/* Модель: всё, что считается из базы. Клиентка — один документ: анкета,
   контакты, этап, теги и карта ev с историей (сообщения, звонки, рассылки,
   оплаты, задачи, смены этапов). LTV, подписка, последнее касание, сегмент,
   рефералы — не хранятся, а считаются из истории, поэтому не расходятся. */

/* версия данных: растёт на каждое изменение базы — по ней сбрасываются кэши */
let MV = 0;
Store.subscribe(() => { MV++; });
function memo(fn) { let v = -1, val; return () => (v === MV ? val : (v = MV, val = fn())); }

/* ── настройки и справочники из cfg/* ── */
const settings = memo(() => deepMerge(DEFAULT_SETTINGS, Store.get('cfg', 'settings') || {}));
const saveSettings = partial => Store.patch('cfg', 'settings', partial);

const DEFAULT_SEQUENCES = {
  warm1: {name: 'Прогрев 1 — знакомство с Евой', trigger: 'Этап «Прогрев 1»', on: true, steps: [
    {day: 0, ch: 'tg', text: 'Привет, {имя}! Это Ева. Держи практику «Дыхание 4–7–8» — семь минут, чтобы выдохнуть.'},
    {day: 2, ch: 'tg', text: 'Как прошла практика? Рассказываю, как Ева собирает программу под тебя.'},
    {day: 4, ch: 'email', text: 'Три истории участниц: что изменилось за первый месяц.'},
  ]},
  warm2: {name: 'Прогрев 2 — предложение', trigger: 'Этап «Прогрев 2»', on: true, steps: [
    {day: 0, ch: 'tg', text: '{имя}, приглашаю на бесплатный эфир с экспертом в четверг, 19:00.'},
    {day: 1, ch: 'push', text: 'Эфир через час — ссылка внутри.'},
    {day: 3, ch: 'tg', text: 'Три дня Евы бесплатно — попробуй программу: {ссылка}'},
  ]},
  events: {name: 'Eva Events — после записи на мероприятие', trigger: 'Запись на мероприятие', on: true, steps: [
    {day: 0, ch: 'tg', text: 'Вы записаны! Детали и адрес — здесь.'},
    {day: 0, ch: 'tg', text: 'Код для подруги: пусть приходит с вами.'},
    {day: -3, ch: 'email', text: 'Подтвердите участие — встреча через 3 дня.'},
    {day: -1, ch: 'email', text: 'Напоминание: встреча завтра.'},
    {day: 0, ch: 'push', text: 'Сегодня встреча — ждём вас.'},
    {day: 1, ch: 'tg', text: 'Как вам встреча? Оставьте отзыв — это 1 минута.'},
  ]},
  renew: {name: 'Продление подписки', trigger: 'За 3 дня до конца подписки', on: true, steps: [
    {day: -3, ch: 'tg', text: '{имя}, подписка заканчивается через 3 дня — продлите, чтобы не потерять программу.'},
    {day: 0, ch: 'push', text: 'Сегодня последний день подписки.'},
    {day: 3, ch: 'wa', text: 'Мы скучаем. Вернитесь — месяц со скидкой 20% по промокоду BACK.'},
  ]},
};
const DEFAULT_INTEGRATIONS = {};
const CFG_DEFAULTS = {funnels: DEFAULT_FUNNELS, tags: DEFAULT_TAGS, segments: DEFAULT_SEGMENTS, templates: DEFAULT_TEMPLATES, sequences: DEFAULT_SEQUENCES, integrations: DEFAULT_INTEGRATIONS};
const Cfg = {
  list(name) { const d = Store.get('cfg', name); return d && d.list ? d.list : CFG_DEFAULTS[name]; },
  items(name) { return Object.entries(this.list(name) || {}).map(([id, x]) => ({...x, id})).sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || String(a.name).localeCompare(String(b.name), 'ru')); },
  /* справочник пишем целиком: правки настроек редкие, так проще удалять */
  save(name, id, item) { const cur = clone(this.list(name) || {}); cur[id] = item; return Store.put('cfg', name, {list: cur}); },
  drop(name, id) { const cur = clone(this.list(name) || {}); delete cur[id]; return Store.put('cfg', name, {list: cur}); },
};

