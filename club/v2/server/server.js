#!/usr/bin/env node
/* Сервер штаба Eva Club V2 и Eva CRM — чтобы оба жили на своём хостинге.
   Без зависимостей: нужен только Node.js 18+.

   Что делает:
   • раздаёт штаб (/) и CRM (/crm/), анкету CRM (/anketa/) — её видят без входа;
   • вход по почте и паролю проверяет сам: пароли и их отпечатки в браузер
     не уходят, без входа сервер не отдаёт ни одной записи;
   • каждой роли отдаёт только её данные и не принимает чужие правки
     (lib/hq-rules.js, lib/crm-rules.js);
   • живые правки коллег — поток событий (Server-Sent Events);
   • Google Календарь — от имени вошедшего человека (lib/gcal.js).

   Запуск:   node server.js                         — http://localhost:8080
             PORT=3000 node server.js               — другой порт
             LISTEN=/run/eva/web.sock node server.js — unix-сокет (за Caddy / nginx)
             node server.js --import файл.json      — загрузить выгрузку штаба и выйти
             node server.js --import-crm файл.json  — загрузить выгрузку CRM и выйти
             node server.js --export файл.json      — выгрузить штаб (--export-crm — CRM)
             node server.js --invite роль [id человека из «Команды»] — выдать приглашение и выйти
                                                    (роль: owner, lead, finance, member, investor)

   Команды с файлами и приглашением запускайте, пока сервер остановлен: работающий
   сервер держит данные в памяти и перезапишет файл своим состоянием.

   Настройки (переменные окружения):
     DATA_DIR       где лежат данные (по умолчанию ./data): eva-hq.json, eva-crm.json,
                    sessions.json, gcal.json и копии на каждый день в backups/
     PUBLIC_URL     адрес сайта, например https://eva.example.ru — для ссылок и Google
     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — ключи Google для календаря
     CRM_DIR        папка собранной CRM (по умолчанию ../../../crm/v2)
     MATERIALS_DIR  папка с презентациями m/*.html (по умолчанию ../m)
     INSECURE_COOKIE=1 — для проверки на своём компьютере без HTTPS */

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const {JsonStore, merge, isObj} = require('./lib/store');
const A = require('./lib/auth');
const HQ = require('./lib/hq-rules');
const CRM = require('./lib/crm-rules');
const {Gcal} = require('./lib/gcal');

