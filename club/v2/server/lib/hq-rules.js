/* Права штаба на сервере: кто какую запись получает и кто что может менять.
   Роли и права — те же, что в src/app/01-config.js: там они решают, что
   показать на экране, здесь — что вообще уходит в браузер и что сервер
   согласится записать. Поменяли права в одном месте — поменяйте в другом. */

'use strict';
const {isObj} = require('./store');
const Flow = require('./flow');

const COLS = ['accounts', 'invites', 'people', 'tasks', 'ledger', 'plan', 'sales', 'links', 'docs', 'meetings', 'busy', 'messages',
  'subs', 'payouts', 'courses', 'orders', 'products', 'failed', 'refunds', 'scenarios', 'protocols', 'yasen', 'files',
  'fundreqs', 'budgets', 'ideas'];
/* файл к задаче (скриншот, документ) — до 5 МБ; в браузер уходит без содержимого, сам файл — по /api/file/<id> */
const FILE_MAX = 5 * 1024 * 1024;
const FILE_DATA = /^data:[\w.+-]+\/[\w.+-]+(;[\w.+=-]+)*;base64,[A-Za-z0-9+/=]*$/;
const ROLES = ['owner', 'lead', 'finance', 'member', 'investor'];
const roleOf = r => (ROLES.includes(r) ? r : 'member');
const PERMS = {
  'tasks.view':     ['owner', 'lead', 'finance', 'member'],
  'tasks.manage':   ['owner', 'lead', 'finance'],
  'money.view':     ['owner', 'lead', 'finance', 'investor'],
  'money.edit':     ['owner', 'lead', 'finance'],
  'payroll.view':   ['owner', 'finance'],
  'fin.ops':        ['owner', 'lead', 'finance'],
  'sales.edit':     ['owner', 'lead', 'finance', 'member'],
  'strategy.check': ['owner', 'lead', 'finance'],
  'proto.edit':     ['owner', 'lead', 'finance'],
};
/* протоколы и собрания по уровням: 1 — основатели, 2 — и инвесторы, 3 — все участники */
const LEVEL_ROLES = {1: ['owner', 'lead', 'finance'], 2: ['owner', 'lead', 'finance', 'investor'], 3: ROLES};
const levelOf = d => (LEVEL_ROLES[Number(d && d.level)] ? Number(d.level) : 1);
const seesLevel = (role, d) => LEVEL_ROLES[levelOf(d)].includes(role);
/* собрание без уровня — как раньше, для всей команды */
const meetHidden = (role, d) => !!d && Number(d.level) === 1 && !can(role, 'proto.edit');
const can = (role, perm) => (PERMS[perm] || []).includes(role);

const omit = (o, keys) => { const out = {...o}; keys.forEach(k => { delete out[k]; }); return out; };
/* в протоколе: ссылки на файлы записи у Зума — их знает и ведёт только сервер, смотрят запись через /api/zoom/video */
const PROTO_SERVER = ['recSrc'];
/* пароль и всё, по чему его можно подобрать или сбросить, — никогда не уходит в браузер */
const ACC_SECRET = ['salt', 'hash', 'reset'];
/* что человек может поправить в своей учётке сам */
const ACC_SELF = ['prefs', 'welcomed', 'welcomedAt', 'lastSeen'];
/* что в учётке меняет только основатель */
const ACC_OWNER = [...ACC_SELF, 'role', 'active', 'name', 'email', 'personId'];
/* поля карточки, которые человек не меняет себе сам; tgChatId и tgLinked пишет бот штаба (lib/tg.js) */
const PERSON_LOCKED = ['salary', 'startMonth', 'rate', 'status', 'archived', 'founder', 'managerId', 'order', 'tgChatId', 'tgLinked'];
/* данные клиентов в финансовых записях — инвестору идут только суммы */
const CLIENT_FIELDS = ['client', 'customer', 'contact', 'address', 'comment', 'note', 'log', 'track', 'to', 'who', 'decision'];
/* инвестор команду не ведёт: ему от карточки и учётки — только кто это, без контактов и личного */
const PERSON_PUBLIC = ['name', 'givenName', 'surname', 'title', 'dir', 'status', 'order', 'founder', 'archived'];
const ACC_PUBLIC = ['name', 'role', 'personId', 'active'];
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
/* настройки денег — тем, кто денег не видит, не нужны */
const SETTINGS_MONEY = ['cashStart', 'cashDate', 'invest', 'rates'];

