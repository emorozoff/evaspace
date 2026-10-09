/* Google Календарь на своём сервере. В артефакте Claude штаб и CRM ходят в
   календарь через коннектор Claude (callTool('Google Calendar', инструмент, …)).
   Здесь те же шесть инструментов с теми же полями исполняет сервер — через
   Google Calendar API, от имени того, кто вошёл: каждый один раз подключает
   свой аккаунт Google, сервер хранит его ключ продления в data/gcal.json.

   Нужны GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET (Google Cloud → Credentials →
   OAuth client, тип «Web application», адрес возврата PUBLIC_URL/api/gcal/callback). */

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

const SCOPES = ['openid', 'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy'];
const TOOLS = ['list_events', 'list_calendars', 'suggest_time', 'create_event', 'update_event', 'delete_event'];

/* ошибка в том виде, в каком её ждут штаб и CRM: код решает, что показать человеку */
const fail = (code, message, extra) => Object.assign(new Error(message || code), {code, ...(extra || {})});

function request(method, url, {headers = {}, body, form} = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = form ? new URLSearchParams(form).toString() : body === undefined ? null : JSON.stringify(body);
    const h = {...headers};
    if (data !== null) { h['content-type'] = form ? 'application/x-www-form-urlencoded' : 'application/json'; h['content-length'] = Buffer.byteLength(data); }
    const r = https.request({host: u.host, path: u.pathname + u.search, method, headers: h}, res => {
      const parts = [];
      res.on('data', c => parts.push(c));
      res.on('end', () => {
        const text = Buffer.concat(parts).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { /* не JSON — отдадим как есть */ }
        resolve({status: res.statusCode, json, text});
      });
    });
    r.on('error', e => reject(fail('server_unavailable', e.message, {retryable: true})));
    r.setTimeout(25000, () => { r.destroy(); reject(fail('server_unavailable', 'Google не ответил за 25 секунд', {retryable: true})); });
    r.end(data === null ? undefined : data);
  });
}

/* смещение часового пояса в минутах на момент ms: +180 для Москвы */
function tzOffsetMin(tz, ms) {
  try {
    const f = new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000);
  } catch (e) { return 180; }
}
const hm = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : null; };