/* ── воронки ── */
const ENT_FUNNEL = {clients: 'sales', experts: 'experts', partners: 'partners'};
const Funnels = {
  list() { return Cfg.items('funnels').sort((a, b) => (a.order ?? 9) - (b.order ?? 9)); },
  forEntity(ent) { return this.list().filter(f => f.entity === ent); },
  get(id) { const f = Cfg.list('funnels')[id]; return f ? {...f, id} : null; },
  stages(id) { const f = this.get(id); return f ? f.stages : []; },
  stage(fid, sid) { if (sid === 'lost') return LOST; const f = this.get(fid); return f ? f.stages.find(s => s.id === sid) || null : null; },
  idx(fid, sid) { return this.stages(fid).findIndex(s => s.id === sid); },
  won(fid) { const w = this.stages(fid).find(s => s.won); return w ? w.id : null; },
  of(col, e) { return (e && e.funnel) || ENT_FUNNEL[col]; },
  save(id, f) { return Cfg.save('funnels', id, f); },
};

/* ── теги ── */
const Tags = {
  all() { return Cfg.items('tags').sort((a, b) => String(a.group).localeCompare(String(b.group), 'ru') || String(a.name).localeCompare(String(b.name), 'ru')); },
  get(id) { const t = (Cfg.list('tags') || {})[id]; return t ? {...t, id} : null; },
  byName(name) { const n = String(name).trim().toLowerCase(); return this.all().find(t => t.name.toLowerCase() === n) || null; },
  /* найти по имени или завести новый */
  ensure(name, group = 'Прочее') {
    const n = String(name || '').trim();
    if (!n) return null;
    const t = this.byName(n) || this.get(n);
    if (t) return t.id;
    const id = 't' + uid().slice(-6);
    Cfg.save('tags', id, {name: n, group, color: AV_COLORS[hashStr(n) % AV_COLORS.length]});
    return id;
  },
  count: memo(() => { const m = {}; Store.all('clients').forEach(c => (c.tags || []).forEach(t => { m[t] = (m[t] || 0) + 1; })); return m; }),
};

/* ── сегменты: условия по полям ── */
function fieldVal(c, k) {
  if (k.startsWith('q_')) return (c.quiz || {})[k.slice(2)];
  if (k === 'invited') return Referral.invitees(c.id).length;
  if (k === 'refEarned') return Referral.of(c).accrued;
  if (k === 'level') return levelOf(c.points).id;
  if (k === 'segment') { const sg = cx(c).segment; return sg ? sg.id : null; }
  const f = FIELD[k];
  if (f && f.calc) return cx(c)[k];
  return c[k];
}
const isEmpty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
function toDay(v) { if (!v) return null; return typeof v === 'number' ? isoTs(v) : String(v).slice(0, 10); }
function testRule(r, c) {
  const v = fieldVal(c, r.f);
  const arr = Array.isArray(v) ? v : isEmpty(v) ? [] : [v];
  const low = x => String(x ?? '').toLowerCase();
  switch (r.op) {
    case 'eq':    return arr.some(x => low(x) === low(r.v));
    case 'ne':    return !arr.some(x => low(x) === low(r.v));
    case 'in':    { const set = (Array.isArray(r.v) ? r.v : String(r.v).split(',')).map(x => low(String(x).trim())); return arr.some(x => set.includes(low(x))); }
    case 'has':   return arr.some(x => low(x).includes(low(r.v)) || low(x) === low(r.v));
    case 'nhas':  return !arr.some(x => low(x).includes(low(r.v)) || low(x) === low(r.v));
    case 'gte':   return Number(v) >= Number(r.v);
    case 'lte':   return !isEmpty(v) && Number(v) <= Number(r.v);
    case 'set':   return !isEmpty(v);
    case 'unset': return isEmpty(v);
    case 'within':{ const d = toDay(v); return !!d && d >= addDays(today(), -Number(r.v || 0)); }
    case 'older': { const d = toDay(v); return !!d && d < addDays(today(), -Number(r.v || 0)); }
    default: return false;
  }
}
function testRules(rules, match, c) {
  const list = (rules || []).filter(r => r && r.f && r.op);
  if (!list.length) return true;
  return match === 'any' ? list.some(r => testRule(r, c)) : list.every(r => testRule(r, c));
}
function ruleText(r) {
  const f = FIELD[r.f];
  const name = f ? f.n : r.f;
  const op = OPS[r.op] ? OPS[r.op].name : r.op;
  if (OPS[r.op] && OPS[r.op].noValue) return `${name} — ${op}`;
  return `${name} ${op} «${valueLabel(r.f, r.v)}»`;
}
function valueLabel(k, v) {
  const f = FIELD[k];
  const one = x => {
    if (!f) return x;
    if (f.type === 'quiz') return quizText(f.q, x);
    if (f.type === 'tags') return (Tags.get(x) || {}).name || x;
    if (f.type === 'stage') return (Funnels.stage('sales', x) || {}).name || x;
    if (f.type === 'person') return Team.name(Team.get(x));
    if (f.label) return f.label(x);
    return x;
  };
  return (Array.isArray(v) ? v : [v]).map(one).join(', ');
}
const Segments = {
  all() { return Cfg.items('segments'); },
  get(id) { const s = (Cfg.list('segments') || {})[id]; return s ? {...s, id} : null; },
  test(seg, c) { return !!(seg.rules && seg.rules.length) && testRules(seg.rules, seg.match, c); },
  /* первый подходящий по порядку; ручной выбор в карточке важнее условий */
  of(c) {
    if (c.segId === 'none') return null;
    if (c.segId) return this.get(c.segId);
    return this.all().find(s => this.test(s, c)) || null;
  },
  members(seg) { return Store.all('clients').filter(c => { const s = cx(c).segment; return s && s.id === seg.id; }); },
};