const dmHas = (ch, accId) => String(ch).startsWith('dm:') && String(ch).slice(3).split('|').includes(accId);

/* Бот команды в Telegram входит по ключу (BOT_KEY на сервере), а не по паролю. Роль 'bot' — не из
   ROLES: учётки с ней нет. Видит задачи, собрания (без внешних гостей), протоколы (без файла) и
   стратегию; из «Команды» и учёток — только кто это (без контактов, зарплат и личного). Ставит и
   меняет задачи и собрания (встречу Зума к собранию заводит сервер); удалить может только то, что
   поставил сам (via: 'bot'). В «Команде» ведёт одну свою карточку (id yasen). Протоколы, стратегию
   и ответы анкеты «Каким быть Ясеню» только читает. Денег, сообщений и настроек не
   видит и не меняет. Приглашения выдаёт только с ролью «Команда» и только через
   POST /api/bot/invite (код и роль ставит сервер); видит и отзывает лишь свои неиспользованные.
   В CRM бот — как человек из команды (server.js, BOT_CTX). */
const BOT = 'bot';
const BOT_COLS = ['tasks', 'meetings'];
/* своя карточка в «Команде»: Ясень — участник команды, чтобы ставить задачи от себя и получать их */
const BOT_PERSON = 'yasen';
const BOT_PERSON_FIELDS = ['name', 'givenName', 'surname', 'title', 'dir', 'status', 'order', 'bot', 'about'];
const MEET_GUESTS = ['extGuests', 'guests'];
function botView(c, id, doc) {
  if (c === 'tasks') return doc;
  if (c === 'meetings') return omit(doc, MEET_GUESTS);
  /* протоколы — чтобы присылать их в группу (файл не отдаём: тяжёлый, есть ссылка на запись и текст) */
  if (c === 'protocols') return {...omit(doc, ['file', ...PROTO_SERVER]), hasFile: !!doc.file};
  /* из документов — только стратегия: цели недели для утренней сводки */
  if (c === 'docs') return id === 'strategy' ? doc : null;
  /* анкета «Каким быть Ясеню» — бот и есть Ясень: читает ответы, чтобы общаться, как просит команда */
  if (c === 'yasen') return doc;
  /* файлы к задачам — что приложили (без содержимого) */
  if (c === 'files') return omit(doc, ['data']);
  /* приглашения — только свои: использовано ли, на кого */
  if (c === 'invites') return doc.by === BOT_PERSON ? doc : null;
  if (c === 'people') return pick(doc, PERSON_PUBLIC);
  if (c === 'accounts') return pick(doc, ACC_PUBLIC);
  return null;
}
function botWrite(op, c, id, cur, body, next) {
  if (c === 'people') {
    if (id !== BOT_PERSON || op === 'delete' || (op === 'put' && cur)) return no('в «Команде» бот ведёт только свою карточку');
    if (!Object.keys((op === 'put' ? next : body) || {}).every(k => BOT_PERSON_FIELDS.includes(k))) return no('в своей карточке бот меняет только имя, должность и направление');
    return yes(next);
  }
  if (c === 'invites') {
    /* выдаёт приглашение сервер (POST /api/bot/invite); сам бот может только отозвать свою неиспользованную ссылку */
    return op === 'delete' && cur && cur.by === BOT_PERSON && !cur.usedBy ? yes(null) : no('приглашение бот выдаёт через /api/bot/invite и отзывает только своё неиспользованное');
  }
  if (!BOT_COLS.includes(c)) return no('бот может только ставить и менять задачи и собрания');
  if (op === 'delete') return cur && cur.via === BOT ? yes(null) : no('бот удаляет только то, что поставил сам');
  if (op === 'put' && cur) return no('бот меняет запись правкой, а не заменой целиком');
  if (op === 'put' && (!isObj(next) || next.via !== BOT)) return no('запись от бота должна быть помечена via: bot');
  if (isObj(body) && MEET_GUESTS.some(k => k in body)) return no('внешних гостей собрания бот не трогает');
  if (op === 'patch' && isObj(body) && 'via' in body) return no('пометку бота менять нельзя');
  return yes(next);
}

