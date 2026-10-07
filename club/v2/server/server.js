#!/usr/bin/env node
/* Сервер штаба Eva Club V2 — чтобы выкатить штаб на свой хостинг.
   Без зависимостей: нужен только Node.js 18+.

   Запуск:   node server.js                    — штаб на http://localhost:8080
             PORT=80 node server.js            — другой порт
             EVA_KEY=секрет node server.js     — доступ только по ключу (?key=секрет один раз в адресе)
             node server.js --import backup.json   — загрузить выгрузку из штаба и выйти
             node server.js --export backup.json   — выгрузить данные в файл и выйти

   Данные — один файл data/eva-hq.json того же формата, что «Выгрузить всё»
   в штабе (см. DATA.md), плюс копия на каждый день в data/backups.
   Напоминания гостям в Telegram: TELEGRAM_BOT_TOKEN=… TELEGRAM_BOT_NAME=имя_бота. */

'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');                       // club/v2 — сам штаб
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const FILE = path.join(DATA_DIR, 'eva-hq.json');
const PORT = Number(process.env.PORT || 8080);
const KEY = process.env.EVA_KEY || '';
/* имя бота напоминаний — для ссылок «Старт» в штабе (только буквы, цифры и _) */
const TG_BOT = /^[A-Za-z0-9_]{5,64}$/.test(process.env.TELEGRAM_BOT_NAME || '') ? process.env.TELEGRAM_BOT_NAME : '';
const MAX_BODY = 8 * 1024 * 1024;
const COLS = ['accounts', 'invites', 'people', 'tasks', 'ledger', 'plan', 'sales', 'links', 'docs', 'meetings', 'busy', 'messages'];
const FORMAT = 'eva-hq';