/* ── производные поля клиентки (кэш на каждую версию данных) ── */
const TOUCH_KINDS = ['msg', 'call', 'camp', 'meet', 'group'];
const REVENUE_TYPES = ['sub', 'year', 'course', 'consult', 'event', 'club', 'market', 'topup'];
const DC = new WeakMap();
function cx(c) {
  let e = DC.get(c);
  if (!e || e.v !== MV) {
    e = {v: MV, d: derive(c)};
    DC.set(c, e);
    /* сегмент — после кэша: условия читают LTV и подписку этой же клиентки */
    e.d.segment = Segments.of(c);
  }
  return e.d;
}
/* деньги, которые клиентка реально принесла: оплаты не с баланса, минус возвраты */
const cashOf = p => (p.status !== 'ok' ? 0 : p.type === 'refund' ? -Math.abs(p.amount || 0) : p.method === 'balance' ? 0 : (p.amount || 0));
function derive(c) {
  const evs = Ev.list(c);
  const pays = evs.filter(e => e.kind === 'pay');
  const ok = pays.filter(p => p.status === 'ok');
  let subUntil = null;
  ok.filter(p => PAY_TYPES[p.type] && PAY_TYPES[p.type].sub).forEach(p => {
    const d = isoTs(p.t);
    const start = subUntil && subUntil > d ? subUntil : d;
    subUntil = addDays(start, PAY_TYPES[p.type].sub);
  });
  const t = today();
  let sub = 'none';
  if (subUntil && subUntil >= t) sub = subUntil <= addDays(t, 7) ? 'expiring' : 'active';
  else if (c.trialUntil && c.trialUntil >= t) sub = 'trial';
  else if (subUntil) sub = 'expired';
  const touchEvs = evs.filter(e => TOUCH_KINDS.includes(e.kind));
  const groupMsgs = Chats.byClient(c.id);
  const lastTouchTs = Math.max(0, ...touchEvs.map(e => e.t), ...groupMsgs.map(m => m.t));
  const msgs = evs.filter(e => e.kind === 'msg');
  const lastIn = msgs.filter(m => m.dir === 'in').pop() || null;
  const lastOut = evs.filter(e => (e.kind === 'msg' && e.dir === 'out') || (e.kind === 'call' && e.result === 'ok')).pop() || null;
  const tasks = evs.filter(e => e.kind === 'task' && !e.done).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
  const firstPay = ok.find(p => p.type !== 'refund' && p.method !== 'balance');
  const pending = pays.filter(p => p.status === 'pending');
  const d = {
    evs, pays, ok, pending, msgs, tasks, groupMsgs,
    ltv: sum(ok, cashOf),
    pays_n: ok.filter(p => p.type !== 'refund').length,
    firstPay: firstPay ? firstPay.t : null,
    subUntil, sub,
    lastTouchTs: lastTouchTs || null,
    lastTouch: lastTouchTs ? isoTs(lastTouchTs) : null,
    touches: touchEvs.length + groupMsgs.length,
    lastIn, lastOut,
    lastMsg: msgs[msgs.length - 1] || null,
    unread: msgs.filter(m => m.dir === 'in' && m.t > (c.readAt || 0)).length,
    waiting: !!(lastIn && (!lastOut || lastOut.t < lastIn.t)),
    nextAt: tasks.length ? tasks[0].due || null : null,
    overdue: tasks.filter(x => x.due && x.due < t).length,
    level: levelOf(c.points),
    stageDays: c.stageAt ? daysBetween(isoTs(c.stageAt), t) : null,
  };
  d.pays = d.pays_n;
  d.payList = pays;
  d.segment = null;
  return d;
}
/* до какого дня оплачена подписка по оплатам не позже даты end */
function subUntilAt(c, end) {
  let until = null;
  cx(c).ok.filter(p => PAY_TYPES[p.type] && PAY_TYPES[p.type].sub && isoTs(p.t) <= end).forEach(p => {
    const d = isoTs(p.t);
    until = addDays(until && until > d ? until : d, PAY_TYPES[p.type].sub);
  });
  return until;
}
const SUB_STATUS = {
  active:   {name: 'Активна',          tone: 'good'},
  expiring: {name: 'Заканчивается',    tone: 'warn'},
  trial:    {name: 'Пробный доступ',   tone: 'violet'},
  expired:  {name: 'Истекла',          tone: 'bad'},
  none:     {name: 'Нет подписки',     tone: ''},
};
const subPill = c => { const s = SUB_STATUS[cx(c).sub]; return `<span class="pill ${s.tone}">${s.name}</span>`; };