/* что из записи увидит этот человек: документ (возможно, без части полей) или null */
function view(ctx, c, id, doc) {
  if (!doc) return null;
  const r = ctx.role;
  if (r === BOT) return botView(c, id, doc);
  switch (c) {
    case 'accounts': return can(r, 'tasks.view') || id === ctx.accId ? omit(doc, ACC_SECRET) : pick(doc, ACC_PUBLIC);
    case 'invites': return r === 'owner' ? doc : null;
    case 'people':
      if (!can(r, 'tasks.view') && id !== ctx.personId) return pick(doc, PERSON_PUBLIC);
      return omit(doc, can(r, 'payroll.view') ? ['tgChatId'] : ['tgChatId', 'salary']);
    case 'tasks': case 'busy': return can(r, 'tasks.view') ? doc : null;
    /* файлы к задачам видят все, кто видит задачи; содержимое отдаёт /api/file/<id> */
    case 'files': return can(r, 'tasks.view') ? omit(doc, ['data']) : null;
    case 'meetings': return can(r, 'tasks.view') && !meetHidden(r, doc) ? doc : null;
    case 'protocols': return seesLevel(r, doc) ? omit(doc, PROTO_SERVER) : null;
    /* анкета Ясеня: свой ответ — каждому, все ответы — основателю (и боту — только читать, см. botView) */
    case 'yasen': return r === 'owner' || id === (ctx.personId || ctx.accId) ? doc : null;
    case 'messages':
      if (!can(r, 'tasks.view')) return null;
      return doc.ch === 'team' || dmHas(doc.ch, ctx.accId) ? doc : null;
    case 'ledger': case 'subs': case 'courses': case 'products': case 'scenarios': return can(r, 'money.view') ? doc : null;
    case 'plan':
      if (can(r, 'money.view')) return doc;
      /* команде — только строки бюджета задач: их заводит сама задача */
      return can(r, 'tasks.view') && (doc.taskId || id.startsWith('tb_')) ? doc : null;
    case 'orders': case 'payouts': case 'failed': case 'refunds':
      if (can(r, 'fin.ops')) return doc;
      return can(r, 'money.view') ? omit(doc, CLIENT_FIELDS) : null;
    case 'links': return r === 'owner' || !Array.isArray(doc.roles) || doc.roles.includes(r) ? doc : null;
    case 'docs': return id === 'settings' && !can(r, 'money.view') ? omit(doc, SETTINGS_MONEY) : doc;
    case 'sales': return doc;
    /* заявки на финансирование и бюджеты направлений: все — тем, кто видит деньги; остальным — свои */
    case 'fundreqs': case 'budgets': return can(r, 'money.view') || doc.by === (ctx.personId || ctx.accId) ? doc : null;
    /* биржа идей — открыта всем */
    case 'ideas': return ROLES.includes(r) ? doc : null;
    default: return null;
  }
}

/* ── бюджетирование: заявки на финансирование и бюджеты направлений ──
   Автор пишет и отправляет; решение (согласовать, на доработку, отказать) добавляет только тот,
   чья сейчас очередь по маршруту (flow.js). Решения не правятся и не удаляются */
