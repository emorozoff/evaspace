/* Зум команды: встречи из штаба, запись и ИИ-протокол — сами в «Протоколы».
   Работает через приложение Зума типа Server-to-Server OAuth (одно на аккаунт
   компании, от имени владельца аккаунта): ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID,
   ZOOM_CLIENT_SECRET — создавать встречи и читать протоколы; ZOOM_WEBHOOK_SECRET —
   проверять уведомления Зума («запись готова», «протокол готов»), которые он
   присылает на https://АДРЕС-ШТАБА/api/zoom/webhook. Ключи кладёт deploy/zoom.sh.
   Видео записи штаб показывает у себя: файл берёт у Зума сервер (file) и отдаёт плееру кусками. */

'use strict';
const crypto = require('crypto');

const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
/* звуковой транскрипт записи (WebVTT) → текст: «[чч:мм:сс] Имя: фраза», реплики одного человека подряд — одной строкой */
function vttText(vtt) {
  const out = [];
  for (const block of String(vtt || '').replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map(x => x.trim()).filter(Boolean);
    const ti = lines.findIndex(x => x.includes('-->'));
    if (ti < 0) continue;
    const at = lines[ti].split('-->')[0].trim().replace(/\.\d+$/, '');
    const text = lines.slice(ti + 1).join(' ').trim();
    if (!text) continue;
    const m = /^([^:]{1,60}):\s+(.*)$/.exec(text);
    const who = m ? m[1].trim() : '', say = m ? m[2] : text;
    const last = out[out.length - 1];
    if (last && last.who === who) last.say += ' ' + say;
    else out.push({at, who, say});
  }
  return out.map(x => `[${x.at}] ${x.who ? x.who + ': ' : ''}${x.say}`).join('\n');
}
/* uuid встречи с «/» в начале или «//» внутри Зум просит кодировать дважды */
const uuidPath = u => (/^\/|\/\//.test(u) ? encodeURIComponent(encodeURIComponent(u)) : encodeURIComponent(u));
/* из файлов одного захода в Зум — одно видео для просмотра: экран с говорящим, потом говорящий, галерея…
   Видео нет — звук. Ссылку на файл (url) знает только сервер */
const VIDEO_PICK = ['shared_screen_with_speaker_view', 'shared_screen_with_speaker_view(CC)', 'active_speaker', 'speaker_view',
  'shared_screen_with_gallery_view', 'gallery_view', 'shared_screen'];
function videoFile(files) {
  const ready = (files || []).filter(f => f && f.id && f.download_url && f.status !== 'processing');
  const typed = t => ready.filter(f => String(f.file_type || '').toUpperCase() === t);
  const rank = f => { const i = VIDEO_PICK.indexOf(f.recording_type); return i < 0 ? 99 : i; };
  const mp4 = typed('MP4').sort((a, b) => rank(a) - rank(b))[0], f = mp4 || typed('M4A')[0];
  if (!f) return null;
  return {id: String(f.id), kind: mp4 ? 'video' : 'audio', size: Number(f.file_size) || 0,
    start: String(f.recording_start || ''), end: String(f.recording_end || ''), url: String(f.download_url)};
}

class Zoom {
  /* oauth и api — адреса Зума; другие — только для проверок (test/api-test.js): свой «Зум» */
  constructor({accountId, clientId, clientSecret, webhookSecret, oauth, api}) {
    Object.assign(this, {accountId, clientId, clientSecret, webhookSecret});
    this.oauth = oauth || 'https://zoom.us/oauth/token';
    this.base = api || 'https://api.zoom.us/v2';
    this.configured = !!(accountId && clientId && clientSecret);
    this.hooks = !!webhookSecret;
    this.tok = null;
    this.exp = 0;
    this.cdn = new Map();
  }
  async token() {
    if (this.tok && Date.now() < this.exp - 60e3) return this.tok;
    const r = await fetch(`${this.oauth}?grant_type=account_credentials&account_id=${encodeURIComponent(this.accountId)}`, {
      method: 'POST', headers: {authorization: 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')},
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw Object.assign(new Error('Зум не выдал доступ: ' + (j.reason || j.error || r.status)), {status: 502});
    this.tok = j.access_token;
    this.exp = Date.now() + (Number(j.expires_in) || 3600) * 1000;
    return this.tok;
  }
  async api(method, path, body) {
    const r = await fetch(this.base + path, {
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
  /* транскрипт записи текстом. Файл TRANSCRIPT приходит в уведомлении о записи; скачать его можно ключом
     из уведомления (download_token, живёт сутки) или ключом приложения (нужны права на облачные записи) */
  async transcriptText(files, downloadToken) {
    const f = (files || []).find(x => x && (x.file_type === 'TRANSCRIPT' || x.recording_type === 'audio_transcript') && x.download_url);
    if (!f) return '';
    const r = await fetch(f.download_url, {headers: {authorization: 'Bearer ' + (downloadToken || await this.token())}});
    if (!r.ok) throw Object.assign(new Error('Зум не отдал транскрипт: ' + r.status), {status: 502});
    return vttText(await r.text());
  }
  /* файлы записи одного захода — для записей, пришедших до того, как штаб научился их показывать */
  recordings(uuid) { return this.api('GET', `/meetings/${uuidPath(uuid)}/recordings`); }
  /* файл записи для плеера штаба. Ссылка Зума перенаправляет в хранилище: туда идём уже без ключа, с тем же
     Range (плеер просит запись кусками). Адрес хранилища помним пять минут, чтобы не спрашивать Зум на каждый кусок.
     Ключ отдаём только самому Зуму */
  async file(url, range, signal) {
    const own = u => { try { const h = new URL(u).hostname; return /(^|\.)zoom\.us$/.test(h) || h === new URL(this.base).hostname; } catch (e) { return false; } };
    if (!own(url)) throw Object.assign(new Error('ссылка на запись — не Зума'), {status: 400});
    const get = async (u, auth) => fetch(u, {redirect: 'manual', signal,
      headers: {'accept-encoding': 'identity', ...(range ? {range} : {}), ...(auth ? {authorization: 'Bearer ' + await this.token()} : {})}});
    const hit = this.cdn.get(url);
    if (hit && hit.exp > Date.now()) {
      const r = await get(hit.loc, false);
      if (r.ok || r.status === 416) return r;
      r.body?.cancel().catch(() => {});
      this.cdn.delete(url);
    }
    let at = url, r = await get(url, true);
    for (let i = 0; i < 4 && r.status >= 300 && r.status < 400 && r.headers.get('location'); i++) {
      r.body?.cancel().catch(() => {});
      at = new URL(r.headers.get('location'), at).href;
      r = await get(at, new URL(at).hostname === new URL(url).hostname);   // как curl: ключ — только тому же адресу
    }
    if (r.ok && at !== url) {
      const now = Date.now();
      for (const [k, x] of this.cdn) if (x.exp < now) this.cdn.delete(k);
      this.cdn.set(url, {loc: at, exp: now + 5 * 60e3});
    }
    return r;
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

module.exports = {Zoom, hmac, vttText, videoFile};