/* ── история: события внутри документа ── */
const Ev = {
  list(e) { return Object.entries((e && e.ev) || {}).map(([id, x]) => ({...x, id})).sort((a, b) => (a.t || 0) - (b.t || 0)); },
  add(col, id, e) {
    const eid = uid();
    Store.patch(col, id, {ev: {[eid]: {t: Date.now(), by: Who.id(), ...e}}});
    return eid;
  },
  set(col, id, eid, p) { return Store.patch(col, id, {ev: {[eid]: p}}); },
  del(col, id, eid) { return Store.unset(col, id, ['ev', eid]); },
};

/* ── этапы и автоматика ── */
function moveStage(col, id, to, {reason = '', auto = false} = {}) {
  const e = Store.get(col, id);
  if (!e || e.stage === to) return;
  const now = Date.now();
  const p = {stage: to, stageAt: now, ev: {[uid()]: {kind: 'stage', t: now, by: auto ? null : Who.id(), funnel: Funnels.of(col, e), from: e.stage || null, to, auto, text: reason}}};
  if (to === 'lost') p.lostReason = reason || e.lostReason || 'Другое';
  Store.patch(col, id, p);
}

const Pay = {
  add(clientId, p) {
    const c = Store.get('clients', clientId);
    if (!c) return null;
    const eid = Ev.add('clients', clientId, {kind: 'pay', status: 'ok', method: 'card', ...p});
    this.auto(c, p);
    return eid;
  },
  markPaid(clientId, eid) {
    const c = Store.get('clients', clientId);
    const p = (c.ev || {})[eid];
    Ev.set('clients', clientId, eid, {status: 'ok', paidAt: Date.now()});
    this.auto(c, {...p, status: 'ok'});
  },
  /* пришла оплата — «Оплата получена»; выставлен счёт — «Счёт выставлен» */
  auto(c, p) {
    if (Funnels.of('clients', c) !== 'sales' || c.stage === 'lost') return;
    const won = Funnels.won('sales');
    if (p.status === 'ok' && p.type !== 'refund' && won && c.stage !== won) moveStage('clients', c.id, won, {auto: true, reason: 'пришла оплата'});
    else if (p.status === 'pending' && Funnels.idx('sales', c.stage) < Funnels.idx('sales', 'invoice') && Funnels.idx('sales', 'invoice') >= 0) moveStage('clients', c.id, 'invoice', {auto: true, reason: 'выставлен счёт'});
  },
};