const FLOW_DOC = {
  fundreqs: ['title', 'kind', 'tags', 'dir', 'dept', 'taskId', 'ideaId', 'amount', 'month', 'cat', 'why', 'gain', 'need', 'risk'],
  budgets: ['title', 'ptype', 'period', 'dir', 'dept', 'lines', 'why', 'gain', 'need', 'risk'],
};
const FLOW_STATUS_OPEN = ['draft', 'revise'];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const PERIOD = {year: /^\d{4}$/, quarter: /^\d{4}-Q[1-4]$/, month: MONTH};
const changed = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter(k => JSON.stringify((a || {})[k]) !== JSON.stringify((b || {})[k]));
const money = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e11;
/* настройки бюджета и кто согласует — из базы штаба */
function flowCtx(store) {
  const budget = ((store && store.get('docs', 'settings')) || {}).budget || {};
  return {budget, who: Flow.people(budget, store ? store.list('accounts') : [], store ? store.list('people') : [])};
}
function flowContent(c, d) {
  if (typeof d.title !== 'string' || !d.title.trim() || d.title.length > 300) return 'назовите, на что нужны деньги';
  if (c === 'fundreqs') {
    if (!money(d.amount)) return 'сумма — числом';
    if (d.month && !MONTH.test(d.month)) return 'месяц — в виде 2026-11';
  } else {
    if (!PERIOD[d.ptype] || !PERIOD[d.ptype].test(String(d.period || ''))) return 'период бюджета оформлен неверно';
    if (!Array.isArray(d.lines) || d.lines.length > 300 || !d.lines.every(l => isObj(l) && money(l.amount))) return 'строки бюджета оформлены неверно';
  }
  return '';
}
function flowWrite(ctx, op, c, id, cur, next, store) {
  const r = ctx.role, me = ctx.personId || ctx.accId;
  const {budget, who} = flowCtx(store);
  const st = cur ? Flow.state(cur, who, budget) : null;
  if (op === 'delete') {
    if (!cur) return yes(null);
    return r === 'owner' || (cur.by === me && ['draft', 'withdrawn'].includes(st.status)) ? yes(null) : no('удалить можно свой черновик; остальное — основатель');
  }
  if (!isObj(next) || JSON.stringify(next).length > 200000) return no('запись оформлена неверно или слишком длинная');
  if (!cur) {
    if (!can(r, 'tasks.view') && !can(r, 'money.view')) return no('нет доступа к бюджету');
    if (next.by !== me) return no('автор — тот, кто подаёт');
    if (Object.keys(next.decisions || {}).length || next.withdrawn) return no('решения принимает маршрут согласования');
    if (next.sentAt ? next.round !== 1 || typeof next.sentAt !== 'number' : next.round) return no('отправка оформлена неверно');
    if (c === 'budgets' && id !== Flow.budgetId(next.period, next.dir, next.dept)) return no('у бюджета направления на период — один документ');
    const bad = flowContent(c, next);
    return bad ? no(bad) : yes(next);
  }
  const diff = changed(cur, next).filter(k => k !== 'upd');
  if (!diff.length) return yes(next);
  /* решение по маршруту: ровно одна новая запись в decisions — от того, чья очередь */
  if (diff.length === 1 && diff[0] === 'decisions') {
    const was = cur.decisions || {}, now = next.decisions || {};
    const added = Object.keys(now).filter(k => !was[k]);
    if (added.length !== 1 || Object.keys(was).some(k => JSON.stringify(was[k]) !== JSON.stringify(now[k]))) return no('решения не правятся — добавляется одно новое');
    const d = now[added[0]];
    if (!isObj(d) || d.by !== me || d.round !== cur.round || d.step !== st.step || !Flow.VERDICTS.includes(d.verdict) || typeof d.at !== 'number') return no('решение оформлено неверно');
    if (st.status !== 'review' || !st.waiting.includes(me)) return no('сейчас решение не за вами');
    if (d.verdict !== 'ok' && !(typeof d.note === 'string' && d.note.trim())) return no('напишите, что доработать или почему отказ');
    if (d.note !== undefined && (typeof d.note !== 'string' || d.note.length > 4000)) return no('комментарий слишком длинный');
    return yes(next);
  }
  /* автор (бюджет направления может поправить и тот, кто ведёт деньги) */
  if (!(cur.by === me || (c === 'budgets' && can(r, 'money.edit')))) return no('менять может автор; согласующие добавляют только решение');
  if (diff.some(k => ['by', 'at', 'decisions'].includes(k) || (c === 'budgets' && ['ptype', 'period', 'dir', 'dept'].includes(k)))) return no('автора, период и решения менять нельзя');
  if (diff.some(k => !FLOW_DOC[c].includes(k) && !['sentAt', 'round', 'withdrawn'].includes(k))) return no('это поле менять нельзя');
  if (diff.some(k => FLOW_DOC[c].includes(k)) && !FLOW_STATUS_OPEN.includes(st.status)) return no('на согласовании и после решения не правят — отзовите и подайте заново');
  if (diff.includes('withdrawn') && (next.withdrawn !== true || !['draft', 'review', 'revise'].includes(st.status))) return no('отозвать можно до решения; отозванное — подать заново');
  if ((diff.includes('round') || diff.includes('sentAt')) && (!FLOW_STATUS_OPEN.includes(st.status) || next.round !== (Number(cur.round) || 0) + 1 || typeof next.sentAt !== 'number')) return no('отправить можно черновик или доработанное');
  const bad = flowContent(c, next);
  return bad ? no(bad) : yes(next);
}

