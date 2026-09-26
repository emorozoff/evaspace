/* Google Календарь — через коннектор Claude (capability mcp) и от имени
   того, кто открыл CRM. Что делает:
   • назначенный созвон становится событием в Google Календаре того, кто
     его назначил: «CRM · Интервью: Ольга Миронова», в описании — ссылка на
     карточку и метка #eva-crm. По этой метке штаб узнаёт созвоны CRM и
     рисует их у себя полупрозрачными;
   • перенос и отмена созвона меняют и удаляют это событие; если созвон
     перенёс коллега, событие у автора обновится, когда он откроет CRM;
   • свои события недели видны в календаре CRM серым — чтобы не назначить
     созвон на занятое время. Они не сохраняются в базе.
   Без коннектора (GitHub Pages, чужое окно) календарь CRM работает сам по
   себе, просто без Google. */

const GCAL = 'Google Calendar';
const CRM_TAG = '#eva-crm';
const TZ_LOCAL = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'; } catch (e) { return 'Europe/Moscow'; } })();
const GCAL_ERR = {
  needs_reauth: 'Доступ к Google Календарю истёк. Переподключите его: claude.ai → Настройки → Коннекторы → Google Calendar — и обновите страницу.',
  server_not_connected: 'Google Календарь не подключён к вашему Claude. Добавьте его: claude.ai → Настройки → Коннекторы → Google Calendar — и обновите страницу.',
  selection_required: 'У вас подключено несколько Google Календарей — Claude попросит выбрать один. Если окно закрыли, обновите страницу.',
  not_in_manifest: 'Доступ к календарю для этой страницы выключен или отклонён. Разрешите Google Календарь в настройках артефакта и обновите страницу.',
  blocked_by_policy: 'Организация запретила этот инструмент Google Календаря.',
  approval_required: 'Нужно разрешение администратора организации на Google Календарь.',
  server_not_found: 'Коннектор Google Календаря не найден. Подключите его заново: claude.ai → Настройки → Коннекторы.',
  consent_required: 'CRM нужен доступ к Google Календарю — нажмите «Подключить» ещё раз и подтвердите.',
  server_unavailable: 'Google Календарь сейчас не отвечает. Попробуйте через минуту.',
  rate_limited: 'Слишком много запросов к календарю — подождите немного.',
  cancelled: 'Действие отменено.',
};
const GCAL_OFF = ['not_granted', 'capability_disabled', 'capability_removed'];
const GCAL_CONN = ['needs_reauth', 'server_not_connected', 'selection_required', 'not_in_manifest', 'blocked_by_policy', 'approval_required', 'server_not_found', 'consent_required'];
function gcalErr(e) {
  const code = (e && e.code) || 'upstream_error';
  let text = GCAL_ERR[code];
  if (!text && GCAL_OFF.includes(code)) text = 'Google Календарь недоступен в этом окне — откройте CRM в Claude.';
  if (!text && code === 'tool_error') text = 'Google ответил ошибкой: ' + ((e && e.message) || 'без подробностей');
  if (!text) text = 'Не получилось связаться с Google Календарём' + (e && e.message ? ': ' + e.message : '') + '.';
  /* для записи «не ответил» не значит «не сделал» — повторять только после проверки */
  const ambiguous = code === 'server_unavailable' || code === 'upstream_error' || !(code in GCAL_ERR || GCAL_OFF.includes(code) || code === 'tool_error' || code === 'bad_request');
  return {code, text, conn: GCAL_CONN.includes(code), off: GCAL_OFF.includes(code), ambiguous};
}
const gwait = ms => new Promise(r => setTimeout(r, ms));
const gEventOf = res => (res && (res.event || res.createdEvent || res.updatedEvent)) || res || {};
function gRange(ev) {
  const s = ev.start || {}, e = ev.end || {};
  if (s.dateTime) { const a = Date.parse(s.dateTime); return {start: a, end: Date.parse(e.dateTime || s.dateTime) || a, allDay: false}; }
  if (s.date) { const d0 = String(s.date).slice(0, 10); const d1 = e.date ? String(e.date).slice(0, 10) : addDays(d0, 1); return {start: dateOf(d0).getTime(), end: dateOf(d1 > d0 ? d1 : addDays(d0, 1)).getTime(), allDay: true}; }
  return null;
}
const gIsCrm = ev => String(ev.description || '').includes(CRM_TAG) || /^CRM ·/.test(String(ev.summary || ''));
function gBusy(ev) {
  if (ev.transparency === 'transparent' || ev.availability === 'AVAILABILITY_FREE') return false;
  const me = (ev.attendees || []).find(a => a.self);
  return !(me && me.responseStatus === 'declined');
}