/* ── клиенты ── */
const Clients = {
  all() { return Store.all('clients'); },
  get(id) { return id ? Store.get('clients', id) : null; },
  visible() {
    const all = this.all();
    if (Who.can('clients.all')) return all;
    const me = Who.id();
    return all.filter(c => !c.manager || c.manager === me);
  },
  canEdit(c) { return Who.can('clients.edit') && !Who.readOnly() && (Who.can('clients.all') || !c || !c.manager || c.manager === Who.id()); },
  name(c) { return c ? (c.name || c.org || 'Без имени') : '—'; },
  create(f = {}) {
    const s = settings();
    const doc = {
      name: '', funnel: 'sales', stage: 'lead', created: today(), createdAt: Date.now(), stageAt: Date.now(),
      manager: Who.role() === 'manager' ? Who.id() : null, tags: [], quiz: {}, source: 'site',
      trialUntil: null, ...f,
    };
    doc.ev = {[uid()]: {kind: 'sys', t: Date.now(), by: Who.id(), text: f.importBatch ? `Загружена из файла «${f.importBatch}»` : 'Карточка создана вручную'}, ...(f.ev || {})};
    if (!doc.refCode && doc.name) doc.refCode = refCodeFor(doc.name);
    void s;
    return Store.add('clients', doc);
  },
  contactFor(c, ch) {
    if (ch === 'tg') return c.tg ? '@' + tgUser(c.tg) : '';
    if (ch === 'wa') return phoneFmt(c.wa || c.phone);
    if (ch === 'max' || ch === 'sms') return phoneFmt(c.phone);
    if (ch === 'email') return c.email || '';
    if (ch === 'push') return c.appId ? 'в приложении' : '';
    return '';
  },
  /* внешние ссылки: открываются в новой вкладке, работают и без интеграций */
  chatUrl(c, ch) {
    if (ch === 'tg' && c.tg) return 'https://t.me/' + encodeURIComponent(tgUser(c.tg));
    if (ch === 'wa' && (c.wa || c.phone)) return 'https://wa.me/' + phoneDigits(c.wa || c.phone);
    return '';
  },
};

/* согласие на рекламную рассылку по каналу: без него сообщение не уходит */
function allowed(c, ch) {
  if (!c.consentAds) return {ok: false, why: 'нет согласия на рассылки'};
  if (c.allowCh && c.allowCh.length && !c.allowCh.includes(ch)) return {ok: false, why: 'канал не разрешён'};
  if ((c.unsub || []).includes(ch)) return {ok: false, why: 'отписалась'};
  if (!Clients.contactFor(c, ch)) return {ok: false, why: 'нет контакта'};
  return {ok: true};
}

/* ── задачи: живут в истории карточки, собираются здесь ── */
const Tasks = {
  all: memo(() => {
    const out = [];
    for (const col of ['clients', 'experts', 'partners']) {
      for (const e of Store.all(col)) {
        for (const [id, x] of Object.entries(e.ev || {})) if (x.kind === 'task') out.push({...x, id, col, ent: e});
      }
    }
    return out.sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')) || (a.t - b.t));
  }),
  open() { return this.all().filter(x => !x.done); },
  whoOf(x) { return x.who || x.ent.manager || null; },
  mine() { const me = Who.id(); return this.open().filter(x => this.whoOf(x) === me); },
  visible() { return Who.can('clients.all') ? this.open() : this.mine(); },
  mineOverdue() { const t = today(); return this.mine().filter(x => x.due && x.due < t).length; },
  add(col, id, {title, due, who}) { return Ev.add(col, id, {kind: 'task', title, due: due || today(), who: who || null, done: false}); },
  done(col, id, eid, v = true) { return Ev.set(col, id, eid, {done: v, doneAt: v ? Date.now() : null, doneBy: v ? Who.id() : null}); },
};
const entHref = (col, e) => `#${({clients: 'client', experts: 'expert', partners: 'partner'})[col]}-${e.id}`;
const entName = (col, e) => (col === 'clients' ? Clients.name(e) : e ? e.name || 'Без названия' : '—');

