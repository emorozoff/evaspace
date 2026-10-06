/* Календарь команды. Google Календарь подключается через коннектор Claude
   (capability mcp) и работает от имени того, кто смотрит штаб:
   • каждый видит свои события с названиями — они не сохраняются в штабе;
   • в общую базу уходят только интервалы «занят» на 4 недели вперёд — без
     названий, мест и участников, — чтобы команда видела занятость друг
     друга и общие свободные окна;
   • собрание создаётся в Google Календаре организатора, участникам сразу
     приходит приглашение, а в штабе видно, кто принял.
   Без коннектора (GitHub Pages, другое окно) собрания живут в штабе —
   просто без приглашений. Время команды — московское. */

const GCAL = 'Google Calendar';
/* Созвоны из Eva CRM: CRM ставит их в Google Календарь того, кто назначил,
   с названием «CRM · …» и меткой #eva-crm в описании. Штаб узнаёт их по
   метке и рисует полупрозрачными — это чужие для штаба встречи, но время
   занято. Ссылка из описания ведёт прямо в карточку человека в CRM. */
const CRM_URL = 'https://claude.ai/artifact/3KRhRoeBVMY5cWps3oSASA';
const CRM_TAG = '#eva-crm';
const evCrm = ev => String(ev.description || '').includes(CRM_TAG) || /^CRM ·/.test(String(ev.summary || ''));
const crmLinkOf = ev => { const m = String(ev.description || '').match(/https:\/\/claude\.ai\/artifact\/[A-Za-z0-9]+#p-[A-Za-z0-9_-]+/); return m ? m[0] : CRM_URL; };
const TZ = 'Europe/Moscow', TZ_OFF = '+03:00', TZ_MS = 3 * 3600e3;
const CAL_H0 = 8, CAL_H1 = 21;          // сетка дня: 8:00–21:00
const SYNC_DAYS = 28;                   // занятость в базе — на 4 недели
const DURS = [15, 30, 45, 60, 90, 120];
const REPEATS = {'': 'Не повторять', weekly: 'Каждую неделю', biweekly: 'Раз в две недели'};
const RSVP = {
  accepted:    {name: 'идёт',       tone: 'good', mark: '✓'},
  tentative:   {name: 'возможно',   tone: 'warn', mark: '?'},
  declined:    {name: 'не идёт',    tone: 'bad',  mark: '✕'},
  needsAction: {name: 'нет ответа', tone: '',     mark: '·'},
};

/* ── время: всё в московском, чтобы у команды совпадали часы ── */
const tMs = (d, hm) => Date.parse(`${d}T${hm}:00${TZ_OFF}`);
const mskDate = ms => new Date(ms + TZ_MS).toISOString().slice(0, 10);
const mskMin = ms => { const d = new Date(ms + TZ_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const hmOf = min => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const hmMs = ms => hmOf(mskMin(ms));
const isoMs = ms => `${mskDate(ms)}T${hmMs(ms)}:00${TZ_OFF}`;
/* «сейчас» — для проверок подменяется вместе с «сегодня» */
const nowMs = () => window.__EVA_NOW || (window.__EVA_TODAY ? tMs(window.__EVA_TODAY, '09:30') : Date.now());
const ceil15 = ms => Math.ceil(ms / 9e5) * 9e5;
const wait = ms => new Promise(r => setTimeout(r, ms));
function mergeIv(list) {
  const a = list.filter(x => x[1] > x[0]).sort((x, y) => x[0] - y[0]), out = [];
  a.forEach(([s, e]) => { const l = out[out.length - 1]; if (l && s <= l[1]) l[1] = Math.max(l[1], e); else out.push([s, e]); });
  return out;
}

/* ── почта для приглашений: своя для календаря → карточка в «Команде» →
   почта подключённого Google → почта входа в штаб ── */
const accountOf = pid => Store.all('accounts').find(a => a.personId === pid && a.active !== false) || null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAIL_SRC = {cal: 'своя для календаря', card: 'из карточки в «Команде»', google: 'из подключённого Google', login: 'почта входа в штаб'};
function inviteMail(p) {
  if (!p) return {mail: '', src: ''};
  const acc = accountOf(p.id);
  for (const [src, v] of [['cal', p.calEmail], ['card', p.email], ['google', p.gcalEmail], ['login', acc && acc.email]]) {
    if (v && EMAIL_RE.test(String(v).trim())) return {mail: String(v).trim(), src};
  }
  return {mail: '', src: ''};
}
const inviteEmail = p => inviteMail(p).mail;
function personByEmail(email) {
  const e = normEmail(email);
  if (!e) return null;
  return people().find(p => [p.calEmail, p.email, p.gcalEmail, (accountOf(p.id) || {}).email].some(x => x && normEmail(x) === e)) || null;
}
/* какой календарь читает штаб и куда кладёт собрания: выбранный человеком или основной */
const myCalId = () => { const p = personById(Auth.personId()); return (p && p.calId) || ''; };
const canEditMail = pid => Auth.can('team.manage') || pid === Auth.personId();
const calPeople = () => people().filter(p => p.name && (p.status || 'active') === 'active');

/* ── ошибки коннектора: у каждого кода своё действие ── */
const CAL_ERR = {
  needs_reauth: 'Доступ к Google Календарю истёк. Переподключите его: claude.ai → Настройки → Коннекторы → Google Calendar — и обновите страницу.',
  server_not_connected: 'Google Календарь не подключён к вашему Claude. Добавьте его: claude.ai → Настройки → Коннекторы → Google Calendar — и обновите страницу.',
  selection_required: 'У вас подключено несколько Google Календарей — Claude попросит выбрать один. Если окно закрыли, обновите страницу.',
  not_in_manifest: 'Доступ к календарю для этой страницы выключен или отклонён. Разрешите Google Календарь в настройках артефакта и обновите страницу.',
  blocked_by_policy: 'Организация запретила этот инструмент Google Календаря.',
  approval_required: 'Нужно разрешение администратора организации на Google Календарь.',
  server_not_found: 'Коннектор Google Календаря не найден. Подключите его заново: claude.ai → Настройки → Коннекторы.',
  consent_required: 'Штабу нужен доступ к Google Календарю — нажмите «Подключить» ещё раз и подтвердите.',
  server_unavailable: 'Google Календарь сейчас не отвечает. Попробуйте через минуту.',
  rate_limited: 'Слишком много запросов к календарю — подождите немного.',
  cancelled: 'Действие отменено.',
};
const CAL_OFF = ['not_granted', 'capability_disabled', 'capability_removed'];
const CAL_CONN = ['needs_reauth', 'server_not_connected', 'selection_required', 'not_in_manifest', 'blocked_by_policy', 'approval_required', 'server_not_found', 'consent_required'];
function calErr(e) {
  const code = (e && e.code) || 'upstream_error';
  let text = CAL_ERR[code];
  if (!text && CAL_OFF.includes(code)) text = 'Google Календарь недоступен в этом окне — откройте штаб в Claude.';
  if (!text && code === 'tool_error') text = 'Google ответил ошибкой: ' + ((e && e.message) || 'без подробностей');
  if (!text) text = 'Не получилось связаться с Google Календарём' + (e && e.message ? ': ' + e.message : '') + '.';
  /* для записи «не ответил» не значит «не сделал» — повторять только после проверки */
  const ambiguous = code === 'server_unavailable' || code === 'upstream_error' || !(code in CAL_ERR || CAL_OFF.includes(code) || code === 'tool_error' || code === 'bad_request');
  return {code, text, conn: CAL_CONN.includes(code), off: CAL_OFF.includes(code), ambiguous};
}

/* ── связь с Google ── */
const Cal = {
  api: undefined,
  conn: 'checking',     // checking · ready · prompt · denied · off · error
  err: null,            // {code, text} — ошибка подключения для всей страницы
  hint: '',             // мягкая подсказка по списку коннекторов
  hostEmail: '',        // почта календаря, который сейчас читает штаб
  calendars: null,      // календари подключённого аккаунта (list_calendars) — только в памяти
  calLoading: false,
  week: {},             // понедельник → {events, at} | {loading} | {err} — свои события, только в памяти
  syncing: false,
  _init: null,
  _auto: false,

  init() {
    if (this._init) return this._init;
    this._init = (async () => {
      try { this.api = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('mcp') : null; }
      catch (e) { this.api = null; }
      if (!this.api) { this.conn = 'off'; App.renderSoon(); return; }
      let st = 'prompt';
      try {
        const perms = await window.claude.use('permissions');
        if (perms) st = await perms.state('mcp:' + GCAL).catch(() => 'unavailable');
      } catch (e) { st = 'prompt'; }
      /* список коннекторов — только подсказка: окончательно решает ответ на вызов */
      try {
        const lt = await this.api.listTools(GCAL);
        const srv = ((lt && lt.servers) || []).find(x => x.server === GCAL);
        if (srv && srv.authStatus === 'needs_reauth') this.setErr({code: 'needs_reauth'});
        else if (!srv || !(srv.tools || []).length) this.hint = 'Похоже, Google Календарь ещё не подключён к вашему Claude (claude.ai → Настройки → Коннекторы → Google Calendar) или подключено несколько и нужно выбрать один. Если он подключён — просто нажмите кнопку.';
      } catch (e) { /* решат коды вызовов */ }
      if (!this.err) this.conn = st === 'unavailable' ? 'off' : st === 'denied' ? 'denied' : st === 'granted' ? 'ready' : 'prompt';
      App.renderSoon();
    })();
    return this._init;
  },
  usable() { return this.conn === 'ready' || this.conn === 'prompt'; },
  setErr(e) {
    const x = calErr(e);
    if (x.off) { this.conn = 'off'; this.err = null; }
    else if (x.conn) { this.conn = 'error'; this.err = x; }
    return x;
  },

  /* read — чтение: одна тихая повторная попытка, если Google разрешил; запись не повторяем */
  async call(tool, input, read = false) {
    await this.init();
    if (!this.api) throw {code: 'capability_disabled'};
    const run = () => this.api.callTool(GCAL, tool, input, read ? undefined : {cache: false});
    let r;
    try { r = await run(); }
    catch (e) {
      if (!(read && e && e.retryable)) { this.setErr(e); throw e; }
      await wait(Math.min(60000, e.retryAfterMs || 700 + Math.random() * 1300));
      try { r = await run(); } catch (e2) { this.setErr(e2); throw e2; }
    }
    this.conn = 'ready';
    this.err = null;
    this.hint = '';
    return r && r.payload !== undefined ? r.payload : r;
  },

  async events(from, to) {
    const input = {startTime: `${from}T00:00:00${TZ_OFF}`, endTime: `${addDays(to, 1)}T00:00:00${TZ_OFF}`, orderBy: 'startTime', pageSize: 250, timeZone: TZ};
    const cid = myCalId();
    if (cid) input.calendarId = cid;
    let list = [], token = null;
    for (let page = 0; page < 4; page++) {
      const res = await this.call('list_events', token ? {...input, pageToken: token} : input, true);
      list = list.concat(Array.isArray(res) ? res : (res && (res.events || res.items)) || []);
      /* название основного календаря — это почта владельца */
      if (res && EMAIL_RE.test(res.summary || '')) this.hostEmail = res.summary;
      token = res && res.nextPageToken;
      if (!token) break;
    }
    return list.filter(ev => ev && ev.status !== 'cancelled');
  },

  /* календари, доступные подключённому аккаунту Google: основной, общие, чужие с доступом */
  async loadCalendars() {
    if (this.calLoading) return;
    this.calLoading = true;
    App.renderSoon();
    try {
      let list = [], token = null;
      for (let page = 0; page < 3; page++) {
        const res = await this.call('list_calendars', token ? {pageSize: 100, pageToken: token} : {pageSize: 100}, true);
        list = list.concat((res && (res.calendars || res.items)) || []);
        token = res && res.nextPageToken;
        if (!token) break;
      }
      this.calendars = list.filter(c => c && c.id).map(c => ({id: String(c.id), name: String(c.summary || c.summaryOverride || c.id), primary: !!c.primary}));
    } catch (e) {
      this.calendars = null;
      const x = calErr(e);
      if (!x.conn && !x.off) toast(x.text, {error: true});
    } finally {
      this.calLoading = false;
      App.renderSoon();
    }
  },

  /* свои события недели — для сетки «Неделя» */
  async loadWeek(ws) {
    if (this.week[ws] && !this.week[ws].err) return;
    this.week[ws] = {loading: true};
    try {
      this.week[ws] = {events: await this.events(ws, addDays(ws, 6)), at: Date.now()};
    } catch (e) {
      this.week[ws] = {err: calErr(e)};
    }
    App.renderSoon();
  },

  /* синхронизация: свои события на 4 недели → интервалы «занят» в базу,
     почта календаря в карточку и ответы на приглашения штаба */
  async sync({silent = false} = {}) {
    const pid = Auth.personId();
    if (!pid || this.syncing) return false;
    this.syncing = true;
    App.renderSoon();
    const from = weekStart(today()), to = addDays(from, SYNC_DAYS - 1);
    try {
      const events = await this.events(from, to);
      for (let w = from; w <= to; w = addDays(w, 7)) {
        const a = tMs(w, '00:00'), b = tMs(addDays(w, 7), '00:00');
        this.week[w] = {events: events.filter(ev => { const r = evRange(ev); return r && r.end > a && r.start < b; }), at: Date.now()};
      }
      const busyEv = events.filter(evBusy).filter(ev => !meetingOfEvent(ev));
      const slots = mergeIv(busyEv.filter(ev => !evCrm(ev)).map(evRange).filter(Boolean).map(r => [r.start, r.end]));
      /* созвоны CRM — без названий, только время: команда видит их отдельно и полупрозрачными */
      const crm = busyEv.filter(evCrm).map(evRange).filter(r => r && !r.allDay).map(r => [r.start, r.end]).sort((x, y) => x[0] - y[0]);
      Store.put('busy', pid, {slots, crm, from, to, at: Date.now(), share: true});
      const email = selfEmail(events) || this.hostEmail || '', p = personById(pid);
      if (!myCalId() && email && p && normEmail(p.gcalEmail) !== normEmail(email)) Store.patch('people', pid, {gcalEmail: email});
      syncRsvp(events);
      if (!silent) toast('Календарь обновлён: команда видит вашу занятость на 4 недели вперёд');
      return true;
    } catch (e) {
      const x = calErr(e);
      if (!silent && !x.conn && !x.off) toast(x.text, {error: true});
      return false;
    } finally {
      this.syncing = false;
      App.renderSoon();
    }
  },

  /* тихое обновление занятости раз в полчаса — только если человек уже поделился и доступ дан */
  autoSync() {
    const pid = Auth.personId();
    if (this._auto || !pid) return;
    const doc = Store.get('busy', pid);
    if (!doc || doc.share === false || Date.now() - (doc.at || 0) < 30 * 60e3) return;
    this._auto = true;
    this.init().then(() => { if (this.conn === 'ready') this.sync({silent: true}); });
  },

  stopSharing() {
    const pid = Auth.personId();
    if (!pid) return;
    Store.put('busy', pid, {slots: [], share: false, at: Date.now()});
    toast('Занятость больше не видна команде. Собрания штаба остаются.');
  },
};

/* ── события Google ── */
function evRange(ev) {
  const s = ev.start || {}, e = ev.end || {};
  if (s.dateTime) { const a = Date.parse(s.dateTime); return {start: a, end: Date.parse(e.dateTime || s.dateTime) || a, allDay: false}; }
  /* день события приходит и как «2026-10-10», и как «2026-10-10T00:00:00Z» — берём дату */
  if (s.date) { const d0 = String(s.date).slice(0, 10), d1 = e.date ? String(e.date).slice(0, 10) : addDays(d0, 1); return {start: tMs(d0, '00:00'), end: tMs(d1 > d0 ? d1 : addDays(d0, 1), '00:00'), allDay: true, d0, d1: d1 > d0 ? d1 : addDays(d0, 1)}; }
  return null;
}
const evType = ev => String(ev.eventType || '').toLowerCase().replace(/[_\s]/g, '');
/* занимает ли событие время: не «свободен», не отклонено, не место работы и не день рождения */
const evDeclined = ev => { const me = (ev.attendees || []).find(a => a.self); return !!(me && me.responseStatus === 'declined'); };
function evBusy(ev) {
  if (ev.transparency === 'transparent' || ev.availability === 'AVAILABILITY_FREE') return false;
  if (['workinglocation', 'birthday'].includes(evType(ev))) return false;
  return !evDeclined(ev);
}
function selfEmail(events) {
  for (const ev of events) {
    const a = (ev.attendees || []).find(x => x.self && x.email);
    if (a) return a.email;
    if (ev.organizer && ev.organizer.self && ev.organizer.email) return ev.organizer.email;
    if (ev.creator && ev.creator.self && ev.creator.email) return ev.creator.email;
  }
  return '';
}
function meetingOfEvent(ev) {
  const id = String(ev.id || ''), rid = String(ev.recurringEventId || '');
  return Store.all('meetings').find(m => m.gcalId && (id === m.gcalId || rid === m.gcalId || id.startsWith(m.gcalId + '_'))) || null;
}
/* кто принял приглашение: статусы участников из своей копии события */
function syncRsvp(events) {
  events.forEach(ev => {
    const m = meetingOfEvent(ev);
    if (!m || !Array.isArray(ev.attendees)) return;
    const resp = {};
    ev.attendees.forEach(a => { const p = personByEmail(a.email); if (p && a.responseStatus) resp[p.id] = a.responseStatus; });
    const cur = m.responses || {};
    if (Object.keys(resp).some(k => cur[k] !== resp[k])) Store.patch('meetings', m.id, {responses: resp});
  });
}
const eventOf = res => (res && (res.event || res.createdEvent || res.updatedEvent)) || res || {};
function meetUrlOf(ev) {
  if (!ev) return '';
  if (ev.hangoutLink) return ev.hangoutLink;
  const ep = ((ev.conferenceData || {}).entryPoints || []).find(x => x.entryPointType === 'video' && x.uri);
  return ep ? ep.uri : (ev.meetUrl || ev.googleMeetUrl || '');
}

/* ── собрания штаба ── */
const Meetings = {
  all() { return Store.all('meetings').filter(m => m.date && m.start); },
  step(m) { return m.repeat === 'weekly' ? 7 : m.repeat === 'biweekly' ? 14 : 0; },
  /* вхождения в диапазон дат, с повторами */
  occ(from, to) {
    const out = [];
    this.all().forEach(m => {
      const step = this.step(m);
      if (!step) { if (m.date >= from && m.date <= to) out.push({m, date: m.date}); return; }
      let d = m.date;
      if (d < from) d = addDays(d, Math.ceil(daysBetween(d, from) / step) * step);
      for (; d <= to && d <= (m.until || Q.end); d = addDays(d, step)) out.push({m, date: d});
    });
    return out.map(o => { const s = tMs(o.date, o.m.start); return {...o, s, e: s + (Number(o.m.dur) || 60) * 60e3}; }).sort((a, b) => a.s - b.s);
  },
  next(m) { const t = today(); return this.occ(t, addDays(t, 120)).find(o => o.m.id === m.id && o.e > nowMs()) || null; },
  people(m) { return [m.organizer, ...(m.attendees || [])].filter((x, i, a) => x && a.indexOf(x) === i); },
  mine(m) { const pid = Auth.personId(); return !!pid && this.people(m).includes(pid); },
  when(m) {
    const step = this.step(m);
    const t = `${m.start}–${hmMs(tMs(m.date, m.start) + (Number(m.dur) || 60) * 60e3)}`;
    if (!step) return `${dayWd(m.date)}, ${t}`;
    const wd = ['по понедельникам', 'по вторникам', 'по средам', 'по четвергам', 'по пятницам', 'по субботам', 'по воскресеньям'][weekday(m.date)];
    return `${step === 7 ? '' : 'раз в две недели, '}${wd}, ${t}`;
  },
};

/* занятость человека за дни: интервалы Google (без названий) + собрания штаба */
function busyOf(pid, from, to) {
  const doc = Store.get('busy', pid);
  const shared = !!(doc && doc.share !== false && doc.from);
  const a = tMs(from, '00:00'), b = tMs(addDays(to, 1), '00:00');
  const list = [];
  if (shared) (doc.slots || []).forEach(([s, e]) => { if (e > a && s < b) list.push({s, e, kind: 'busy'}); });
  if (shared) (doc.crm || []).forEach(([s, e]) => { if (e > a && s < b) list.push({s, e, kind: 'crm'}); });
  Meetings.occ(from, to).forEach(o => {
    if (Meetings.people(o.m).includes(pid) && (o.m.responses || {})[pid] !== 'declined') list.push({s: o.s, e: o.e, kind: 'meet', m: o.m});
  });
  return {has: shared && doc.from <= from && doc.to >= to, shared, at: doc ? doc.at : 0, list: list.sort((x, y) => x.s - y.s)};
}
/* общие свободные окна: рабочие часы минус чья-то занятость */
function freeWindows(pids, date, wh, minDur = 30) {
  const d0 = tMs(date, '00:00');
  let lo = d0 + wh[0] * 36e5;
  const hi = d0 + wh[1] * 36e5, now = nowMs();
  if (hi <= now) return [];
  if (lo < now) lo = ceil15(now);
  const busy = mergeIv(pids.flatMap(pid => busyOf(pid, date, date).list.map(x => [x.s, x.e])));
  const out = [];
  let cur = lo;
  for (const [s, e] of busy) {
    if (e <= cur) continue;
    if (s >= hi) break;
    if (s - cur >= minDur * 60e3) out.push([cur, Math.min(s, hi)]);
    cur = Math.max(cur, e);
  }
  if (hi - cur >= minDur * 60e3) out.push([cur, hi]);
  return out;
}
/* ближайшие удобные начала для собрания */
function suggestSlots(pids, dur, wh, fromDate, n = 8) {
  const out = [];
  for (let i = 0, d = fromDate; i < 21 && out.length < n; i++, d = addDays(d, 1)) {
    if (weekday(d) > 4) continue;
    freeWindows(pids, d, wh, dur).forEach(([s, e]) => {
      for (let t = s, k = 0; t + dur * 60e3 <= e && k < 2 && out.length < n; t += 60 * 60e3, k++) out.push(t);
    });
  }
  return out;
}
/* кто занят в выбранное время */
function conflictsAt(pids, s, e, skipId) {
  const d = mskDate(s);
  return pids.map(pid => {
    const b = busyOf(pid, d, d);
    const hit = b.list.find(x => x.s < e && x.e > s && !(x.m && x.m.id === skipId));
    return hit ? {pid, hit} : (!b.has ? {pid, unknown: true} : null);
  }).filter(Boolean);
}

/* ── раскладка пересекающихся блоков в дорожки ── */
function lanes(items) {
  items.sort((a, b) => a.s - b.s || b.e - a.e);
  let group = [], ends = [], groupEnd = -Infinity;
  const finish = () => { const n = ends.length || 1; group.forEach(x => { x.lanes = n; }); };
  items.forEach(it => {
    if (it.s >= groupEnd && group.length) { finish(); group = []; ends = []; }
    let c = ends.findIndex(end => end <= it.s);
    if (c < 0) { c = ends.length; ends.push(0); }
    ends[c] = it.e;
    it.lane = c;
    group.push(it);
    groupEnd = Math.max(groupEnd, it.e);
  });
  if (group.length) finish();
  return items;
}

/* ── страница ── */
const CalUI = {ws: null, day: null};

App.register('calendar', {
  title: 'Календарь',
  render(root) {
    Cal.init();
    const t = today();
    const tab = View.get('cal.tab', 'week');
    const ws = CalUI.ws || weekStart(t);
    const canMeet = Auth.can('tasks.edit');
    const wkDays = View.get('cal.days', 7);

    root.innerHTML = `
      ${pageHead('Календарь', 'Занятость команды, общие свободные окна и собрания. Приглашения приходят участникам прямо в их Google Календарь.',
        `${helpBtn('calendar')}${canMeet ? `<button class="btn primary" data-new-meet>${icon('plus')}Собрание</button>` : ''}`)}
      ${helpBox('calendar', `<b>Как это работает.</b> Нажмите «Подключить мой Google Календарь» — один раз. Вы увидите свои события в сетке недели, а команда — только когда вы <b>заняты</b>: названия, места и участники ваших встреч в штаб не попадают. <b>Собрание</b>: кнопка сверху или клик по сетке → название, время, участники → «Создать и отправить приглашения» — событие появится в вашем Google Календаре, участникам придёт приглашение на почту и в их календарь, со ссылкой на Google Meet. Вкладка «Занятость команды» показывает, кто когда занят, и зелёным — окна, где свободны все выбранные: нажмите на окно, и собрание создастся на это время. Приглашение уходит на почту из вкладки <b>«Почты»</b>: по умолчанию это почта из карточки в «Команде», но каждый может вписать свою — например, другой аккаунт Google. Там же выбирается, какой календарь читает штаб.`)}
      ${connCard()}
      <div class="cal-bar">
        <div class="tabs cal-tabs" role="tablist">
          <button data-ctab="week" class="${tab === 'week' ? 'on' : ''}">Неделя</button>
          <button data-ctab="team" class="${tab === 'team' ? 'on' : ''}">Занятость команды</button>
          <button data-ctab="list" class="${tab === 'list' ? 'on' : ''}">Собрания <span class="n">${upcomingMeetings().length || ''}</span></button>
          <button data-ctab="mail" class="${tab === 'mail' ? 'on' : ''}">Почты${(n => n ? ` <span class="n warn-t" title="без почты — приглашения не придут">${n} без почты</span>` : '')(calPeople().filter(x => !inviteEmail(x)).length)}</button>
        </div>
        ${tab === 'week' || tab === 'team' ? `<div class="cal-nav">
          <button class="icon-btn" data-wk="-7" aria-label="Предыдущая неделя">${icon('back')}</button>
          <b class="cal-wk">${weekLabel(ws)}</b>
          <button class="icon-btn" data-wk="7" aria-label="Следующая неделя" style="transform:scaleX(-1)">${icon('back')}</button>
          ${ws !== weekStart(t) ? '<button class="btn xs ghost" data-wk="0">Сегодня</button>' : ''}
          ${tab === 'week' ? `<div class="seg"><button data-days="5" class="${wkDays === 5 ? 'on' : ''}">Пн–Пт</button><button data-days="7" class="${wkDays === 7 ? 'on' : ''}">7 дней</button></div>` : ''}
        </div>` : ''}
      </div>
      <div id="calView">${tab === 'team' ? calTeamView(ws) : tab === 'list' ? calListView() : tab === 'mail' ? calMailView() : calWeekView(ws, wkDays)}</div>`;

    wireHelp(root);
    on(root, 'click', '[data-ctab]', (e, el) => { View.set('cal.tab', el.dataset.ctab); App.render(); });
    on(root, 'click', '[data-wk]', (e, el) => {
      const n = Number(el.dataset.wk);
      CalUI.ws = n ? addDays(ws, n) : weekStart(t);
      CalUI.day = null;
      App.render();
    });
    on(root, 'click', '[data-days]', (e, el) => { View.set('cal.days', Number(el.dataset.days)); App.render(); });
    on(root, 'click', '[data-new-meet]', () => openMeeting(null));
    on(root, 'click', '[data-meet]', (e, el) => { e.stopPropagation(); openMeeting(el.dataset.meet); });
    on(root, 'click', '[data-cal-connect]', async (e, el) => {
      el.disabled = true;
      el.textContent = 'Подключаю…';
      await Cal.sync();
      App.render();
    });
    on(root, 'click', '[data-cal-sync]', () => Cal.sync());
    on(root, 'click', '[data-cal-stop]', async (e, el) => {
      if (await confirmPop(el, {text: 'Перестать показывать команде вашу занятость?', yes: 'Да, перестать'})) Cal.stopSharing();
    });
    on(root, 'click', '[data-cal-retry]', () => { Cal._init = null; Cal.err = null; Cal.hint = ''; Cal.conn = 'checking'; Cal.week = {}; App.render(); });
    on(root, 'click', '[data-verify]', (e, el) => verifyMeeting(el.dataset.verify));
    on(root, 'click', '[data-push]', (e, el) => { el.disabled = true; pushMeeting(el.dataset.push); });
    on(root, 'click', '[data-cancel-meet]', (e, el) => cancelMeeting(el.dataset.cancelMeet, el));
    on(root, 'click', '[data-mine]', (e, el) => { View.set('cal.mine', el.dataset.mine === '1'); App.render(); });
    if (tab === 'week') calWireWeek(root, ws);
    if (tab === 'team') calWireTeam(root, ws);
    if (tab === 'mail') calWireMail(root);
    if (tab === 'mail' && Cal.conn === 'ready' && Cal.calendars === null && !Cal.calLoading) Cal.loadCalendars();
    if (tab === 'week' && Cal.conn === 'ready' && !Cal.week[ws]) Cal.loadWeek(ws);
    Cal.autoSync();
  },
});

/* ── подключение ── */
function connCard() {
  const pid = Auth.personId();
  const doc = pid ? Store.get('busy', pid) : null;
  const shared = doc && doc.share !== false && doc.from;
  const p = personById(pid);
  if (Cal.conn === 'checking') return '<div class="cal-conn slim"><i class="dot"></i><span>Проверяю Google Календарь…</span></div>';
  if (Cal.conn === 'off') return `<div class="cal-conn slim off"><i class="dot"></i><span><b>Google Календарь подключается, когда штаб открыт в Claude.</b> Здесь собрания сохраняются в штабе и видны команде, но приглашения не уходят, а своя занятость не подтягивается.</span></div>`;
  if (Cal.conn === 'error' && Cal.err) return `<div class="cal-conn warn"><div>${icon('cal')}</div><div><b>Google Календарь не отвечает штабу</b><p>${esc(Cal.err.text)}</p></div><button class="btn sm" data-cal-retry>Проверить снова</button></div>`;
  if (Cal.conn === 'denied') return `<div class="cal-conn warn"><div>${icon('cal')}</div><div><b>Доступ к календарю не разрешён</b><p>Вы отказали в доступе в этот раз. Обновите страницу и нажмите «Разрешить», когда Claude спросит.</p></div></div>`;
  if (!pid) return '<div class="cal-conn slim off"><i class="dot"></i><span>Ваша учётка не связана с карточкой в «Команде» — занятость не с чем связать. Напишите основателю.</span></div>';
  if (!shared) return `<div class="cal-conn">
      <div>${icon('cal')}</div>
      <div><b>Подключите свой Google Календарь</b>
        <p>Вы увидите свои события в сетке недели, а команда — только интервалы «занят» на 4 недели вперёд. Названия, места и участники ваших встреч в штаб не попадают. Claude спросит разрешение на доступ — нажмите «Разрешить».</p>
        ${Cal.hint ? `<p class="warn-t">${esc(Cal.hint)}</p>` : ''}</div>
      <button class="btn primary" data-cal-connect ${Cal.syncing ? 'disabled' : ''}>${Cal.syncing ? 'Подключаю…' : 'Подключить мой Google Календарь'}</button>
    </div>`;
  const cid = myCalId(), im = inviteMail(p);
  return `<div class="cal-conn slim ok"><i class="dot"></i>
      <span><b>Google Календарь подключён</b> · календарь: ${esc(cid ? calName(cid) : (p && p.gcalEmail) || 'основной')} · приглашения: ${im.mail ? esc(im.mail) : '<b class="warn-t">почта не указана</b>'} <button class="link-btn" data-ctab="mail">изменить</button> · занятость ${Cal.syncing ? 'обновляется…' : 'обновлена ' + timeAgo(doc.at)}</span>
      <button class="btn xs ghost" data-cal-sync ${Cal.syncing ? 'disabled' : ''}>${icon('refresh')}Обновить</button>
      <button class="btn xs ghost" data-cal-stop>Не показывать занятость</button>
    </div>`;
}

/* ── неделя: свои события + собрания штаба ── */
function calWeekView(ws, nDays) {
  const t = today();
  const dates = Array.from({length: nDays}, (_, i) => addDays(ws, i));
  const H = CAL_H1 - CAL_H0;
  const wk = Cal.week[ws];
  const own = wk && wk.events ? wk.events.filter(ev => !meetingOfEvent(ev)) : [];
  const occ = Meetings.occ(dates[0], dates[dates.length - 1]);
  const pct0 = ms => clamp((mskMin(ms) - CAL_H0 * 60) / (H * 60) * 100, 0, 100);
  const allDay = dates.map(d => own.filter(ev => { const r = evRange(ev); return r && r.allDay && r.d0 <= d && r.d1 > d && !evDeclined(ev); }));
  const hasAllDay = allDay.some(x => x.length);

  const col = (d, i) => {
    const a = tMs(d, hmOf(CAL_H0 * 60)), b = tMs(d, hmOf(CAL_H1 * 60));
    const items = [];
    own.forEach(ev => {
      const r = evRange(ev);
      if (!r || r.allDay || r.end <= a || r.start >= b || evDeclined(ev)) return;
      items.push({s: Math.max(r.start, a), e: Math.min(r.end, b), rs: r.start, re: r.end, ev, busy: evBusy(ev)});
    });
    occ.forEach(o => { if (o.date === d && o.e > a && o.s < b) items.push({s: Math.max(o.s, a), e: Math.min(o.e, b), rs: o.s, re: o.e, m: o.m}); });
    lanes(items);
    const blocks = items.map(it => {
      const top = pct0(it.s), h = Math.max(pct0(it.e) - top, 2.2);
      const style = `top:${top.toFixed(2)}%;height:${h.toFixed(2)}%;left:calc(${(it.lane / it.lanes * 100).toFixed(2)}% + 2px);width:calc(${(100 / it.lanes).toFixed(2)}% - 4px)`;
      const time = `${hmMs(it.rs)}–${hmMs(it.re)}`;
      const short = it.e - it.s <= 35 * 60e3 ? ' short' : '';
      if (it.m) {
        const mine = Meetings.mine(it.m);
        return `<button class="cw-ev meet${short} ${mine ? 'mine' : ''}" style="${style}" data-meet="${it.m.id}" title="${esc(it.m.title)} · ${time}"><b>${esc(it.m.title)}</b><small>${time}${it.m.meetUrl ? ' · Meet' : ''}</small></button>`;
      }
      const title = it.ev.summary || 'Без названия';
      if (evCrm(it.ev)) return `<a class="cw-ev own crm${short}" style="${style}" href="${esc(crmLinkOf(it.ev))}" target="_blank" rel="noopener" title="${esc(title)} · ${time} · открыть в CRM"><b>${esc(title.replace(/^CRM · /, ''))}</b><small>${time} · CRM</small></a>`;
      return `<a class="cw-ev own${short} ${it.busy ? '' : 'free'}" style="${style}" ${it.ev.htmlLink ? `href="${esc(it.ev.htmlLink)}" target="_blank" rel="noopener"` : ''} title="${esc(title)} · ${time}${it.busy ? '' : ' · не занимает время'}"><b>${esc(title)}</b><small>${time}</small></a>`;
    }).join('');
    const nowLine = d === t && mskDate(nowMs()) === d ? `<i class="cw-now" style="top:${pct0(nowMs()).toFixed(2)}%"></i>` : '';
    const offHours = `<i class="cw-off" style="top:0;height:${((10 - CAL_H0) / H * 100).toFixed(2)}%"></i><i class="cw-off" style="top:${((19 - CAL_H0) / H * 100).toFixed(2)}%;bottom:0"></i>`;
    return `<div class="cw-col ${weekday(d) > 4 ? 'we' : ''} ${d < t ? 'past' : ''}" data-date="${d}">${offHours}${blocks}${nowLine}</div>`;
  };

  let status = '';
  if (Cal.conn === 'ready' || Cal.conn === 'prompt') {
    if (!wk) status = Cal.conn === 'ready' ? 'Загружаю ваши события…' : 'Свои события появятся после подключения Google Календаря.';
    else if (wk.loading) status = 'Загружаю ваши события…';
    else if (wk.err) status = wk.err.text;
    else status = `Ваших событий: ${own.length} · собраний штаба: ${occ.length}`;
  } else status = `Собраний штаба на неделе: ${occ.length}`;

  const crmN = crmCalls(tMs(dates[0], '00:00'), tMs(addDays(dates[dates.length - 1], 1), '00:00')).length;
  return `<div class="cal-legend"><span><i class="lg-own"></i>ваши события из Google</span><span><i class="lg-crm"></i>созвоны CRM${crmN ? ` · ${crmN}` : ''}</span><span><i class="lg-meet"></i>собрания штаба</span><span><i class="lg-off"></i>вне рабочих часов</span><span class="note">${esc(status)}</span></div>
    <div class="cal-wrap"><div class="cal-week" style="--days:${nDays}">
      <div class="cw-corner"></div>
      ${dates.map(d => `<div class="cw-dh ${d === t ? 'is-today' : ''} ${weekday(d) > 4 ? 'we' : ''}"><span>${WD_SH[weekday(d)]}</span><b>${Number(d.slice(8))}</b><small>${MONTHS_SH[dateOf(d).getMonth()]}</small></div>`).join('')}
      ${hasAllDay ? `<div class="cw-adl">весь день</div>${allDay.map(list => `<div class="cw-ad">${list.map(ev => `<span class="cw-adi" title="${esc(ev.summary || '')}">${esc(ev.summary || 'Событие')}</span>`).join('')}</div>`).join('')}` : ''}
      <div class="cw-times">${Array.from({length: H}, (_, i) => `<span style="top:${(i / H * 100).toFixed(2)}%">${pad(CAL_H0 + i)}:00</span>`).join('')}</div>
      ${dates.map(col).join('')}
    </div></div>
    ${Auth.can('tasks.edit') ? '<p class="note">Нажмите на свободное место в сетке — откроется новое собрание на это время.</p>' : ''}`;
}
function calWireWeek(root) {
  if (!Auth.can('tasks.edit')) return;
  on(root, 'click', '.cw-col', (e, el) => {
    if (e.target.closest('.cw-ev')) return;
    const r = el.getBoundingClientRect();
    const min = CAL_H0 * 60 + (e.clientY - r.top) / r.height * (CAL_H1 - CAL_H0) * 60;
    const start = clamp(Math.floor(min / 30) * 30, CAL_H0 * 60, CAL_H1 * 60 - 30);
    openMeeting(null, {date: el.dataset.date, start: hmOf(start)});
  });
}

/* ── занятость команды: люди × часы одного дня ── */
function calTeamView(ws) {
  const t = today();
  const days = Array.from({length: 7}, (_, i) => addDays(ws, i));
  let day = CalUI.day && days.includes(CalUI.day) ? CalUI.day : (days.includes(t) ? t : days[0]);
  CalUI.day = day;
  const wh = View.get('cal.wh', [10, 19]);
  const all = calPeople();
  let sel = View.get('cal.sel', null);
  sel = (sel || all.map(p => p.id)).filter(id => all.some(p => p.id === id));
  const H = CAL_H1 - CAL_H0;
  const px = ms => clamp((mskMin(ms) - CAL_H0 * 60) / (H * 60) * 100, 0, 100);
  const withData = sel.filter(pid => busyOf(pid, day, day).has);
  const noData = sel.filter(pid => !withData.includes(pid));
  const free = weekday(day) > 4 && !View.get('cal.we', false) ? [] : freeWindows(withData, day, wh, 30);
  const d0 = tMs(day, '00:00');

  const seg = (s, e, cls, attrs = '', inner = '') => {
    const a = Math.max(s, d0 + CAL_H0 * 36e5), b = Math.min(e, d0 + CAL_H1 * 36e5);
    if (b <= a) return '';
    const l = px(a), w = Math.max(px(b) - l, .8);
    return `<span class="${cls}" style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%" ${attrs}>${inner}</span>`;
  };
  const offHours = `<i class="ct-off" style="left:0;width:${((wh[0] - CAL_H0) / H * 100).toFixed(2)}%"></i><i class="ct-off" style="left:${((wh[1] - CAL_H0) / H * 100).toFixed(2)}%;right:0"></i>`;
  const now = nowMs();
  const nowLine = mskDate(now) === day ? `<i class="ct-now" style="left:${px(now).toFixed(2)}%"></i>` : '';
  const rows = sel.map(pid => {
    const p = personById(pid);
    const b = busyOf(pid, day, day);
    const stale = b.shared && b.at && Date.now() - b.at > 3 * 864e5;
    const blocks = b.list.map(x => x.kind === 'meet'
      ? seg(x.s, x.e, 'ct-b meet', `data-meet="${x.m.id}" title="${esc(x.m.title)} · ${hmMs(x.s)}–${hmMs(x.e)}"`, `<em>${esc(x.m.title)}</em>`)
      : x.kind === 'crm' ? seg(x.s, x.e, 'ct-b crm', `title="Созвон CRM · ${hmMs(x.s)}–${hmMs(x.e)}"`, '<em>CRM</em>')
      : seg(x.s, x.e, 'ct-b busy', `title="Занят · ${hmMs(x.s)}–${hmMs(x.e)}"`)).join('');
    return `<div class="ct-row ${b.has ? '' : 'nodata'}">
      <a class="ct-name" href="#p-${pid}">${avatar(p)}<span><b>${esc(firstName(p))}</b><small>${b.has ? (stale ? 'обновлено ' + timeAgo(b.at) : 'календарь подключён') : 'нет данных календаря'}</small></span></a>
      <div class="ct-track" data-pid="${pid}">${offHours}${blocks}${nowLine}</div></div>`;
  }).join('');

  return `<div class="ct-days">${days.map(d => {
      const n = freeWindows(withData, d, wh, 30).length;
      return `<button data-cday="${d}" class="${d === day ? 'on' : ''} ${d < t ? 'past' : ''}"><span>${WD_SH[weekday(d)]}, ${dayShort(d)}</span><small>${d < t ? '' : weekday(d) > 4 && !View.get('cal.we', false) ? 'выходной' : n ? `${n} ${plural(n, 'окно', 'окна', 'окон')}` : 'нет окон'}</small></button>`;
    }).join('')}</div>
    <div class="ct-tools">
      <div class="chips" id="ctSel">${all.map(p => `<button class="chip ${sel.includes(p.id) ? 'on' : ''}" data-sel="${p.id}">${esc(firstName(p))}${busyOf(p.id, day, day).has ? '' : ' <span class="ct-nd" title="нет данных календаря">•</span>'}</button>`).join('')}
        <button class="chip ghost" data-sel-all>${sel.length === all.length ? 'Сбросить' : 'Все'}</button></div>
      <label class="ct-wh">Рабочие часы <select class="select sm" id="whFrom">${Array.from({length: 8}, (_, i) => i + 7).map(h => `<option value="${h}" ${h === wh[0] ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select>–<select class="select sm" id="whTo">${Array.from({length: 9}, (_, i) => i + 14).map(h => `<option value="${h}" ${h === wh[1] ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="ctWe" ${View.get('cal.we', false) ? 'checked' : ''}> выходные</label>
    </div>
    ${sel.length ? `<div class="cal-wrap"><div class="cal-team">
      <div class="ct-row ct-head"><div class="ct-name"></div><div class="ct-track">${Array.from({length: H + 1}, (_, i) => `<span style="left:${(i / H * 100).toFixed(2)}%">${pad(CAL_H0 + i)}</span>`).join('')}</div></div>
      <div class="ct-row ct-free"><div class="ct-name"><span class="ct-fico">${icon('tick')}</span><span><b>Свободны все</b><small>${withData.length ? `${withData.length} из ${sel.length} с календарём` : 'нет данных'}</small></span></div>
        <div class="ct-track">${offHours}${free.map(([s, e]) => seg(s, e, 'ct-b free', `data-free="${s}" title="Свободны все: ${hmMs(s)}–${hmMs(e)} — нажмите, чтобы назначить собрание"`, `<em>${hmMs(s)}–${hmMs(e)}</em>`)).join('')}${nowLine}</div></div>
      ${rows}
    </div></div>` : '<div class="empty"><b>Выберите людей</b>Отметьте, чью занятость показать.</div>'}
    ${noData.length ? `<p class="note ct-nodata">Нет данных календаря: <b>${noData.map(pid => esc(firstName(personById(pid)))).join(', ')}</b> — их занятость не учитывается в окнах. Попросите их один раз открыть «Календарь» и нажать «Подключить мой Google Календарь».</p>` : ''}
    <p class="note">Серым — занят по Google Календарю (без подробностей), полупрозрачным «CRM» — созвоны из Eva CRM, фиолетовым — собрания штаба, зелёным — окна от 30 минут, где свободны все выбранные. Нажмите на зелёное окно или на шкалу — откроется собрание на это время.</p>`;
}
function calWireTeam(root) {
  on(root, 'click', '[data-cday]', (e, el) => { CalUI.day = el.dataset.cday; App.render(); });
  const all = calPeople().map(p => p.id);
  const cur = () => (View.get('cal.sel', null) || all).filter(id => all.includes(id));
  on(root, 'click', '[data-sel]', (e, el) => {
    const s = new Set(cur());
    if (s.has(el.dataset.sel)) s.delete(el.dataset.sel); else s.add(el.dataset.sel);
    View.set('cal.sel', [...s]);
    App.render();
  });
  on(root, 'click', '[data-sel-all]', () => { View.set('cal.sel', cur().length === all.length ? [] : all); App.render(); });
  const whF = $('#whFrom', root), whT = $('#whTo', root);
  const setWh = () => { const a = Number(whF.value), b = Math.max(a + 1, Number(whT.value)); View.set('cal.wh', [a, b]); App.render(); };
  if (whF) { whF.onchange = setWh; whT.onchange = setWh; }
  const we = $('#ctWe', root);
  if (we) we.onchange = () => { View.set('cal.we', we.checked); App.render(); };
  if (!Auth.can('tasks.edit')) return;
  on(root, 'click', '[data-free]', (e, el) => {
    e.stopPropagation();
    const s = Number(el.dataset.free);
    openMeeting(null, {date: mskDate(s), start: hmMs(s), attendees: cur().filter(id => id !== Auth.personId())});
  });
  on(root, 'click', '.ct-track[data-pid], .ct-free .ct-track', (e, el) => {
    if (e.target.closest('.ct-b')) return;
    const r = el.getBoundingClientRect();
    const min = CAL_H0 * 60 + (e.clientX - r.left) / r.width * (CAL_H1 - CAL_H0) * 60;
    const start = clamp(Math.floor(min / 30) * 30, CAL_H0 * 60, CAL_H1 * 60 - 30);
    openMeeting(null, {date: CalUI.day, start: hmOf(start), attendees: cur().filter(id => id !== Auth.personId())});
  });
}

/* ── почты: куда приходят приглашения и какой календарь читает штаб ── */
function calMailView() {
  const pid = Auth.personId(), me = personById(pid);
  const usable = Cal.usable();
  let myCard = '';
  if (me) {
    const mine = inviteMail(me), acc = accountOf(me.id), cid = myCalId();
    const cands = [['card', me.email], ['google', me.gcalEmail], ['login', acc && acc.email]]
      .filter(([, v], i, a) => v && EMAIL_RE.test(v) && normEmail(v) !== normEmail(me.calEmail || '') && a.findIndex(x => normEmail(x[1] || '') === normEmail(v)) === i);
    const host = me.gcalEmail || Cal.hostEmail;
    const cals = (Cal.calendars || []).filter(c => normEmail(c.id) !== normEmail(host || '') && !c.primary);
    myCard = `<section class="card ml-me">
      <div class="card-head"><h2>Мой календарь</h2><span class="note">${esc(personName(me))}</span></div>
      <div class="ml-grid">
        <div class="ml-block">
          <label class="field"><span>Почта для приглашений</span>
            <input class="input" id="mlMine" type="email" autocomplete="email" value="${esc(me.calEmail || '')}" placeholder="${esc(mine.src && mine.src !== 'cal' ? mine.mail : 'name@gmail.com')}"></label>
          <p class="note">Сейчас приглашения на собрания штаба приходят на <b>${mine.mail ? esc(mine.mail) : 'никуда — почта не указана'}</b>${mine.src ? ` — ${MAIL_SRC[mine.src]}` : ''}. Нужен другой аккаунт — впишите его почту. Пустое поле — почта из карточки в «Команде».</p>
          ${cands.length ? `<div class="chips ml-cands">${cands.map(([src, v]) => `<button type="button" class="chip" data-ml-pick="${esc(v)}">${esc(v)}<small>${MAIL_SRC[src]}</small></button>`).join('')}</div>` : ''}
        </div>
        <div class="ml-block">
          <label class="field"><span>Календарь для штаба</span>
            <select class="select" id="mlCal" ${usable ? '' : 'disabled'}>
              <option value="">Основной календарь подключённого Google${host ? ' — ' + esc(host) : ''}</option>
              ${cals.map(c => `<option value="${esc(c.id)}" ${c.id === cid ? 'selected' : ''}>${esc(c.name)}${c.name !== c.id && EMAIL_RE.test(c.id) ? ' — ' + esc(c.id) : ''}</option>`).join('')}
              ${cid && !cals.some(c => c.id === cid) ? `<option value="${esc(cid)}" selected>${esc(cid)}</option>` : ''}
            </select></label>
          <p class="note">Из этого календаря штаб берёт вашу занятость и в него ставит собрания, которые создаёте вы. ${!usable ? 'Выбор появится, когда штаб открыт в Claude с подключённым Google Календарём.' : Cal.calLoading ? 'Загружаю список календарей…' : Cal.calendars ? `В списке — календари, которые видит подключённый аккаунт. <button type="button" class="link-btn" data-ml-cals>Обновить список</button>` : '<button type="button" class="link-btn" data-ml-cals>Загрузить список календарей</button>'}</p>
          <details class="ml-other"><summary>Нужного аккаунта нет в списке?</summary>
            <p class="note">Коннектор Google Calendar в Claude работает с одним аккаунтом Google. Два пути: <b>1)</b> в нужном аккаунте откройте Google Календарь → Настройки → «Доступ для отдельных пользователей» и добавьте ${host ? esc(host) : 'подключённый аккаунт'} с правом вносить изменения — календарь появится в списке выше; <b>2)</b> переподключите Google Calendar в claude.ai → Настройки → Коннекторы уже к нужному аккаунту и обновите страницу.</p>
          </details>
        </div>
      </div>
      <div class="ml-foot"><button class="btn primary" id="mlSave">Сохранить</button></div>
    </section>`;
  }
  const rows = calPeople().map(p => {
    const m = inviteMail(p), b = Store.get('busy', p.id);
    return `<tr>
      <td><a class="ml-person" href="#p-${p.id}">${avatar(p)}<span><b>${esc(personName(p))}</b><small>${esc(p.title || '')}</small></span></a></td>
      <td>${canEditMail(p.id) ? `<input class="input sm" type="email" data-ml-pid="${p.id}" value="${esc(p.calEmail || '')}" placeholder="${esc(m.src && m.src !== 'cal' ? m.mail : 'почта для приглашений')}">` : (p.calEmail ? esc(p.calEmail) : '<span class="muted">—</span>')}</td>
      <td>${m.mail ? `<b>${esc(m.mail)}</b><small class="ml-src">${MAIL_SRC[m.src]}</small>` : '<span class="pill warn">приглашения не придут</span>'}</td>
      <td class="soft nowrap">${b && b.share !== false && b.from ? `подключён · ${timeAgo(b.at)}` : 'не подключён'}</td>
    </tr>`;
  }).join('');
  return `${myCard}
    <section class="section">
      <div class="section-head"><h2>Почты команды</h2><span class="hint-inline">По умолчанию — почта из карточки в «Команде». ${Auth.can('team.manage') ? 'Впишите другую, если человеку нужны приглашения на другой аккаунт.' : 'Свою можно поменять здесь, чужие меняет основатель.'}</span></div>
      <div class="table-wrap"><table class="t ml-table">
        <thead><tr><th>Человек</th><th>Своя почта для календаря</th><th>Приглашения уходят на</th><th>Google Календарь</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="note">Пустое поле — берём почту из карточки в «Команде», если её нет — почту подключённого Google, затем почту входа в штаб. Сохраняется, когда выходите из поля.</p>
    </section>`;
}
function calWireMail(root) {
  on(root, 'change', '[data-ml-pid]', (e, el) => {
    const v = el.value.trim(), p = personById(el.dataset.mlPid);
    if (v && !EMAIL_RE.test(v)) { el.classList.add('bad'); toast('Почта выглядит неправильно'); return; }
    el.classList.remove('bad');
    if ((p.calEmail || '') === v) return;
    Store.patch('people', p.id, {calEmail: v});
    toast(v ? `${firstName(p)}: приглашения — на ${v}` : `${firstName(p)}: снова почта из карточки`);
  });
  on(root, 'click', '[data-ml-pick]', (e, el) => { const i = $('#mlMine', root); if (i) { i.value = el.dataset.mlPick; i.focus(); } });
  on(root, 'click', '[data-ml-cals]', () => { Cal.calendars = null; Cal.loadCalendars(); });
  const btn = $('#mlSave', root);
  if (btn) btn.onclick = () => {
    const pid = Auth.personId(), p = personById(pid);
    const mail = $('#mlMine', root).value.trim();
    if (mail && !EMAIL_RE.test(mail)) { toast('Почта выглядит неправильно'); $('#mlMine', root).focus(); return; }
    const sel = $('#mlCal', root);
    const cid = sel && !sel.disabled ? sel.value : (p.calId || '');
    const calChanged = cid !== (p.calId || '');
    Store.patch('people', pid, {calEmail: mail, calId: cid});
    if (!calChanged) { toast('Сохранено'); return; }
    Cal.week = {};
    Cal.hostEmail = '';
    const doc = Store.get('busy', pid);
    if (doc && doc.share !== false && doc.from) {
      toast('Сохранено. Беру занятость из выбранного календаря…');
      Cal.sync({silent: true}).then(ok => toast(ok ? 'Занятость обновлена из выбранного календаря' : 'Не получилось прочитать выбранный календарь — проверьте доступ к нему', ok ? {} : {error: true}));
    } else toast('Сохранено');
  };
}

/* ── список собраний ── */
function upcomingMeetings() {
  const now = nowMs();
  return Meetings.all().map(m => ({m, o: Meetings.next(m)})).filter(x => x.o && x.o.e > now).sort((a, b) => a.o.s - b.o.s);
}
function inviteState(m) {
  if (m.invite === 'sent') return `<span class="pill good" title="${esc((m.sentTo || []).join(', '))}">приглашения ушли${m.sentTo ? ': ' + m.sentTo.length : ''}</span>`;
  if (m.invite === 'sending') return '<span class="pill warn">отправляю…</span>';
  if (m.invite === 'unknown') return '<span class="pill warn" title="Google не ответил вовремя">не ясно, создалось ли</span>';
  if (m.invite === 'failed') return `<span class="pill bad" title="${esc(CAL_ERR[m.inviteErr] || m.inviteErr || '')}">приглашения не ушли</span>`;
  return '<span class="pill line">только в штабе</span>';
}
function meetRow(m, o) {
  const pid = Auth.personId();
  const org = personById(m.organizer);
  const isOrg = m.organizer === pid;
  const resp = m.responses || {};
  const ppl = Meetings.people(m).map(id => {
    const p = personById(id);
    const st = id === m.organizer ? 'accepted' : resp[id] || (m.invite === 'sent' ? 'needsAction' : '');
    const r = RSVP[st];
    return `<span class="mt-p ${r ? r.tone : ''}" title="${esc(personName(p))}${id === m.organizer ? ' · организатор' : r ? ' · ' + r.name : ''}">${avatar(p)}${r && id !== m.organizer ? `<i>${r.mark}</i>` : ''}</span>`;
  }).join('');
  const guests = (m.guests || []).length;
  const actions = [];
  if (m.meetUrl) actions.push(`<a class="btn xs" href="${esc(m.meetUrl)}" target="_blank" rel="noopener">${icon('video')}Meet</a>`);
  if (m.link) actions.push(`<a class="btn xs ghost" href="${esc(m.link)}" target="_blank" rel="noopener">${icon('ext')}Google</a>`);
  if (isOrg && m.invite === 'unknown' && Cal.usable()) actions.push(`<button class="btn xs" data-verify="${m.id}">Проверить в Google</button>`);
  if (isOrg && m.invite === 'failed' && Cal.usable()) actions.push(`<button class="btn xs primary" data-push="${m.id}">Отправить приглашения</button>`);
  if (isOrg && (!m.invite || m.invite === 'none') && Cal.usable()) actions.push(`<button class="btn xs" data-push="${m.id}">Отправить в Google</button>`);
  if (isOrg || Auth.isOwner()) actions.push(`<button class="btn xs ghost" data-cancel-meet="${m.id}">${m.gcalId && isOrg ? 'Отменить' : 'Удалить'}</button>`);
  return `<div class="mt-row ${Meetings.mine(m) ? 'mine' : ''}">
    <div class="mt-when"><b>${o ? hmMs(o.s) : m.start}</b><small>${o ? dayWd(o.date) : dayWd(m.date)}</small></div>
    <button class="mt-main" data-meet="${m.id}"><b>${esc(m.title)}</b>
      <small>${Meetings.step(m) ? esc(REPEATS[m.repeat]) + ' · ' : ''}${m.dur} мин · организатор ${esc(org ? firstName(org) : '—')}${guests ? ` · гостей: ${guests}` : ''}</small>
      ${m.agenda ? `<span class="mt-agenda">${esc(m.agenda.split('\n')[0]).slice(0, 140)}</span>` : ''}</button>
    <div class="mt-ppl">${ppl}</div>
    <div class="mt-st">${inviteState(m)}</div>
    <div class="mt-act">${actions.join('')}</div>
  </div>`;
}
function calListView() {
  const up = upcomingMeetings();
  const now = nowMs();
  const past = Meetings.all().filter(m => !Meetings.next(m) && tMs(m.date, m.start) < now).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  const mineOnly = View.get('cal.mine', false);
  const list = mineOnly ? up.filter(x => Meetings.mine(x.m)) : up;
  return `<div class="mt-tools"><div class="seg"><button data-mine="0" class="${mineOnly ? '' : 'on'}">Все собрания</button><button data-mine="1" class="${mineOnly ? 'on' : ''}">Где я участвую</button></div>
      <span class="note">✓ идёт · ? возможно · ✕ не идёт · · нет ответа — ответы подтягиваются из Google, когда организатор или участник обновляет календарь</span></div>
    ${list.length ? `<div class="mt-list card flat">${list.map(x => meetRow(x.m, x.o)).join('')}</div>` : `<div class="empty"><b>Ближайших собраний нет</b>${Auth.can('tasks.edit') ? 'Нажмите «Собрание» сверху или выберите окно во вкладке «Занятость команды».' : ''}</div>`}
    ${past.length ? `<details class="section mt-past"><summary>Прошедшие собрания · ${past.length}</summary><div class="mt-list card flat">${past.map(m => meetRow(m, null)).join('')}</div></details>` : ''}`;
}

/* ── окно собрания ── */
function nextWorkday() {
  const now = nowMs();
  let d = today();
  if (mskMin(now) > 17 * 60 || weekday(d) > 4) d = addDays(d, 1);
  while (weekday(d) > 4) d = addDays(d, 1);
  return d;
}
const parseGuests = s => String(s || '').split(/[\s,;]+/).map(x => x.trim()).filter(x => /^\S+@\S+\.\S+$/.test(x));

function openMeeting(id, preset = {}) {
  const m = id ? Store.get('meetings', id) : null;
  const me = Auth.personId();
  if (!m && !Auth.can('tasks.edit')) return;
  const isOrg = !m || m.organizer === me;
  const canEdit = !m || isOrg || Auth.isOwner();
  const inGoogle = !!(m && m.gcalId);
  const d = {title: '', date: nextWorkday(), start: '11:00', dur: 60, attendees: [], guests: [], agenda: '', meet: true, repeat: '', ...(m ? clone(m) : {}), ...preset};
  const organizer = m ? m.organizer : me;
  d.attendees = (d.attendees || []).filter(x => x !== organizer);
  const all = calPeople();
  const times = [];
  for (let x = 7 * 60; x <= 22 * 60; x += 15) times.push(hmOf(x));
  if (!times.includes(d.start)) times.push(d.start);
  times.sort();
  const google = Cal.usable();
  const orgP = personById(organizer);

  if (m && !canEdit) {
    /* участник смотрит собрание */
    const o = Meetings.next(m);
    openModal({
      title: m.title,
      body: `<div class="mt-view">
        <p><b>${o ? `${dayWd(o.date)}, ${hmMs(o.s)}–${hmMs(o.e)}` : Meetings.when(m)}</b>${Meetings.step(m) ? ` · ${esc(REPEATS[m.repeat].toLowerCase())}` : ''}</p>
        <p class="note">Организатор — ${esc(personName(orgP))}. ${m.invite === 'sent' ? 'Приглашение пришло вам в Google Календарь — ответьте там, ответ появится в штабе.' : 'Собрание сохранено в штабе.'}</p>
        ${m.agenda ? `<div class="mt-agenda-full">${esc(m.agenda)}</div>` : ''}
        <div class="mt-ppl big">${Meetings.people(m).map(id => { const p = personById(id); const r = RSVP[(m.responses || {})[id] || '']; return `<span class="mt-pl">${avatar(p)}${esc(firstName(p))}${id === m.organizer ? ' <small>организатор</small>' : r ? ` <small class="${r.tone}">${r.name}</small>` : ''}</span>`; }).join('')}</div>
        <div class="row">${m.meetUrl ? `<a class="btn primary" href="${esc(m.meetUrl)}" target="_blank" rel="noopener">${icon('video')}Войти в Google Meet</a>` : ''}${m.link ? `<a class="btn" href="${esc(m.link)}" target="_blank" rel="noopener">${icon('ext')}Открыть в Google</a>` : ''}</div>
      </div>`,
      foot: '<button class="btn" data-close>Закрыть</button>',
    });
    return;
  }

  const chip = (p, on = d.attendees.includes(p.id)) => {
    const mail = inviteEmail(p);
    return `<button type="button" class="chip mt-chip ${on ? 'on' : ''} ${mail ? '' : 'nomail'}" data-att="${p.id}" title="${mail ? esc(mail) : 'нет почты — приглашение не придёт; впишите её ниже или во вкладке «Почты»'}">${avatar(p)}${esc(firstName(p))}${mail ? '' : ' <span class="mt-nomail">нет почты</span>'}</button>`;
  };
  const foot = `${m && canEdit ? `<button class="btn ghost danger left" id="mtDel">${inGoogle && isOrg ? 'Отменить собрание' : 'Удалить'}</button>` : ''}
    <button class="btn" data-close>Отмена</button>
    <button class="btn primary" id="mtSave">${m ? 'Сохранить' : 'Создать собрание'}</button>`;

  openModal({
    title: m ? 'Собрание' : 'Новое собрание',
    wide: true,
    focus: !m,
    body: `<label class="field"><span>Название</span><input class="input" id="mtTitle" maxlength="120" placeholder="Созвон команды · разбор цифр недели" value="${esc(d.title)}"></label>
      <div class="mt-time">
        <label class="field"><span>Дата</span><input class="input" type="date" id="mtDate" value="${d.date}"></label>
        <label class="field"><span>Начало</span><select class="select" id="mtStart">${times.map(x => `<option ${x === d.start ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <div class="field"><span>Длительность</span><div class="seg" id="mtDur">${DURS.map(x => `<button type="button" data-dur="${x}" class="${Number(d.dur) === x ? 'on' : ''}">${x < 60 ? x + ' мин' : x / 60 + ' ч'}</button>`).join('').replace('1.5 ч', '1,5 ч')}</div></div>
        <label class="field"><span>Повтор</span><select class="select" id="mtRepeat" ${inGoogle ? 'disabled title="Повтор меняется только новым собранием"' : ''}>${Object.entries(REPEATS).map(([k, n]) => `<option value="${k}" ${k === (d.repeat || '') ? 'selected' : ''}>${n}${k ? ' до 31 декабря' : ''}</option>`).join('')}</select></label>
      </div>
      <div class="field"><span>Участники <small class="note">организатор — ${esc(orgP ? firstName(orgP) : 'вы')}</small></span>
        <div class="chips mt-chips">${all.filter(p => p.id !== organizer).map(p => chip(p)).join('')}<button type="button" class="chip ghost" id="mtAll">Все</button></div>
      </div>
      <label class="field"><span>Гости не из команды <small class="note">почты через запятую</small></span><input class="input" id="mtGuests" value="${esc((d.guests || []).join(', '))}" placeholder="partner@mail.ru"></label>
      <div class="mt-mail" id="mtMail"></div>
      <div class="mt-help" id="mtHelp"></div>
      <label class="field"><span>Повестка</span><textarea class="textarea" id="mtAgenda" rows="3" placeholder="1. Цифры недели · 2. Что мешает · 3. Решения">${esc(d.agenda || '')}</textarea></label>
      <div class="mt-opts">
        <label class="check"><input type="checkbox" id="mtMeet" ${d.meet ? 'checked' : ''} ${inGoogle && m.meetUrl ? 'disabled' : ''}> Ссылка Google Meet</label>
        <label class="check"><input type="checkbox" id="mtSend" ${google && (!m || isOrg) ? 'checked' : ''} ${google && isOrg ? '' : 'disabled'}> ${inGoogle ? 'Отправить изменения участникам через Google' : 'Создать в моём Google Календаре и отправить приглашения'}</label>
        <p class="note">${!google ? 'Google Календарь недоступен в этом окне — собрание сохранится в штабе, приглашения не уйдут.' : !isOrg ? `Изменения в Google отправляет организатор — ${esc(personName(orgP))}. Здесь поправится только запись в штабе.` : 'Участникам придёт письмо-приглашение и событие в их календарь; ответ «иду / не иду» появится в штабе.'}</p>
      </div>`,
    foot,
    onMount(el, close) {
      const val = () => ({
        title: $('#mtTitle', el).value.trim(),
        date: $('#mtDate', el).value,
        start: $('#mtStart', el).value,
        dur: Number(($('#mtDur .on', el) || {}).dataset?.dur || d.dur),
        attendees: $$('[data-att].on', el).map(b => b.dataset.att),
        guests: parseGuests($('#mtGuests', el).value),
        agenda: $('#mtAgenda', el).value.trim(),
        meet: $('#mtMeet', el).checked,
        repeat: $('#mtRepeat', el).value,
      });
      const paint = () => {
        const v = val();
        const pids = [organizer, ...v.attendees];
        const wh = View.get('cal.wh', [10, 19]);
        const box = $('#mtHelp', el);
        if (!v.date || !v.start) { box.innerHTML = ''; return; }
        const s = tMs(v.date, v.start), e = s + v.dur * 60e3;
        const cf = conflictsAt(pids, s, e, m && m.id);
        const busy = cf.filter(x => x.hit), unknown = cf.filter(x => x.unknown);
        const known = pids.filter(pid => !unknown.some(u => u.pid === pid));
        const slots = suggestSlots(known, v.dur, wh, today());
        const noMail = v.attendees.filter(pid => !inviteEmail(personById(pid)));
        box.innerHTML = `
          <div class="mt-state ${busy.length ? 'bad' : 'good'}">${icon(busy.length ? 'x' : 'tick')}<span>${busy.length
            ? `В это время заняты: ${busy.map(x => `<b>${esc(firstName(personById(x.pid)))}</b>${x.hit.m ? ` (${esc(x.hit.m.title)})` : ''}`).join(', ')}`
            : `${dayWd(v.date)}, ${v.start}–${hmMs(e)} — ${known.length > 1 ? 'свободны все, у кого подключён календарь' : 'пересечений не видно'}`}${unknown.length ? `<small>Нет данных календаря: ${unknown.map(x => esc(firstName(personById(x.pid)))).join(', ')}</small>` : ''}</span></div>
          ${slots.length ? `<div class="mt-slots"><span class="label">Свободно у всех</span>${slots.map(t => `<button type="button" class="chip" data-slot="${t}">${dayWd(mskDate(t))}, ${hmMs(t)}</button>`).join('')}${google && pids.length > 1 ? '<button type="button" class="chip ghost" id="mtAskG">Спросить Google</button>' : ''}</div>` : google && pids.length > 1 ? '<div class="mt-slots"><button type="button" class="chip ghost" id="mtAskG">Подобрать время в Google</button></div>' : ''}
          <div class="mt-gslots" id="mtG"></div>`;
      };
      /* почты прямо здесь: у кого из выбранных нет адреса для приглашения */
      const paintMail = () => {
        const box = $('#mtMail', el);
        const typed = Object.fromEntries($$('[data-mt-mail]', box).map(i => [i.dataset.mtMail, i.value]));
        const noMail = val().attendees.filter(pid => !inviteEmail(personById(pid)));
        if (!noMail.length) { box.innerHTML = ''; return; }
        const editable = noMail.filter(canEditMail);
        box.innerHTML = `<p class="note warn-t">Без почты приглашение не придёт: ${noMail.map(pid => esc(firstName(personById(pid)))).join(', ')}.${editable.length < noMail.length ? ' Почту остальных впишет основатель во вкладке «Почты».' : ''}</p>
          ${editable.length ? `<div class="mt-mail-row">${editable.map(pid => `<label class="field"><span>${esc(firstName(personById(pid)))}</span><input class="input sm" type="email" data-mt-mail="${pid}" placeholder="name@gmail.com" value="${esc(typed[pid] || '')}"></label>`).join('')}
            <button type="button" class="btn sm" id="mtMailSave">Сохранить почты</button></div>` : ''}`;
      };
      paint();
      paintMail();
      on(el, 'click', '[data-att]', (e, b) => { b.classList.toggle('on'); paint(); paintMail(); });
      $('#mtAll', el).onclick = () => { const btns = $$('[data-att]', el); const allOn = btns.every(b => b.classList.contains('on')); btns.forEach(b => b.classList.toggle('on', !allOn)); paint(); paintMail(); };
      on(el, 'click', '#mtMailSave', () => {
        let n = 0, bad = false;
        $$('[data-mt-mail]', el).forEach(i => {
          const v = i.value.trim();
          if (!v) return;
          if (!EMAIL_RE.test(v)) { bad = true; i.classList.add('bad'); return; }
          Store.patch('people', i.dataset.mtMail, {calEmail: v});
          const b = $(`[data-att="${i.dataset.mtMail}"]`, el);
          if (b) b.outerHTML = chip(personById(i.dataset.mtMail), b.classList.contains('on'));
          n++;
        });
        if (bad) toast('Проверьте почту — она выглядит неправильно');
        if (n) { toast(`Почты сохранены: ${n}. Их видно во вкладке «Почты»`); paintMail(); }
      });
      on(el, 'click', '[data-dur]', (e, b) => { $$('[data-dur]', el).forEach(x => x.classList.toggle('on', x === b)); paint(); });
      on(el, 'click', '[data-slot]', (e, b) => {
        const t = Number(b.dataset.slot);
        $('#mtDate', el).value = mskDate(t);
        const hm = hmMs(t), sel = $('#mtStart', el);
        if (![...sel.options].some(o => o.value === hm)) sel.add(new Option(hm, hm));
        sel.value = hm;
        paint();
      });
      on(el, 'click', '#mtAskG', async (e, b) => {
        const v = val();
        const emails = [organizer, ...v.attendees].map(pid => inviteEmail(personById(pid))).filter(Boolean).concat(v.guests);
        const box = $('#mtG', el);
        b.disabled = true;
        box.innerHTML = '<span class="note">Спрашиваю Google…</span>';
        const wh = View.get('cal.wh', [10, 19]);
        const from = Math.max(nowMs(), tMs(today(), '00:00'));
        try {
          const res = await Cal.call('suggest_time', {
            attendeeEmails: emails, startTime: isoMs(ceil15(from)), endTime: isoMs(tMs(addDays(today(), 10), '23:00')),
            durationMinutes: v.dur, timeZone: TZ, preferences: {startHour: hmOf(wh[0] * 60), endHour: hmOf(wh[1] * 60), excludeWeekends: true, pageSize: 6},
          }, true);
          /* Google отдаёт свободные периоды целиком: показываем диапазон, клик ставит начало */
          const list = ((res && (res.timeSlots || res.slots)) || []).map(x => ({s: Date.parse(x.startTime || (x.start || {}).dateTime), e: Date.parse(x.endTime || (x.end || {}).dateTime)})).filter(x => x.s);
          box.innerHTML = list.length
            ? `<span class="label">Google: свободно</span>${list.map(x => `<button type="button" class="chip" data-slot="${x.s}">${dayWd(mskDate(x.s))}, ${hmMs(x.s)}${x.e && mskDate(x.e) === mskDate(x.s) ? '–' + hmMs(x.e) : ''}</button>`).join('')}<small class="note">учтены календари, которые Google вам показывает</small>`
            : '<span class="note">Google не нашёл общего окна на ближайшие 10 дней.</span>';
        } catch (err) {
          box.innerHTML = `<span class="note bad">${esc(calErr(err).text)}</span>`;
        }
        b.disabled = false;
      });
      ['#mtDate', '#mtStart'].forEach(s => { $(s, el).onchange = paint; });
      $('#mtGuests', el).onchange = paint;
      const del = $('#mtDel', el);
      if (del) del.onclick = async () => { if (await cancelMeeting(m.id, del)) close(); };
      $('#mtSave', el).onclick = async () => {
        const v = val();
        if (!v.title) { $('#mtTitle', el).focus(); toast('Напишите название собрания'); return; }
        if (!v.date || !v.start) { toast('Выберите дату и время'); return; }
        const send = $('#mtSend', el).checked && !$('#mtSend', el).disabled;
        const body = {...v, until: v.repeat ? Q.end : null};
        if (!m) {
          const nid = uid();
          Store.put('meetings', nid, {...body, organizer, calId: myCalId() || null, by: Auth.me().id, at: Date.now(), invite: send ? 'sending' : 'none'});
          close();
          if (send) await pushMeeting(nid); else toast('Собрание сохранено в штабе');
          return;
        }
        const before = clone(m);
        Store.patch('meetings', m.id, {...body, guests: v.guests, attendees: v.attendees, editedAt: Date.now()});
        close();
        if (send && before.gcalId && isOrg) await updateInGoogle(m.id, before);
        else if (send && !before.gcalId) await pushMeeting(m.id);
        else toast('Собрание обновлено');
      };
    },
  });
}

/* участники для Google: почты команды и гости. Хозяину календаря, в котором
   создаётся событие, приглашение не нужно; если организатор вписал для
   календаря другую почту — пригласим и её, чтобы собрание было и там. */
function inviteList(m) {
  const seen = new Set(), out = [];
  const org = personById(m.organizer);
  const host = normEmail(EMAIL_RE.test(m.calId || '') ? m.calId : (org && org.gcalEmail) || (m.organizer === Auth.personId() ? Cal.hostEmail : ''));
  const add = (mail, name) => {
    const k = normEmail(mail);
    if (!mail || seen.has(k) || k === host) return;
    seen.add(k);
    out.push(name ? {email: mail, displayName: name} : {email: mail});
  };
  if (org && host) add(inviteEmail(org), personName(org));
  (m.attendees || []).forEach(pid => { const p = personById(pid); add(inviteEmail(p), personName(p)); });
  (m.guests || []).forEach(mail => add(mail));
  return out;
}
/* название календаря для подписи */
function calName(id) {
  const c = (Cal.calendars || []).find(x => x.id === id);
  return c ? c.name + (c.name !== id && EMAIL_RE.test(id) ? ` (${id})` : '') : id;
}
function descOf(m) {
  return `${m.agenda ? m.agenda + '\n\n' : ''}Собрание из штаба Eva Club.`;
}
function rruleOf(m) {
  return `RRULE:FREQ=WEEKLY;${m.repeat === 'biweekly' ? 'INTERVAL=2;' : ''}UNTIL=${(m.until || Q.end).replace(/-/g, '')}T205959Z`;
}

/* создать событие в Google Календаре организатора — приглашения уходят сами */
async function pushMeeting(id) {
  const m = Store.get('meetings', id);
  if (!m) return;
  const att = inviteList(m);
  const s = tMs(m.date, m.start), e = s + (Number(m.dur) || 60) * 60e3;
  Store.patch('meetings', id, {invite: 'sending', inviteErr: null});
  const input = {
    summary: m.title, startTime: isoMs(s), endTime: isoMs(e), timeZone: TZ,
    attendees: att, description: descOf(m), addGoogleMeetUrl: !!m.meet,
    notificationLevel: 'ALL', useDefaultReminders: true,
  };
  if (m.calId) input.calendarId = m.calId;
  if (m.repeat) input.recurrenceData = [rruleOf(m)];
  try {
    const ev = eventOf(await Cal.call('create_event', input));
    Store.patch('meetings', id, {invite: 'sent', gcalId: ev.id || ev.eventId || null, link: ev.htmlLink || null, meetUrl: meetUrlOf(ev) || null, sentTo: att.map(a => a.email), sentAt: Date.now()});
    toast(att.length ? `Собрание в Google Календаре, приглашения ушли: ${att.length}` : 'Собрание добавлено в ваш Google Календарь');
  } catch (err) {
    const x = calErr(err);
    Store.patch('meetings', id, {invite: x.ambiguous ? 'unknown' : 'failed', inviteErr: x.code});
    toast(x.ambiguous ? 'Google не ответил вовремя. Проверьте календарь, прежде чем отправлять ещё раз — кнопка «Проверить в Google» в «Собраниях».' : x.text, {error: true});
  }
}
/* поменять время, название, участников — Google сам разошлёт обновление */
async function updateInGoogle(id, before) {
  const m = Store.get('meetings', id);
  if (!m || !m.gcalId) return;
  const now = inviteList(m).map(a => a.email);
  const was = before.sentTo || inviteList(before).map(a => a.email);
  const lower = x => x.map(normEmail);
  const added = inviteList(m).filter(a => !lower(was).includes(normEmail(a.email)));
  const removed = was.filter(x => !lower(now).includes(normEmail(x)));
  const s = tMs(m.date, m.start), e = s + (Number(m.dur) || 60) * 60e3;
  const input = {eventId: m.gcalId, summary: m.title, description: descOf(m), startTime: isoMs(s), endTime: isoMs(e), timeZone: TZ, notificationLevel: 'ALL'};
  if (m.calId) input.calendarId = m.calId;
  if (added.length) input.addedAttendees = added;
  if (removed.length) input.removedAttendeeEmails = removed;
  if (m.meet && !m.meetUrl) input.addGoogleMeetUrl = true;
  try {
    const ev = eventOf(await Cal.call('update_event', input));
    Store.patch('meetings', id, {invite: 'sent', sentTo: now, sentAt: Date.now(), meetUrl: meetUrlOf(ev) || m.meetUrl || null, link: ev.htmlLink || m.link || null});
    toast('Собрание обновлено, участникам ушло изменение');
  } catch (err) {
    const x = calErr(err);
    toast(x.ambiguous ? 'Google не ответил вовремя — проверьте событие в календаре.' : 'В штабе поменяли, в Google — нет. ' + x.text, {error: true});
  }
}
/* после неясного ответа: ищем событие в своём календаре, прежде чем создавать заново */
async function verifyMeeting(id) {
  const m = Store.get('meetings', id);
  if (!m) return;
  try {
    const list = await Cal.events(m.date, m.date);
    const s = tMs(m.date, m.start);
    const ev = list.find(x => x.summary === m.title && Math.abs((evRange(x) || {}).start - s) < 60e3);
    if (ev) {
      Store.patch('meetings', id, {invite: 'sent', gcalId: String(ev.recurringEventId || ev.id), link: ev.htmlLink || null, meetUrl: meetUrlOf(ev) || null, sentTo: inviteList(m).map(a => a.email), sentAt: Date.now()});
      toast('Нашёл событие в Google — приглашения ушли');
    } else {
      Store.patch('meetings', id, {invite: 'failed', inviteErr: 'not_found'});
      toast('В Google такого события нет — можно отправить приглашения ещё раз');
    }
  } catch (err) { toast(calErr(err).text, {error: true}); }
}
/* отменить: у организатора — через Google (участникам придёт отмена), иначе — только из штаба */
async function cancelMeeting(id, anchor) {
  const m = Store.get('meetings', id);
  if (!m) return false;
  const isOrg = m.organizer === Auth.personId();
  if (m.gcalId && isOrg && Cal.conn !== 'off') {
    if (!(await confirmPop(anchor, {text: 'Отменить собрание? Участникам придёт отмена в Google Календаре.', yes: 'Да, отменить', danger: true}))) return false;
    try {
      await Cal.call('delete_event', m.calId ? {eventId: m.gcalId, calendarId: m.calId, notificationLevel: 'ALL'} : {eventId: m.gcalId, notificationLevel: 'ALL'});
      Store.remove('meetings', id);
      toast('Собрание отменено, участникам ушла отмена');
      return true;
    } catch (err) {
      const x = calErr(err);
      if (x.code !== 'tool_error') { toast(x.ambiguous ? 'Google не ответил вовремя — проверьте календарь, прежде чем отменять ещё раз.' : x.text, {error: true}); return false; }
      if (!(await confirmPop(anchor, {text: `Google не отменил событие (${x.text.replace('Google ответил ошибкой: ', '')}). Удалить собрание только из штаба?`, yes: 'Удалить из штаба', danger: true}))) return false;
      Store.remove('meetings', id);
      return true;
    }
  }
  const org = personById(m.organizer);
  const text = m.gcalId && !isOrg ? `Удалить из штаба? В Google Календаре собрание отменит только организатор — ${personName(org)}.` : 'Удалить собрание?';
  if (!(await confirmPop(anchor, {text, yes: 'Удалить', danger: true}))) return false;
  const copy = clone(m);
  Store.remove('meetings', id);
  toast('Собрание удалено', {undo: () => Store.put('meetings', copy.id, copy)});
  return true;
}

/* созвоны CRM за период: по занятости всей команды (у кого подключён
   календарь) и по своим событиям в этом окне; одинаковые — один раз */
function crmCalls(a, b) {
  const seen = new Set(), out = [];
  const add = (s, e) => { const k = s + ':' + e; if (e > a && s < b && !seen.has(k)) { seen.add(k); out.push([s, e]); } };
  Store.all('busy').forEach(doc => { if (doc && doc.share !== false) (doc.crm || []).forEach(([s, e]) => add(s, e)); });
  Object.values(Cal.week).forEach(w => (w && w.events || []).filter(evCrm).forEach(ev => { const r = evRange(ev); if (r && !r.allDay) add(r.start, r.end); }));
  return out.sort((x, y) => x[0] - y[0]);
}
const crmWeek = () => { const ws = weekStart(today()); return crmCalls(tMs(ws, '00:00'), tMs(addDays(ws, 7), '00:00')); };
function crmTodayHtml() {
  const t = today(), now = nowMs();
  const list = crmCalls(tMs(t, '00:00'), tMs(addDays(t, 1), '00:00'));
  const week = crmWeek();
  if (!week.length) return '';
  const next = list.filter(([, e]) => e > now);
  return `<div class="today-meet crm-today"><span class="label">Созвоны CRM</span><div class="tm-row"><b>${list.length ? `сегодня ${list.length}` : 'сегодня нет'}</b><span>на неделе ${week.length}${next.length ? ` · ближайший в ${hmMs(next[0][0])}` : ''}</span><a class="btn xs" href="${CRM_URL}#calendar" target="_blank" rel="noopener">${icon('ext')}Открыть CRM</a></div></div>`;
}

/* собрания сегодня — для главной */
function todayMeetingsHtml() {
  const t = today(), pid = Auth.personId();
  const list = Meetings.occ(t, t).filter(o => Meetings.people(o.m).includes(pid) && o.e > nowMs());
  if (!list.length) return '';
  return `<div class="today-meet"><span class="label">Собрания сегодня</span>${list.map(o => `<div class="tm-row"><b>${hmMs(o.s)}</b><a href="#calendar">${esc(o.m.title)}</a>${o.m.meetUrl ? `<a class="btn xs" href="${esc(o.m.meetUrl)}" target="_blank" rel="noopener">${icon('video')}Meet</a>` : ''}</div>`).join('')}</div>`;
}
