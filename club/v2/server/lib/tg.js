/* Бот штаба в Telegram (ключ HQ_TG_TOKEN): пишет каждому в личку напоминания
   с кнопками и сам записывает нажатия в штаб. Это не бот группы «Ясень Ева» —
   у того свой ключ и свой вход (BOT_KEY).

   • Привязка. В штабе «Мой профиль» → «Уведомления» → «Подключить Telegram»:
     сервер выдаёт одноразовую ссылку t.me/<бот>?start=<код> (действует час).
     По «Старт» бот пишет номер чата в карточку человека в «Команде» (tgChatId —
     его сервер никому не отдаёт; в браузер уходит только tgLinked: true).
     Гость собрания не из команды — по ссылке ?start=g_<собрание>_<гость> из окна
     «Напомнить гостям»: номер чата ложится в extGuests[].tgChatId.
   • Напоминания сервер считает сам, раз в полминуты:
       собрание — за remindMin (нет поля — за час) и за 15 минут; кнопки «Буду» /
         «Не смогу» → meetings.responses[человек], у повторяющихся ещё
         respDate[человек] — на какой день ответ. Гостям — один раз, без кнопок;
       протокол, который ждёт «Ок», — по разу на каждую версию текста, днём
         (9–21 по Москве); кнопка «Ок» → protocols.ok[человек];
       задачи со сроком сегодня — одной сводкой в 10:00 по Москве.
     Что уже отправлено и выданные коды — в DATA_DIR/tg.json: после перезапуска
     сервера ничего не повторяется.
   • Нажатия Telegram присылает на https://АДРЕС-ШТАБА/api/tg/webhook с заголовком
     X-Telegram-Bot-Api-Secret-Token; без него запрос не принимается. Адрес сервер
     сообщает Telegram сам при запуске (setWebhook). */

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MSK = 3 * 3600e3, DAY = 864e5, CODE_TTL = 3600e3;
const pad = n => String(n).padStart(2, '0');
const mskDate = ms => new Date(ms + MSK).toISOString().slice(0, 10);
const mskHour = ms => new Date(ms + MSK).getUTCHours();
const hmOf = ms => { const d = new Date(ms + MSK); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
const tMs = (d, hm) => Date.parse(`${d}T${hm}:00+03:00`);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const cut = (s, n) => { const t = String(s || '').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const dayName = d => { const x = new Date(d + 'T12:00:00Z'); return `${WD[x.getUTCDay()]}, ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
const https = u => /^https:\/\/\S+$/.test(String(u || '')) ? String(u) : '';
const firstName = p => String((p && (p.givenName || p.name)) || '').trim().split(/\s+/)[0];

/* собрания — так же, как Meetings в src/app/80-calendar.js */
const step = m => (m.repeat === 'weekly' ? 7 : m.repeat === 'biweekly' ? 14 : 0);
const remindOf = m => (m && m.remindMin !== undefined && m.remindMin !== null && m.remindMin !== '' ? Number(m.remindMin) || 0 : 60);
const meetPeople = m => [m.organizer, ...(m.attendees || [])].filter((x, i, a) => x && a.indexOf(x) === i);
/* ответ человека на этот день: ответ кнопкой у повторяющегося собрания относится к одному дню */
const respOf = (m, pid, date) => { const r = (m.responses || {})[pid], d = (m.respDate || {})[pid]; return r && (!d || d === date) ? r : ''; };
function occ(list, from, to) {
  const out = [];
  list.forEach(m => {
    if (!m || !/^\d{4}-\d\d-\d\d$/.test(m.date || '') || !/^\d\d:\d\d$/.test(m.start || '')) return;
    const st = step(m);
    if (!st) { if (m.date >= from && m.date <= to) out.push({m, date: m.date}); return; }
    let d = m.date;
    if (d < from) d = addDays(d, Math.ceil(daysBetween(d, from) / st) * st);
    for (; d <= to && (!m.until || d <= m.until); d = addDays(d, st)) out.push({m, date: d});
  });
  return out.map(o => { const s = tMs(o.date, o.m.start); return {...o, s, e: s + (Number(o.m.dur) || 60) * 60e3}; }).filter(o => !isNaN(o.s));
}
/* версия протокола — по тексту: «Ок» относится к тексту, поменяли текст — нужно новое «Ок» */
const protoVer = pr => sha(String(pr.text || '')).slice(0, 8);

const HOWTO = 'Это бот штаба Eva Club: присылает напоминания о собраниях и протоколах, отвечать можно кнопками.\n\n'
  + 'Чтобы подключиться, откройте штаб → «Мой профиль» → «Уведомления» → «Подключить Telegram» и нажмите «Старт» в открывшемся боте.';
const RSVP_TEXT = {accepted: '✅ Буду', declined: '❌ Не смогу'};

class TgBot {
  /* store — база штаба, rules — lib/hq-rules.js; api — адрес Bot API и anyHour (днём и ночью) — для проверок */
  constructor({token, secret, publicUrl, file, store, rules, api, anyHour}) {
    this.token = String(token || '').trim();
    this.configured = /^\d{5,}:[\w-]{30,}$/.test(this.token);
    this.secret = String(secret || '').trim() || (this.configured ? sha('eva-hq-tg-webhook|' + this.token).slice(0, 48) : '');
    this.publicUrl = String(publicUrl || '').replace(/\/$/, '');
    this.file = file;
    this.store = store;
    this.rules = rules;
    this.api = String(api || 'https://api.telegram.org').replace(/\/$/, '');
    this.anyHour = !!anyHour;
    this.username = '';
    this.st = {codes: {}, sent: {}};
    this.seen = new Set();   // update_id: Telegram может прислать одно и то же дважды
    this.busy = false;
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); this.st = {codes: j.codes || {}, sent: j.sent || {}}; } catch (e) { /* ещё ничего не отправляли */ }
  }
  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), {recursive: true});
      fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.st), {mode: 0o600});
      fs.renameSync(this.file + '.tmp', this.file);
    } catch (e) { console.error(new Date().toISOString(), 'tg: не сохранил', e.message); }
  }
  /* вызов Bot API; в ошибках адреса с ключом нет */
  async call(method, params) {
    let r;
    try {
      r = await fetch(`${this.api}/bot${this.token}/${method}`, {method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify(params || {}), signal: AbortSignal.timeout(15000)});
    } catch (e) { throw Object.assign(new Error(`Telegram ${method}: нет связи`), {status: 0}); }
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw Object.assign(new Error(`Telegram ${method}: ${j.description || r.status}`), {status: j.error_code || r.status});
    return j.result;
  }
  /* при запуске: узнать имя бота и сказать Telegram, куда слать нажатия */
  async setup() {
    try {
      const me = await this.call('getMe');
      this.username = String(me.username || '');
      if (this.publicUrl.startsWith('https://')) {
        await this.call('setWebhook', {url: this.publicUrl + '/api/tg/webhook', secret_token: this.secret, allowed_updates: ['message', 'callback_query'], max_connections: 4});
      }
      console.log(`Бот штаба в Telegram: @${this.username}`);
    } catch (e) {
      console.error(new Date().toISOString(), 'tg setup:', e.message);
      setTimeout(() => this.setup(), 5 * 60e3).unref();
    }
  }
  start(every = 30e3) {
    if (!this.configured) return;
    this.setup();
    const run = () => this.tick().catch(e => console.error(new Date().toISOString(), 'tg tick:', e.message));
    setInterval(run, every).unref();
    setTimeout(run, Math.min(every, 5000)).unref();
  }

  /* ── кто это ── */
  personByChat(chatId) { return chatId ? this.store.list('people').find(p => p.tgChatId && String(p.tgChatId) === String(chatId) && !p.archived) || null : null; }
  /* права человека — по его учётке: что не увидел бы в штабе, того и в Telegram не получит */
  ctxOf(pid) {
    const a = this.store.list('accounts').find(x => x.personId === pid && x.active !== false);
    return a ? {accId: a.id, role: this.rules.roleOf(a.role), personId: pid} : null;
  }
  sees(pid, c, id, doc) { const ctx = this.ctxOf(pid); return !!ctx && !!this.rules.view(ctx, c, id, doc); }
  unlink(pid) { if (this.store.get('people', pid)) this.store.patch('people', pid, {tgChatId: null, tgLinked: false}); }

  /* ── привязка ── */
  linkFor(pid) {
    if (!this.username) return null;
    const now = Date.now();
    for (const [h, c] of Object.entries(this.st.codes)) if (c.pid === pid || c.exp < now) delete this.st.codes[h];
    const code = crypto.randomBytes(18).toString('base64url');
    this.st.codes[sha(code)] = {pid, exp: now + CODE_TTL};
    this.save();
    return {url: `https://t.me/${this.username}?start=${code}`, exp: now + CODE_TTL};
  }
  startWith(chatId, payload) {
    if (!payload) {
      const p = this.personByChat(chatId);
      return p ? `${firstName(p)}, вы уже подключены: сюда приходят напоминания штаба. Отключить — /stop.` : HOWTO;
    }
    if (payload.startsWith('g_')) return this.linkGuest(chatId, payload.slice(2));
    const h = sha(payload), c = this.st.codes[h];
    if (!c || c.exp < Date.now()) return 'Ссылка не подошла или устарела. Возьмите новую в штабе: «Мой профиль» → «Уведомления» → «Подключить Telegram».';
    delete this.st.codes[h];
    this.save();
    const p = this.store.get('people', c.pid);
    if (!p) return 'Карточки в «Команде» больше нет — напишите основателю.';
    /* один Telegram — одна карточка: иначе непонятно, чей ответ записывать */
    this.store.list('people').filter(x => x.id !== c.pid && x.tgChatId && String(x.tgChatId) === String(chatId)).forEach(x => this.unlink(x.id));
    this.store.patch('people', c.pid, {tgChatId: chatId, tgLinked: true});
    return `Готово, ${firstName(p) || 'подключено'}! Сюда будут приходить напоминания о собраниях (за час и за 15 минут), протоколы на «Ок» и задачи со сроком на сегодня. Отвечать можно кнопками — ответ сам попадёт в штаб.\n\nОтключить — /stop.`;
  }
  linkGuest(chatId, rest) {
    const i = rest.lastIndexOf('_');
    const mid = i > 0 ? rest.slice(0, i) : '', gid = rest.slice(i + 1);
    const m = mid ? this.store.get('meetings', mid) : null;
    const gs = m && Array.isArray(m.extGuests) ? m.extGuests : [];
    const g = gs.find(x => x && x.id === gid);
    if (!g) return 'Встреча не найдена — возможно, её отменили. Попросите у организатора новую ссылку.';
    this.store.patch('meetings', mid, {extGuests: gs.map(x => (x === g ? {...x, tgChatId: chatId} : x))});
    const o = occ([m], mskDate(Date.now()), addDays(mskDate(Date.now()), 120)).find(x => x.e > Date.now());
    const lead = remindOf(m);
    return `Готово! Напомню о встрече «${cut(m.title, 120)}»${o ? ` (${dayName(o.date)}, ${hmOf(o.s)} по Москве)` : ''}${lead ? ` — ${lead >= 1440 ? 'за день' : lead >= 60 ? `за ${lead / 60} ч` : `за ${lead} мин`}` : ''}.`;
  }

  /* ── что пришло от Telegram ── */
  verify(headers) { return this.configured && same(String(headers['x-telegram-bot-api-secret-token'] || ''), this.secret); }
  async update(u) {
    if (!u || typeof u !== 'object') return;
    if (u.update_id !== undefined) {
      if (this.seen.has(u.update_id)) return;
      this.seen.add(u.update_id);
      if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value);
    }
    if (u.message) return this.onMessage(u.message);
    if (u.callback_query) return this.onButton(u.callback_query);
  }
  async onMessage(msg) {
    const chat = msg.chat || {};
    if (chat.type !== 'private' || !chat.id) return;
    const text = String(msg.text || '').trim();
    const st = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec(text);
    let reply;
    if (st) reply = this.startWith(chat.id, st[1] || '');
    else if (/^\/stop(?:@\w+)?$/.test(text)) {
      const p = this.personByChat(chat.id);
      if (p) this.unlink(p.id);
      reply = p ? 'Отключил: напоминаний штаба больше не будет. Подключить снова — в штабе, «Мой профиль» → «Уведомления».' : 'Этот Telegram и так не подключён к штабу.';
    } else reply = this.personByChat(chat.id) ? 'Я только присылаю напоминания штаба и записываю ответы кнопками — писать мне не нужно. Отключить — /stop.' : HOWTO;
    await this.call('sendMessage', {chat_id: chat.id, text: reply}).catch(e => console.error(new Date().toISOString(), 'tg reply:', e.message));
  }
  /* нажали кнопку: записываем ответ того, кто нажал, — и только в его поле */
  async onButton(q) {
    let r;
    try { r = this.press((q.from || {}).id, String(q.data || '')); }
    catch (e) { console.error(new Date().toISOString(), 'tg press:', e.message); r = {text: 'Не получилось записать — ответьте, пожалуйста, в штабе.'}; }
    await this.call('answerCallbackQuery', {callback_query_id: q.id, text: r.text}).catch(() => {});
    const msg = q.message;
    if (r.note && msg && msg.chat && msg.message_id) {
      const base = String(msg.text || '').replace(/\n\n(Ваш ответ|✅ Ваше «Ок»)[^\n]*$/, '');
      await this.call('editMessageText', {chat_id: msg.chat.id, message_id: msg.message_id, text: `${base}\n\n${r.note}`,
        reply_markup: r.markup || {inline_keyboard: []}, link_preview_options: {is_disabled: true}}).catch(() => {});
    }
  }
  press(chatId, data) {
    const p = this.personByChat(chatId);
    if (!p) return {text: 'Этот Telegram не подключён к штабу.'};
    let x = /^m:(.+):(\d{4}-\d\d-\d\d):([ad])$/.exec(data);
    if (x) {
      const [, mid, date, a] = x, m = this.store.get('meetings', mid);
      if (!m || !meetPeople(m).includes(p.id) || !this.sees(p.id, 'meetings', mid, m)) return {text: 'Этого собрания у вас больше нет.'};
      const o = occ([m], date, date)[0];
      if (!o || o.e < Date.now()) return {text: 'Собрание уже прошло.'};
      const v = a === 'a' ? 'accepted' : 'declined';
      this.store.patch('meetings', mid, step(m) ? {responses: {[p.id]: v}, respDate: {[p.id]: date}} : {responses: {[p.id]: v}});
      return {text: `Записал в штаб: ${v === 'accepted' ? 'буду' : 'не смогу'}`, note: `Ваш ответ: ${RSVP_TEXT[v]}`, markup: this.meetMarkup(o)};
    }
    x = /^p:(.+):([0-9a-f]{8})$/.exec(data);
    if (x) {
      const [, id, ver] = x, pr = this.store.get('protocols', id);
      if (!pr || !(pr.people || []).includes(p.id) || !this.sees(p.id, 'protocols', id, pr)) return {text: 'Этого протокола у вас больше нет.'};
      if (protoVer(pr) !== ver) return {text: 'Текст протокола поменялся — пришлю новую версию.'};
      if (!(pr.ok || {})[p.id]) this.store.patch('protocols', id, {ok: {[p.id]: Date.now()}});
      return {text: 'Спасибо, ваше «Ок» записано', note: '✅ Ваше «Ок» записано', markup: this.openMarkup('Открыть протоколы', '#protocols')};
    }
    return {text: 'Эта кнопка устарела.'};
  }

  /* ── сообщения ── */
  openMarkup(label, hash) { return this.publicUrl.startsWith('https://') ? {inline_keyboard: [[{text: label, url: this.publicUrl + '/' + hash}]]} : {inline_keyboard: []}; }
  meetMarkup(o) {
    const rows = [], cb = a => `m:${o.m.id}:${o.date}:${a}`;
    if (Buffer.byteLength(cb('a')) <= 64) rows.push([{text: RSVP_TEXT.accepted, callback_data: cb('a')}, {text: RSVP_TEXT.declined, callback_data: cb('d')}]);
    const url = https(o.m.zoomUrl) || https(o.m.meetUrl);
    if (url) rows.push([{text: o.m.zoomUrl ? '🎥 Открыть Зум' : '🎥 Открыть встречу', url}]);
    return {inline_keyboard: rows};
  }
  meetText(o, now) {
    const mins = Math.max(1, Math.round((o.s - now) / 60e3));
    const head = o.date !== mskDate(now) ? `Завтра в ${hmOf(o.s)}` : mins <= 90 ? `Через ${mins} мин` : `Сегодня в ${hmOf(o.s)}`;
    const lines = [`🔔 ${head} — «${cut(o.m.title || 'Собрание', 150)}»`, `${dayName(o.date)}, ${hmOf(o.s)}–${hmOf(o.e)} по Москве`];
    const url = https(o.m.zoomUrl) || https(o.m.meetUrl);
    if (url) lines.push(`Ссылка: ${url}`);
    if (String(o.m.agenda || '').trim()) lines.push('', `Повестка: ${cut(o.m.agenda, 600)}`);
    return lines.join('\n');
  }

  /* ── что пора отправить ── */
  meetingJobs(now) {
    const today = mskDate(now), out = [];
    occ(this.store.list('meetings'), today, addDays(today, 1)).forEach(o => {
      const lead = remindOf(o.m);
      if (!lead || o.s <= now) return;
      /* пороги: за remindMin и за 15 минут; отправляем самый близкий из наступивших */
      const due = [...new Set([lead, 15])].filter(l => l <= lead && o.s - l * 60e3 <= now);
      if (!due.length) return;
      const stage = Math.min(...due);
      meetPeople(o.m).forEach(pid => {
        const p = this.store.get('people', pid);
        if (!p || !p.tgChatId || p.archived || respOf(o.m, pid, o.date) === 'declined' || !this.sees(pid, 'meetings', o.m.id, o.m)) return;
        const key = `m|${o.m.id}|${o.date}|${o.m.start}|${pid}`, prev = this.st.sent[key];
        if (prev && prev.v <= stage) return;
        const r = respOf(o.m, pid, o.date);
        out.push({key, v: stage, prev, chat: p.tgChatId, pid, text: this.meetText(o, now) + (RSVP_TEXT[r] ? `\n\nВаш ответ: ${RSVP_TEXT[r]}` : ''), markup: this.meetMarkup(o)});
      });
      /* гостям не из команды — один раз, без кнопок */
      if (o.s - lead * 60e3 > now) return;
      (o.m.extGuests || []).forEach(g => {
        if (!g || !g.id || !g.tgChatId) return;
        const key = `g|${o.m.id}|${o.date}|${o.m.start}|${g.id}`;
        if (this.st.sent[key]) return;
        const url = https(o.m.zoomUrl) || https(o.m.meetUrl);
        out.push({key, v: 1, chat: g.tgChatId, guest: {mid: o.m.id, gid: g.id}, text: this.meetText(o, now),
          markup: url ? {inline_keyboard: [[{text: '🎥 Открыть встречу', url}]]} : undefined});
      });
    });
    return out;
  }
  protoJobs(now) {
    const h = mskHour(now);
    if (!this.anyHour && (h < 9 || h >= 21)) return [];
    const out = [];
    this.store.list('protocols').forEach(pr => {
      const at = Math.max(Number(pr.at) || 0, Number(pr.upd) || 0);
      /* свежие версии (до 3 дней); 2 минуты — дать дописать, прежде чем звать на «Ок» */
      if (!pr.title || !at || now - at > 3 * DAY || now - at < 2 * 60e3) return;
      if (!String(pr.text || '').trim() && !pr.recUrl && !pr.file) return;
      const ver = protoVer(pr), ok = pr.ok || {};
      (pr.people || []).forEach(pid => {
        const p = this.store.get('people', pid);
        if (ok[pid] || !p || !p.tgChatId || p.archived || !this.sees(pid, 'protocols', pr.id, pr)) return;
        const key = `p|${pr.id}|${ver}|${pid}`;
        if (this.st.sent[key]) return;
        const text = [`📄 Протокол ждёт вашего «Ок»: «${cut(pr.title, 150)}»${pr.date ? ` · ${dayName(pr.date)}` : ''}`,
          String(pr.text || '').trim() ? '\n' + cut(pr.text, 1500) : '', https(pr.recUrl) ? `\nЗапись: ${pr.recUrl}` : ''].filter(Boolean).join('\n');
        const markup = this.openMarkup('Открыть в штабе', '#protocols');
        markup.inline_keyboard.unshift([{text: '✅ Ок, согласен(на)', callback_data: `p:${pr.id}:${ver}`}]);
        if (Buffer.byteLength(`p:${pr.id}:${ver}`) > 64) markup.inline_keyboard.shift();
        out.push({key, v: 1, chat: p.tgChatId, pid, text, markup});
      });
    });
    return out;
  }
  taskJobs(now) {
    const h = mskHour(now);
    if (!this.anyHour && (h < 10 || h >= 21)) return [];
    const today = mskDate(now), by = {};
    this.store.list('tasks').forEach(t => { if (t.title && t.status !== 'done' && t.due === today && t.assignee) (by[t.assignee] = by[t.assignee] || []).push(t); });
    return Object.entries(by).map(([pid, list]) => {
      const p = this.store.get('people', pid), ctx = this.ctxOf(pid);
      const key = `t|${today}|${pid}`;
      if (!p || !p.tgChatId || p.archived || !ctx || !this.rules.can(ctx.role, 'tasks.view') || this.st.sent[key]) return null;
      return {key, v: 1, chat: p.tgChatId, pid, text: `📌 Сегодня срок по ${list.length === 1 ? 'задаче' : 'задачам'}:\n${list.slice(0, 15).map(t => '• ' + cut(t.title, 140)).join('\n')}${list.length > 15 ? `\n…и ещё ${list.length - 15}` : ''}`,
        markup: this.openMarkup('Открыть задачи', '#tasks')};
    }).filter(Boolean);
  }
  async tick(now = Date.now()) {
    if (this.busy || !this.configured) return;
    this.busy = true;
    try {
      const jobs = [...this.meetingJobs(now), ...this.protoJobs(now), ...this.taskJobs(now)];
      for (const j of jobs) {
        /* сначала отметка — следующий круг то же самое не пошлёт */
        this.st.sent[j.key] = {v: j.v, at: now};
        this.save();
        try {
          await this.call('sendMessage', {chat_id: j.chat, text: j.text, reply_markup: j.markup, link_preview_options: {is_disabled: true}});
        } catch (e) {
          /* бота заблокировали или чата нет — отвязываем; иначе (нет связи) попробуем на следующем круге */
          if (e.status === 403 || (e.status === 400 && /chat not found|deactivated/i.test(e.message))) {
            if (j.pid) this.unlink(j.pid);
            else if (j.guest) { const m = this.store.get('meetings', j.guest.mid); if (m) this.store.patch('meetings', j.guest.mid, {extGuests: (m.extGuests || []).map(g => (g && g.id === j.guest.gid ? {...g, tgChatId: null} : g))}); }
          } else if (j.prev) this.st.sent[j.key] = j.prev; else delete this.st.sent[j.key];
          this.save();
          console.error(new Date().toISOString(), 'tg send:', e.message);
        }
      }
      /* старые отметки и коды — прочь */
      let gone = 0;
      for (const [k, s] of Object.entries(this.st.sent)) if (!s || now - (s.at || 0) > 7 * DAY) { delete this.st.sent[k]; gone++; }
      for (const [k, c] of Object.entries(this.st.codes)) if (c.exp < now) { delete this.st.codes[k]; gone++; }
      if (gone) this.save();
    } finally { this.busy = false; }
  }
}

module.exports = {TgBot, occ, respOf};