/* ── групповые чаты ── */
const Chats = {
  all() { return Store.all('chats').sort((a, b) => (a.order ?? 9) - (b.order ?? 9)); },
  get(id) { return Store.get('chats', id); },
  msgs(ch) { return Object.entries((ch && ch.msgs) || {}).map(([id, m]) => ({...m, id})).sort((a, b) => a.t - b.t); },
  index: memo(() => {
    const m = {};
    for (const ch of Store.all('chats')) {
      for (const [id, x] of Object.entries(ch.msgs || {})) {
        if (x.from && x.from.type === 'client') (m[x.from.id] = m[x.from.id] || []).push({...x, id, chat: ch.id, chatName: ch.name});
      }
    }
    return m;
  }),
  byClient(id) { return this.index()[id] || []; },
  post(chatId, text, extra = {}) {
    return Store.patch('chats', chatId, {msgs: {[uid()]: {t: Date.now(), from: {type: 'team', id: Who.id()}, text, ...extra}}});
  },
  memberOf(c) { return this.all().filter(ch => (ch.members || []).includes(c.id)); },
};

/* ── переписка ── */
const Inbox = {
  threads: memo(() => Clients.visible().filter(c => cx(c).msgs.length).sort((a, b) => (cx(b).lastMsg.t || 0) - (cx(a).lastMsg.t || 0))),
  unreadTotal() { const me = Who.id(); return sum(this.threads().filter(c => !c.manager || c.manager === me || Who.role() === 'owner' || Who.role() === 'lead'), c => cx(c).unread); },
  /* каналы, которые реально отправляют: подключаются в «Настройках → Интеграции» */
  live(ch) { const i = (Cfg.list('integrations') || {})[ch]; return !!(i && i.status === 'on'); },
  send(clientId, ch, text) {
    return Ev.add('clients', clientId, {kind: 'msg', ch, dir: 'out', text, status: this.live(ch) ? 'queued' : 'saved'});
  },
  markRead(c) { if (cx(c).unread && !Who.readOnly()) Store.patch('clients', c.id, {readAt: Date.now()}); },
};
function fillTemplate(text, c) {
  const s = settings();
  return String(text || '')
    .replace(/\{имя\}/g, c ? (Clients.name(c).split(' ')[0]) : 'Имя')
    .replace(/\{менеджер\}/g, Team.first(Who.member()) || 'менеджер')
    .replace(/\{промокод\}/g, (c && c.refCode) || 'EVA')
    .replace(/\{ссылка\}/g, 'eva.space/pay')
    .replace(/\{цена\}/g, rub(s.price));
}