class Gcal {
  constructor({file, clientId, clientSecret, publicUrl}) {
    this.file = file;
    this.clientId = clientId || '';
    this.clientSecret = clientSecret || '';
    this.publicUrl = String(publicUrl || '').replace(/\/$/, '');
    this.tokens = {};
    this.pending = new Map();   // state → {accId, back, at}
    try { this.tokens = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { this.tokens = {}; }
  }
  get configured() { return !!(this.clientId && this.clientSecret && this.publicUrl); }
  get redirectUri() { return this.publicUrl + '/api/gcal/callback'; }
  save() {
    fs.mkdirSync(path.dirname(this.file), {recursive: true});
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.tokens), {mode: 0o600});
    fs.renameSync(tmp, this.file);
  }
  status(accId) {
    const t = this.tokens[accId];
    return {configured: this.configured, connected: !!(t && t.refresh), email: (t && t.email) || ''};
  }

  /* ── подключение аккаунта Google ── */
  authUrl(accId, back) {
    const state = crypto.randomBytes(18).toString('base64url');
    this.pending.set(state, {accId, back, at: Date.now()});
    for (const [k, v] of this.pending) if (Date.now() - v.at > 15 * 60e3) this.pending.delete(k);
    const q = new URLSearchParams({client_id: this.clientId, redirect_uri: this.redirectUri, response_type: 'code', scope: SCOPES.join(' '),
      access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state});
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
  }
  /* Google вернул человека с кодом → меняем на ключи. Возвращает {accId, back} */
  async finish(state, code) {
    const p = this.pending.get(state);
    this.pending.delete(state);
    if (!p || Date.now() - p.at > 15 * 60e3) throw fail('cancelled', 'Ссылка подключения устарела — нажмите «Подключить» ещё раз');
    const r = await request('POST', 'https://oauth2.googleapis.com/token', {form: {code, client_id: this.clientId, client_secret: this.clientSecret, redirect_uri: this.redirectUri, grant_type: 'authorization_code'}});
    if (r.status !== 200 || !r.json || !r.json.access_token) throw fail('tool_error', (r.json && (r.json.error_description || r.json.error)) || 'Google не выдал доступ');
    const j = r.json;
    let email = '';
    try { email = JSON.parse(Buffer.from(String(j.id_token || '').split('.')[1] || '', 'base64url').toString('utf8')).email || ''; } catch (e) { /* без почты обойдёмся */ }
    const old = this.tokens[p.accId] || {};
    this.tokens[p.accId] = {refresh: j.refresh_token || old.refresh || '', access: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000, email, scope: j.scope || '', at: Date.now()};
    this.save();
    return p;
  }
  async disconnect(accId) {
    const t = this.tokens[accId];
    if (!t) return;
    delete this.tokens[accId];
    this.save();
    try { await request('POST', 'https://oauth2.googleapis.com/revoke', {form: {token: t.refresh || t.access}}); } catch (e) { /* ключ уже удалён у нас — этого достаточно */ }
  }
  async access(accId) {
    const t = this.tokens[accId];
    if (!this.configured) throw fail('capability_disabled', 'Google Календарь на этом сервере не настроен');
    if (!t || !t.refresh) throw fail('connect_first', 'Google Календарь не подключён');
    if (t.access && t.exp - Date.now() > 60e3) return t.access;
    const r = await request('POST', 'https://oauth2.googleapis.com/token', {form: {client_id: this.clientId, client_secret: this.clientSecret, refresh_token: t.refresh, grant_type: 'refresh_token'}});
    if (r.status === 400 || r.status === 401) {
      /* человек отозвал доступ в настройках Google — просим подключить заново */
      delete this.tokens[accId];
      this.save();
      throw fail('connect_first', 'Доступ к Google Календарю отозван — подключите его заново');
    }
    if (r.status !== 200 || !r.json || !r.json.access_token) throw fail('server_unavailable', 'Google не продлил доступ', {retryable: true});
    t.access = r.json.access_token;
    t.exp = Date.now() + (Number(r.json.expires_in) || 3600) * 1000;
    this.save();
    return t.access;
  }
  async api(accId, method, p, {query, body} = {}) {
    const token = await this.access(accId);
    const q = new URLSearchParams();
    Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); });
    const r = await request(method, `https://www.googleapis.com/calendar/v3/${p}${[...q].length ? '?' + q : ''}`, {headers: {authorization: 'Bearer ' + token}, body});
    if (r.status >= 200 && r.status < 300) return r.json || {};
    const msg = (r.json && r.json.error && r.json.error.message) || `HTTP ${r.status}`;
    if (r.status === 401) { const t = this.tokens[accId]; if (t) { t.access = ''; t.exp = 0; } throw fail('server_unavailable', msg, {retryable: true}); }
    if (r.status === 429 || (r.status === 403 && /rate|quota/i.test(msg))) throw fail('rate_limited', msg, {retryable: true, retryAfterMs: 3000});
    if (r.status >= 500) throw fail('server_unavailable', msg, {retryable: true});
    throw fail('tool_error', msg, {status: r.status});
  }

  /* ── инструменты: названия и поля — как у коннектора Claude ── */
  async call(accId, tool, input) {
    const a = input && typeof input === 'object' ? input : {};
    if (!TOOLS.includes(tool)) throw fail('bad_request', 'нет такого инструмента: ' + tool);
    const cal = encodeURIComponent(a.calendarId || 'primary');
    const send = {NONE: 'none', EXTERNAL_ONLY: 'externalOnly', ALL: 'all'}[a.notificationLevel] || 'none';

    if (tool === 'list_events') {
      const order = {startTime: 'startTime', lastModified: 'updated'}[a.orderBy];
      return this.api(accId, 'GET', `calendars/${cal}/events`, {query: {timeMin: iso(a.startTime), timeMax: iso(a.endTime), singleEvents: true, orderBy: order,
        maxResults: Math.min(250, Number(a.pageSize) || 250), pageToken: a.pageToken, timeZone: a.timeZone, q: a.fullText}});
    }
    if (tool === 'list_calendars') {
      const r = await this.api(accId, 'GET', 'users/me/calendarList', {query: {maxResults: Math.min(250, Number(a.pageSize) || 100), pageToken: a.pageToken}});
      return {calendars: r.items || [], nextPageToken: r.nextPageToken};
    }
    if (tool === 'suggest_time') return this.suggest(accId, a);
    if (tool === 'delete_event') {
      if (!a.eventId) throw fail('bad_request', 'нужен eventId');
      await this.api(accId, 'DELETE', `calendars/${cal}/events/${encodeURIComponent(a.eventId)}`, {query: {sendUpdates: send}});
      return {deleted: true};
    }

    const body = {};
    if (a.summary !== undefined) body.summary = String(a.summary);
    if (a.description !== undefined) body.description = String(a.description);
    if (a.location !== undefined) body.location = String(a.location);
    if (a.colorId !== undefined) body.colorId = String(a.colorId);
    if (a.startTime) body.start = {dateTime: iso(a.startTime), timeZone: a.timeZone || undefined};
    if (a.endTime) body.end = {dateTime: iso(a.endTime), timeZone: a.timeZone || undefined};
    const person = x => ({email: String(x.email || '').trim().toLowerCase(), ...(x.displayName ? {displayName: String(x.displayName)} : {})});
    const meet = () => ({createRequest: {requestId: crypto.randomBytes(12).toString('hex'), conferenceSolutionKey: {type: 'hangoutsMeet'}}});

    if (tool === 'create_event') {
      if (!body.start || !body.end) throw fail('bad_request', 'нужны startTime и endTime');
      if (Array.isArray(a.attendees) && a.attendees.length) body.attendees = a.attendees.filter(x => x && x.email).map(person);
      if (Array.isArray(a.recurrenceData) && a.recurrenceData.length) body.recurrence = a.recurrenceData.map(String);
      if (a.useDefaultReminders !== undefined) body.reminders = {useDefault: !!a.useDefaultReminders};
      if (a.addGoogleMeetUrl) body.conferenceData = meet();
      const ev = await this.api(accId, 'POST', `calendars/${cal}/events`, {query: {sendUpdates: send, conferenceDataVersion: 1}, body});
      return {event: ev};
    }
    /* update_event: участников присылают разницей — добавить / убрать */
    if (!a.eventId) throw fail('bad_request', 'нужен eventId');
    const id = encodeURIComponent(a.eventId);
    const add = (a.addedAttendees || []).filter(x => x && x.email).map(person);
    const del = (a.removedAttendeeEmails || []).map(e => String(e || '').trim().toLowerCase());
    if (add.length || del.length || a.addGoogleMeetUrl) {
      const cur = await this.api(accId, 'GET', `calendars/${cal}/events/${id}`);
      if (add.length || del.length) {
        const list = (cur.attendees || []).filter(x => !del.includes(String(x.email || '').toLowerCase()));
        add.forEach(x => { if (!list.some(y => String(y.email || '').toLowerCase() === x.email)) list.push(x); });
        body.attendees = list;
      }
      if (a.addGoogleMeetUrl && !cur.hangoutLink) body.conferenceData = meet();
    }
    const ev = await this.api(accId, 'PATCH', `calendars/${cal}/events/${id}`, {query: {sendUpdates: send, conferenceDataVersion: 1}, body});
    return {event: ev};
  }

  /* свободные окна для собрания: занятость участников из Google (чьи календари
     видны организатору) + рабочие часы. Отдаём окна целиком — штаб берёт начало. */
  async suggest(accId, a) {
    const from = Date.parse(a.startTime), to = Date.parse(a.endTime);
    const dur = (Number(a.durationMinutes) || 30) * 60e3;
    if (!(from < to)) throw fail('bad_request', 'нужны startTime и endTime');
    const pref = a.preferences || {};
    const tz = a.timeZone || 'Europe/Moscow';
    const dayFrom = hm(pref.startHour) ?? 600, dayTo = hm(pref.endHour) ?? 1140;
    const max = Math.min(50, Number(pref.pageSize) || 6);
    const ids = ['primary', ...[...new Set((a.attendeeEmails || []).map(e => String(e || '').trim().toLowerCase()).filter(Boolean))]];
    const fb = await this.api(accId, 'POST', 'freeBusy', {body: {timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), timeZone: tz, items: ids.map(id => ({id}))}});
    const busy = [];
    Object.values(fb.calendars || {}).forEach(c => (c.busy || []).forEach(b => { const s = Date.parse(b.start), e = Date.parse(b.end); if (s < e) busy.push([s, e]); }));
    busy.sort((x, y) => x[0] - y[0]);
    const slots = [];
    const off = tzOffsetMin(tz, from) * 60e3;
    /* идём по дням в поясе встречи */
    for (let day = Math.floor((from + off) / 864e5) * 864e5; day - off < to && slots.length < max; day += 864e5) {
      const wd = new Date(day).getUTCDay();
      if (pref.excludeWeekends && (wd === 0 || wd === 6)) continue;
      let s = Math.max(from, day - off + dayFrom * 60e3);
      const end = Math.min(to, day - off + dayTo * 60e3);
      for (const [bs, be] of busy) {
        if (be <= s) continue;
        if (bs >= end) break;
        if (bs - s >= dur) slots.push([s, bs]);
        s = Math.max(s, be);
      }
      if (end - s >= dur) slots.push([s, end]);
    }
    return {timeSlots: slots.slice(0, max).map(([s, e]) => ({startTime: new Date(s).toISOString(), endTime: new Date(e).toISOString()}))};
  }
}
function iso(s) {
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) throw fail('bad_request', 'непонятное время: ' + s);
  return String(s);
}

module.exports = {Gcal, TOOLS};
