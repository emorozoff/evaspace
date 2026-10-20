/* Зум команды: встречи из штаба, запись и ИИ-протокол — сами в «Протоколы».
   Работает через приложение Зума типа Server-to-Server OAuth (одно на аккаунт
   компании, от имени владельца аккаунта): ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID,
   ZOOM_CLIENT_SECRET — создавать встречи и читать протоколы; ZOOM_WEBHOOK_SECRET —
   проверять уведомления Зума («запись готова», «протокол готов»), которые он
   присылает на https://АДРЕС-ШТАБА/api/zoom/webhook. Ключи кладёт deploy/zoom.sh. */

'use strict';
const crypto = require('crypto');

const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
/* uuid встречи с «/» в начале или «//» внутри Зум просит кодировать дважды */
const uuidPath = u => (/^\/|\/\//.test(u) ? encodeURIComponent(encodeURIComponent(u)) : encodeURIComponent(u));

class Zoom {
  constructor({accountId, clientId, clientSecret, webhookSecret}) {
    Object.assign(this, {accountId, clientId, clientSecret, webhookSecret});
    this.configured = !!(accountId && clientId && clientSecret);
    this.hooks = !!webhookSecret;
    this.tok = null;
    this.exp = 0;
  }
  async token() {
    if (this.tok && Date.now() < this.exp - 60e3) return this.tok;
    const r = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(this.accountId)}`, {
      method: 'POST', headers: {authorization: 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')},
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw Object.assign(new Error('Зум не выдал доступ: ' + (j.reason || j.error || r.status)), {status: 502});
    this.tok = j.access_token;
    this.exp = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    return this.tok;
  }
  async api(method, path, body) {
    const r = await fetch('https://api.zoom.us/v2' + path, {
      method, headers: {authorization: 'Bearer ' + await this.token(), 'content-type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.message || 'Зум ответил ошибкой ' + r.status), {status: r.status === 404 ? 404 : 502, code: j.code});
    return j;
  }
  /* встреча штаба → встреча Зума: запись в облако включена сразу */
  meetingBody(m) {
    return {topic: String(m.title || 'Собрание Eva Club').slice(0, 200), type: 2, start_time: `${m.date}T${m.start}:00`, timezone: 'Europe/Moscow',
      duration: Number(m.dur) || 60, agenda: String(m.agenda || '').slice(0, 2000),
      settings: {auto_recording: 'cloud', join_before_host: true, waiting_room: false}};
  }
  create(m) { return this.api('POST', '/users/me/meetings', this.meetingBody(m)); }
  update(id, m) { return this.api('PATCH', `/meetings/${encodeURIComponent(id)}`, this.meetingBody(m)); }
  /* ИИ-протокол Зума (AI Companion) текстом: кратко, по темам, следующие шаги */
  async summaryText(uuid) {
    const s = await this.api('GET', `/meetings/${uuidPath(uuid)}/meeting_summary`);
    const parts = [];
    if (s.summary_overview) parts.push(`Кратко:\n${s.summary_overview}`);
    (s.summary_details || []).forEach(d => { if (d && (d.label || d.summary)) parts.push(`${d.label ? d.label + ':\n' : ''}${d.summary || ''}`); });
    if ((s.next_steps || []).length) parts.push(`Следующие шаги:\n${s.next_steps.map(x => '• ' + x).join('\n')}`);
    if (s.summary_content && !parts.length) parts.push(String(s.summary_content));
    return parts.join('\n\n').trim();
  }
  /* уведомление пришло от Зума: подпись v0=HMAC(секрет, «v0:время:тело»), не старше 5 минут */
  verify(headers, raw) {
    if (!this.hooks) return false;
    const ts = String(headers['x-zm-request-timestamp'] || ''), sig = String(headers['x-zm-signature'] || '');
    if (!ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
    return same(sig, 'v0=' + hmac(this.webhookSecret, `v0:${ts}:${raw}`));
  }
  /* проверка адреса при настройке уведомлений в Зуме */
  validation(plainToken) { return {plainToken, encryptedToken: hmac(this.webhookSecret, String(plainToken))}; }
}

module.exports = {Zoom, hmac};