/* ── рефералы: одна ступень, только с фактических оплат ── */
const Referral = {
  idx: memo(() => {
    const m = {};
    Store.all('clients').forEach(c => { if (c.referrerId) (m[c.referrerId] = m[c.referrerId] || []).push(c); });
    return m;
  }),
  invitees(id) { return this.idx()[id] || []; },
  program(r) { return REF_PROGRAMS[r.refProgram] ? r.refProgram : 'friend'; },
  rate(r, pay) {
    const s = settings();
    if (typeof r.refRate === 'number') return r.refRate;
    const prog = this.program(r);
    if (prog === 'key') {
      const since = r.ambSince || r.created || today();
      return isoTs(pay.t) <= addDays(since, 365) ? s.ambKeyRate : s.ambRate;
    }
    if (prog === 'amb') return s.ambRate;
    return s.refRates[levelOf(r.points).id] ?? 0.1;
  },
  /* начисления по месяцам: [{month, amount, inv, t, type, base}] */
  accruals(r) {
    const s = settings(), prog = this.program(r), out = [], cur = monthOf(today());
    for (const inv of this.invitees(r.id)) {
      if (inv.id === r.id) continue;           // самоприглашение не считается
      const until = addDays(inv.created || today(), 30 * s.refMonths);
      for (const p of cx(inv).ok) {
        if (p.method === 'balance' || p.type === 'topup') continue;
        const d = isoTs(p.t);
        if (prog === 'friend' && d > until) continue;
        const isSub = PAY_TYPES[p.type] && PAY_TYPES[p.type].sub;
        if (prog !== 'friend' && !isSub && p.type !== 'refund') continue;
        const rate = this.rate(r, p);
        const sign = p.type === 'refund' ? -1 : 1;
        const base = Math.abs(p.amount || 0) * (prog === 'friend' ? 1 : s.netFactor) * sign;
        if (prog !== 'friend' && p.type === 'year') {
          for (let i = 0; i < 12; i++) {
            const m = addMonths(monthOf(d), i);
            if (m > cur) break;
            out.push({month: m, amount: Math.round(base / 12 * rate), base: base / 12, rate, inv: inv.id, t: p.t, type: p.type, part: `${i + 1}/12`});
          }
        } else out.push({month: monthOf(d), amount: Math.round(base * rate), base, rate, inv: inv.id, t: p.t, type: p.type});
      }
    }
    return out;
  },
  settled(r, beforeMonth = '9999-99') {
    let s = 0;
    for (const reg of Store.all('payouts')) {
      if (reg.id >= beforeMonth) continue;
      const row = (reg.rows || {})[r.id];
      if (row && (row.status === 'paid' || row.status === 'balance')) s += row.amount || 0;
    }
    return s;
  },
  of(r) {
    const acc = this.accruals(r);
    const inv = this.invitees(r.id);
    const accrued = sum(acc, a => a.amount);
    const settled = this.settled(r);
    const paying = inv.filter(i => cx(i).ltv > 0).length;
    const revenue = sum(inv, i => cx(i).ltv);
    return {acc, inv, accrued, settled, available: accrued - settled, paying, revenue};
  },
  list: memo(() => Store.all('clients').filter(c => c.refProgram || Referral.invitees(c.id).length)),
  stageOf(r) {
    const st = this.of(r);
    if (st.settled > 0) return 'paid';
    if (st.accrued > 0) return 'accrued';
    if (st.paying) return 'converted';
    if (st.inv.length) return 'invited';
    return 'link';
  },
  min(r) { const s = settings(); return this.program(r) === 'friend' ? s.refMin : s.ambMin; },
  /* реестр месяца: что причитается к выплате 10 числа следующего месяца */
  registry(month) {
    const saved = Store.get('payouts', month) || {rows: {}};
    const rows = [];
    for (const r of this.list()) {
      const acc = this.accruals(r);
      const upTo = sum(acc.filter(a => a.month <= month), a => a.amount);
      const inMonth = sum(acc.filter(a => a.month === month), a => a.amount);
      const before = this.settled(r, month);
      const due = upTo - before;
      const row = (saved.rows || {})[r.id] || null;
      if (due <= 0 && !row) continue;
      const mode = (row && row.mode) || r.refMode || 'balance';
      const min = this.min(r);
      let status = row ? row.status : (mode === 'card' && due < min ? 'carry' : 'due');
      const needTax = mode === 'card' && this.program(r) !== 'friend' && !['npd', 'ip'].includes(r.taxStatus);
      rows.push({r, inMonth, due: row && row.amount ? row.amount : due, mode, status, min, needTax, row});
    }
    return rows.sort((a, b) => b.due - a.due);
  },
};
const REF_STAGES = [
  {id: 'link', name: 'Ссылка выдана'},
  {id: 'invited', name: 'Подруга пришла'},
  {id: 'converted', name: 'Подруга оплатила'},
  {id: 'accrued', name: 'Начислено'},
  {id: 'paid', name: 'Выплачено или на балансе'},
];
const PAYOUT_STATUS = {
  due:     {name: 'К выплате',          tone: 'warn'},
  carry:   {name: 'Меньше минимума — копится', tone: ''},
  hold:    {name: 'На паузе',           tone: 'bad'},
  paid:    {name: 'Выплачено',          tone: 'good'},
  balance: {name: 'Зачислено на баланс', tone: 'violet'},
};