const HQ_DIR = path.resolve(__dirname, '..');                       // club/v2 — сам штаб
const CRM_DIR = path.resolve(process.env.CRM_DIR || path.join(__dirname, '..', '..', '..', 'crm', 'v2'));
const MATERIALS_DIR = path.resolve(process.env.MATERIALS_DIR || path.join(HQ_DIR, 'm'));
const VERSION_FILE = path.resolve(process.env.VERSION_FILE || path.join(HQ_DIR, '..', '..', 'version.json'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PORT = Number(process.env.PORT || 8080);
const LISTEN = process.env.LISTEN || '';
const PUBLIC_URL = String(process.env.PUBLIC_URL || '').replace(/\/$/, '');
const SECURE = !process.env.INSECURE_COOKIE;
const COOKIE = 'eva_sid';
const MAX_BODY = 8 * 1024 * 1024;

const hq = {name: 'hq', rules: HQ, store: new JsonStore({file: path.join(DATA_DIR, 'eva-hq.json'), cols: HQ.COLS, format: 'eva-hq'})};
const crm = {name: 'crm', rules: CRM, store: new JsonStore({file: path.join(DATA_DIR, 'eva-crm.json'), cols: CRM.COLS, format: 'eva-crm'})};

/* ── командная строка: перенос данных ── */
const argv = process.argv.slice(2);
const cli = {'--import': [hq, 'in'], '--import-crm': [crm, 'in'], '--export': [hq, 'out'], '--export-crm': [crm, 'out']}[argv[0]];
if (cli && argv[1]) {
  const [app, dir] = cli;
  app.store.load();
  if (dir === 'in') {
    app.store.replace(JSON.parse(fs.readFileSync(argv[1], 'utf8')));
    console.log('Загружено:', Object.entries(app.store.db.collections).map(([c, d]) => `${c} ${Object.keys(d).length}`).join(', '));
  } else {
    fs.writeFileSync(argv[1], JSON.stringify(app.store.export(), null, 1), {mode: 0o600});
    console.log('Выгружено в', argv[1]);
  }
  process.exit(0);
}

if (argv[0] === '--invite') {
  hq.store.load();
  const role = argv[1], pid = argv[2] || null;
  if (!HQ.ROLES.includes(role)) { console.error('Роль — одна из:', HQ.ROLES.join(', ')); process.exit(1); }
  if (pid && !hq.store.get('people', pid)) { console.error('В «Команде» нет человека с id', pid); process.exit(1); }
  const code = A.makeCode();
  hq.store.set('invites', code, {role, personId: pid, by: null, at: Date.now()});
  hq.store.flush();
  console.log(`Приглашение ${code} (роль ${role}${pid ? ', карточка ' + pid : ''}): ${PUBLIC_URL || 'адрес-штаба'}/#join=${code}`);
  process.exit(0);
}

hq.store.load();
crm.store.load();
const sessions = new A.Sessions(path.join(DATA_DIR, 'sessions.json'));
const limiter = new A.Limiter();
const gcal = new Gcal({file: path.join(DATA_DIR, 'gcal.json'), clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, publicUrl: PUBLIC_URL});

/* ── кто пришёл ── */
function ctxFor(accId, token) {
  const acc = accId ? hq.store.get('accounts', accId) : null;
  if (!acc || acc.active === false) return null;
  const role = HQ.roleOf(acc.role);
  /* в CRM — вся команда, кроме инвесторов (как пункт «CRM» в меню штаба) */
  const crmAccess = HQ.can(role, 'tasks.view');
  return {accId, token, role, personId: acc.personId || null, name: acc.name || '', crmAccess,
    crmRole: crmAccess ? CRM.crmRole(crm.store, accId, role === 'owner') : null};
}
function ctxOf(req) {
  const token = A.readCookie(req, COOKIE);
  const s = sessions.get(token);
  return s ? ctxFor(s.acc, token) : null;
}
const cookie = (token, maxAge) => `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;
function startSession(res, accId) {
  const token = sessions.create(accId);
  res.setHeader('set-cookie', cookie(token, 30 * 86400));
  hq.store.patch('accounts', accId, {lastSeen: Date.now()});
  return token;
}
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

/* ── ответы ── */
const json = (res, code, obj) => { res.writeHead(code, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); res.end(JSON.stringify(obj)); };
const err = (status, message, extra) => Object.assign(new Error(message), {status, ...(extra || {})});
function body(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', ch => { size += ch.length; if (size > MAX_BODY) { reject(err(413, 'слишком большой запрос')); req.destroy(); } else parts.push(ch); });
    /* поле «__proto__» в записях не нужно никому, а вреда наделать может — выбрасываем при чтении */
    req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8'), (k, v) => (k === '__proto__' ? undefined : v)) : null); } catch (e) { reject(err(400, 'не JSON')); } });
    req.on('error', reject);
  });
}
/* запись — только со своей страницы: чужой сайт не может ни поставить этот заголовок, ни прислать cookie */
function sameSite(req) {
  if (req.headers['x-eva'] !== '1') return false;
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host || (!!PUBLIC_URL && o === PUBLIC_URL); } catch (e) { return false; }
}

/* ── что отдаём человеку ── */
function stateOf(app, ctx) {
  const out = {};
  app.rules.COLS.forEach(c => {
    const o = {};
    for (const [id, d] of Object.entries(app.store.col(c))) { const v = app.rules.view(ctx, c, id, d); if (v) o[id] = v; }
    out[c] = o;
  });
  return out;
}
/* до входа: только то, без чего не открыть анкету приглашения или смену пароля по ссылке */
async function peek(q) {
  const cols = {};
  const join = A.normCode(q.get('join') || '');
  const inv = join ? hq.store.get('invites', join) : null;
  if (inv) {
    cols.invites = {[join]: inv.usedBy ? {usedBy: true} : {role: inv.role, personId: inv.personId || null, title: inv.title || '', dir: inv.dir || '', by: inv.by || null}};
    if (!inv.usedBy) {
      const p = inv.personId ? hq.store.get('people', inv.personId) : null;
      const card = ['name', 'givenName', 'surname', 'title', 'dir', 'email', 'phone', 'telegram', 'birthDate', 'birthTime', 'birthCity', 'hdType', 'hdProfile', 'status'];
      cols.people = {};
      if (p) cols.people[inv.personId] = Object.fromEntries(card.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
      /* кто пригласил — только имя */
      const by = inv.by ? hq.store.get('accounts', inv.by) : null;
      if (by) {
        cols.accounts = {[inv.by]: {name: by.name, personId: by.personId || null, role: by.role}};
        const bp = by.personId ? hq.store.get('people', by.personId) : null;
        if (bp && !cols.people[by.personId]) cols.people[by.personId] = {name: bp.name, givenName: bp.givenName, surname: bp.surname, title: bp.title};
      }
    }
  }
  const [rid, rcode] = String(q.get('reset') || '').split('.');
  const racc = rid ? hq.store.get('accounts', rid) : null;
  if (racc && racc.reset && racc.reset.exp > Date.now() && racc.active !== false && await A.verify(A.normCode(rcode), racc.reset.salt, racc.reset.hash)) {
    cols.accounts = {...(cols.accounts || {}), [rid]: {name: racc.name, email: racc.email, reset: {exp: racc.reset.exp}}};
  }
  return cols;
}

/* ── живые обновления ── */
const clients = new Set();   // {res, accId, app}
const send = (cl, msg) => { try { cl.res.write(`data: ${JSON.stringify(msg)}\n\n`); } catch (e) { clients.delete(cl); } };
function relay(app, ev) {
  for (const cl of clients) {
    if (cl.app !== app) continue;
    if (ev.reset) { send(cl, {reload: true}); continue; }
    const ctx = ctxFor(cl.accId);
    if (!ctx || (app === crm && !ctx.crmAccess)) { send(cl, {reload: true}); continue; }
    const was = app.rules.view(ctx, ev.col, ev.id, ev.prev), now = app.rules.view(ctx, ev.col, ev.id, ev.doc);
    if (was || now) send(cl, {col: ev.col, id: ev.id, doc: now, rev: ev.rev});
  }
}
hq.store.on(ev => {
  relay(hq, ev);
  if (ev.reset || ev.col !== 'accounts') return;
  /* сменили роль или отключили вход — человеку нужны другие данные: его страницы перезагрузятся сами */
  const was = ev.prev || {}, now = ev.doc || {};
  if (!ev.doc || was.role !== now.role || (was.active !== false) !== (now.active !== false) || was.personId !== now.personId) {
    if (!ev.doc || now.active === false) sessions.dropFor(ev.id);
    for (const cl of clients) if (cl.accId === ev.id) send(cl, {reload: true});
  }
});
crm.store.on(ev => relay(crm, ev));

/* ── учётки: вход, приглашение, сброс пароля ── */
const fail = (message, status = 400) => err(status, message);
function findByEmail(email) {
  const e = A.normEmail(email);
  return hq.store.list('accounts').find(a => A.normEmail(a.email) === e) || null;
}
async function newAccount({name, email, pw, role, personId, welcomed}) {
  if (!String(name || '').trim()) throw fail('Напишите имя и фамилию.');
  if (!/^\S+@\S+\.\S+$/.test(String(email || '').trim())) throw fail('Почта выглядит неправильно.');
  if (String(pw || '').length < 6) throw fail('Пароль — не короче 6 символов.');
  if (findByEmail(email)) throw fail('Эта почта уже зарегистрирована — просто войдите.');
  const salt = A.newSalt();
  const acc = {name: String(name).trim(), email: A.normEmail(email), role, personId: personId || null,
    salt, hash: await A.hashPassword(pw, salt), active: true, createdAt: Date.now(), lastSeen: Date.now()};
  if (welcomed === false) acc.welcomed = false;
  const id = A.uid();
  hq.store.set('accounts', id, acc);
  return id;
}
const joinName = (given, surname) => [given, surname].map(x => String(x || '').trim()).filter(Boolean).join(' ');

const auth = {
  async login(req, res, b) {
    const email = A.normEmail(b.email), key = ipOf(req) + '|' + email;
    const wait = limiter.blocked(key) || limiter.blocked(ipOf(req));
    if (wait) throw fail(`Слишком много попыток. Попробуйте через ${wait} мин.`, 429);
    const acc = findByEmail(email);
    const ok = acc ? await A.verify(String(b.pw || ''), acc.salt, acc.hash) : (await A.hashPassword(String(b.pw || ''), 'x'), false);
    if (!acc || !ok) {
      limiter.fail(key);
      /* один и тот же ответ на «нет такой почты» и «не тот пароль» — чтобы почты нельзя было перебирать */
      throw fail('Почта или пароль не подошли. Проверьте раскладку; если вас пригласили — откройте ссылку из приглашения.', 401);
    }
    if (acc.active === false) throw fail('Учётка отключена. Напишите основателю.', 403);
    limiter.ok(key);
    if (ok === 'weak') { const salt = A.newSalt(); hq.store.patch('accounts', acc.id, {salt, hash: await A.hashPassword(b.pw, salt)}); }
    startSession(res, acc.id);
    return {ok: true, me: acc.id};
  },
  async logout(req, res) {
    sessions.drop(A.readCookie(req, COOKIE));
    res.setHeader('set-cookie', cookie('', 0));
    return {ok: true};
  },
  /* первый вход в пустой штаб — учётка основателя и его карточка в команде */
  async owner(req, res, b) {
    if (hq.store.count('accounts')) throw fail('Штаб уже создан — войдите своей почтой.');
    let pid = (hq.store.list('people').find(p => p.founder) || {}).id;
    if (!pid) { pid = A.uid(); hq.store.set('people', pid, {name: String(b.name || '').trim(), title: 'Основатель', dir: 'ops', founder: true, order: 0}); }
    const id = await newAccount({name: b.name, email: b.email, pw: b.pw, role: 'owner', personId: pid});
    if (!hq.store.get('people', pid).name) hq.store.patch('people', pid, {name: String(b.name).trim()});
    startSession(res, id);
    return {ok: true, me: id};
  },
  /* регистрация по приглашению: анкета ложится в карточку человека в «Команде» */
  async join(req, res, b) {
    const wait = limiter.blocked('join|' + ipOf(req));
    if (wait) throw fail(`Слишком много попыток. Попробуйте через ${wait} мин.`, 429);
    const code = A.normCode(b.code);
    const inv = hq.store.get('invites', code);
    if (!inv || inv.usedBy) { limiter.fail('join|' + ipOf(req)); throw fail('Приглашение не найдено или уже использовано. Попросите у основателя новую ссылку.'); }
    const given = String(b.given || '').trim(), surname = String(b.surname || '').trim();
    if (!given) throw fail('Напишите имя.');
    if (!surname) throw fail('Напишите фамилию.');
    if (b.birthDate && !/^\d{4}-\d\d-\d\d$/.test(b.birthDate)) throw fail('Дата рождения выглядит неправильно.');
    const name = joinName(given, surname);
    let pid = inv.personId;
    const fresh = !pid || !hq.store.get('people', pid);
    if (fresh) pid = A.uid();
    /* сначала учётка: если почта занята или пароль короткий — карточку не трогаем */
    const id = await newAccount({name, email: b.email, pw: b.pw, role: HQ.roleOf(inv.role), personId: pid, welcomed: false});
    if (fresh) hq.store.set('people', pid, {name, title: inv.title || '', dir: inv.dir || '', order: 50});
    const p = hq.store.get('people', pid) || {};
    const card = {name, givenName: given, surname, email: A.normEmail(b.email), joinedAt: Date.now()};
    ['title', 'dir', 'phone', 'telegram', 'birthDate', 'birthTime', 'birthCity', 'hdType', 'hdProfile'].forEach(k => { if (b[k] !== undefined) card[k] = String(b[k] || '').trim().slice(0, 300); });
    if (p.status === 'vacancy') card.status = 'active';
    hq.store.patch('people', pid, card);
    hq.store.patch('invites', code, {usedBy: id, usedAt: Date.now()});
    /* строка команды CRM, заведённая на эту карточку заранее (team.person), становится строкой этой учётки */
    crm.store.list('team').filter(t => t.person === pid && !t.uid && !t.archived).forEach(t => crm.store.patch('team', t.id, {uid: id}));
    startSession(res, id);
    return {ok: true, me: id};
  },
  /* новый пароль по ссылке или коду от основателя (действует сутки, один раз) */
  async reset(req, res, b) {
    const acc = b.accId ? hq.store.get('accounts', String(b.accId)) && {...hq.store.get('accounts', String(b.accId)), id: String(b.accId)} : findByEmail(b.email);
    const key = 'reset|' + ipOf(req);
    const wait = limiter.blocked(key);
    if (wait) throw fail(`Слишком много попыток. Попробуйте через ${wait} мин.`, 429);
    const r = acc && acc.reset;
    if (!r || r.exp < Date.now() || acc.active === false || !(await A.verify(A.normCode(b.code), r.salt, r.hash))) {
      limiter.fail(key);
      throw fail('Ссылка или код для смены пароля не подходят или устарели. Попросите у основателя новые.');
    }
    if (String(b.pw || '').length < 6) throw fail('Пароль — не короче 6 символов.');
    const salt = A.newSalt();
    hq.store.patch('accounts', acc.id, {salt, hash: await A.hashPassword(b.pw, salt), reset: null});
    sessions.dropFor(acc.id);
    startSession(res, acc.id);
    return {ok: true, me: acc.id};
  },
  /* основатель выдаёт код сброса пароля */
  async 'issue-reset'(req, res, b, ctx) {
    if (!ctx || ctx.role !== 'owner') throw fail('Сброс пароля выдаёт основатель.', 403);
    if (!hq.store.get('accounts', String(b.accId || ''))) throw fail('Нет такой учётки.', 404);
    const code = A.makeCode(), salt = A.newSalt();
    hq.store.patch('accounts', String(b.accId), {reset: {salt, hash: await A.hashPassword(A.normCode(code), salt), exp: Date.now() + 864e5}});
    return {ok: true, code};
  },
  /* свой пароль — на своей странице, по текущему */
  async password(req, res, b, ctx) {
    if (!ctx) throw fail('Войдите заново.', 401);
    const acc = hq.store.get('accounts', ctx.accId);
    const key = 'pw|' + ctx.accId;
    if (limiter.blocked(key)) throw fail('Слишком много попыток. Попробуйте позже.', 429);
    if (!(await A.verify(String(b.old || ''), acc.salt, acc.hash))) { limiter.fail(key); throw fail('Текущий пароль не подошёл'); }
    if (String(b.pw || '').length < 6) throw fail('Новый пароль — не короче 6 символов');
    const salt = A.newSalt();
    hq.store.patch('accounts', ctx.accId, {salt, hash: await A.hashPassword(b.pw, salt)});
    /* остальные устройства выходят, это — остаётся */
    sessions.dropFor(ctx.accId, ctx.token);
    return {ok: true};
  },
};

/* ── записи ── */
async function docApi(app, req, res, ctx, c, id) {
  if (!app.store.has(c) || !id || id.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(id)) return json(res, 400, {error: 'неверный путь'});
  const cur = app.store.get(c, id);
  const op = {PUT: 'put', PATCH: 'patch', DELETE: 'delete'}[req.method];
  if (!op) return json(res, 405, {error: 'так нельзя'});
  let b = null, next = null;
  if (op !== 'delete') {
    b = await body(req);
    if (!isObj(b)) return json(res, 400, {error: 'нужен объект'});
    if (op === 'patch' && !cur) return json(res, 404, {error: 'нет документа'});
    next = app.rules.keepHidden(ctx, c, id, cur, op === 'patch' ? merge(cur, b) : b);
  }
  const verdict = app.rules.write(ctx, op, c, id, cur, b, next, app.store);
  if (!verdict.ok) return json(res, 403, {error: verdict.why});
  app.store.set(c, id, op === 'delete' ? null : verdict.next);
  return json(res, 200, {ok: true, rev: app.store.rev, doc: op === 'delete' ? null : app.rules.view(ctx, c, id, verdict.next)});
}

function events(app, req, res, ctx) {
  res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no'});
  res.write(': ok\n\n');
  const cl = {res, accId: ctx.accId, app};
  clients.add(cl);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) { /* закроется само */ } }, 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(cl); });
}

async function hqApi(req, res, p, u) {
  const ctx = ctxOf(req);
  const write = req.method !== 'GET';
  if (write && !sameSite(req)) return json(res, 403, {error: 'запрос не со страницы штаба'});

  if (p === 'state' && !write) {
    return json(res, 200, {me: ctx ? ctx.accId : null, empty: !hq.store.count('accounts'), collections: ctx ? stateOf(hq, ctx) : await peek(u.searchParams)});
  }
  if (p === 'peek' && !write) {
    const k = 'peek|' + ipOf(req);
    if (limiter.blocked(k)) return json(res, 429, {error: 'Слишком много попыток. Попробуйте позже.'});
    const cols = await peek(u.searchParams);
    if (!Object.keys(cols).length) limiter.fail(k);
    return json(res, 200, {collections: cols});
  }
  const am = /^auth\/([a-z-]+)$/.exec(p);
  if (am && req.method === 'POST' && auth[am[1]]) return json(res, 200, await auth[am[1]](req, res, (await body(req)) || {}, ctx));

  /* календарь: возврат из Google приходит обычным переходом, без заголовков страницы */
  if (p === 'gcal/callback' && !write) {
    let back = '/';
    try {
      if (u.searchParams.get('error')) throw new Error('отказ');
      const done = await gcal.finish(u.searchParams.get('state'), u.searchParams.get('code'));
      back = done.back + (done.back.includes('?') ? '&' : '?') + 'gcal=ok';
    } catch (e) { back = '/?gcal=fail'; }
    res.writeHead(302, {location: back + '#calendar', 'cache-control': 'no-store'});
    return res.end();
  }

  if (!ctx) return json(res, 401, {error: 'нужно войти'});

  if (p === 'events' && !write) return events(hq, req, res, ctx);
  if (p === 'gcal/status' && !write) return json(res, 200, gcal.status(ctx.accId));
  if (p === 'gcal/connect' && !write) {
    if (!gcal.configured) return json(res, 503, {error: 'Google Календарь на сервере не настроен'});
    const back = u.searchParams.get('back') === 'crm' ? '/crm/' : '/';
    res.writeHead(302, {location: gcal.authUrl(ctx.accId, back), 'cache-control': 'no-store'});
    return res.end();
  }
  if (p === 'gcal/disconnect' && req.method === 'POST') { await gcal.disconnect(ctx.accId); return json(res, 200, {ok: true}); }
  if (p === 'gcal/tool' && req.method === 'POST') {
    if (!ctx.crmAccess) return json(res, 403, {error: 'календарь — для команды', code: 'blocked_by_policy'});
    const b = (await body(req)) || {};
    try { return json(res, 200, {payload: await gcal.call(ctx.accId, String(b.tool || ''), b.input)}); }
    catch (e) { return json(res, 200, {error: e.message || 'ошибка', code: e.code || 'upstream_error', retryable: !!e.retryable, retryAfterMs: e.retryAfterMs}); }
  }

  if (p === 'export' && !write) {
    if (ctx.role !== 'owner') return json(res, 403, {error: 'полную выгрузку делает основатель'});
    const j = hq.store.export();
    if (u.searchParams.get('secrets') !== '1') { j.collections = {...j.collections}; delete j.collections.accounts; delete j.collections.invites; }
    j.source = 'server';
    res.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
    return res.end(JSON.stringify(j));
  }
  if (p === 'import' && req.method === 'POST') {
    if (ctx.role !== 'owner') return json(res, 403, {error: 'загружать данные может основатель'});
    const j = await body(req), mode = u.searchParams.get('mode') === 'replace' ? 'replace' : 'merge';
    const inc = hq.store.normalize(j);
    /* тот, кто загружает, не должен остаться без входа и без прав основателя */
    const me = hq.store.get('accounts', ctx.accId);
    if (inc.collections.accounts) inc.collections.accounts[ctx.accId] = me;
    hq.store.replace(inc, mode);
    return json(res, 200, {ok: true, n: Object.values(inc.collections).reduce((a, d) => a + Object.keys(d).length, 0)});
  }
  const m = /^doc\/([a-z]{2,20})\/([^/]+)$/.exec(p);
  if (m) return docApi(hq, req, res, ctx, decodeURIComponent(m[1]), decodeURIComponent(m[2]));
  return json(res, 404, {error: 'нет такого адреса'});
}

async function crmApi(req, res, p, u) {
  const ctx = ctxOf(req);
  const write = req.method !== 'GET';
  if (write && !sameSite(req)) return json(res, 403, {error: 'запрос не со страницы CRM'});
  if (!ctx) return json(res, 401, {error: 'нужно войти'});
  if (!ctx.crmAccess) return json(res, 403, {error: 'CRM — для команды'});
  if (p === 'state' && !write) return json(res, 200, {me: ctx.accId, owner: ctx.role === 'owner', crmRole: ctx.crmRole, collections: stateOf(crm, ctx)});
  if (p === 'events' && !write) return events(crm, req, res, ctx);
  /* имена для строк команды: в артефакте их давал профиль Claude, здесь — учётки штаба */
  if (p === 'profiles' && !write) {
    const out = {};
    hq.store.list('accounts').forEach(a => { const pp = a.personId ? hq.store.get('people', a.personId) : null; out[a.id] = {name: (pp && pp.name) || a.name || ''}; });
    return json(res, 200, out);
  }
  if (p === 'export' && !write) {
    if (ctx.crmRole !== 'owner') return json(res, 403, {error: 'выгрузку делает руководитель'});
    res.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
    return res.end(JSON.stringify(crm.store.export()));
  }
  const m = /^doc\/([a-z]{2,20})\/([^/]+)$/.exec(p);
  if (m) return docApi(crm, req, res, ctx, decodeURIComponent(m[1]), decodeURIComponent(m[2]));
  return json(res, 404, {error: 'нет такого адреса'});
}

/* ── страницы ── */
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8'};
const HEADERS = {'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'x-frame-options': 'SAMEORIGIN'};
function file(res, f, {inject, cache = 'no-cache', headers = {}} = {}) {
  let data;
  try { data = fs.readFileSync(f); } catch (e) { res.writeHead(404, {'content-type': 'text/plain; charset=utf-8'}); return res.end('Не найдено'); }
  if (inject) data = Buffer.from(data.toString('utf8').replace('</head>', inject + '\n</head>'));
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': cache, ...HEADERS, ...headers});
  res.end(data);
}
const boot = app => `<script>window.EVA = ${JSON.stringify({app, api: app === 'crm' ? '/crm/api' : '/api', hq: '/', crm: '/crm/'})}; window.EVA_API = window.EVA.api;</script>\n<script src="/eva-server.js"></script>`;
/* кому какие презентации: как в src/app/60-materials.js */
const TEAM = ['owner', 'lead', 'finance', 'member'];
const MATERIALS = {standards: TEAM, team: TEAM, speech: TEAM, experts: TEAM, 'experts-partners': TEAM, investor: HQ.ROLES, pitch: HQ.ROLES};

function page(req, res, u) {
  const p = decodeURIComponent(u.pathname);
  if (p === '/' || p === '/index.html') return file(res, path.join(HQ_DIR, 'index.html'), {inject: boot('hq')});
  if (p === '/eva-club-v2.html') return file(res, path.join(HQ_DIR, 'eva-club-v2.html'));
  if (p === '/eva-server.js') return file(res, path.join(__dirname, 'public', 'eva-server.js'));
  if (p === '/healthz') { res.writeHead(200, {'content-type': 'text/plain'}); return res.end('ok'); }
  /* какая правка сейчас стоит и не отказался ли сервер ставить следующую (пишет deploy/autodeploy) */
  if (p === '/version.json') return file(res, VERSION_FILE);
  const mm = /^\/m\/([a-z-]+)\.html$/.exec(p);
  if (mm) {
    const ctx = ctxOf(req);
    if (!ctx || !(MATERIALS[mm[1]] || []).includes(ctx.role)) { res.writeHead(ctx ? 403 : 401, {'content-type': 'text/plain; charset=utf-8'}); return res.end('Материал закрыт'); }
    return file(res, path.join(MATERIALS_DIR, mm[1] + '.html'), {cache: 'private, max-age=3600', headers: {'content-security-policy': 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox'}});
  }
  /* анкета CRM — открыта всем: её заполняют клиентки, данных с сервера она не получает */
  if (p === '/anketa') { res.writeHead(301, {location: '/anketa/'}); return res.end(); }
  if (p === '/anketa/') return file(res, path.join(CRM_DIR, 'a', 'index.html'));
  if (p === '/anketa.html') return file(res, path.join(CRM_DIR, 'anketa.html'));
  if (p === '/crm') { res.writeHead(301, {location: '/crm/'}); return res.end(); }
  if (p === '/crm/' || p === '/crm/index.html') {
    const ctx = ctxOf(req);
    /* без входа — на экран входа штаба; вернёмся сюда же (часть адреса после # браузер сохранит сам) */
    if (!ctx) { res.writeHead(302, {location: '/?next=crm', 'cache-control': 'no-store'}); return res.end(); }
    if (!ctx.crmAccess) { res.writeHead(403, {'content-type': 'text/html; charset=utf-8'}); return res.end('<meta charset="utf-8"><p style="font:16px sans-serif;margin:15vh auto;max-width:420px;text-align:center">Eva CRM открыта только команде.<br><br><a href="/">В штаб</a></p>'); }
    return file(res, path.join(CRM_DIR, 'index.html'), {inject: boot('crm')});
  }
  if (p === '/crm/eva-crm-v2.html') return file(res, path.join(CRM_DIR, 'eva-crm-v2.html'));
  res.writeHead(404, {'content-type': 'text/plain; charset=utf-8'});
  res.end('Не найдено');
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/crm/api/')) return await crmApi(req, res, u.pathname.slice(9), u);
    if (u.pathname.startsWith('/api/')) return await hqApi(req, res, u.pathname.slice(5), u);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    page(req, res, u);
  } catch (e) {
    if (!e.status) console.error(new Date().toISOString(), req.method, req.url, e);
    if (res.headersSent) { try { res.end(); } catch (x) { /* уже закрыт */ } return; }
    json(res, e.status || 500, {error: e.status ? e.message : 'ошибка сервера'});
  }
});

function stop() {
  hq.store.flush();
  crm.store.flush();
  sessions.save(true);
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
setInterval(() => sessions.sweep(), 6 * 3600e3).unref();

if (LISTEN) {
  try { fs.unlinkSync(LISTEN); } catch (e) { /* сокета ещё нет */ }
  server.listen(LISTEN, () => { fs.chmodSync(LISTEN, 0o666); console.log(`Штаб и CRM слушают сокет ${LISTEN} · данные: ${DATA_DIR} · Google Календарь ${gcal.configured ? 'настроен' : 'не настроен'}`); });
} else {
  server.listen(PORT, () => console.log(`Штаб: http://localhost:${PORT}/ · CRM: http://localhost:${PORT}/crm/ · данные: ${DATA_DIR}${gcal.configured ? '' : ' · Google Календарь не настроен'}`));
}