/* ── хранилище: всё в памяти, на диск — с задержкой и атомарно ── */
let db = {format: FORMAT, version: 1, collections: {}};
function load() {
  try { db = normalize(JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
  catch (e) { if (e.code !== 'ENOENT') { console.error('Не прочитал', FILE, e.message); process.exit(1); } }
  COLS.forEach(c => { db.collections[c] = db.collections[c] || {}; });
}
function normalize(j) {
  if (!j || typeof j !== 'object') throw new Error('пустой файл');
  const cols = j.collections || j;   // принимаем и голый {коллекция: {id: doc}}
  const out = {format: FORMAT, version: 1, collections: {}};
  Object.entries(cols).forEach(([c, docs]) => { if (docs && typeof docs === 'object' && !Array.isArray(docs)) out.collections[c] = docs; });
  return out;
}
let saveTimer = null;
function save(now) {
  clearTimeout(saveTimer);
  const run = () => {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
    backup();
  };
  if (now) run(); else saveTimer = setTimeout(run, 300);
}
function backup() {
  const dir = path.join(DATA_DIR, 'backups');
  const day = new Date().toISOString().slice(0, 10);
  const f = path.join(dir, `eva-hq-${day}.json`);
  if (fs.existsSync(f)) return;
  fs.mkdirSync(dir, {recursive: true});
  fs.copyFileSync(FILE, f);
  fs.readdirSync(dir).filter(n => /^eva-hq-\d{4}-\d\d-\d\d\.json$/.test(n)).sort().slice(0, -30).forEach(n => fs.unlinkSync(path.join(dir, n)));
}
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function merge(a, b) {
  const o = isObj(a) ? {...a} : {};
  Object.entries(b || {}).forEach(([k, v]) => { o[k] = isObj(v) && isObj(o[k]) ? merge(o[k], v) : v; });
  return o;
}

/* ── живые обновления: Server-Sent Events ── */
const clients = new Set();
function broadcast(msg) {
  const line = `data: ${JSON.stringify(msg)}\n\n`;
  clients.forEach(res => { try { res.write(line); } catch (e) { clients.delete(res); } });
}
function setDoc(c, id, doc) {
  db.collections[c] = db.collections[c] || {};
  if (doc === null) delete db.collections[c][id]; else db.collections[c][id] = doc;
  save();
  broadcast({col: c, id, doc});
}

/* ── командная строка: перенос данных ── */
const argv = process.argv.slice(2);
if (argv[0] === '--import' && argv[1]) {
  load();
  db = normalize(JSON.parse(fs.readFileSync(argv[1], 'utf8')));
  COLS.forEach(c => { db.collections[c] = db.collections[c] || {}; });
  save(true);
  console.log('Загружено:', Object.entries(db.collections).map(([c, d]) => `${c} ${Object.keys(d).length}`).join(', '));
  process.exit(0);
}
if (argv[0] === '--export' && argv[1]) {
  load();
  fs.writeFileSync(argv[1], JSON.stringify({...db, exportedAt: new Date().toISOString()}, null, 1));
  console.log('Выгружено в', argv[1]);
  process.exit(0);
}

/* ── HTTP ── */
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf'};
const keyOk = req => {
  if (!KEY) return true;
  const u = new URL(req.url, 'http://x');
  const got = req.headers['x-eva-key'] || u.searchParams.get('key') || '';
  const a = Buffer.from(String(got)), b = Buffer.from(KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const json = (res, code, obj) => { res.writeHead(code, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}); res.end(JSON.stringify(obj)); };
function body(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', ch => { size += ch.length; if (size > MAX_BODY) { reject(Object.assign(new Error('слишком большой запрос'), {status: 413})); req.destroy(); } else parts.push(ch); });
    req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : null); } catch (e) { reject(Object.assign(new Error('не JSON'), {status: 400})); } });
    req.on('error', reject);
  });
}
async function api(req, res, p) {
  if (!keyOk(req)) return json(res, 401, {error: 'нужен ключ доступа'});
  if (p === 'state' && req.method === 'GET') return json(res, 200, db);
  if (p === 'export' && req.method === 'GET') {
    res.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="eva-hq-${new Date().toISOString().slice(0, 10)}.json"`});
    return res.end(JSON.stringify({...db, exportedAt: new Date().toISOString()}));
  }
  if (p === 'import' && req.method === 'POST') {
    const j = normalize(await body(req));
    db = j;
    COLS.forEach(c => { db.collections[c] = db.collections[c] || {}; });
    save(true);
    Object.entries(db.collections).forEach(([c, docs]) => broadcast({col: c, reset: true, docs}));
    return json(res, 200, {ok: true});
  }
  if (p === 'events' && req.method === 'GET') {
    res.writeHead(200, {'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no'});
    res.write(': ok\n\n');
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ping); clients.delete(res); });
    return;
  }
  const m = /^doc\/([^/]+)\/([^/]+)$/.exec(p);
  if (m) {
    const c = decodeURIComponent(m[1]), id = decodeURIComponent(m[2]);
    if (!/^[a-z]{2,20}$/.test(c) || !id || id.length > 200) return json(res, 400, {error: 'неверный путь'});
    const cur = (db.collections[c] || {})[id];
    if (req.method === 'PUT') { const b = await body(req); if (!isObj(b)) return json(res, 400, {error: 'нужен объект'}); setDoc(c, id, b); return json(res, 200, {ok: true}); }
    if (req.method === 'PATCH') { if (!cur) return json(res, 404, {error: 'нет документа'}); const next = merge(cur, await body(req)); setDoc(c, id, next); return json(res, 200, {ok: true, doc: next}); }
    if (req.method === 'DELETE') { setDoc(c, id, null); return json(res, 200, {ok: true}); }
  }
  return json(res, 404, {error: 'нет такого адреса'});
}
function serveFile(res, rel) {
  const f = path.resolve(ROOT, rel);
  if (!f.startsWith(ROOT + path.sep) || f.includes(`${path.sep}server${path.sep}`) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('Не найдено'); }
  let data = fs.readFileSync(f);
  if (path.basename(f) === 'index.html') data = Buffer.from(data.toString('utf8').replace('</head>', `<script>window.EVA_API = 'api';${TG_BOT ? ` window.EVA_TG_BOT = '${TG_BOT}';` : ''}</script>\n</head>`));
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache'});
  res.end(data);
}
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    if (u.pathname.startsWith('/api/')) return await api(req, res, u.pathname.slice(5));
    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname).replace(/^\/+/, '');
    serveFile(res, rel);
  } catch (e) {
    json(res, e.status || 500, {error: e.message || 'ошибка'});
  }
});

/* ── напоминания в Telegram ── */
const TG = process.env.TELEGRAM_BOT_TOKEN || '';
function tg(method, params) {
  return new Promise(resolve => {
    const data = JSON.stringify(params || {});
    const r = https.request({host: 'api.telegram.org', path: `/bot${TG}/${method}`, method: 'POST', headers: {'content-type': 'application/json', 'content-length': Buffer.byteLength(data)}}, res => {
      let s = '';
      res.on('data', c => { s += c; });
      res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { resolve({ok: false}); } });
    });
    r.on('error', () => resolve({ok: false}));
    r.setTimeout(40000, () => { r.destroy(); resolve({ok: false}); });
    r.end(data);
  });
}
/* человек нажал «Старт» в боте по ссылке из штаба: t.me/<бот>?start=<payload> */
function linkChat(payload, chatId) {
  const [kind, a, b] = String(payload || '').split('_');
  if (kind === 'g') {                       // гость собрания: g_<meetingId>_<guestId>
    const m = db.collections.meetings[a];
    const g = m && (m.extGuests || []).find(x => x.id === b);
    if (!g) return null;
    g.tgChatId = chatId;
    setDoc('meetings', a, m);
    return `Готово! Напомню о встрече «${m.title}».`;
  }
  if (kind === 'p') {                       // человек из команды: p_<personId>
    const p = db.collections.people[a];
    if (!p) return null;
    setDoc('people', a, {...p, tgChatId: chatId});
    return 'Готово! Буду напоминать о собраниях штаба.';
  }
  return null;
}
async function pollTelegram() {
  let offset = 0;
  for (;;) {
    const r = await tg('getUpdates', {offset, timeout: 30, allowed_updates: ['message']});
    if (!r.ok) { await new Promise(x => setTimeout(x, 5000)); continue; }
    for (const u of r.result || []) {
      offset = u.update_id + 1;
      const msg = u.message;
      const m = msg && /^\/start\s+(\S+)/.exec(msg.text || '');
      if (!m) continue;
      const reply = linkChat(m[1], msg.chat.id);
      await tg('sendMessage', {chat_id: msg.chat.id, text: reply || 'Ссылка устарела — попросите новую у организатора.'});
    }
  }
}
const mskMs = (date, hm) => Date.parse(`${date}T${hm}:00+03:00`);
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* ближайшее вхождение собрания (с повторами) */
function nextOccurrence(m, now) {
  if (!m.date || !m.start) return null;
  const step = m.repeat === 'weekly' ? 7 : m.repeat === 'biweekly' ? 14 : 0;
  let d = m.date;
  if (step) while (mskMs(d, m.start) + (Number(m.dur) || 60) * 60e3 < now && (!m.until || d <= m.until)) d = addDays(d, step);
  if (m.until && d > m.until) return null;
  return {date: d, at: mskMs(d, m.start)};
}
async function remindLoop() {
  const now = Date.now();
  for (const [id, m] of Object.entries(db.collections.meetings || {})) {
    const o = nextOccurrence(m, now);
    if (!o) continue;
    /* «Не напоминать» — 0; не указано — за час */
    const min = m.remindMin === undefined || m.remindMin === null || m.remindMin === '' ? 60 : Number(m.remindMin) || 0;
    const lead = min * 60e3;
    if (!lead || o.at - now > lead || o.at < now) continue;
    const key = o.date;
    m.tgReminded = m.tgReminded || {};
    if (m.tgReminded[key]) continue;
    const text = `Напоминание: «${m.title}» в ${m.start} по Москве${m.meetUrl ? `\nСсылка: ${m.meetUrl}` : ''}`;
    const chats = [
      ...(m.extGuests || []).map(g => g.tgChatId),
      ...[m.organizer, ...(m.attendees || [])].map(pid => (db.collections.people[pid] || {}).tgChatId),
    ].filter(Boolean);
    for (const chat of [...new Set(chats)]) await tg('sendMessage', {chat_id: chat, text});
    m.tgReminded[key] = now;
    setDoc('meetings', id, m);
  }
}

load();
server.listen(PORT, () => {
  console.log(`Штаб Eva Club: http://localhost:${PORT}${KEY ? ' (доступ по ключу)' : ''}`);
  console.log(`Данные: ${FILE}`);
  if (TG) { pollTelegram(); setInterval(remindLoop, 60e3); console.log('Напоминания в Telegram включены'); }
});