/* ── биржа идей: подаёт и правит автор (пока идею не взяли в работу), голос и комментарий — свои,
   рассматривают, внедряют и назначают премию основатель, руководитель и финансы ── */
const IDEA_TEXT = ['title', 'type', 'problem', 'proposal', 'effect', 'profitEst', 'costEst', 'dir', 'tags'];
const IDEA_DESK = ['status', 'statusAt', 'statusBy', 'verdict', 'taskId', 'reqId', 'result', 'reward'];
const IDEA_OPEN = ['new', 'review', 'later'];
function ideaWrite(ctx, op, cur, next) {
  const r = ctx.role, me = ctx.personId || ctx.accId, desk = can(r, 'tasks.manage');
  if (!ROLES.includes(r)) return no('нет доступа к бирже идей');
  if (op === 'delete') return !cur || r === 'owner' || (cur.by === me && (cur.status || 'new') === 'new') ? yes(null) : no('удалить новую идею может автор, остальное — основатель');
  if (!isObj(next) || JSON.stringify(next).length > 200000) return no('идея оформлена неверно или слишком длинная');
  if (typeof next.title !== 'string' || !next.title.trim() || next.title.length > 300) return no('назовите идею');
  if (!cur) {
    if (next.by !== me) return no('автор идеи — тот, кто её подаёт');
    if ((next.status || 'new') !== 'new' || IDEA_DESK.some(k => k !== 'status' && next[k] != null)) return no('идею рассматривают после подачи');
    if (Object.keys(next.comments || {}).length || Object.keys(next.votes || {}).some(k => k !== me)) return no('голос — только свой');
    return yes(next);
  }
  for (const k of changed(cur, next)) {
    if (k === 'upd') continue;
    if (k === 'votes') {
      const v = (next.votes || {})[me];
      if (changed(cur.votes, next.votes).every(x => x === me) && (v == null || typeof v === 'number')) continue;
      return no('голос — только свой');
    }
    if (k === 'comments') {
      const a = cur.comments || {}, b = next.comments || {};
      const fresh = Object.keys(b).filter(x => !a[x]);
      if (Object.keys(a).every(x => JSON.stringify(a[x]) === JSON.stringify(b[x])) && fresh.every(x => isObj(b[x]) && b[x].by === me && typeof b[x].text === 'string' && b[x].text.trim() && b[x].text.length <= 4000)) continue;
      return no('комментарий — только свой и новый');
    }
    if (IDEA_TEXT.includes(k) && (desk || (cur.by === me && IDEA_OPEN.includes(cur.status || 'new')))) continue;
    if (IDEA_DESK.includes(k) && desk) continue;
    return no(desk ? 'это поле идеи менять нельзя' : 'идею рассматривают основатель, руководитель и финансы; автор правит её, пока её не взяли в работу');
  }
  return yes(next);
}