const Gcal = {
  api: undefined,
  conn: 'checking',     // checking · ready · prompt · denied · off · error
  err: null,
  week: {},             // понедельник → {events, at} | {loading} | {err} — только в памяти этого окна
  busy: false,
  _init: null,
  _reconciled: false,

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
      this.conn = st === 'unavailable' ? 'off' : st === 'denied' ? 'denied' : st === 'granted' ? 'ready' : 'prompt';
      App.renderSoon();
      if (this.conn === 'ready') this.reconcile();
    })();
    return this._init;
  },
  usable() { return this.conn === 'ready' || this.conn === 'prompt'; },
  /* ставить ли созвоны в Google по умолчанию — выбор каждого в своём браузере */
  auto() { return this.conn === 'ready' && View.get('gcal.auto', true) !== false; },
  setErr(e) {
    const x = gcalErr(e);
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
      await gwait(Math.min(60000, e.retryAfterMs || 700 + Math.random() * 1300));
      try { r = await run(); } catch (e2) { this.setErr(e2); throw e2; }
    }
    const wasReady = this.conn === 'ready';
    this.conn = 'ready';
    this.err = null;
    if (!wasReady) { App.renderSoon(); this.reconcile(); }
    return r && r.payload !== undefined ? r.payload : r;
  },

  async events(fromMs, toMs) {
    const input = {startTime: new Date(fromMs).toISOString(), endTime: new Date(toMs).toISOString(), orderBy: 'startTime', pageSize: 250, timeZone: TZ_LOCAL};
    let list = [], token = null;
    for (let page = 0; page < 4; page++) {
      const res = await this.call('list_events', token ? {...input, pageToken: token} : input, true);
      list = list.concat(Array.isArray(res) ? res : (res && (res.events || res.items)) || []);
      token = res && res.nextPageToken;
      if (!token) break;
    }
    return list.filter(ev => ev && ev.status !== 'cancelled');
  },

  /* свои события недели — только для сетки, в базу не попадают */
  async loadWeek(ws, force = false) {
    if (!force && this.week[ws] && !this.week[ws].err) return;
    this.week[ws] = {loading: true};
    try {
      const a = dateOf(ws).getTime(), b = dateOf(addDays(ws, 7)).getTime();
      this.week[ws] = {events: await this.events(a, b), at: Date.now()};
    } catch (e) {
      this.week[ws] = {err: gcalErr(e)};
    }
    App.renderSoon();
  },
  /* подключить: первое чтение само спросит разрешение */
  async connect(ws) {
    this.week = {};
    await this.loadWeek(ws, true);
    const w = this.week[ws];
    if (w && w.err && !w.err.conn && !w.err.off) toast(w.err.text, {error: true});
    else if (this.conn === 'ready') toast('Google Календарь подключён: новые созвоны будут появляться в нём сами');
  },

  /* событие созвона */
  title(p) { return `CRM · ${p.type === 'client' ? 'Интервью' : p.type === 'partner' ? 'Встреча' : 'Созвон'}: ${People.name(p)}${p.type === 'client' ? '' : ' (' + TYPES[p.type].one.toLowerCase() + ')'}`; },
  desc(p) {
    const url = (settings().crmUrl || LINKS.crm) + '#p-' + p.id;
    const lines = [`Созвон из Eva CRM — ${groupName(p.type)}.`, `Карточка: ${url}`];
    if (p.zoom) lines.push(`Zoom: ${p.zoom}`);
    if (p.tg) lines.push(`Контакт: ${p.tg}`);
    return [...lines, '', CRM_TAG].join('\n');
  },
  sig(p) { return [p.callAt, callMin(p), this.title(p), p.zoom || ''].join('|'); },
  mine(p) { return !!(p.gcal && p.gcal.id && p.gcal.by === Who.id()); },
  wanted(p) { return !!p.callAt && ['set', 'done', 'noshow'].includes(p.s2); },

  /* поставить или обновить событие; true — получилось */
  async push(p, {silent = false} = {}) {
    if (!p || !this.wanted(p)) return false;
    const input = {summary: this.title(p), description: this.desc(p), startTime: new Date(p.callAt).toISOString(), endTime: new Date(p.callAt + callMin(p) * 60e3).toISOString(), timeZone: TZ_LOCAL, colorId: '4', notificationLevel: 'NONE'};
    if (p.zoom) input.location = p.zoom;
    try {
      let ev;
      if (this.mine(p)) ev = gEventOf(await this.call('update_event', {eventId: p.gcal.id, ...input}));
      else ev = gEventOf(await this.call('create_event', {...input, useDefaultReminders: true}));
      const id = ev.id || ev.eventId || (p.gcal && p.gcal.id) || null;
      People.patch(p.id, {gcal: {id, by: Who.id(), sig: this.sig(p), link: ev.htmlLink || (p.gcal && p.gcal.link) || null, at: Date.now()}});
      if (!silent) toast('Созвон в вашем Google Календаре 📅');
      return true;
    } catch (e) {
      const x = gcalErr(e);
      if (!silent) toast(x.ambiguous ? 'Google не ответил вовремя — проверьте календарь, прежде чем добавлять ещё раз.' : x.text, {error: true});
      return false;
    }
  },
  async drop(p, {silent = false} = {}) {
    if (!this.mine(p)) return false;
    try {
      await this.call('delete_event', {eventId: p.gcal.id, notificationLevel: 'NONE'});
    } catch (e) {
      const x = gcalErr(e);
      if (x.code !== 'tool_error') { if (!silent) toast(x.text, {error: true}); return false; }
      /* событие уже удалили в самом Google — просто забываем о нём */
    }
    People.patch(p.id, {gcal: null});
    if (!silent) toast('Событие убрано из Google Календаря');
    return true;
  },
  /* после переноса или отмены — привести своё событие к карточке */
  async sync(p) {
    if (!p || !this.mine(p) || this.conn !== 'ready') return;
    if (!this.wanted(p)) return this.drop(p, {silent: true});
    if (p.gcal.sig !== this.sig(p)) return this.push(p, {silent: true});
  },
  /* при открытии CRM: мои события, которые коллеги перенесли или отменили */
  async reconcile() {
    if (this._reconciled || this.conn !== 'ready') return;
    this._reconciled = true;
    const list = Store.all('people').filter(p => this.mine(p) && (!this.wanted(p) || p.gcal.sig !== this.sig(p))).slice(0, 20);
    for (const p of list) { await this.sync(p); await gwait(250); }
  },
};
/* длительность созвона в минутах */
const callMin = p => Number(p.callMin) || (p.type === 'partner' ? 45 : 30);