/* ── партнёры и эксперты ── */
const Partners = {
  all() { return Store.all('partners').sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru')); },
  get(id) { return id ? Store.get('partners', id) : null; },
  idx: memo(() => { const m = {}; Store.all('clients').forEach(c => { if (c.partnerId) (m[c.partnerId] = m[c.partnerId] || []).push(c); }); return m; }),
  clients(p) { return this.idx()[p.id] || []; },
  stats(p) {
    const list = this.clients(p);
    const revenue = sum(list, c => cx(c).ltv);
    const rate = p.model === 'commission' || p.rate ? (typeof p.rate === 'number' ? p.rate : settings().partnerRate) : 0;
    const paidOut = sum(Ev.list(p).filter(e => e.kind === 'pay' && e.status === 'ok'), e => e.amount || 0);
    return {n: list.length, paying: list.filter(c => cx(c).ltv > 0).length, revenue, rate, reward: Math.round(revenue * rate), paidOut};
  },
  offers(p) { return Object.entries(p.offers || {}).map(([id, o]) => ({...o, id})).filter(o => !o.archived); },
};
const Experts = {
  all() { return Store.all('experts').sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru')); },
  get(id) { return id ? Store.get('experts', id) : null; },
  sales: memo(() => {
    const m = {};
    Store.all('clients').forEach(c => cx(c).ok.forEach(p => { if (p.expertId) (m[p.expertId] = m[p.expertId] || []).push({...p, client: c}); }));
    return m;
  }),
  stats(e) {
    const sales = this.sales()[e.id] || [];
    const revenue = sum(sales, cashOf);
    const share = typeof e.share === 'number' ? e.share : settings().expertShare;
    const paidOut = sum(Ev.list(e).filter(x => x.kind === 'pay' && x.status === 'ok'), x => x.amount || 0);
    const content = Object.values(e.content || {});
    return {sales, n: sales.filter(p => p.type !== 'refund').length, revenue, share, earned: Math.round(revenue * share), paidOut, owed: Math.round(revenue * share) - paidOut,
      content, live: content.filter(x => x.status === 'live').length};
  },
};

/* ── рассылки: статистика по событиям camp в карточках ── */
const Camps = {
  all() { return Store.all('campaigns').sort((a, b) => (b.at || b.createdAt || 0) - (a.at || a.createdAt || 0)); },
  idx: memo(() => {
    const m = {};
    Store.all('clients').forEach(c => Object.values(c.ev || {}).forEach(e => {
      if (e.kind !== 'camp' || !e.camp) return;
      const s = m[e.camp] = m[e.camp] || {total: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, unsub: 0, failed: 0, queued: 0, clients: []};
      s.total++;
      s.clients.push(c.id);
      const r = CAMP_RANK[e.status] ?? 0;
      if (e.status === 'failed') s.failed++;
      if (e.status === 'queued') s.queued++;
      if (e.status === 'unsub') s.unsub++;
      if (r >= 2 && e.status !== 'unsub') s.delivered++;
      if (r >= 3 && e.status !== 'unsub') s.opened++;
      if (r >= 4 && e.status !== 'unsub') s.clicked++;
      if (e.status === 'replied') s.replied++;
    }));
    return m;
  }),
  stats(camp) {
    const s = this.idx()[camp.id] || {total: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, unsub: 0, failed: 0, queued: 0, clients: []};
    /* оплатили в течение 7 дней после рассылки */
    const from = camp.at || camp.createdAt || 0, to = from + 7 * 864e5;
    const paid = s.clients.map(id => Store.get('clients', id)).filter(c => c && cx(c).ok.some(p => p.type !== 'refund' && p.t >= from && p.t <= to));
    return {...s, paid: paid.length, paidSum: sum(paid, c => sum(cx(c).ok.filter(p => p.t >= from && p.t <= to), cashOf))};
  },
};

/* ── общее для отчётов ── */
function monthsBack(n, end = monthOf(today())) { return monthRange(addMonths(end, -(n - 1)), end); }
const PERIODS = {
  '7':   {name: '7 дней',   from: () => addDays(today(), -6)},
  '30':  {name: '30 дней',  from: () => addDays(today(), -29)},
  '90':  {name: '90 дней',  from: () => addDays(today(), -89)},
  month: {name: 'Этот месяц', from: () => monthStart(monthOf(today()))},
  all:   {name: 'Всё время', from: () => '2000-01-01'},
};
const periodFrom = k => (PERIODS[k] || PERIODS['30']).from();