const no = why => ({ok: false, why});
const yes = next => ({ok: true, next});
const onlyKeys = (body, allowed) => isObj(body) && Object.keys(body).every(k => allowed.includes(k));

/* можно ли записать. op: put | patch | delete; cur — что лежит сейчас,
   body — что прислали, next — что получится (для delete — null).
   Возвращает {ok, next} — next может быть поправлен (скрытые поля возвращаем на место). */
function write(ctx, op, c, id, cur, body, next, store) {
  const r = ctx.role, owner = r === 'owner';
  if (r === BOT) return botWrite(op, c, id, cur, body, next);
  switch (c) {
    case 'accounts': {
      /* учётки создаёт и удаляет только сервер: вход, приглашение, сброс пароля */
      if (op !== 'patch' || !cur) return no('учётки меняются через вход и приглашения');
      if (Object.keys(body || {}).some(k => ACC_SECRET.includes(k))) return no('пароль меняется на своей странице');
      const self = id === ctx.accId;
      if (owner) {
        if (!onlyKeys(body, ACC_OWNER)) return no('это поле учётки менять нельзя');
        /* основатель не может сам себя разжаловать или отключить — иначе штаб останется без хозяина */
        if (self && ((body.role !== undefined && body.role !== 'owner') || body.active === false)) return no('нельзя снять права основателя с самого себя');
        if (body.role !== undefined && !ROLES.includes(body.role)) return no('нет такой роли');
        return yes(next);
      }
      return self && onlyKeys(body, ACC_SELF) ? yes(next) : no('чужую учётку меняет только основатель');
    }
    case 'invites': return owner ? yes(next) : no('приглашения выдаёт основатель');
    case 'people': {
      if (owner) return yes(next);
      if (op !== 'patch' || !cur || id !== ctx.personId) return no('чужую карточку меняет только основатель');
      if (Object.keys(body || {}).some(k => PERSON_LOCKED.includes(k))) return no('это поле карточки меняет основатель');
      return yes(next);
    }
    case 'tasks': return can(r, 'tasks.view') ? yes(next) : no('нет доступа к задачам и собраниям');
    case 'meetings':
      if (!can(r, 'tasks.view')) return no('нет доступа к задачам и собраниям');
      return meetHidden(r, cur) || meetHidden(r, next) ? no('собрания уровня 1 ведут основатели') : yes(next);
    case 'yasen':
      if (next && JSON.stringify(next).length > 50000) return no('слишком длинные ответы');
      return owner || id === (ctx.personId || ctx.accId) ? yes(next) : no('отвечать можно только за себя');
    case 'protocols': {
      if (next && JSON.stringify(next).length > 5e6) return no('протокол слишком большой: файл — до 3 МБ');
      if (next && PROTO_SERVER.some(k => JSON.stringify(next[k]) !== JSON.stringify(cur ? cur[k] : undefined))) return no('ссылки на запись у Зума ведёт сервер');
      if (can(r, 'proto.edit')) return yes(next);
      /* остальные — только своё «Ок» в протоколе, который видят */
      const me = ctx.personId || ctx.accId, ok = isObj(body) ? body.ok : null;
      if (op === 'patch' && cur && seesLevel(r, cur) && onlyKeys(body, ['ok']) && isObj(ok) && Object.keys(ok).length === 1 && Object.keys(ok)[0] === me && typeof ok[me] === 'number') return yes(next);
      return no('протоколы ведут основатели; участник может только подтвердить «Ок»');
    }
    case 'files': {
      if (!can(r, 'tasks.view')) return no('нет доступа к задачам');
      if (op === 'delete') return cur && (cur.acc === ctx.accId || owner) ? yes(null) : no('удалить файл может тот, кто его приложил, или основатель');
      if (op !== 'put' || cur) return no('файл не меняется: удалите и приложите заново');
      if (!isObj(body) || typeof body.data !== 'string' || !FILE_DATA.test(body.data)) return no('файл оформлен неверно');
      if (body.data.length > Math.ceil(FILE_MAX / 3) * 4 + 200) return no('файл больше 5 МБ');
      if (!['outcome', 'thread'].includes(body.where) || typeof body.name !== 'string' || body.name.length > 200) return no('файл оформлен неверно');
      if (store && !store.get('tasks', String(body.task || ''))) return no('нет такой задачи');
      /* кто приложил — по учётке, а не по тому, что прислал браузер */
      return yes({...next, acc: ctx.accId, at: Date.now()});
    }
    case 'busy':
      /* занятость — только своя */
      return can(r, 'tasks.view') && (owner || id === ctx.personId) ? yes(next) : no('занятость каждый ведёт свою');
    case 'messages': {
      if (!can(r, 'tasks.view')) return no('нет доступа к сообщениям');
      if (op === 'delete') return cur && (cur.by === ctx.accId || owner) ? yes(null) : no('удалить можно только своё сообщение');
      if (op !== 'put' || cur) return no('сообщения не редактируются');
      if (!isObj(body) || body.by !== ctx.accId || typeof body.text !== 'string' || body.text.length > 8000) return no('сообщение оформлено неверно');
      return body.ch === 'team' || dmHas(body.ch, ctx.accId) ? yes(next) : no('это не ваш диалог');
    }
    case 'plan': {
      const taskRow = d => !!d && d.group === 'once' && !!d.taskId;
      const payroll = d => !!d && d.group === 'payroll';
      /* зарплатные строки — только тем, кто видит зарплаты */
      if ((payroll(cur) || payroll(next)) && !can(r, 'payroll.view')) return no('зарплаты ведут основатель и финансы');
      if (can(r, 'money.edit')) return yes(next);
      /* команда: только строка бюджета своей задачи (tb_<id задачи>) */
      if (can(r, 'tasks.view') && (!cur || taskRow(cur)) && (op === 'delete' ? !!cur : taskRow(next))) return yes(next);
      return no('план платежей ведут основатель, руководитель и финансы');
    }
    case 'ledger': case 'subs': case 'courses': case 'products':
      return can(r, 'money.edit') ? yes(next) : no('деньги вносят основатель, руководитель и финансы');
    /* сценарии ни на что в штабе не влияют; сохраняют те, кто ведёт деньги */
    case 'scenarios': return can(r, 'money.edit') ? yes(next) : no('сценарии сохраняют основатель, руководитель и финансы');
    case 'orders': case 'payouts': case 'failed': case 'refunds':
      return can(r, 'fin.ops') ? yes(next) : no('заказы, выплаты и возвраты ведут основатель, руководитель и финансы');
    case 'sales':
      if (op === 'delete') return can(r, 'tasks.manage') ? yes(null) : no('день удаляет руководитель');
      return can(r, 'sales.edit') ? yes(next) : no('цифры продаж вносит команда');
    case 'links': return owner ? yes(next) : no('свои материалы добавляет основатель');
    case 'fundreqs': case 'budgets': return flowWrite(ctx, op, c, id, cur, next, store);
    case 'ideas': return ideaWrite(ctx, op, cur, next);
    case 'docs':
      if (owner) return yes(next);
      /* отмечать пункты целей могут руководитель и финансы; остальное в стратегии и настройках — основатель */
      if (id === 'strategy' && op === 'patch' && cur && can(r, 'strategy.check')) return yes(next);
      return no('стратегию и настройки меняет основатель');
    default: return no('нет такой коллекции');
  }
}

/* поля, которые человек не видит, при его записи остаются как были */
function keepHidden(ctx, c, id, cur, next) {
  if (!cur || !next) return next;
  const seen = view(ctx, c, id, cur);
  if (!seen) return next;
  const out = {...next};
  Object.keys(cur).forEach(k => { if (!(k in seen)) out[k] = cur[k]; });
  return out;
}

module.exports = {COLS, ROLES, roleOf, can, view, write, keepHidden, ACC_SECRET, LEVEL_ROLES, levelOf, BOT, BOT_PERSON, FILE_MAX, flowCtx};
