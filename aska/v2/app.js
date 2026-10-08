/* АСЬКА — мессенджер в духе ICQ 99/2000.
   Всё живёт в браузере: номера, контакты и переписка хранятся в localStorage,
   между вкладками одного устройства сообщения летают через BroadcastChannel,
   а компанию составляют боты-собеседники из 1999 года. */
(function () {
  'use strict';

  const VERSION = '2.1';
  const SESSION_KEY = 'aska.session';
  const Snd = window.AskaSound;
  const Music = window.AskaMusic;

  /* ================= утилиты ================= */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const fmtTime = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const fmtDay = (ts) => { const d = new Date(ts); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); };
  const sameDay = (a, b) => fmtDay(a) === fmtDay(b);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pairKey = (a, b) => (String(a) < String(b) ? a + '-' + b : b + '-' + a);
  const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
  const isNarrow = () => window.matchMedia('(max-width: 719px)').matches || (isTouch() && window.matchMedia('(max-width: 900px)').matches);

  /* ================= хранилище ================= */
  // общее с дизайном «Зумер» хранилище (../store.js): те же номера, переписка и сессия
  const Store = window.AskaStore;
  const Sec = window.AskaSecure;
  function load() { return Store.sync(); }
  let db = load();
  function mutate(fn) { return Store.mutate(fn); }
  // выбор дизайна: «Зумер» — новый интерфейс в корне, «Миллениал» — этот
  function toZoomer() { mutate((d) => { d.settings.design = 'zoomer'; }); if (me) saveSession(); const q = new URLSearchParams(location.search); q.delete('design'); const qs = q.toString(); location.href = '../' + (qs ? '?' + qs : '') + location.hash; }

  function applySettings() {
    Snd.enabled = db.settings.sound !== false;
    Snd.volume = db.settings.volume == null ? 0.8 : db.settings.volume;
  }
  applySettings();

  /* ================= боты ================= */
  const BOTS = {
    '123456': {
      uin: '123456', nick: 'Админ АСЬКИ', phone: '', bot: true, seed: 1, always: true,
      hello: ['Добро пожаловать в АСЬКУ! Я помогу разобраться. Напиши «помощь» :)'],
      replies: ['Чтобы добавить друга — меню «Контакты» → «Добавить контакт», ищи по номеру, телефону или нику.', 'Сменить статус можно кнопкой с цветочком внизу списка контактов.', 'Смайлы вставляются кнопкой :) под полем ввода. У каждого свой звук — нажми на смайл в переписке, чтобы послушать.', 'Открой АСЬКУ во второй вкладке, зарегистрируй ещё один номер и напиши сам себе — так можно проверить звук «о-оу» :)', 'Звук можно выключить в меню «Звук».', 'Добавь АСЬКУ на экран «Домой» — она откроется как приложение, даже без интернета.', 'Enter отправляет сообщение, Shift+Enter — новая строка.'],
      bye: ['До связи! Я всегда онлайн :)'],
      how: ['Работаю круглосуточно, без выходных :)'],
      help: 'Что умеет АСЬКА:\n• номер + ник + телефон при регистрации\n• контакты с цветочками-статусами\n• «о-оу!» на входящее сообщение\n• 22 смайла, у каждого свой звук\n• стена: открытки, записи, музыка — её видят друзья\n• интересы и процент совпадения, случайное знакомство\n• режимы «Близкие / Бизнес / Общение» — меняют статус и стиль\n• виниловый плеер: хиты, коллекция по ссылкам (Яндекс Музыка, YouTube, mp3), НФТ у трека, консультант Винилл\n• кино: фильмы и сериалы по ссылке, смотреть с любого устройства, любимое, советовать друзьям\n• холодильник: магниты из поездок, любимая еда и напитки (НФТ)\n• Аська и друзья с характером\n• аватар КИРР: учится на переписке, отвечает друзьям твоими словами («учись» — тренировка)\n• пригласить друга: «Добавить контакт → Пригласить» — аватар встретит новичка открыткой\n\nСпроси: «контакты», «статус», «смайлы», «звук», «вкладки».',
    },
  };
  // Аська и друзья — персонажи с характером, живут в brain.js
  Object.values(window.AskaBrain.personas).forEach((P) => {
    BOTS[P.uin] = { uin: P.uin, nick: P.nick, phone: P.phone, bot: true, brain: P.id, persona: P, always: !!P.always, seed: P.seed };
  });

  const SMILE_TAUNTS = ['Ой, какой смайлик! :)', 'Отвечаю тем же! :D', 'хихи :$', ';)', 'Ух ты! :O', 'Люблю смайлы @}->--', '8) круто'];

  /* ================= графика (art.js) ================= */
  const { STATUSES, statusInfo, flowerSvg, statusFlower, envelopeSvg, SMILES, SMILE_BY_ID, smileSvg, postcardSvg, COUNTRIES, COUNTRY, magnetSvg, coverSvg, foodSvg } = window.AskaArt;
  const Cinema = window.AskaCinema;

  // регулярка по всем кодам: длинные раньше коротких
  const CODE_LIST = [];
  SMILES.forEach((s) => s.codes.forEach((c) => CODE_LIST.push([c, s.id])));
  CODE_LIST.sort((a, b) => b[0].length - a[0].length);
  const CODE_MAP = {};
  CODE_LIST.forEach(([c, id]) => (CODE_MAP[c] = id));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const SMILE_RE = new RegExp('(^|[\\s(])?(' + CODE_LIST.map(([c]) => reEsc(c)).join('|') + ')(?=$|[\\s.,!?)])', 'g');

  function findSmiles(text) {
    const out = [];
    text.replace(SMILE_RE, (m, pre, code, off) => {
      // коды из букв и цифр (8), B), O:)) считаем смайлом только в начале или после пробела
      if (/^[A-Za-z0-9]/.test(code) && pre == null && off !== 0) return m;
      out.push(CODE_MAP[code]);
      return m;
    });
    return out;
  }

  // текст сообщения → html со смайлами и ссылками
  function renderText(text) {
    const parts = [];
    let last = 0;
    text.replace(SMILE_RE, (m, pre, code, off) => {
      const needPre = /^[A-Za-z0-9]/.test(code);
      if (needPre && pre == null && off !== 0) return m;
      parts.push(['t', text.slice(last, off + (pre ? pre.length : 0))]);
      parts.push(['s', CODE_MAP[code], code]);
      last = off + m.length;
      return m;
    });
    parts.push(['t', text.slice(last)]);
    return parts.map((p) => {
      if (p[0] === 's') return `<span class="sm" data-sm="${p[1]}" title="${esc(p[2])} — ${esc(SMILE_BY_ID[p[1]].name)}">${smileSvg(p[1])}</span>`;
      return esc(p[1]).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }).join('');
  }

  /* ================= аккаунты ================= */
  function normPhone(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    if (d.length === 10) d = '7' + d;
    return d;
  }
  function fmtPhone(d) {
    d = normPhone(d);
    if (!d) return '';
    if (d.length === 11 && d[0] === '7') return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
    return '+' + d;
  }
  function maskPhoneInput(input) {
    let d = input.value.replace(/\D/g, '');
    if (d[0] === '8') d = '7' + d.slice(1);
    if (!d) { input.value = ''; return; }
    if (d[0] !== '7' && d.length <= 10) d = '7' + d;
    d = d.slice(0, 15);
    if (d[0] === '7' && d.length <= 11) {
      let s = '+7';
      if (d.length > 1) s += ' (' + d.slice(1, 4);
      if (d.length >= 4) s += ') ' + d.slice(4, 7);
      if (d.length >= 7) s += '-' + d.slice(7, 9);
      if (d.length >= 9) s += '-' + d.slice(9, 11);
      input.value = s;
    } else input.value = '+' + d;
  }
  const isTwin = (uin) => typeof uin === 'string' && uin.startsWith('tw');
  const twinUin = (uin) => 'tw' + uin;
  function twinNick(owner) { const p = profileOf(owner); return p.twinName || 'КИРР'; }
  function accountOf(uin) {
    if (db.accounts[uin]) return db.accounts[uin];
    if (BOTS[uin]) return BOTS[uin];
    if (isTwin(uin)) { const o = db.accounts[uin.slice(2)]; if (o) return { uin, nick: me && o.uin === me.uin ? twinNick(o.uin) : `${twinNick(o.uin)} (${o.nick})`, phone: '', bot: true, twinOf: o.uin, ownerNick: o.nick }; }
    return null;
  }
  function allKnown() {
    const real = Object.values(db.accounts);
    return real.concat(Object.values(BOTS)).concat(real.map((a) => accountOf(twinUin(a.uin))).filter(Boolean));
  }
  function newUin() {
    for (let i = 0; i < 100; i++) {
      const u = String(100000 + Math.floor(Math.random() * 900000));
      if (!accountOf(u)) return u;
    }
    return String(Date.now()).slice(-7);
  }

  /* ================= сессия ================= */
  let me = null;               // объект аккаунта
  let myStatus = 'online';
  let openChats = [];          // uin'ы открытых бесед
  let active = null;           // активная беседа
  let drafts = {};
  let typing = {};             // кто печатает (боты)
  let botState = {};           // онлайн ли бот в прошлую проверку
  let menuEl = null;
  let smilesEl = null;
  let heartbeatTimer = null;
  let titleTimer = null;
  const BLINK_MS = 120000;        // конверт мигает две минуты после прихода, потом просто висит
  let lastIncomingTs = 0, blinkTimer = null;
  function lastFromTs(uin) { const h = db.history[pairKey(me.uin, uin)] || []; for (let i = h.length - 1; i >= 0; i--) if (h[i].from === uin) return h[i].ts; return 0; }
  function freshUnread(uin) { return unreadFrom(uin) > 0 && Date.now() - lastFromTs(uin) < BLINK_MS; }
  function scheduleBlinkStop() {
    clearTimeout(blinkTimer); let soonest = Infinity;
    contactsOf(me.uin).forEach((u) => { if (!unreadFrom(u)) return; const left = BLINK_MS - (Date.now() - lastFromTs(u)); if (left > 0) soonest = Math.min(soonest, left); });
    if (soonest < Infinity) blinkTimer = setTimeout(() => { if (me) { renderContacts(); renderChatHead(); } }, soonest + 150);
  }
  let toastTimer = null;

  function loadSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (s && s.seen && Date.now() - s.seen > 12 * 3600 * 1000) { sessionStorage.removeItem(SESSION_KEY); return; }
      if (s && Sec.isUin(s.uin) && !isTwin(s.uin) && db.accounts[s.uin]) {
        me = db.accounts[s.uin];
        myStatus = s.status || 'online';
        openChats = (s.open || []).filter((u) => accountOf(u));
        active = openChats.includes(s.active) ? s.active : openChats[0] || null;
        drafts = s.drafts || {};
      }
    } catch (err) {}
  }
  function saveSession() {
    try {
      if (!me) sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, JSON.stringify({ uin: me.uin, status: myStatus, open: openChats, active, drafts, seen: Date.now() }));
    } catch (err) {}
  }

  /* ================= присутствие ================= */
  const bus = 'BroadcastChannel' in window ? new BroadcastChannel('aska') : null;
  function post(msg) { if (bus) try { bus.postMessage(msg); } catch (err) {} }

  function botOnline(bot) {
    if (bot.always) return true;
    // детерминированное расписание: одинаковое во всех вкладках
    const slot = Math.floor(Date.now() / 60000) + bot.seed;
    return slot % 9 !== 0 && slot % 13 !== 4;
  }
  function statusOf(uin) {
    if (me && uin === me.uin) return myStatus;
    if (isTwin(uin)) return 'chat';
    const b = BOTS[uin];
    if (b) {
      if (b.persona && botRt[uin] && botRt[uin].status) return botRt[uin].status;
      if (!botOnline(b)) return 'offline';
      const slot = Math.floor(Date.now() / 300000) + b.seed;
      return ['online', 'online', 'chat', 'away', 'online', 'na', 'online', 'occupied'][slot % 8];
    }
    const p = db.presence[uin];
    if (!p || Date.now() - p.ts > 30000) return 'offline';
    return p.status === 'invisible' ? 'offline' : p.status;
  }
  const isOnline = (uin) => statusOf(uin) !== 'offline';

  function xstatusOf(uin) {
    if (isTwin(uin)) { const a = accountOf(uin); return a ? `аватар ${esc(a.ownerNick)} · учусь на сообщениях` : null; }
    if (BOTS[uin]) return botRt[uin] ? botRt[uin].xstatus : null;
    const p = db.presence[uin];
    return p && Date.now() - p.ts < 30000 ? p.xstatus || null : null;
  }
  function heartbeat() {
    if (!me) return;
    db = load();
    mutate((d) => { d.presence[me.uin] = { status: myStatus, xstatus: myXstatus(), ts: Date.now() }; });
    // боты зашли/вышли?
    contactsOf(me.uin).forEach((u) => {
      const on = isOnline(u);
      if (botState[u] != null && botState[u] !== on) {
        Snd.play(on ? 'online' : 'offline');
        toast(accountOf(u), on ? 'появился в сети' : 'вышел из сети', null);
      }
      botState[u] = on;
    });
    renderContacts();
    if (active) renderChatHead();
  }
  function setStatus(key) {
    myStatus = key;
    saveSession();
    mutate((d) => { d.presence[me.uin] = { status: key, xstatus: myXstatus(), ts: Date.now() }; });
    post({ type: 'presence', uin: me.uin });
    Snd.play('click');
    renderMe();
    renderContacts();
  }

  /* ================= контакты ================= */
  function contactsOf(uin) { return db.contacts[uin] || []; }
  function addContact(uin) {
    const fresh = !contactsOf(me.uin).includes(uin);
    mutate((d) => {
      d.contacts[me.uin] = d.contacts[me.uin] || [];
      if (!d.contacts[me.uin].includes(uin)) d.contacts[me.uin].push(uin);
    });
    if (fresh) addPoints(10, 'новый друг');
    if (fresh && db.accounts[uin] && !contactsOf(me.uin).includes(twinUin(uin))) mutate((d) => { d.contacts[me.uin].push(twinUin(uin)); });
    botState[uin] = isOnline(uin);
    renderContacts();
  }
  function removeContact(uin) {
    mutate((d) => { d.contacts[me.uin] = (d.contacts[me.uin] || []).filter((u) => u !== uin); });
    closeChat(uin);
    renderContacts();
  }
  function unreadFrom(uin) { return ((db.unread[me.uin] || {})[uin]) || 0; }
  function unreadTotal() { const u = db.unread[me.uin] || {}; return Object.values(u).reduce((a, b) => a + b, 0); }
  function markRead(uin) {
    if (!unreadFrom(uin)) return;
    mutate((d) => { if (d.unread[me.uin]) delete d.unread[me.uin][uin]; });
    renderContacts();
    updateTitle();
  }

  /* ================= сообщения ================= */
  function historyOf(uin) { return db.history[pairKey(me.uin, uin)] || []; }
  function pushHistory(msg) {
    mutate((d) => {
      const k = pairKey(msg.from, msg.to);
      d.history[k] = d.history[k] || [];
      d.history[k].push(msg);
      if (d.history[k].length > 500) d.history[k] = d.history[k].slice(-500);
      if (!BOTS[msg.to]) {
        d.unread[msg.to] = d.unread[msg.to] || {};
        d.unread[msg.to][msg.from] = (d.unread[msg.to][msg.from] || 0) + 1;
      }
    });
  }

  function send() {
    const ta = $('#compose');
    if (!ta || !active) return;
    const text = Sec.cleanText(ta.value, 2000);
    if (!text) return;
    const msg = { id: uid(), from: me.uin, to: active, text, ts: Date.now() };
    lastUserActivity = Date.now();
    pushHistory(msg);
    addPoints(1);
    ta.value = '';
    delete drafts[active];
    saveSession();
    post({ type: 'msg', msg });
    Snd.play('sent');
    renderHistory();
    const bot = accountOf(active);
    if (bot && bot.bot) scheduleBotReply(bot, text);
    ta.focus();
  }

  function sendSpecial(to, extra) {
    if (!to || !me) return;
    const msg = Object.assign({ id: uid(), from: me.uin, to, ts: Date.now() }, extra);
    pushHistory(msg);
    post({ type: 'msg', msg });
    Snd.play('sent');
    if (active === to) renderHistory();
    if (extra.kind === 'track' || extra.kind === 'playlist') addPoints(2, 'музыка другу');
    if (extra.kind === 'movie') addPoints(2, 'кино другу');
    const bot = BOTS[to];
    if (bot && bot.persona && extra.kind === 'movie') { const P = bot.persona; const arr = Cinema.BOT_LINES[P.id] || Cinema.BOT_LINES.aska; setTimeout(() => botSays(bot, P.id === 'aska' ? pick(arr) : P.v(pick(arr))), 2500 + Math.random() * 2500); return; }
    if (bot && bot.persona && extra.kind !== 'magnet') {
      const t = extra.kind === 'track' ? Music.byId[extra.track] : null;
      const P = bot.persona;
      const lines = t ? (t.by === bot.brain ? ['Это же мой трек! Ты его нашёл :)', 'О, моё! Приятно, что слушаешь'] : ['Ооо, ' + t.title + '! Качает!', 'Поставил на повтор. ' + t.title + ' — это вещь', 'Слушаю. ' + t.artist + ' — молодцы']) : ['Плейлист! Целый плейлист! Слушаю по порядку', 'Ого, подборка. Спасибо!'];
      setTimeout(() => botSays(bot, P.id === 'aska' ? pick(lines) : P.v(pick(lines))), 2500 + Math.random() * 2500);
    }
  }
  function onIncoming(msg) {
    // сообщение уже лежит в общей истории — только реагируем
    db = load();
    const from = accountOf(msg.from);
    const inChat = active === msg.from && document.hasFocus() && !(isNarrow() && !$('.desktop').classList.contains('mode-chat'));
    if (inChat) markRead(msg.from);
    lastIncomingTs = Date.now();
    if (!contactsOf(me.uin).includes(msg.from) && from) addContact(msg.from);
    Snd.play('incoming');
    const sm = findSmiles(msg.text);
    const extraSound = msg.sound || (sm.length ? 'smile:' + sm[0] : null);
    if (extraSound) setTimeout(() => playRef(extraSound), 700);
    if (navigator.vibrate) try { navigator.vibrate(60); } catch (err) {}
    if (!inChat) toast(from, msg.text, msg.from);
    renderContacts();
    if (active === msg.from) renderHistory();
    updateTitle();
  }

  function scheduleBotReply(bot, text) {
    if (bot.twinOf) { twinTalk(bot, text); return; }
    if (bot.persona) { brainTalk(bot, text); return; }
    const t = text.toLowerCase();
    const smiles = findSmiles(text);
    let pool = bot.replies;
    if (/^(прив|здр|хай|ку\b|hi\b|hello|йо\b|здаров|добр)/.test(t)) pool = bot.hello;
    else if (/(пока|бб|bb|до св|споки|удачи|спокойной)/.test(t)) pool = bot.bye;
    else if (/(как (дела|сам|ты|жизнь|оно)|чё как|что нового)/.test(t)) pool = bot.how;
    else if (bot.help && /(помощ|help|что умее|справк)/.test(t)) pool = [bot.help];
    else if (bot.help && /контакт/.test(t)) pool = [bot.replies[0]];
    else if (bot.help && /статус/.test(t)) pool = [bot.replies[1]];
    else if (bot.help && /смайл/.test(t)) pool = [bot.replies[2]];
    else if (bot.help && /вкладк|вторая|сам себе/.test(t)) pool = [bot.replies[3]];
    else if (bot.help && /звук/.test(t)) pool = [bot.replies[4]];
    else if (smiles.length && Math.random() < 0.6) pool = SMILE_TAUNTS;
    const reply = pick(pool);
    const delay = 900 + Math.min(reply.length, 120) * 18 + Math.random() * 1500;
    if (!isOnline(bot.uin)) {
      // не в сети: ответит, когда появится (в демо — просто позже)
      setTimeout(() => botSays(bot, 'Меня не было в сети, сорри :( ' + reply), delay + 4000);
      return;
    }
    typing[bot.uin] = true;
    renderContacts(); renderChatHead();
    setTimeout(() => {
      typing[bot.uin] = false;
      botSays(bot, reply);
    }, delay);
  }
  function botSays(bot, text, extra) {
    if (!me) return;
    lastIncomingTs = Date.now();
    const msg = { id: uid(), from: bot.uin, to: me.uin, text, ts: Date.now() };
    if (extra && extra.card) msg.card = extra.card;
    if (extra && extra.sound) msg.sound = extra.sound;
    if (extra && extra.track) { msg.kind = 'track'; msg.track = extra.track; }
    if (extra && extra.magnet) { msg.kind = 'magnet'; msg.country = extra.magnet.country; msg.serial = extra.magnet.id; }
    if (extra && extra.invite) { msg.kind = 'invite'; msg.event = extra.invite; }
    if (extra && extra.movie) { msg.kind = 'movie'; msg.movie = extra.movie; if (extra.note) msg.note = extra.note; }
    mutate((d) => {
      const k = pairKey(msg.from, msg.to);
      d.history[k] = d.history[k] || [];
      d.history[k].push(msg);
      if (d.history[k].length > 500) d.history[k] = d.history[k].slice(-500);
      d.unread[me.uin] = d.unread[me.uin] || {};
      d.unread[me.uin][bot.uin] = (d.unread[me.uin][bot.uin] || 0) + 1;
    });
    onIncoming(msg);
    renderChatHead();
  }

  if (bus) bus.onmessage = (e) => {
    const m = e.data || {};
    if (!me) return;
    if (m.type === 'msg' && m.msg && m.msg.to === me.uin) onIncoming(m.msg);
    else if (m.type === 'msg' && m.msg && m.msg.from === me.uin) { db = load(); if (active === m.msg.to) renderHistory(); }
    else if (m.type === 'presence') { db = load(); renderContacts(); renderChatHead(); }
    else if (m.type === 'tracks') { db = load(); loadExternalTracks(); if (aux.kind === 'vinyl') renderAux(); }
    else if (m.type === 'movies') { db = load(); if (aux.kind === 'cinema' || aux.kind === 'watch') renderAux(); }
    else if (m.type === 'radio') { db = load(); loadRadio(); if (aux.kind === 'vinyl') renderAux(); }
    else if (m.type === 'interests' || m.type === 'events' || m.type === 'refs') { db = load(); if (['interests', 'interest', 'community', 'events', 'refs'].includes(aux.kind)) renderAux(); if (m.type === 'events' && active) renderHistory(); }
    else if (m.type === 'wall') { db = load(); if (m.uin === me.uin && m.from !== me.uin) { const a = accountOf(m.from); if (a) { toast(a, 'оставил(а) запись у тебя на стене', null); Snd.play('tada'); } } if (aux.kind === 'wall' && aux.arg === m.uin) renderAux(); if (aux.kind === 'track' && 'trk_' + aux.arg === m.uin) renderAux(); }
  };
  Store.onChange((cols) => {
    if (!me) return;
    if (cols.has('*') || cols.has('accounts')) { if (!db.accounts[me.uin]) { logout(); return; } me = db.accounts[me.uin]; }
    if (['*', 'contacts', 'presence', 'unread', 'accounts', 'profile'].some((c) => cols.has(c))) renderContacts();
  });

  /* ================= Аська и друзья ================= */
  const Brain = window.AskaBrain;
  const botRt = {};              // состояние персонажей в этой вкладке: статус, подпись, таймеры
  let lastAnyProactive = 0;
  // тишина: боты пишут редко, не мешают, когда ты занят, и не копят гору непрочитанного
  const QUIET = { gap: 240000, maxUnTotal: 2, maxUnreadChats: 3, busyMs: 90000, hiddenMax: 1, warmup: 45000 };
  let lastUserActivity = 0, hiddenSent = 0, sessionStart = 0;
  const unreadChats = () => Object.values((db.unread[me.uin] || {})).filter((n) => n > 0).length;
  function scheduleSoft(fn, ms) { setTimeout(() => { if (!me) return; if (!lastUserActivity || Date.now() - lastUserActivity < QUIET.busyMs || unreadChats() >= 2 || document.hidden) { scheduleSoft(fn, 180000); return; } fn(); }, ms); }
  const playRef = (ref) => (ref && ref.startsWith('smile:') ? Snd.smile(ref.slice(6)) : Snd.play(ref));
  function rtOf(uin) { return botRt[uin] || (botRt[uin] = { status: null, xstatus: null, lastProactive: 0, unanswered: 0 }); }
  function memOf(uin) { db = load(); return Object.assign({}, (db.memory[me.uin] || {})[uin] || {}); }
  function saveMem(uin, mem) { mutate((d) => { d.memory[me.uin] = d.memory[me.uin] || {}; d.memory[me.uin][uin] = mem; }); }
  const femaleOf = (bot) => /^(aska|kat|lena)$/.test(bot.brain);

  // все персонажи — в список контактов; у каждого своя подпись к статусу и свой таймер
  function initBots() {
    mutate((d) => {
      d.contacts[me.uin] = d.contacts[me.uin] || [];
      Object.keys(BOTS).filter((u) => !(BOTS[u].persona && BOTS[u].persona.lite)).forEach((u) => { if (!d.contacts[me.uin].includes(u)) d.contacts[me.uin].push(u); });
      if (!d.contacts[me.uin].includes(twinUin(me.uin))) d.contacts[me.uin].push(twinUin(me.uin));
      d.contacts[me.uin].slice().forEach((u) => { if (d.accounts[u] && !d.contacts[me.uin].includes(twinUin(u))) d.contacts[me.uin].push(twinUin(u)); });
    });
    ensureInterestRegistry();
    syncMyInterests();
    seedBotEvents();
    if (!myProfile().invitedOnce) scheduleSoft(botInvitesMe, 240000 + Math.random() * 120000);
    if (!myProfile().movieRecd) scheduleSoft(botRecommendsMovie, 540000 + Math.random() * 180000);
    Object.values(BOTS).forEach((b) => {
      if (!b.persona) return;
      const rt = rtOf(b.uin);
      rt.xstatus = pick(b.persona.xstatus)[1];
      rt.lastProactive = Date.now() - b.persona.gapMs + (b.brain === 'aska' ? 50000 : 30000 + Math.random() * 90000);
      botState[b.uin] = isOnline(b.uin);
    });
    renderContacts();
  }
  function setBotStatus(bot, st) {
    const rt = rtOf(bot.uin);
    rt.status = st[0]; rt.xstatus = st[1];
    Snd.play('online');
    toast(bot, `${femaleOf(bot) ? 'сменила' : 'сменил'} статус: «${st[1]}»`, null);
    renderContacts(); renderChatHead();
  }
  // доставить цепочку сообщений с паузами и «печатает…»
  function deliverSeq(bot, msgs, firstDelay) {
    let t = firstDelay;
    msgs.forEach((m, i) => {
      if (i > 0) t += m.delay || 1200;
      const at = t;
      if (m.text || m.card || m.track) { typing[bot.uin] = true; renderContacts(); renderChatHead(); }
      setTimeout(() => {
        if (!me) return;
        if (m.status) setBotStatus(bot, m.status);
        if (m.text || m.card || m.track) {
          typing[bot.uin] = msgs.slice(i + 1).some((x) => x.text || x.card || x.track);
          botSays(bot, m.text || '', { card: m.card, sound: m.sound, track: m.track });
        }
      }, at);
    });
  }
  function musicCtx() {
    const prof = myProfile();
    return { catalog: catalogAll().map((t) => ({ id: t.id, title: t.title, artist: t.artist, style: t.style || 'pop', by: t.by, source: t.url ? t.kind : 'synth' })), plays: prof.plays || {}, favs: prof.favTracks || [], nowId: Music.state.trackId };
  }
  // бот «дочитывает»: если человек дописывает вторым-третьим сообщением, ответ один — на всё сразу
  const READ_MS = 1400;
  const inbox = {};
  function brainTalk(bot, text) {
    const box = inbox[bot.uin] || (inbox[bot.uin] = { texts: [], timer: null });
    box.texts.push(String(text).trim());
    clearTimeout(box.timer);
    box.timer = setTimeout(() => { const all = box.texts.splice(0).join(' '); if (me) brainTalkNow(bot, all); }, READ_MS);
  }
  function brainTalkNow(bot, text) {
    const rt = rtOf(bot.uin);
    Object.values(botRt).forEach((r) => (r.unanswered = 0));
    const mem = memOf(bot.uin);
    const msgs = bot.brain === 'vinyl' ? Brain.vinyl.reply(text, mem, Object.assign(musicCtx(), { xstatus: rt.xstatus, nick: me.nick, tier: tierOf(me.uin) })) : Brain.reply(text, mem, { persona: bot.brain, xstatus: rt.xstatus, nick: me.nick, tier: tierOf(me.uin) });
    msgs.forEach((m) => { if (m.play) { const id = m.play; setTimeout(() => { Music.play(id); if (aux.kind === 'vinyl') renderAux(); }, 1500); } });
    saveMem(bot.uin, mem);
    const first = msgs[0] && msgs[0].text ? msgs[0].text : '';
    const delay = Math.max(400, 900 + Math.min(first.length, 160) * 16 + Math.random() * 1200 - READ_MS);
    deliverSeq(bot, msgs, delay);
  }
  // персонажи пишут сами: вопросы, открытки, статусы
  function askaTick(force) {
    if (!me) return;
    const now = Date.now();
    const bots = contactsOf(me.uin).map(accountOf).filter((b) => b && b.persona && isOnline(b.uin));
    const totalUn = bots.reduce((a, b) => a + rtOf(b.uin).unanswered, 0);
    if (!force) {
      if (now - sessionStart < QUIET.warmup) return;
      if (now - lastAnyProactive < QUIET.gap * (1 + Math.min(3, totalUn))) return;
      if (totalUn >= QUIET.maxUnTotal) return;
      if (unreadChats() >= QUIET.maxUnreadChats) return;
      if (now - lastUserActivity < QUIET.busyMs) return;
      if (document.hidden && hiddenSent >= QUIET.hiddenMax) return;
    }
    let pool = bots.filter((b) => { const rt = rtOf(b.uin); return force || (now - rt.lastProactive >= b.persona.gapMs && rt.unanswered < b.persona.maxUnanswered && !memOf(b.uin).muted); });
    if (typeof force === 'string') pool = pool.filter((b) => b.uin === force);
    if (!pool.length) return;
    if (!force && Math.random() > 0.55) return;
    const total = pool.reduce((a, b) => a + b.persona.weight, 0);
    let r = Math.random() * total, bot = pool[0];
    for (const b of pool) { r -= b.persona.weight; if (r <= 0) { bot = b; break; } }
    const rt = rtOf(bot.uin);
    const mem = memOf(bot.uin);
    const msgs = bot.brain === 'vinyl' ? (Math.random() < 0.7 ? Brain.vinyl.proactive(mem, musicCtx()) : Brain.proactive(mem, { persona: bot.brain, xstatus: rt.xstatus })) : Brain.proactive(mem, { persona: bot.brain, xstatus: rt.xstatus });
    saveMem(bot.uin, mem);
    if (!msgs || !msgs.length) return;
    // иногда открытка уходит на стену, а друзья делятся своими треками
    msgs.forEach((m, i) => {
      if (m.card && Math.random() < 0.4) {
        botPostsWall(bot, me.uin, { kind: 'card', card: m.card, text: m.text });
        msgs[i] = { text: (femaleOf(bot) ? 'Оставила' : 'Оставил') + ' открытку у тебя на стене. Загляни ;)', sound: 'tada', delay: m.delay };
      }
    });
    if (bot.brain !== 'aska' && Math.random() < 0.3 && !msgs.some((m) => m.card || m.status)) {
      const own = Music.TRACKS.filter((t) => t.by === bot.brain);
      if (own.length) { const t = pick(own); msgs.length = 0; msgs.push({ text: bot.persona.v(pick(['Слушай, зацени', 'Новый трек, оцени', 'Вот, записал. Как тебе?', 'Это надо слышать'])) }, { text: '♪ ' + t.title, track: t.id, delay: 1200 }); }
    }
    rt.lastProactive = now; lastAnyProactive = now;
    if (document.hidden) hiddenSent++;
    if (msgs.some((m) => m.text || m.card || m.track)) rt.unanswered++;
    deliverSeq(bot, msgs, 600 + Math.random() * 1500);
  }
  setInterval(askaTick, 15000);
  if (/[?&]debug\b/.test(location.search) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) window.AskaDebug = { tick: (uin) => askaTick(uin || true), mem: () => load().memory, bots: () => botRt, wall: (u) => wallOf(u || me.uin), openAux, setMode, randomMeet, fly, addPoints, profile: () => myProfile(), dossier: buildDossier, createEvent, rsvp, addTrackByLink, toggleFav, music: () => Music.state, twinFacts: () => twinFacts(me.uin), twinStore: () => twinStore(me.uin), welcomeFrom, quiet: () => ({ lastAnyProactive, lastUserActivity, hiddenSent, sessionStart }), addMovie, toggleMovieFav, recommendMovie, botRecommendsMovie, watching: () => watching, saveProfile, events: () => load().events, refs: () => refTree(me.uin), botInvitesMe, interests: () => load().interests, twinModel: () => twinModelOf(me.uin) };

  /* ================= заголовок вкладки ================= */
  function updateTitle() {
    const n = me ? unreadTotal() : 0;
    clearInterval(titleTimer); titleTimer = null;
    if (!n) { document.title = 'АСЬКА'; return; }
    document.title = `(${n}) АСЬКА`;
    if (Date.now() - lastIncomingTs > BLINK_MS) return;
    let flip = false;
    titleTimer = setInterval(() => { if (Date.now() - lastIncomingTs > BLINK_MS) { clearInterval(titleTimer); titleTimer = null; document.title = `(${n}) АСЬКА`; return; } flip = !flip; document.title = flip ? '✉ Новое сообщение!' : `(${n}) АСЬКА`; }, 900);
  }
  window.addEventListener('focus', () => { if (me && active) { markRead(active); updateTitle(); } });

  /* ================= всплывашка ================= */
  function toast(acc, text, openUin) {
    if (!acc) return;
    const old = $('.toast'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${openUin ? envelopeSvg(18) : statusFlower(isOnline(acc.uin) ? 'online' : 'offline', 18)}<div class="t"><b>${esc(acc.nick)}</b><div>${renderText(text)}</div></div>`;
    el.onclick = () => { el.remove(); if (openUin) openChat(openUin); };
    $('.desktop').appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 5000);
  }

  /* ================= меню и диалоги ================= */
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } $$('.menubar button.open').forEach((b) => b.classList.remove('open')); }
  function showMenu(anchor, items) {
    const wasOpen = menuEl && menuEl._anchor === anchor;
    closeMenu();
    if (wasOpen) return;
    const el = document.createElement('div');
    el.className = 'menu';
    el._anchor = anchor;
    items.forEach((it) => {
      if (it === '-') { el.appendChild(document.createElement('hr')); return; }
      const b = document.createElement('button');
      b.innerHTML = `<span class="chk">${it.checked ? '✓' : ''}</span>${it.icon || ''}<span>${esc(it.label)}</span>`;
      b.onclick = (e) => { e.stopPropagation(); closeMenu(); it.onClick(); };
      el.appendChild(b);
    });
    const win = anchor.closest('.win');
    win.appendChild(el);
    const r = anchor.getBoundingClientRect(), w = win.getBoundingClientRect();
    el.style.left = Math.max(2, r.left - w.left) + 'px';
    el.style.top = (r.bottom - w.top) + 'px';
    anchor.classList.add('open');
    menuEl = el;
  }
  document.addEventListener('pointerdown', (e) => {
    if (menuEl && !menuEl.contains(e.target) && !e.target.closest('.menubar')) closeMenu();
    if (smilesEl && !smilesEl.contains(e.target) && !e.target.closest('#smbtn')) hideSmiles();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (menuEl) closeMenu();
    if (smilesEl) hideSmiles();
    const ov = $$('.overlay').pop();
    if (ov) ov.remove();
  });

  function dialog(opts) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    const btns = (opts.buttons || [{ label: 'OK', primary: true }]).map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('');
    ov.innerHTML = `<div class="win dialog"><div class="titlebar">${flowerSvg('#3cb44a', 14, { logo: true })}<span class="ttl">${esc(opts.title)}</span><button class="tbtn" data-close>×</button></div><div class="body">${opts.body}<div class="btns">${btns}</div></div></div>`;
    const close = () => ov.remove();
    ov.querySelector('[data-close]').onclick = close;
    $$('.btns .btn', ov).forEach((b) => {
      b.onclick = () => {
        const def = (opts.buttons || [{}])[+b.dataset.i];
        if (def.onClick && def.onClick(ov) === false) return;
        close();
      };
    });
    ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    $('.desktop').appendChild(ov);
    const f = ov.querySelector('input, textarea, .btn.primary');
    if (f) setTimeout(() => f.focus(), 30);
    if (opts.onOpen) opts.onOpen(ov);
    return ov;
  }
  const alertBox = (title, text) => dialog({ title, body: `<div>${text}</div>` });
  const confirmBox = (title, text, ok) => dialog({ title, body: `<div>${text}</div>`, buttons: [{ label: 'Да', primary: true, onClick: ok }, { label: 'Нет' }] });

  /* ================= экран входа ================= */
  function renderLogin(prefill) {
    const app = $('#app');
    app.className = 'desktop';
    const known = Object.values(db.accounts).filter((a) => !isTwin(a.uin));
    const last = prefill || db.lastLogin || '';
    app.innerHTML = `
    <div class="wins">
      <div class="win dialog" id="loginwin">
        <div class="titlebar">${flowerSvg('#3cb44a', 14, { logo: true })}<span class="ttl">АСЬКА — вход в сеть</span></div>
        <div class="login-body">
          <div class="bigflower">${flowerSvg('#3cb44a', 44, { logo: true })}<div class="logo-word center">АСЬКА<small>I seek you · по-русски · с 1998 года</small></div></div>
          <div class="design-pick" role="radiogroup" aria-label="Дизайн"><button type="button" role="radio" aria-checked="false" data-design="zoomer"><b>Зумер</b><small>стекло, плитки, свайпы</small></button><button type="button" role="radio" aria-checked="true" class="on" data-design="millennial"><b>Миллениал</b><small>классика 2000-х, окна и меню</small></button></div>
          <div class="ver-links center"><a class="link" href="../v1/">простая v1</a></div>
          <div class="tabs"><button class="on" data-tab="reg">Новый номер</button><button data-tab="login">Уже есть номер</button></div>
          <div class="tabpanel" id="tab-reg">
            <div class="col">
              <label class="row"><span class="lbl">Телефон</span><input class="field" id="r-phone" type="tel" inputmode="tel" placeholder="+7 (___) ___-__-__" autocomplete="tel"></label>
              <label class="row"><span class="lbl">Ник</span><input class="field" id="r-nick" maxlength="24" placeholder="как тебя звать в сети" autocomplete="nickname"></label>
              <label class="row"><span class="lbl">Пароль</span><input class="field" id="r-pass" type="password" maxlength="32" placeholder="можно без него" autocomplete="new-password"></label>
              <label class="row"><span class="lbl">Код друга</span><input class="field" id="r-ref" inputmode="numeric" maxlength="8" placeholder="номер того, кто позвал" value="${esc(refFromUrl())}"></label>
              <div class="err" id="r-err"></div>
              <div class="hint">Номер АСЬКИ выдадим автоматически — как в старые времена. Телефон нужен, чтобы друзья могли тебя найти.</div>
              <div class="right mt"><button class="btn primary" id="r-go">Получить номер</button></div>
            </div>
          </div>
          <div class="tabpanel" id="tab-login" hidden>
            <div class="col">
              <label class="row"><span class="lbl">Номер / тел.</span><input class="field" id="l-id" inputmode="tel" placeholder="123456 или +7…" value="${esc(last)}"></label>
              <label class="row"><span class="lbl">Пароль</span><input class="field" id="l-pass" type="password" autocomplete="current-password"></label>
              <div class="err" id="l-err"></div>
              ${known.length ? `<div class="hint">Номера на этом устройстве:</div><div class="found inset">${known.map((a) => `<div class="citem" data-pick="${esc(a.uin)}"><span class="ico">${statusFlower('offline')}</span><span class="nick">${esc(a.nick)}</span><span class="muted">${esc(a.uin)}</span></div>`).join('')}</div>` : '<div class="hint">На этом устройстве ещё нет номеров. Заведи новый на соседней вкладке.</div>'}
              <div class="right mt"><button class="btn primary" id="l-go">Войти</button></div>
            </div>
          </div>
        </div>
        <div class="statusbar"><div class="cell">${statusFlower('offline', 12)} Не в сети</div><div class="cell fit">v${VERSION}</div></div>
      </div>
    </div>`;

    $$('.tabs button', app).forEach((b) => (b.onclick = () => {
      $$('.tabs button', app).forEach((x) => x.classList.toggle('on', x === b));
      $('#tab-reg').hidden = b.dataset.tab !== 'reg';
      $('#tab-login').hidden = b.dataset.tab !== 'login';
      Snd.play('click');
    }));
    const ph = $('#r-phone');
    ph.addEventListener('input', () => maskPhoneInput(ph));
    $('#r-go').onclick = register;
    $$('[data-design]', app).forEach((b) => (b.onclick = () => { Snd.play('click'); if (b.dataset.design === 'zoomer') toZoomer(); }));
    $$('#tab-reg input', app).forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') register(); }));
    $('#l-go').onclick = login;
    $$('#tab-login input', app).forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); }));
    $$('[data-pick]', app).forEach((el) => (el.onclick = () => { $('#l-id').value = el.dataset.pick; $('#l-pass').focus(); }));
    if (last && known.length) $$('.tabs button', app)[1].click();
  }

  function register() {
    const phone = normPhone($('#r-phone').value);
    const nick = Sec.cleanNick($('#r-nick').value);
    const pass = $('#r-pass').value;
    const err = $('#r-err');
    if (registering) return;
    if (phone.length < 10 || phone.length > 15) { err.textContent = 'Введи настоящий номер телефона.'; Snd.play('error'); return; }
    if (nick.length < 2) { err.textContent = 'Ник — хотя бы две буквы.'; Snd.play('error'); return; }
    if (pass && pass.length < 4) { err.textContent = 'Пароль — от 4 символов (или оставь пустым).'; Snd.play('error'); return; }
    if (Object.values(db.accounts).some((a) => a.phone === phone)) { err.textContent = 'На этот телефон уже заведён номер — войди через «Уже есть номер».'; Snd.play('error'); return; }
    err.textContent = '';
    const ref = ($('#r-ref').value || '').trim();
    const inviter = Sec.isUin(ref) && accountOf(ref) && !isTwin(ref) ? ref : '000001';
    registering = true; $('#r-go').disabled = true; err.textContent = 'Шифруем пароль…';
    Sec.hashPassword(pass).then((pw) => { registering = false; $('#r-go').disabled = false; err.textContent = ''; finishRegister({ uin: newUin(), phone, nick, pw, created: Date.now(), invitedBy: inviter }); });
  }
  let registering = false, loggingIn = false;
  function finishRegister(acc) {
    mutate((d) => {
      d.accounts[acc.uin] = acc;
      d.contacts[acc.uin] = Object.keys(BOTS).filter((u) => !(BOTS[u].persona && BOTS[u].persona.lite));
      d.lastLogin = acc.uin;
    });
    recordReferral(acc);
    pendingWelcome = whoInvited(acc);
    Snd.play('connect');
    dialog({
      title: 'Регистрация завершена',
      body: `<div class="center">Твой номер АСЬКИ:</div><div class="uin-box inset mt">${acc.uin}</div><div class="hint mt center">Запиши его на бумажке — по нему тебя будут искать друзья.<br>Телефон: ${esc(fmtPhone(acc.phone))}</div>`,
      buttons: [{ label: 'Войти в сеть', primary: true, onClick: () => enter(acc) }],
    });
  }
  function login() {
    const id = $('#l-id').value.trim();
    const pass = $('#l-pass').value;
    const err = $('#l-err');
    if (loggingIn) return;
    db = load();
    const phone = normPhone(id);
    const acc = (Sec.isUin(id) && db.accounts[id]) || Object.values(db.accounts).find((a) => a.phone === phone && phone.length >= 10);
    if (!acc || isTwin(acc.uin)) { err.textContent = 'Такого номера на этом устройстве нет.'; Snd.play('error'); return; }
    const wait = Sec.lockLeft(acc.uin);
    if (wait) { err.textContent = `Много неверных попыток. Подожди ${Math.ceil(wait / 1000)} с.`; Snd.play('error'); return; }
    loggingIn = true; $('#l-go').disabled = true;
    Sec.verifyPassword(acc, pass).then((ok) => {
      loggingIn = false; $('#l-go').disabled = false;
      if (!ok) { Sec.noteFail(acc.uin); err.textContent = 'Неверный пароль.'; Snd.play('error'); return; }
      Sec.noteOk(acc.uin);
      mutate((d) => { d.lastLogin = acc.uin; });
      if (Sec.needsUpgrade(acc)) Sec.hashPassword(pass).then((pw) => mutate((d) => { const a = d.accounts[acc.uin]; if (a) { a.pw = pw; delete a.pass; } }));
      enter(acc);
    });
  }
  function enter(acc) {
    db = load();
    me = db.accounts[acc.uin];
    applyTheme();
    myStatus = MODES[myProfile().mode].status;
    openChats = []; active = null; drafts = {};
    saveSession();
    botState = {};
    contactsOf(me.uin).forEach((u) => (botState[u] = isOnline(u)));
    mutate((d) => { d.presence[me.uin] = { status: myStatus, xstatus: myXstatus(), ts: Date.now() }; });
    post({ type: 'presence', uin: me.uin });
    renderMain();
    Snd.play('connect');
    sessionStart = Date.now(); lastUserActivity = 0; hiddenSent = 0;
    if (pendingWelcome && pendingWelcome.length) { const list = pendingWelcome; pendingWelcome = null; list.forEach((u, i) => setTimeout(() => welcomeFrom(u, me), 3500 + i * 9000)); }
    if (pendingPlay) { const id = pendingPlay; pendingPlay = null; openAux('vinyl'); Music.play(id); }
    else if (pendingWatch) { const id = pendingWatch; pendingWatch = null; openAux('watch', id); }
    // подсказки не лезут поверх окна, которое человек уже открыл сам: ждут, пока закроет
    else { const autoTips = (n) => { if (!me) return; if ($$('.overlay').length && n < 20) { setTimeout(() => autoTips(n + 1), 3000); return; } showTips(false); }; setTimeout(() => autoTips(0), 1200); }
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(heartbeat, 10000);
    updateTitle();
    const pending = unreadTotal();
    if (pending) setTimeout(() => Snd.play('incoming'), 900);
    // первое знакомство: админ здоровается, потом Аська
    if (!historyOf('123456').length) setTimeout(() => botSays(BOTS['123456'], BOTS['123456'].hello[0]), 1200);
    initBots();
    loadExternalTracks();
    ensureMovies();
    setTimeout(() => {
      if (!me) return;
      const bot = BOTS['000001'];
      const mem = memOf(bot.uin);
      const msgs = Brain.greet(mem, me.nick, 'aska');
      saveMem(bot.uin, mem);
      deliverSeq(bot, msgs, 2200);
    }, 1800);
  }
  function logout() {
    const was = me && me.uin;
    if (me) mutate((d) => { delete d.presence[me.uin]; });
    post({ type: 'presence', uin: was });
    me = null; active = null; openChats = [];
    aux.kind = null;
    saveSession();
    clearInterval(heartbeatTimer);
    updateTitle();
    document.body.className = '';
    renderLogin(was);
  }

  /* ================= главный экран ================= */
  function renderMain() {
    const app = $('#app');
    app.className = 'desktop';
    app.innerHTML = `
    <div class="wins">
      <div class="win contacts" id="cwin">
        <div class="titlebar">${flowerSvg('#3cb44a', 14, { logo: true })}<span class="ttl">АСЬКА</span><button class="tbtn" id="c-about" title="О программе">?</button><button class="tbtn" id="c-exit" title="Выйти">×</button></div>
        <div class="menubar"><button id="m-contacts">Контакты</button><button id="m-sound">Звук</button><button id="m-help">Справка</button></div>
        <div class="toolbar"><div class="modes" id="modes"></div></div>
        <div class="toolbar tb2"><button class="btn tb-btn" id="tb-wall" title="Моя стена: записи, открытки, комментарии"><i>▤</i><span>Стена</span></button><button class="btn tb-btn" id="tb-vinyl" title="Винил: музыка, коллекция, плейлисты"><i>♪</i><span>Винил</span></button><button class="btn tb-btn" id="tb-random" title="Случайное знакомство по интересам"><i>☺</i><span>Люди</span></button><button class="btn tb-btn" id="tb-fridge" title="Холодильник: еда, напитки, магниты"><i>🧲</i><span>Холод.</span></button><button class="btn tb-btn" id="tb-cinema" title="Кино: фильмы и сериалы по ссылке, любимое, рекомендации"><i>🎬</i><span>Кино</span></button><button class="btn tb-btn" id="tb-events" title="Мероприятия: позвать в гости"><i>📅</i><span>Гости</span></button></div>
        <div class="me-panel" id="me-panel"></div>
        <div class="clist inset" id="clist"></div>
        <div class="bottom-bar"><button class="btn status-btn" id="status-btn"></button><button class="btn icon" id="add-btn" title="Добавить контакт">+</button></div>
        <div class="statusbar"><div class="cell" id="sb-count"></div><div class="cell np" id="sb-np" hidden title="Винил"></div><div class="cell fit" id="sb-net">${statusFlower('online', 12)} в сети</div></div>
      </div>
      <div class="win aux" id="auxwin" hidden>
        <div class="titlebar"><button class="tbtn back" id="aux-back" title="Назад">‹</button>${flowerSvg('#3cb44a', 14, { logo: true })}<span class="ttl" id="aux-title"></span><button class="tbtn close-aux" id="aux-close" title="Закрыть">×</button></div>
        <div class="aux-body" id="aux-body"></div>
      </div>
      <div class="win chat" id="chatwin" hidden>
        <div class="titlebar"><button class="tbtn back" id="ch-back" title="К контактам">‹</button>${flowerSvg('#3cb44a', 14, { logo: true })}<span class="ttl" id="ch-title">Беседа</span><button class="tbtn close-chat" id="ch-close" title="Закрыть беседу">×</button></div>
        <div class="chat-tabs" id="ch-tabs"></div>
        <div class="chat-head" id="ch-head"></div>
        <div class="history inset" id="history"></div>
        <div class="compose">
          <textarea class="field" id="compose" maxlength="2000" placeholder="Напиши что-нибудь… Enter — отправить" rows="3"></textarea>
          <div class="send-row">
            <button class="btn icon" id="smbtn" title="Смайлы">${smileSvg('smile', 16)}</button>
            <button class="btn icon" id="clearbtn" title="Очистить историю">🗑</button>
            <span class="hint" id="ch-hint"></span>
            <button class="btn primary" id="sendbtn">Отправить</button>
          </div>
        </div>
      </div>
    </div>`;

    renderMe(); renderModes(); renderContacts(); renderChatWindow(); renderAux(); updateNowPlaying();

    $('#tb-wall').onclick = () => openAux('wall', me.uin);
    $('#tb-vinyl').onclick = () => openAux('vinyl');
    $('#tb-random').onclick = () => openAux('people');
    $('#tb-fridge').onclick = () => openAux('fridge', me.uin);
    $('#tb-events').onclick = () => openAux('events');
    $('#tb-cinema').onclick = () => openAux('cinema');
    $('#sb-np').onclick = () => openAux('vinyl');
    $('#aux-back').onclick = closeAux;
    $('#aux-close').onclick = closeAux;
    $('#c-exit').onclick = () => confirmBox('Выход', 'Выйти из АСЬКИ?', logout);
    $('#c-about').onclick = about;
    $('#add-btn').onclick = addContactDialog;
    $('#status-btn').onclick = statusDialog;
    $('#m-contacts').onclick = (e) => showMenu(e.currentTarget, [
      { label: 'Добавить контакт…', onClick: addContactDialog },
      { label: 'Пригласить друга…', onClick: () => inviteFriendDialog('') },
      { label: 'Мой аватар: обучение', onClick: () => openAux('twin') },
      { label: 'Удалить выбранный', onClick: () => { if (!active) { alertBox('Контакты', 'Сначала открой беседу с контактом.'); return; } const a = accountOf(active); confirmBox('Удалить', `Удалить ${esc(a.nick)} из списка?`, () => removeContact(active)); } },
      '-',
      { label: 'Сменить статус…', onClick: statusDialog },
      { label: 'Мой номер и телефон', onClick: () => alertBox('Мой номер', `<b>${esc(me.nick)}</b><div class="uin-box inset mt">${me.uin}</div><div class="hint mt">Телефон: ${esc(fmtPhone(me.phone))}</div>`) },
      '-',
      { label: 'Мой профиль и интересы…', onClick: () => openAux('profile', me.uin) },
      { label: 'Профиль контакта…', onClick: () => { if (!active) { alertBox('Профиль', 'Сначала открой беседу с контактом.'); return; } openAux('profile', active); } },
      { label: 'Случайное знакомство…', onClick: randomMeet },
      { label: 'Моя стена', onClick: () => openAux('wall', me.uin) },
      { label: 'Моё досье', onClick: () => openAux('dossier', me.uin) },
      { label: 'Досье контакта…', onClick: () => { if (!active) { alertBox('Досье', 'Сначала открой беседу с контактом.'); return; } openAux('dossier', active); } },
      { label: 'Холодильник и магниты', onClick: () => openAux('fridge', me.uin) },
      { label: '✈ Я лечу…', onClick: flyDialog },
      { label: '📅 Позвать в гости…', onClick: createEventDialog },
      { label: 'Мероприятия', onClick: () => openAux('events') },
      { label: 'Пригласить друга (рефералы)', onClick: () => openAux('refs') },
      { label: 'Каталог интересов', onClick: () => openAux('interests') },
      { label: 'Мой аватар КИРР', onClick: () => openChat(twinUin(me.uin)) },
      { label: 'Винил', onClick: () => openAux('vinyl') },
      '-',
      { label: 'Выйти', onClick: () => confirmBox('Выход', 'Выйти из АСЬКИ?', logout) },
    ]);
    $('#m-sound').onclick = (e) => showMenu(e.currentTarget, [
      { label: 'Звуки включены', checked: Snd.enabled, onClick: () => { mutate((d) => { d.settings.sound = !Snd.enabled; }); applySettings(); if (Snd.enabled) Snd.play('click'); } },
      '-',
      { label: 'Громче', onClick: () => { mutate((d) => { d.settings.volume = Math.min(1, (d.settings.volume == null ? 0.8 : d.settings.volume) + 0.2); }); applySettings(); Snd.play('online'); } },
      { label: 'Тише', onClick: () => { mutate((d) => { d.settings.volume = Math.max(0.2, (d.settings.volume == null ? 0.8 : d.settings.volume) - 0.2); }); applySettings(); Snd.play('online'); } },
      '-',
      { label: 'Проверить «о-оу»', onClick: () => Snd.play('incoming') },
      { label: 'Послушать все смайлы', onClick: playAllSmiles },
    ]);
    $('#m-help').onclick = (e) => showMenu(e.currentTarget, [
      { label: 'Дизайн «Зумер» — новый интерфейс →', onClick: toZoomer },
      { label: 'Дизайн «Миллениал» — классика', checked: true, onClick: () => {} },
      '-',
      { label: 'Подсказки: как пользоваться', onClick: () => showTips(true) },
      { label: 'Как пользоваться', onClick: () => { openChat('123456'); if (!historyOf('123456').some((m) => m.from === '123456' && /умеет/.test(m.text))) botSays(BOTS['123456'], BOTS['123456'].help); } },
      { label: 'О программе', onClick: about },
    ]);
  }

  function about() {
    alertBox('О программе', `<div class="row"><span>${flowerSvg('#3cb44a', 40, { logo: true })}</span><div><b>АСЬКА</b> ${VERSION}<br><span class="hint">Мессенджер, каким он был в 1999-м: номер, ник, цветочек и «о-оу!»</span></div></div><div class="hint mt">Всё хранится у тебя в браузере. Смайлов: ${SMILES.length}, у каждого свой голос. Звуки синтезируются на лету и не качаются из сети.</div>`);
  }

  function playAllSmiles() {
    let t = 0;
    SMILES.forEach((s) => { setTimeout(() => Snd.smile(s.id), t); t += 1100; });
  }

  function renderMe() {
    const el = $('#me-panel'); if (!el || !me) return;
    const tier = tierOf(me.uin);
    el.innerHTML = `<span class="ico">${statusFlower(myStatus, 16, TIER[tier].ring)}</span><span class="nick">${esc(me.nick)}</span>${tier !== 'basic' ? `<span class="tier ${tier}" title="Уровень АСЬКИ">${TIER[tier].badge}</span>` : ''}<span class="sp"></span><span class="uin">#${me.uin}</span>`;
    const sb = $('#status-btn');
    if (sb) sb.innerHTML = `${statusFlower(myStatus, 16)}<span class="lab">${esc(statusInfo(myStatus).label)}</span><span class="sp"></span><span>▾</span>`;
    const net = $('#sb-net');
    if (net) net.innerHTML = `${statusFlower(myStatus, 12)} ${myStatus === 'offline' ? 'не в сети' : 'в сети'}`;
  }

  const collapsed = { other: true };
  function renderContacts() {
    const el = $('#clist'); if (!el || !me) return;
    const mode = myProfile().mode;
    const list = contactsOf(me.uin).map((u) => accountOf(u)).filter(Boolean);
    const byNick = (a, b) => (b.brain === 'aska') - (a.brain === 'aska') || a.nick.localeCompare(b.nick, 'ru');
    const inMode = (a) => a.brain === 'aska' || (a.twinOf === me.uin) || circleOf(a.uin) === mode; // Аська и свой аватар — в любом круге
    const mine = list.filter(inMode);
    const other = list.filter((a) => !inMode(a)).sort(byNick);
    const on = mine.filter((a) => isOnline(a.uin)).sort(byNick);
    const off = mine.filter((a) => !isOnline(a.uin)).sort(byNick);
    const item = (a) => {
      const n = unreadFrom(a.uin);
      const st = statusOf(a.uin);
      const ico = n ? `<span class="${freshUnread(a.uin) ? 'blink' : 'unread-ico'}" title="${n} новых">${envelopeSvg(16)}</span>` : a.twinOf ? `<span class="twin-ico">${avatarSvg(a.twinOf, 14)}</span>` : statusFlower(st, 16, TIER[tierOf(a.uin)].ring);
      const pct = matchPct(me.uin, a.uin);
      const xs = xstatusOf(a.uin);
      return `<div class="citem ${active === a.uin ? 'sel' : ''} ${st === 'offline' ? 'off' : ''}" data-uin="${a.uin}" title="${esc(a.nick)} · ${a.uin}${a.phone ? ' · ' + esc(fmtPhone(a.phone)) : ''}${xs ? ' · ' + esc(xs) : ''}${pct != null ? ' · совпадение ' + pct + '%' : ''} · ${esc(MODES[circleOf(a.uin)].label)}"><span class="ico">${ico}</span><span class="nick">${esc(a.nick)}</span>${typing[a.uin] ? '<span class="typing">печатает…</span>' : ''}${n ? `<span class="muted">${n}</span>` : ''}</div>`;
    };
    const group = (key, label, arr) => `<div class="cgroup" data-g="${key}"><span class="box">${collapsed[key] ? '+' : '−'}</span>${label} <span class="cnt">(${arr.length})</span></div>${collapsed[key] ? '' : arr.map(item).join('')}`;
    el.innerHTML = group('on', `${MODES[mode].icon} ${MODES[mode].label}: в сети`, on) + group('off', 'не в сети', off) + group('other', 'Другие круги', other) + (!list.length ? '<div class="empty-note">Список пуст. Нажми «+» и найди друга по номеру, телефону или нику.</div>' : '');
    $$('.citem', el).forEach((c) => {
      c.onclick = () => openChat(c.dataset.uin);
      c.oncontextmenu = (e) => { e.preventDefault(); openAux('profile', c.dataset.uin); };
    });
    $$('.cgroup', el).forEach((g) => (g.onclick = () => { collapsed[g.dataset.g] = !collapsed[g.dataset.g]; Snd.play('click'); renderContacts(); }));
    const cnt = $('#sb-count');
    if (cnt) cnt.textContent = `Контактов: ${list.length}, в сети: ${list.filter((a) => isOnline(a.uin)).length}`;
    scheduleBlinkStop();
  }

  /* ================= беседа ================= */
  function openChat(uin) {
    if (!accountOf(uin)) return;
    if (!openChats.includes(uin)) openChats.push(uin);
    const ta = $('#compose');
    if (active && ta) drafts[active] = ta.value;
    active = uin;
    saveSession();
    markRead(uin);
    $('.desktop').classList.add('mode-chat');
    if (isNarrow()) { aux.kind = null; aux.arg = null; $('.desktop').classList.remove('mode-aux'); renderAux(); }
    else if (aux.kind === 'vinyl') { const b = $('#v-tochat'); if (b) { b.disabled = !Music.state.trackId; b.title = 'Отправить в открытую беседу'; } $$('[data-pl-chat]').forEach((x) => (x.disabled = false)); }
    renderChatWindow();
    renderContacts();
    if (!isTouch()) setTimeout(() => { const t = $('#compose'); if (t) t.focus(); }, 20);
  }
  function closeChat(uin) {
    openChats = openChats.filter((u) => u !== uin);
    delete drafts[uin];
    if (active === uin) active = openChats[openChats.length - 1] || null;
    saveSession();
    if (!active) $('.desktop').classList.remove('mode-chat');
    renderChatWindow();
    renderContacts();
  }
  function renderChatWindow() {
    const win = $('#chatwin'); if (!win) return;
    win.hidden = !active;
    if (!active) { hideSmiles(); return; }
    const tabs = $('#ch-tabs');
    tabs.innerHTML = openChats.map((u) => { const a = accountOf(u); const n = unreadFrom(u); return `<button class="${u === active ? 'on' : ''}" data-uin="${u}">${n ? `<span class="${freshUnread(u) ? 'blink' : 'unread-ico'}">${envelopeSvg(12)}</span>` : statusFlower(statusOf(u), 12)}<span>${esc(a.nick)}</span><i data-close="${u}" title="Закрыть">×</i></button>`; }).join('');
    $$('button', tabs).forEach((b) => (b.onclick = (e) => {
      if (e.target.dataset.close) { closeChat(e.target.dataset.close); return; }
      openChat(b.dataset.uin);
    }));
    renderChatHead();
    renderHistory();
    const ta = $('#compose');
    ta.value = drafts[active] || '';
    if (!ta._wired) {
      ta._wired = true;
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
      ta.addEventListener('input', () => { drafts[active] = ta.value; lastUserActivity = Date.now(); });
      $('#sendbtn').onclick = send;
      $('#smbtn').onclick = toggleSmiles;
      $('#clearbtn').onclick = () => confirmBox('История', 'Стереть всю переписку с этим контактом?', () => { mutate((d) => { delete d.history[pairKey(me.uin, active)]; }); renderHistory(); });
      $('#ch-back').onclick = () => { $('.desktop').classList.remove('mode-chat'); renderContacts(); };
      $('#ch-close').onclick = () => closeChat(active);
      $('#history').addEventListener('click', (e) => {
        const sm = e.target.closest('.sm');
        if (sm) { Snd.smile(sm.dataset.sm); sm.classList.remove('bounce'); void sm.offsetWidth; sm.classList.add('bounce'); }
        const pc = e.target.closest('.postcard');
        if (pc) { if (pc.dataset.sound) playRef(pc.dataset.sound); pc.replaceWith(pc.cloneNode(true)); }
      });
    }
    $('#ch-hint').textContent = isTouch() ? '' : 'Enter — отправить, Shift+Enter — новая строка';
  }
  function renderChatHead() {
    if (!active) return;
    const a = accountOf(active); if (!a) return;
    const st = statusOf(active);
    const head = $('#ch-head'); if (!head) return;
    head.innerHTML = `<span class="ico">${statusFlower(st, 16)}</span><span class="nick">${esc(a.nick)}</span><span class="muted">#${a.uin}</span>${a.phone ? `<span class="muted">· ${esc(fmtPhone(a.phone))}</span>` : ''}<span class="sp"></span><span class="hint">${typing[active] ? 'печатает…' : esc(statusInfo(st).label) + (xstatusOf(active) ? ' · ' + esc(xstatusOf(active)) : '')}</span><button class="btn icon" id="ch-wall" title="Стена">▤</button><button class="btn icon" id="ch-prof" title="Профиль">☺</button><button class="btn icon" id="ch-dos" title="Досье">📁</button>`;
    $('#ch-wall').onclick = () => openAux('wall', active);
    $('#ch-prof').onclick = () => openAux('profile', active);
    $('#ch-dos').onclick = () => openAux('dossier', active);
    $('#ch-title').innerHTML = `${esc(a.nick)} <small>— беседа</small>`;
  }
  function renderHistory() {
    const el = $('#history'); if (!el || !active) return;
    db = load();
    const msgs = historyOf(active);
    let html = '', prev = 0;
    msgs.forEach((m) => {
      if (!sameDay(prev, m.ts)) html += `<div class="day">${fmtDay(m.ts)}</div>`;
      prev = m.ts;
      const mine = m.from === me.uin;
      const who = mine ? me : accountOf(m.from);
      if (m.card) {
        html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span><div class="postcard pc-${esc(m.card)}" data-sound="${esc(m.sound || '')}" title="Открытка — нажми, чтобы послушать">${postcardSvg(m.card)}</div><div class="pc-cap">${renderText(m.text)}</div></div>`;
        return;
      }
      if (m.kind === 'invite') {
        html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span>${inviteCard(m.event)}</div>`;
        return;
      }
      if (m.kind === 'rsvp') {
        html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span> <span class="txt">${renderText(m.text)}</span></div>`;
        return;
      }
      if (m.kind === 'magnet') {
        html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span>${magnetCard(m.country, m.serial, m.text)}</div>`;
        return;
      }
      if (m.kind === 'food') {
        html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span>${foodCard(m.item, m.serial, m.text)}</div>`;
        return;
      }
      if (m.kind === 'movie') {
        html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span>${movieCard(m.movie)}${m.note ? `<div class="txt">${renderText(m.note)}</div>` : ''}</div>`;
        return;
      }
      if (m.kind === 'track' || m.kind === 'playlist') {
        html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span>${m.kind === 'track' ? trackCard(m.track) : playlistCard(m.playlist)}${m.note ? `<div class="txt">${renderText(m.note)}</div>` : ''}</div>`;
        return;
      }
      html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span> <span class="txt">${renderText(m.text)}</span></div>`;
    });
    if (!msgs.length) html = `<div class="msg"><span class="sys">Беседа с ${esc(accountOf(active).nick)} началась. ${isOnline(active) ? 'Контакт в сети.' : 'Контакт не в сети — сообщение дойдёт, когда появится.'}</span></div>`;
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }

  /* ================= панель смайлов ================= */
  function toggleSmiles() { if (smilesEl) hideSmiles(); else showSmiles(); }
  function hideSmiles() { if (smilesEl) { smilesEl.remove(); smilesEl = null; } }
  function showSmiles() {
    const el = document.createElement('div');
    el.className = 'smiles';
    el.innerHTML = SMILES.map((s) => `<button data-sm="${s.id}" title="${esc(s.codes[0])} — ${esc(s.name)}">${smileSvg(s.id, 20)}</button>`).join('') + `<div class="cap">нажми — услышишь, вставится код</div>`;
    $$('button', el).forEach((b) => (b.onclick = () => {
      const s = SMILE_BY_ID[b.dataset.sm];
      const ta = $('#compose');
      const pos = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
      const before = ta.value.slice(0, pos), after = ta.value.slice(ta.selectionEnd == null ? pos : ta.selectionEnd);
      const code = (before && !/\s$/.test(before) ? ' ' : '') + s.codes[0] + ' ';
      ta.value = before + code + after;
      ta.selectionStart = ta.selectionEnd = before.length + code.length;
      drafts[active] = ta.value;
      Snd.smile(s.id);
      el.querySelector('.cap').textContent = `${s.codes[0]} — ${s.name}`;
      if (!isTouch()) ta.focus();
    }));
    $('#chatwin').appendChild(el);
    smilesEl = el;
  }

  /* ================= диалоги ================= */
  function addContactDialog() {
    dialog({
      title: 'Добавить контакт',
      body: `<label class="row"><span class="lbl">Кого ищем</span><input class="field" id="f-q" placeholder="номер, телефон или ник"></label><div class="found inset" id="f-res"><div class="empty-note">Набери хотя бы две буквы или цифры.</div></div><div class="row mt"><button class="btn" id="f-invite">✉ Пригласить друга в АСЬКУ</button><span class="hint">${esc(twinNick(me.uin))} встретит новичка открыткой</span></div>`,
      buttons: [{ label: 'Закрыть' }],
      onOpen: (ov) => {
        const q = $('#f-q', ov), res = $('#f-res', ov);
        $('#f-invite', ov).onclick = () => { ov.remove(); inviteFriendDialog(q.value.trim()); };
        const run = () => {
          const v = q.value.trim().toLowerCase();
          const ph = normPhone(v);
          if (v.length < 2) { res.innerHTML = '<div class="empty-note">Набери хотя бы две буквы или цифры.</div>'; return; }
          const mine = contactsOf(me.uin);
          const found = allKnown().filter((a) => a.uin !== me.uin && (a.uin.includes(v) || a.nick.toLowerCase().includes(v) || (ph.length >= 4 && a.phone && normPhone(a.phone).includes(ph))));
          if (!found.length) { res.innerHTML = `<div class="empty-note">Никого не нашли. Друга ещё нет в АСЬКЕ? <span class="link" id="f-inv2">Пригласи ${/^[\d+ ()-]+$/.test(v) ? 'по этому номеру' : 'его'}</span> — ${esc(twinNick(me.uin))} встретит ${/^[\d+ ()-]+$/.test(v) ? 'его' : 'новичка'} открыткой и песней.</div>`; $('#f-inv2', res).onclick = () => { ov.remove(); inviteFriendDialog(q.value.trim()); }; return; }
          res.innerHTML = found.map((a) => `<div class="citem" data-uin="${a.uin}"><span class="ico">${statusFlower(statusOf(a.uin), 16)}</span><span class="nick">${esc(a.nick)} <span class="muted">#${a.uin}</span></span>${mine.includes(a.uin) ? '<span class="muted">уже в списке</span>' : '<span class="link">добавить</span>'}</div>`).join('');
          $$('.citem', res).forEach((c) => (c.onclick = () => {
            if (!mine.includes(c.dataset.uin)) { addContact(c.dataset.uin); Snd.play('knock'); run(); }
            else { ov.remove(); openChat(c.dataset.uin); }
          }));
        };
        q.addEventListener('input', run);
      },
    });
  }
  function statusDialog() {
    dialog({
      title: 'Мой статус',
      body: `<div class="status-list">${STATUSES.filter((s) => s.key !== 'offline').map((s) => `<button data-st="${s.key}">${statusFlower(s.key, 16)}<span>${esc(s.label)}</span>${s.key === myStatus ? '<span class="sp"></span><span>✓</span>' : ''}</button>`).join('')}</div>
        <div class="legend-line">Чем занят</div><div class="chips">${FUN_STATUS.filter((f) => !f.tier || tierRank(tierOf(me.uin)) >= tierRank(f.tier)).map((f) => `<button class="chip ${myProfile().xstatus === f.icon + ' ' + f.text ? 'on' : ''}" data-xs="${esc(f.icon + ' ' + f.text)}">${f.icon} ${esc(f.text)}</button>`).join('')}<button class="chip" data-xs="">✕ сбросить</button></div>`,
      buttons: [{ label: 'Закрыть' }],
      onOpen: (ov) => { $$('[data-st]', ov).forEach((b) => (b.onclick = () => { setStatus(b.dataset.st); ov.remove(); })); $$('[data-xs]', ov).forEach((b) => (b.onclick = () => { setXstatus(b.dataset.xs || null); ov.remove(); })); },
    });
  }


  /* ================= круги, режимы, интересы ================= */
  const MODES = {
    close: { label: 'Близкие', icon: '♥', status: 'chat', xstatus: 'для своих', theme: 'theme-close', hint: 'тёплый режим: только свои' },
    biz: { label: 'Бизнес', icon: '▦', status: 'occupied', xstatus: 'по делу', theme: 'theme-biz', hint: 'строгий режим: по делу' },
    chat: { label: 'Общение', icon: '☺', status: 'online', xstatus: 'скучно, пишите', theme: 'theme-chat', hint: 'лёгкий режим: болтаем, когда скучно' },
  };
  const INTERESTS = ['музыка', 'кино', 'игры', 'программирование', 'спорт', 'путешествия', 'кулинария', 'книги', 'аниме', 'авто', 'природа', 'бизнес', 'дизайн', 'фото', 'мода', 'философия', 'танцы', 'рыбалка', 'дача', 'котики', 'сериалы', 'футбол', 'чай', 'кофе', 'вечеринки', 'общение', 'романтика', 'техника', 'юмор', 'открытки'];
  const BOT_EXTRA = {
    '000001': { interests: ['общение', 'чай', 'открытки', 'музыка', 'путешествия', 'юмор'], circle: 'close', wall: [
      { kind: 'text', text: 'Всем привет! Это моя стена. Оставляйте открытки, я их коллекционирую :)' },
      { kind: 'card', card: 'flowers', text: 'Первая открытка на стене — от меня самой. Так можно? Я решила, что можно.' },
      { kind: 'track', track: 'uhoh', note: 'Записала ремикс на своё «о-оу». Качает? Качает.' }] },
    '100500': { interests: ['музыка', 'кино', 'вечеринки', 'танцы', 'общение', 'сериалы'], circle: 'chat', wall: [
      { kind: 'text', text: 'скачала новую мп3шку, 40 минут качала!!! качество супер)))' },
      { kind: 'track', track: 'dialup', note: 'наша с модемами песня))) слушайте!!!' },
      { kind: 'card', card: 'heart', text: 'Ленке от меня)))' }] },
    '31337': { interests: ['программирование', 'игры', 'техника', 'юмор'], circle: 'biz', wall: [
      { kind: 'text', text: 'пересобрал ядро. 3 часа. доволен' },
      { kind: 'track', track: 'bsod', note: 'записал на спектруме. ну почти' }] },
    '777777': { interests: ['музыка', 'вечеринки', 'танцы', 'дача', 'юмор'], circle: 'chat', wall: [
      { kind: 'track', track: 'disco99', note: 'НОВЫЙ МИКС!!! 80 минут чистого кайфа, тут первые две <:o)' },
      { kind: 'text', text: 'В СУББОТУ СЕЙШН!!! всем быть (b)' },
      { kind: 'track', track: 'sevens', note: 'три семёрки — фарт!' }] },
    '555123': { interests: ['кино', 'романтика', 'книги', 'котики', 'музыка', 'открытки'], circle: 'chat', wall: [
      { kind: 'card', card: 'heart', text: 'всем романтикам :)' },
      { kind: 'track', track: 'cassette', note: 'записала кассету. с переворотом!' },
      { kind: 'text', text: 'Титаник. Шестой раз. Доска выдержала бы двоих!!!' }] },
    '200200': { interests: ['дача', 'рыбалка', 'футбол', 'сериалы', 'природа', 'чай'], circle: 'close', wall: [
      { kind: 'text', text: 'Освоил стену. Сосед показал.' },
      { kind: 'track', track: 'karas', note: 'Про карася. Сам сочинил на баяне.' },
      { kind: 'text', text: 'ОГУРЦЫ ВЗОШЛИ' }] },
    '404404': { interests: ['философия', 'книги', 'чай', 'природа', 'общение'], circle: 'chat', wall: [
      { kind: 'text', text: 'Стена — это как обои, только для мыслей. Пишу сюда мысли.' },
      { kind: 'track', track: 'pager', note: 'Пейджер молчит. И это тоже музыка.' },
      { kind: 'text', text: 'Тишина в Аське — тоже разговор.' }] },
    '123456': { interests: ['общение', 'техника'], circle: 'biz', wall: [{ kind: 'text', text: 'Здесь будут новости АСЬКИ. Пока новость одна: АСЬКА работает :)' }] },
    '000777': { interests: ['музыка', 'винил', 'диджеинг', 'общение'], circle: 'chat', wall: [{ kind: 'text', text: 'Я Винилл, консультант по музыке. Скажи «посоветуй» — подберу под настроение. Чем больше общаемся, тем точнее попадаю.' }, { kind: 'track', track: 'pager', note: 'Лучший фон для разговоров. Проверено.' }] },
  };
  const BOT_MORE = {
    '000001': { avatar: null, tier: 'black', fridge: ['TR', 'IT', 'JP', 'AQ', 'MOON'], dossierOpen: true, dossier: ['Цветочек. Восемь лепестков, один красный — для настроения.', 'Любит чай, открытки, вопросы и когда ей пишут. Не любит, когда не звонят родным.', 'Пишет много, со смайлами, иногда барабанной дробью. Помнит всё, что ей рассказали.'] },
    '100500': { avatar: 'blush', tier: 'basic', fridge: ['TR', 'EG'], dossierOpen: true, dossier: ['Аватар — смущённая улыбка. Подходит: краснеет через сообщение.', 'Студентка иняза, модем 33.6, «Руки Вверх» на повторе. Качает мп3 ночами.', 'Пишет быстро, со скобочками и «прикинь». Отвечает всегда, даже с лекции.'] },
    '31337': { avatar: 'cool', tier: 'gold', fridge: ['CZ'], dossierOpen: false, dossier: ['Аватар в тёмных очках. Естественно.', 'Линукс, квака, кофе. Винду считает ошибкой природы.', 'Пишет строчными, коротко, без точек. Если ответил два слова — это уже тёплый разговор.'] },
    '777777': { avatar: 'party', tier: 'gold', fridge: ['TH', 'TR', 'ES'], dossierOpen: true, dossier: ['Аватар в праздничном колпаке. Снимает его только в душе.', 'Музыка, сейшны, колонки на максимум. Соседи знают его по имени.', 'Пишет с тремя восклицательными!!! Минимум. Смайл (b) — его подпись.'] },
    '555123': { avatar: 'kiss', tier: 'basic', fridge: ['FR', 'IT'], dossierOpen: true, dossier: ['Аватар с поцелуйчиком. Романтик, предупреждали.', 'Титаник (шесть раз), книги, котики, дождь за окном. Тамагочи, увы, погиб.', 'Начинает сообщения с «ой». Плачет на красивых местах. Пишет длинно и душевно.'] },
    '200200': { avatar: 'neutral', tier: 'basic', fridge: ['BY', 'RU'], dossierOpen: true, dossier: ['Аватар строгий, без улыбки. Это не грусть, это опыт.', 'Дача, рыбалка, футбол по телевизору. Освоил интернет по совету соседа.', 'Иногда пишет капсом — не нажимать Caps Lock не научился. Спрашивает, поел ли ты.'] },
    '404404': { avatar: 'think', tier: 'basic', fridge: ['IN', 'GE'], dossierOpen: true, dossier: ['Аватар задумчивый, с вопросительным знаком. Иначе никак.', 'Философия, книги, чай. Ищет смысл, иногда находит, потом теряет.', 'Пишет длинно, с многоточиями… Отвечает вопросом на вопрос. Это не баг, это метод.'] },
    '123456': { avatar: 'angel', tier: 'gold', fridge: [], dossierOpen: true, dossier: ['Аватар с нимбом: служебное лицо.', 'Интересы: чтобы АСЬКА работала. Всё.', 'Пишет по делу, с пунктами и без смайлов. Отвечает на «помощь».'] },
    '000777': { avatar: 'cool', tier: 'gold', fridge: ['GB', 'US'], dossierOpen: true, dossier: ['Аватар в очках: как у всех, кто стоит за вертушками.', 'Музыка, винил, диджеинг. Знает коллекцию наизусть и запоминает, что нравится тебе.', 'Сначала на «вы», потом на «ты», потом «дружище». Советует, учится на реакции, что просили удалить — не предлагает.'] },
  };
  const BOT_REF = { '100500': '000001', '777777': '000001', '200200': '000001', '555123': '100500', '31337': '777777', '404404': '200200', '123456': null, '000001': null, '000777': '777777' };
  const LITE_AV = { sunny: 'laugh', calm: 'neutral', nerd: 'cool', biz: 'think', warm: 'blush', sport: 'party' };
  const LITE_STYLE_RU = { sunny: 'Пишет с восклицаниями и солнышками: заряжает даже через экран.', calm: 'Спокойный тон, без восклицаний. Отвечает по существу и не торопит.', nerd: 'Всё с маленькой буквы, коротко, по-гиковски. Шуток не объясняет.', biz: 'Говорит по делу и на «вы», пока не подружится. Фиксирует договорённости.', warm: 'Тёплые слова и сердечки. Слушает лучше, чем говорит, но говорит тоже хорошо.', sport: 'Бодро, с восклицаниями. Любое дело измеряет подходами.' };
  const LITE_FOOD = { sunny: ['lemonade', 'watermelon'], calm: ['tea', 'cookies'], nerd: ['cola', 'pizza'], biz: ['coffee', 'salmon'], warm: ['redwine', 'cake'], sport: ['milk', 'pelmeni'] };
  const LITE_FRIDGE = { oksana: ['TR', 'TH', 'MV'], dimon: ['KZ'], alisa: ['CZ'], stas: ['JP'], marina: ['IT', 'FR'], egor: ['AE', 'DE'], nadya: ['IN'], pasha: ['RU'], liza: ['ES'], timur: ['GE'] };
  Brain.LITE_PEOPLE.forEach((o) => {
    const P = BOTS[o.uin] && BOTS[o.uin].persona; if (!P) return;
    BOT_EXTRA[o.uin] = { interests: o.interests, circle: 'chat', wall: [{ kind: 'text', text: o.hi }, { kind: 'text', text: o.about }] };
    BOT_MORE[o.uin] = { avatar: LITE_AV[o.style] || 'smile', tier: 'basic', fridge: LITE_FRIDGE[o.id] || [], dossierOpen: true, city: o.city, dossier: [`Аватар — смайл «${(SMILE_BY_ID[LITE_AV[o.style]] || { name: 'улыбка' }).name}». ${o.first} из ${o.cityGen}: ${o.about.split('. ').slice(1, 2).join('')}`, `Любит: ${o.interests.join(', ')}. ${o.hi}`, LITE_STYLE_RU[o.style]] };
  });
  Object.keys(BOT_EXTRA).forEach((u) => { if (BOTS[u]) Object.assign(BOTS[u], { interests: BOT_EXTRA[u].interests, circle: BOT_EXTRA[u].circle, wallSeed: BOT_EXTRA[u].wall, invitedBy: BOT_REF[u] || null }, BOT_MORE[u] || {}); });

  function profileOf(uin) {
    const p = (db.profile || {})[uin];
    const b = BOTS[uin];
    return Object.assign({ interests: b ? b.interests || [] : [], mode: 'chat', circles: {}, playlists: [], avatar: b ? (b.avatar === undefined ? null : b.avatar) : (isNaN(parseInt(uin, 10)) ? null : SMILES[parseInt(uin, 10) % SMILES.length].id), xstatus: null, points: 0, fridge: null, dossierOpen: b ? b.dossierOpen !== false : true }, p || {});
  }
  const myProfile = () => profileOf(me.uin);
  function saveProfile(patch) { mutate((d) => { d.profile = d.profile || {}; d.profile[me.uin] = Object.assign(profileOf(me.uin), patch); }); }
  function circleOf(uin) { const c = myProfile().circles[uin]; if (c) return c; const b = BOTS[uin]; return (b && b.circle) || 'chat'; }
  function setCircle(uin, c) { const circles = Object.assign({}, myProfile().circles); circles[uin] = c; saveProfile({ circles }); renderContacts(); }
  function matchPct(a, b) {
    const A = new Set(profileOf(a).interests), B = new Set(profileOf(b).interests);
    if (!A.size || !B.size) return null;
    let common = 0; A.forEach((x) => { if (B.has(x)) common++; });
    return Math.round((100 * common) / Math.sqrt(A.size * B.size));
  }
  function commonInterests(a, b) { const B = new Set(profileOf(b).interests); return profileOf(a).interests.filter((x) => B.has(x)); }
  function applyTheme() {
    const mode = me ? myProfile().mode : 'chat';
    document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim();
    document.body.classList.add(MODES[mode].theme);
  }
  function myXstatus() {
    const st = Music.state;
    if (watching && movieOf(watching.id)) return 'смотрю: ' + movieOf(watching.id).title;
    if (st.playing && st.trackId && Music.anyById(st.trackId)) return 'слушаю: ' + Music.anyById(st.trackId).title;
    if (!me) return '';
    const p = myProfile();
    return p.xstatus || MODES[p.mode].xstatus;
  }
  const modeComment = {};
  function setMode(key, silent) {
    if (!MODES[key] || !me) return;
    saveProfile({ mode: key });
    applyTheme();
    myStatus = MODES[key].status;
    saveSession();
    mutate((d) => { d.presence[me.uin] = { status: myStatus, xstatus: myXstatus(), ts: Date.now() }; });
    post({ type: 'presence', uin: me.uin });
    renderMe(); renderContacts(); renderModes();
    if (silent) return;
    Snd.play('click');
    const bot = BOTS['000001'];
    if (!modeComment[key] && bot && !memOf(bot.uin).muted) {
      modeComment[key] = true;
      const lines = { close: ['Режим «Близкие». Чай, плед, только свои. Я в списке? Я в списке :)', 'Для своих, значит. Я польщена ;)'], biz: ['Поняла, бизнес. Не отвлекаю. Почти.', 'Бизнес-режим. Галстук надела. Виртуальный.'], chat: ['Общение! Моё любимое. Кому скучно — пишите мне :)', 'Режим «скучно» включён. Хочешь, познакомлю с кем-нибудь? Нажми ☺ сверху.'] };
      setTimeout(() => botSays(bot, pick(lines[key])), 1500);
    }
  }
  function renderModes() {
    const el = $('#modes'); if (!el || !me) return;
    const cur = myProfile().mode;
    el.innerHTML = `<select class="field mode-sel" id="mode-sel" title="Режим: меняет статус, цвет окон и чей круг показан первым">${Object.keys(MODES).map((k) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${MODES[k].icon} ${MODES[k].label}</option>`).join('')}</select>`;
    $('#mode-sel').onchange = (e) => setMode(e.target.value);
  }
  // подсказки новичку
  function showTips(force) {
    if (!me) return;
    if (!force && myProfile().tipsSeen) return;
    saveProfile({ tipsSeen: true });
    dialog({ title: 'Как пользоваться АСЬКОЙ', body: `<div class="tips">
      <div class="tip"><b>1. Беседа.</b> Нажми на контакт — откроется окно беседы. Enter отправляет. Жёлтый смайл внизу вставляет смайлик со звуком.</div>
      <div class="tip"><b>2. Режим.</b> Список сверху: ♥ Близкие, ▦ Бизнес, ☺ Общение. Меняет твой статус, цвет окон и чей круг показан первым.</div>
      <div class="tip"><b>3. Стена ▤.</b> Публичная переписка на виду у друзей: записи, открытки, треки, комментарии. Своя — кнопка «Стена» на панели; чужая — ▤ в шапке беседы. В профиле стену можно закрыть.</div>
      <div class="tip"><b>4. Винил ♪.</b> Пластинка раскручивается, тонарм сам опускается на дорожку и ползёт к центру. Вкладка «Радио»: Бали FM, Ева Спейс, Юхом Плюс. «Коллекция» → «Добавить по ссылке». Нажми на обложку трека — его страница: история, НФТ-паспорт, цепочка владения, стена. Винилл в контактах: «посоветуй».</div>
      <div class="tip"><b>4б. Люди ☺.</b> Случайное знакомство с досье от Аськи и процентом совпадения по интересам, вкладка «По интересам» и все люди сети. «Познакомиться» добавляет в контакты и открывает беседу.</div>
      <div class="tip"><b>4а. Кино 🎬.</b> Фильмы и сериалы по ссылке (YouTube, VK, Rutube, mp4) — смотрятся прямо в АСЬКЕ с любого устройства. ♥ любимое, «посоветовать» другу или на стену, серии подряд, запоминает, где остановился.</div>
      <div class="tip"><b>5. Холодильник 🧲.</b> Старый добрый «Холодок-99»: дверца открывается — внутри морозилка, напитки, еда и овощной ящик (НФТ с номером), снаружи магниты из поездок с номером и формой по стране. «Я лечу» — магнит себе и друзьям, магниты и еду можно дарить.</div>
      <div class="tip"><b>6. Люди ☺ и гости 📅.</b> Случайное знакомство по интересам, мероприятия с приглашениями. Интересы — в профиле, у каждого своя страница и сообщества.</div>
      <div class="tip"><b>7. Аська и друзья.</b> Пишут сами, но редко и не мешают: помнят ответы, советуют, отвечают на стене. Конверт мигает две минуты после сообщения, потом просто ждёт.</div>
      <div class="tip"><b>8. Аватар КИРР.</b> Твой двойник: учится на переписке и отвечает друзьям твоими словами, знает друзей, где ты и что слушаешь. «Контакты → Мой аватар: обучение» или напиши ему «учись». Вернуться сюда: «Справка» → «Подсказки».</div>
      <div class="tip"><b>9. Пригласить друга.</b> «Контакты → Добавить контакт → Пригласить друга»: ссылка с твоим кодом. Как только друг появится, аватар сам встретит его открыткой и песней и сообщит тебе.</div></div>`, buttons: [{ label: 'Понятно, поехали', primary: true }] });
  }

  /* ================= стена ================= */
  function wallOf(uin) {
    db = load();
    if (db.wall[uin]) return db.wall[uin];
    const b = BOTS[uin];
    if (b && b.wallSeed) {
      const now = Date.now();
      const posts = b.wallSeed.map((p, i) => Object.assign({ id: uid(), from: uin, ts: now - (i + 1) * 36e5 * (5 + ((b.seed || 1) % 7) * 2), likes: [] }, p));
      mutate((d) => { d.wall[uin] = posts; });
      return posts;
    }
    return [];
  }
  function addPost(toUin, p) {
    const existing = wallOf(toUin).slice(); // до транзакции: wallOf сам перечитывает базу
    mutate((d) => { d.wall[toUin] = d.wall[toUin] || existing; d.wall[toUin].unshift(p); if (d.wall[toUin].length > 200) d.wall[toUin].length = 200; });
    if ((aux.kind === 'wall' || aux.kind === 'community') && aux.arg === toUin) renderAux();
  }
  function postWall(toUin, data) {
    if (data.text != null) data.text = Sec.cleanText(data.text, 300);
    const p = Object.assign({ id: uid(), from: me.uin, ts: Date.now(), likes: [] }, data);
    addPost(toUin, p);
    post({ type: 'wall', uin: toUin, from: me.uin });
    Snd.play(data.kind === 'card' ? 'tada' : 'sent');
    addPoints(data.kind === 'card' ? 5 : 3, data.kind === 'card' ? 'открытка' : 'запись на стене');
    afterPost(toUin, p);
    return p;
  }
  function botPostsWall(bot, toUin, data) {
    const p = Object.assign({ id: uid(), from: bot.uin, ts: Date.now(), likes: [] }, data);
    addPost(toUin, p);
    return p;
  }
  function thankForWall(bot, p) {
    const P = bot.persona;
    const L = p.kind === 'movie' ? Cinema.BOT_LINES : p.kind === 'card'
      ? { aska: ['Ой! Открытка на моей стене! Это лучшее, что случалось с моей стеной :)', 'Открытка! Повесила на самое видное место. Спасибо :*'], kat: ['ааа открытка!!! спасибо))) :*', 'ой как мило))) спасибо!'], vova: ['открытка. ок. спасибо', 'ы. мило'], serega: ['Ооо, открытка!!! Респект, бро! (b)', 'Это надо отметить!!! Спасибо!'], lena: ['Ой, открытка! :$ Спасибо, ты такой милый!', 'Какая прелесть!!! Спасибо :*'], batya: ['Спасибо. Сосед сказал, это открытка.', 'Молодец. Красиво.'], max: ['Открытка на стене. Простой жест, а приятно. Спасибо.', 'Спасибо. Теперь на моих обоях есть твоя открытка.'] }
      : p.kind === 'track' || p.kind === 'playlist'
        ? { aska: ['Музыка на стене! Ставлю на повтор :)'], kat: ['ооо, музыка!!! качаю)))'], vova: ['трек. послушаю. потом'], serega: ['МУЗЫКА!!! Вот это по-нашему!!! (b)'], lena: ['Ой, песенка! Спасибо :)'], batya: ['Музыка. Громко. Но хорошо.'], max: ['Музыка на стене. Тишина обиделась, но ладно.'] }
        : { aska: ['Написал мне на стене! Прочитала три раза :)'], kat: ['увидела на стене))) спасибо!'], vova: ['видел. ок'], serega: ['Видел на стене!!! Респект!'], lena: ['Ой, ты мне на стену написал :$'], batya: ['Прочитал. Спасибо.'], max: ['Прочитал на стене. Задумался.'] };
    const arr = L[P.id] || L.aska;
    setTimeout(() => { if (me) botSays(bot, P.id === 'aska' ? pick(arr) : P.v(pick(arr))); }, 2500 + Math.random() * 3000);
    if (P.id === 'aska' && p.kind === 'card') setTimeout(() => { if (!me) return; botPostsWall(bot, me.uin, { kind: 'card', card: Brain.pickCard({}), text: 'Открытка в ответ! На твоей стене теперь есть моя :)' }); toast(bot, 'оставила открытку у тебя на стене', null); Snd.play('tada'); }, 9000);
  }
  function toggleLike(wallUin, id) {
    mutate((d) => { const p = (d.wall[wallUin] || []).find((x) => x.id === id); if (!p) return; p.likes = p.likes || []; const i = p.likes.indexOf(me.uin); if (i >= 0) p.likes.splice(i, 1); else p.likes.push(me.uin); });
    Snd.play('click');
    renderAux();
  }
  const trackCard = (id) => {
    const t = Music.anyById(id); if (!t) return '<div class="muted">трек не найден</div>';
    const np = Music.state.trackId === id && Music.state.playing;
    const nft = trackNft(id);
    return `<div class="trackcard ${np ? 'np' : ''}" data-track="${id}"><span class="cv" data-trackpage="${esc(id)}" title="Страница трека">${coverSvg(t, 34)}</span><div class="ti"><b class="link" data-trackpage="${esc(id)}">${esc(t.title)}</b><div class="muted">${esc(t.artist)} · ${t.url ? esc(t.label || t.kind) : t.year + ' · ' + Music.STYLE_NAMES[t.style]} · НФТ ${nft.serial}</div></div><button class="btn icon" data-play="${id}" title="${np ? 'Пауза' : 'Слушать'}">${np ? '❚❚' : '▶'}</button></div>`;
  };
  const playlistCard = (pl) => {
    if (!pl) return '';
    const names = pl.tracks.map((i) => (Music.anyById(i) ? Music.anyById(i).title : '')).filter(Boolean);
    return `<div class="trackcard pl"><span class="disc stack"></span><div class="ti"><b>♪ ${esc(pl.name)}</b><div class="muted">${pl.tracks.length} тр.: ${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? '…' : ''}</div></div><button class="btn icon" data-playpl="${esc(pl.tracks.join(','))}" data-plname="${esc(pl.name)}" title="Слушать плейлист">▶</button></div>`;
  };
  function addReply(wallUin, postId, reply) {
    if (reply.text != null) reply.text = Sec.cleanText(reply.text, 200);
    mutate((d) => { const p = (d.wall[wallUin] || []).find((x) => x.id === postId); if (p) { p.replies = p.replies || []; p.replies.push(reply); } });
    if ((aux.kind === 'wall' || aux.kind === 'community') && aux.arg === wallUin) renderAux();
  }
  function commentOn(wallUin, postId, text) {
    addReply(wallUin, postId, { id: uid(), from: me.uin, ts: Date.now(), text });
    post({ type: 'wall', uin: wallUin, from: me.uin });
    addPoints(1); Snd.play('sent');
    const p = wallOf(wallUin).find((x) => x.id === postId); if (!p) return;
    const author = accountOf(p.from), wallB = BOTS[wallUin];
    const bot = author && (author.persona || author.twinOf) && p.from !== me.uin ? author : wallB && wallB.persona ? wallB : null;
    if (bot) setTimeout(() => botWallReply(bot, wallUin, postId, 'comment', p.kind), 2500 + Math.random() * 4000);
  }
  // аватар отвечает прямо на стене
  function botWallReply(bot, wallUin, postId, why, kind) {
    if (!me) return;
    let text;
    if (bot.twinOf) text = Brain.twin.comment(twinModelOf(bot.twinOf).model, twinStore(bot.twinOf));
    else {
      const P = bot.persona;
      const OWN = { card: { aska: ['Ой, открытка на моей стене! Повесила на самое видное место :)', 'Спасибо за открытку! Коллекция растёт.'], kat: ['ааа открытка!!! спасибо)))', 'ой как мило)))'], vova: ['открытка. ок. спасибо', 'ы. мило'], serega: ['Ооо, открытка!!! Респект! (b)'], lena: ['Ой, открытка! :$ Спасибо!'], batya: ['Спасибо. Красиво. Повесил.'], max: ['Открытка на стене. Простой жест, а приятно.'] },
        track: { aska: ['Музыка на моей стене! Ставлю на повтор :)'], kat: ['ооо, музыка!!! качаю)))'], vova: ['трек. послушаю потом'], serega: ['МУЗЫКА!!! Вот это по-нашему!!!'], lena: ['Ой, песенка! Спасибо :)'], batya: ['Музыка. Громко. Но хорошо.'], max: ['Музыка на стене. Тишина обиделась, но ладно.'] },
        text: { aska: ['Написал мне на стене! Прочитала три раза :)', 'Отвечаю тут же, на стене: спасибо, что зашёл ;)'], kat: ['увидела))) спасибо!', 'ого, ты мне на стену написал)))'], vova: ['видел. ок', 'прочитал'], serega: ['Видел на стене!!! Респект!'], lena: ['Ой, ты мне на стену написал :$'], batya: ['Прочитал. Спасибо. Заходи ещё.'], max: ['Прочитал на стене. Задумался.'] } };
      const MINE = { card: ['Какая открытка!', 'Красота :)', 'О, открытка! Мне такую же!'], track: ['Качает!', 'Что за трек? Беру.', 'Поставил на повтор'], magnet: ['Завидую! Привези магнит и мне :)', 'Куда летим? Беру билет'], invite: ['Приду!', 'Записал(а) в календарь'], playlist: ['Плейлист — огонь', 'Слушаю по порядку'], text: ['Согласен(на)!', 'Ого :)', 'Расскажи подробнее?', 'Плюсую', 'Вот это да', 'Ну ты даёшь :)', 'Записал(а) себе'] };
      const COMMENT = { aska: ['Ага :)', 'Вот и я о том же!', 'Спасибо, что написал(а) ;)', 'Поняла тебя. Продолжаем на стене :)'], kat: ['ага)))', 'ну да ну да', 'хихи :)'], vova: ['ок', 'ы', 'ясн'], serega: ['Точно!!!', 'Бро, ты прав!!!'], lena: ['Ой, правда? :O', 'Согласна :)'], batya: ['Правильно.', 'Вот и я говорю.'], max: ['Интересная мысль. Подумаю.', 'А если наоборот?'] };
      let arr;
      if (why === 'own') arr = (OWN[kind] || OWN.text)[P.id] || OWN.text.aska;
      else if (why === 'comment') arr = COMMENT[P.id] || COMMENT.aska;
      else arr = MINE[kind] || MINE.text;
      const line = pick(arr);
      text = P.id === 'aska' ? line : P.v(line);
    }
    addReply(wallUin, postId, { id: uid(), from: bot.uin, ts: Date.now(), text });
    Snd.play('click');
    toast(bot, 'ответил(а) на стене', null);
  }
  function afterPost(toUin, p) {
    const bot = BOTS[toUin];
    if (bot && bot.persona && toUin !== me.uin) {
      setTimeout(() => botWallReply(bot, toUin, p.id, 'own', p.kind), 3000 + Math.random() * 4000);
      if (bot.brain === 'aska' && p.kind === 'card') setTimeout(() => { if (!me) return; botPostsWall(bot, me.uin, { kind: 'card', card: Brain.pickCard({}), text: 'Открытка в ответ! На твоей стене теперь есть моя :)' }); toast(bot, 'оставила открытку у тебя на стене', null); Snd.play('tada'); }, 9000);
      return;
    }
    if (toUin === me.uin) {
      const cand = contactsOf(me.uin).map(accountOf).filter((a) => a && ((a.persona && isOnline(a.uin)) || a.twinOf === me.uin));
      cand.sort(() => Math.random() - 0.5).slice(0, 1 + (Math.random() < 0.5 ? 1 : 0)).forEach((b, i) => setTimeout(() => botWallReply(b, me.uin, p.id, 'mine', p.kind), 5000 + i * 6000 + Math.random() * 8000));
      return;
    }
    const c = (db.communities || {})[toUin];
    if (c) { const members = c.members.map(accountOf).filter((a) => a && a.persona); if (members.length) setTimeout(() => botWallReply(pick(members), toUin, p.id, 'mine', p.kind), 4000 + Math.random() * 6000); }
  }
  function renderPost(p, wallUin) {
    const from = accountOf(p.from) || { nick: p.from, uin: p.from };
    let content = '';
    if (p.kind === 'card') content = `<div class="postcard pc-${esc(p.card)}" data-sound="${esc(Brain.CARDS[p.card] ? Brain.CARDS[p.card].sound : '')}" title="Нажми, чтобы послушать">${postcardSvg(p.card)}</div>${p.text ? `<div class="pc-cap">${renderText(p.text)}</div>` : ''}`;
    else if (p.kind === 'track') content = trackCard(p.track) + (p.note ? `<div class="txt">${renderText(p.note)}</div>` : '');
    else if (p.kind === 'playlist') content = playlistCard(p.playlist) + (p.note ? `<div class="txt">${renderText(p.note)}</div>` : '');
    else if (p.kind === 'magnet') content = magnetCard(p.country, p.serial, p.text);
    else if (p.kind === 'invite') content = inviteCard(p.event);
    else if (p.kind === 'food') content = foodCard(p.item, p.serial, p.text);
    else if (p.kind === 'movie') content = movieCard(p.movie) + (p.note ? `<div class="txt">${renderText(p.note)}</div>` : '');
    else content = `<div class="txt">${renderText(p.text || '')}</div>`;
    const likes = p.likes || [];
    const liked = likes.includes(me.uin);
    const replies = (p.replies || []).map((r) => { const a = accountOf(r.from) || { nick: r.from }; return `<div class="reply"><span class="ico">${avatarSvg(r.from, 13)}</span><b class="link" data-wall="${esc(r.from)}">${esc(a.nick)}</b> <span class="muted">${fmtTime(r.ts)}</span> <span class="rt">${renderText(r.text)}</span></div>`; }).join('');
    return `<div class="post" data-id="${p.id}"><div class="post-h"><span class="ico">${avatarSvg(p.from, 14)}</span><b class="link" data-wall="${esc(from.uin)}">${esc(from.nick)}</b><span class="muted">${fmtDay(p.ts)} ${fmtTime(p.ts)}</span><span class="sp"></span><button class="like ${liked ? 'on' : ''}" data-like="${p.id}" data-wallof="${esc(wallUin)}" title="Нравится">♥${likes.length ? ' ' + likes.length : ''}</button></div>${content}<div class="replies">${replies}<div class="reply-add"><input class="field" data-reply="${p.id}" data-wallof="${esc(wallUin)}" maxlength="200" placeholder="Ответить… (Enter)"></div></div></div>`;
  }
  let wallFull = false;
  function renderWall(uin) {
    const a = accountOf(uin); if (!a) return '<div class="empty-note">Нет такого пользователя.</div>';
    const mine = uin === me.uin;
    const pct = mine ? null : matchPct(me.uin, uin);
    const prof = profileOf(uin);
    const common = mine ? [] : commonInterests(me.uin, uin);
    const tierW = tierOf(uin);
    const head = `<div class="wall-head"><span class="ico">${avatarSvg(uin, 30)}</span><div class="who"><b>${esc(a.nick)}</b> <span class="muted">#${a.uin}</span> ${tierW !== 'basic' ? `<span class="tier ${tierW}">${TIER[tierW].badge}</span>` : ''}<div class="hint">${esc(xstatusOf(uin) || statusInfo(statusOf(uin)).label)}</div></div>${mine ? '' : `<div class="pct" title="Совпадение интересов">${pct == null ? '—' : pct + '%'}</div>`}</div>
      <div class="chips small">${prof.interests.length ? prof.interests.map((i) => `<button class="chip ${common.includes(i) ? 'on' : ''}" data-interest="${esc(i)}">${esc(i)}</button>`).join('') : `<span class="muted">${mine ? 'интересы не указаны — добавь в профиле' : 'интересы не указаны'}</span>`}</div>
      <div class="row wall-actions">${mine ? '<button class="btn" id="w-profile">☺ Профиль</button>' : '<button class="btn primary" id="w-chat">✉ Написать</button><button class="btn" id="w-profile">☺ Профиль</button>'}<button class="btn" id="w-dos">📁 Досье</button><button class="btn" id="w-fr">🧲 Холодильник</button></div>`;
    if (prof.wallPrivate && !mine) return head + `<div class="groupbox"><span class="legend">Стена закрыта</span><div class="hint">${esc(a.nick)} сделал(а) стену приватной. Записи видит только владелец. Напиши в беседу — там всегда открыто :)</div></div>`;
    const posts = wallOf(uin);
    const shown = wallFull ? posts : posts.slice(0, 6);
    return head + `<div class="composer"><div class="legend-line">${mine ? 'Написать на своей стене' : `Написать на стене ${esc(a.nick)}`} <span class="muted">— видят все друзья</span></div>
      <textarea class="field" id="w-text" rows="2" maxlength="300" placeholder="${mine ? 'Что нового? Enter — отправить' : 'Привет! Enter — отправить'}"></textarea>
      <div class="row"><button class="btn primary" id="w-send">Отправить</button><button class="btn" id="w-card">🖼 Открытка</button><button class="btn" id="w-track">♪ Трек</button><button class="btn" id="w-movie">🎬 Кино</button>${mine ? `<label class="row" style="margin-left:auto" title="Приватная стена — видишь только ты"><input type="checkbox" id="w-priv" ${prof.wallPrivate ? 'checked' : ''}> приватная</label>` : ''}</div></div>
      <div class="legend-line">${mine ? 'Моя стена' : 'Стена'} <span class="muted">— последние записи${posts.length > shown.length ? `, всего ${posts.length}` : ''}</span></div>
      <div class="wall-posts inset" id="w-posts">${shown.length ? shown.map((p) => renderPost(p, uin)).join('') : '<div class="empty-note">На стене пока пусто. Будь первым :)</div>'}${posts.length > shown.length ? `<button class="btn" id="w-more" style="width:100%;margin-top:4px">Показать всю историю (${posts.length} записей)</button>` : wallFull && posts.length > 6 ? '<button class="btn" id="w-less" style="width:100%;margin-top:4px">Свернуть до последних</button>' : ''}</div>`;
  }
  function wireWall(uin) {
    const mine = uin === me.uin;
    $('#w-profile').onclick = () => openAux('profile', uin);
    $('#w-dos').onclick = () => openAux('dossier', uin);
    $('#w-fr').onclick = () => openAux('fridge', uin);
    if (!mine) $('#w-chat').onclick = () => openChat(uin);
    const ta = $('#w-text'); if (!ta) return;
    const send = () => { const text = (ta.value || '').trim(); if (!text) return; postWall(uin, { kind: 'text', text }); ta.value = ''; };
    $('#w-send').onclick = send;
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    $('#w-card').onclick = () => pickCardDialog((card) => {
      dialog({ title: 'Подпись к открытке', body: `<div class="center"><div class="postcard pc-${card}" style="display:inline-block">${postcardSvg(card)}</div></div><input class="field mt" id="c-text" maxlength="200" placeholder="пару слов (можно без них)">`, buttons: [{ label: 'На стену', primary: true, onClick: (ov) => { postWall(uin, { kind: 'card', card, text: $('#c-text', ov).value.trim() }); } }, { label: 'Отмена' }] });
    });
    $('#w-track').onclick = () => pickTrackDialog((kind, payload) => { if (kind === 'track') postWall(uin, { kind: 'track', track: payload }); else postWall(uin, { kind: 'playlist', playlist: payload }); });
    $('#w-movie').onclick = () => pickMovieDialog((id) => { postWall(uin, { kind: 'movie', movie: id }); toast(accountOf(uin), 'кино на стене', null); });
    const pv = $('#w-priv'); if (pv) pv.onchange = (e) => { saveProfile({ wallPrivate: e.target.checked }); toast(me, e.target.checked ? 'стена теперь приватная' : 'стена снова публичная', null); };
    const more = $('#w-more'); if (more) more.onclick = () => { wallFull = true; renderAux(); };
    const less = $('#w-less'); if (less) less.onclick = () => { wallFull = false; renderAux(); };
  }
  function pickCardDialog(cb) {
    const kinds = Object.keys(Brain.CARDS).filter((k) => k !== 'trip');
    dialog({ title: 'Выбери открытку', body: `<div class="card-pick">${kinds.map((k) => `<button data-card="${k}" title="${k}"><div class="postcard pc-${k}">${postcardSvg(k)}</div></button>`).join('')}</div>`, buttons: [{ label: 'Отмена' }], onOpen: (ov) => $$('[data-card]', ov).forEach((b) => (b.onclick = () => { playRef(Brain.CARDS[b.dataset.card].sound); ov.remove(); cb(b.dataset.card); })) });
  }
  function pickTrackDialog(cb) {
    const pls = myProfile().playlists;
    dialog({ title: 'Поделиться музыкой', body: `<div class="found inset v-list">${catalogAll().map((t) => `<div class="trow" data-pick-track="${t.id}"><span class="disc" style="--c:${t.color || '#7a3cff'}"></span><div class="ti"><b>${esc(t.title)}</b><div class="muted">${esc(t.artist)}${t.url ? ' · ' + esc(t.label || t.kind) : ''}</div></div></div>`).join('')}${pls.length ? '<div class="cgroup">Плейлисты</div>' + pls.map((pl) => `<div class="trow" data-pick-pl="${pl.id}"><span class="disc stack"></span><div class="ti"><b>♪ ${esc(pl.name)}</b><div class="muted">${pl.tracks.length} тр.</div></div></div>`).join('') : ''}</div>`, buttons: [{ label: 'Отмена' }], onOpen: (ov) => {
      $$('[data-pick-track]', ov).forEach((r) => (r.onclick = () => { ov.remove(); cb('track', r.dataset.pickTrack); }));
      $$('[data-pick-pl]', ov).forEach((r) => (r.onclick = () => { const pl = pls.find((x) => x.id === r.dataset.pickPl); ov.remove(); cb('playlist', { id: pl.id, name: pl.name, tracks: pl.tracks.slice() }); }));
    } });
  }

  /* ================= профиль и знакомство ================= */
  function renderProfile(uin) {
    const a = accountOf(uin); if (!a) return '<div class="empty-note">Нет такого пользователя.</div>';
    const mine = uin === me.uin;
    const prof = profileOf(uin);
    if (mine) {
      const custom = prof.interests.filter((i) => !INTERESTS.includes(i));
      const tier = tierOf(uin), nextT = nextTier(uin);
      return `<div class="wall-head"><span class="ico">${avatarSvg(uin, 30)}</span><div class="who"><b>${esc(a.nick)}</b> <span class="muted">#${a.uin}</span> ${tier !== 'basic' ? `<span class="tier ${tier}">${TIER[tier].badge}</span>` : ''}<div class="hint">${esc(fmtPhone(a.phone))} · ${esc(myXstatus())}</div></div></div>
        <div class="groupbox"><span class="legend">Уровень АСЬКИ: ${TIER[tier].label}</span><div class="row"><span class="tier-bar"><i style="width:${nextT ? Math.min(100, Math.round((100 * prof.points) / nextT.min)) : 100}%"></i></span><span class="muted">${prof.points} б.</span></div><div class="hint">${nextT ? `До уровня ${nextT.label}: ещё ${nextT.min - prof.points} баллов. ` : 'Выше некуда. Ты на вершине пищевой цепочки АСЬКИ. '}Баллы — за сообщения, открытки, записи, магниты и новых друзей.</div><div class="hint">${esc(TIER[tier].perks)}</div></div>
        <div class="groupbox"><span class="legend">Аватар</span><div class="avatars" id="p-avatars"><button class="${prof.avatar == null ? 'on' : ''}" data-av="" title="цветочек">${flowerSvg('#3cb44a', 22, { logo: true })}</button>${SMILES.map((sm) => `<button class="${prof.avatar === sm.id ? 'on' : ''}" data-av="${sm.id}" title="${esc(sm.name)}">${smileSvg(sm.id, 22)}</button>`).join('')}</div></div>
        <div class="groupbox"><span class="legend">Чем занят</span><div class="chips" id="p-xs">${FUN_STATUS.filter((f) => !f.tier || tierRank(tier) >= tierRank(f.tier)).map((f) => `<button class="chip ${prof.xstatus === f.icon + ' ' + f.text ? 'on' : ''}" data-xs="${esc(f.icon + ' ' + f.text)}">${f.icon} ${esc(f.text)}</button>`).join('')}${prof.xstatus && !FUN_STATUS.some((f) => f.icon + ' ' + f.text === prof.xstatus) ? `<button class="chip on" data-xs="${esc(prof.xstatus)}">${esc(prof.xstatus)}</button>` : ''}<button class="chip" data-xs="" title="обычный статус режима">✕ сбросить</button></div><div class="row mt"><input class="field" id="p-xcustom" maxlength="40" placeholder="свой статус"><button class="btn" id="p-xset">OK</button></div><div class="hint">${FUN_STATUS.some((f) => f.tier) ? 'Статусы с ★ и ◆ открываются на уровнях Gold и Black.' : ''}</div></div>
        <div class="groupbox"><span class="legend">Досье</span><label class="row"><input type="checkbox" id="p-dossier" ${prof.dossierOpen ? 'checked' : ''}> досье открыто для друзей</label><div class="row mt"><button class="btn" id="p-dossier-open">Открыть досье</button><button class="btn" id="p-fridge">🧲 Холодильник</button></div></div>
        <div class="groupbox"><span class="legend">Мой аватар</span><div class="row"><span class="ico">${avatarSvg(uin, 22)}</span><input class="field" id="p-twinname" maxlength="16" value="${esc(prof.twinName || 'КИРР')}" title="имя аватара"><button class="btn" id="p-twinsave">OK</button><button class="btn primary" id="p-twinlearn">🎓 Обучение</button><button class="btn" id="p-twinchat">Написать</button></div><div class="hint">Цифровой двойник: учится на твоих сообщениях и на том, как ты отвечаешь друзьям (выучил ${twinModelOf(uin).model.n} фраз, ${twinModelOf(uin).model.pairsN} ответов). Знает друзей, где ты, что слушаешь. Друзья пишут ему, как тебе.</div></div>
        <div class="groupbox"><span class="legend">Мои интересы (${prof.interests.length})</span><div class="hint mb">Нажми — добавить/убрать; правой кнопкой — страница интереса. <button class="link" id="p-catalog" style="background:none;border:0;padding:0">Каталог →</button></div><div class="chips" id="p-chips">${INTERESTS.map((i) => `<button class="chip ${prof.interests.includes(i) ? 'on' : ''}" data-int="${esc(i)}">${esc(i)}</button>`).join('')}${custom.map((i) => `<button class="chip on" data-int="${esc(i)}" title="убрать">${esc(i)} ×</button>`).join('')}</div>
          <div class="row mt"><input class="field" id="p-custom" maxlength="20" placeholder="свой интерес"><button class="btn" id="p-add">+</button></div></div>
        <div class="groupbox"><span class="legend">Режим</span><select class="field" id="p-mode">${Object.keys(MODES).map((k) => `<option value="${k}" ${prof.mode === k ? 'selected' : ''}>${MODES[k].icon} ${MODES[k].label} — ${MODES[k].hint}</option>`).join('')}</select><div class="hint mt">Режим меняет статус, цвет окон и то, чей круг показан первым. Круг контакта — в его профиле.</div></div>
        <div class="groupbox"><span class="legend">Стена</span><label class="row"><input type="checkbox" id="p-wallpriv" ${prof.wallPrivate ? 'checked' : ''}> приватная стена (видишь только ты)</label><div class="hint">Стена — публичная переписка: записи и комментарии видят друзья. Закрой, если хочешь тишины.</div></div>
        <div class="hint">Интересы видят друзья на твоей стене. По ним считается процент совпадения и подбирается случайное знакомство.</div>`;
    }
    const pct = matchPct(me.uin, uin), common = commonInterests(me.uin, uin);
    const tierC = tierOf(uin);
    return `<div class="wall-head"><span class="ico">${avatarSvg(uin, 30)}</span><div class="who"><b>${esc(a.nick)}</b> <span class="muted">#${a.uin}</span> ${tierC !== 'basic' ? `<span class="tier ${tierC}">${TIER[tierC].badge}</span>` : ''}<div class="hint">${a.phone ? esc(fmtPhone(a.phone)) + ' · ' : ''}${esc(xstatusOf(uin) || statusInfo(statusOf(uin)).label)}</div></div><div class="pct" title="Совпадение интересов">${pct == null ? '—' : pct + '%'}</div></div>
      <div class="groupbox"><span class="legend">Интересы</span><div class="chips">${prof.interests.length ? prof.interests.map((i) => `<button class="chip ${common.includes(i) ? 'on' : ''}" data-interest="${esc(i)}">${esc(i)}</button>`).join('') : '<span class="muted">не указаны</span>'}</div><div class="hint mt">${pct == null ? 'Укажи свои интересы — и Аська посчитает совпадение.' : common.length ? 'Общее: ' + esc(common.join(', ')) : 'Общих интересов нет. Самые интересные разговоры начинаются так.'}</div></div>
      <div class="groupbox"><span class="legend">Круг</span>${Object.keys(MODES).map((k) => `<label class="row"><input type="radio" name="circle" value="${k}" ${circleOf(uin) === k ? 'checked' : ''}> ${MODES[k].icon} ${MODES[k].label}</label>`).join('')}</div>
      <div class="row"><button class="btn primary" id="pr-chat">Написать</button><button class="btn" id="pr-wall">Стена</button><button class="btn" id="pr-dos">Досье</button><button class="btn" id="pr-fridge">🧲</button></div>`;
  }
  function wireProfile(uin) {
    if (uin === me.uin) {
      $$('#p-chips .chip').forEach((b) => (b.onclick = () => {
        const i = b.dataset.int; const list = myProfile().interests.slice();
        const k = list.indexOf(i); if (k >= 0) list.splice(k, 1); else list.push(i);
        saveProfile({ interests: list }); registerInterest(i, k < 0); Snd.play('click'); renderAux(); renderContacts();
      }));
      $$('#p-chips .chip').forEach((b) => (b.oncontextmenu = (e) => { e.preventDefault(); openAux('interest', b.dataset.int); }));
      const add = () => { const v = $('#p-custom').value.trim().toLowerCase(); if (v.length < 2) return; const list = myProfile().interests.slice(); if (!list.includes(v)) list.push(v); saveProfile({ interests: list }); registerInterest(v, true); toast(me, `интерес «${v}» теперь виден всем`, null); renderAux(); };
      $('#p-catalog').onclick = () => openAux('interests');
      const tl = $('#p-twinlearn'); if (tl) tl.onclick = () => openAux('twin');
      const tn = $('#p-twinname'); if (tn) { const saveTwin = () => { const v = tn.value.trim().slice(0, 16) || 'КИРР'; saveProfile({ twinName: v }); toast(me, `аватар теперь зовут ${v}`, null); renderContacts(); }; $('#p-twinsave').onclick = saveTwin; tn.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveTwin(); }); $('#p-twinchat').onclick = () => openChat(twinUin(me.uin)); }
      $('#p-add').onclick = add;
      $('#p-custom').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
      $('#p-mode').onchange = (e) => { setMode(e.target.value); renderAux(); };
      $('#p-wallpriv').onchange = (e) => { saveProfile({ wallPrivate: e.target.checked }); Snd.play('click'); toast(me, e.target.checked ? 'стена теперь приватная' : 'стена снова публичная', null); };
      $$('#p-avatars button').forEach((b) => (b.onclick = () => { saveProfile({ avatar: b.dataset.av || null }); Snd.play('click'); renderAux(); renderMe(); }));
      $$('#p-xs .chip').forEach((b) => (b.onclick = () => setXstatus(b.dataset.xs || null)));
      const setCustom = () => { const v = $('#p-xcustom').value.trim(); if (v) setXstatus(v); };
      $('#p-xset').onclick = setCustom;
      $('#p-xcustom').addEventListener('keydown', (e) => { if (e.key === 'Enter') setCustom(); });
      $('#p-dossier').onchange = (e) => { saveProfile({ dossierOpen: e.target.checked }); Snd.play('click'); toast(me, e.target.checked ? 'досье открыто для друзей' : 'досье закрыто. Аська молчит как партизан', null); };
      $('#p-dossier-open').onclick = () => openAux('dossier', me.uin);
      $('#p-fridge').onclick = () => openAux('fridge', me.uin);
      return;
    }
    $$('input[name=circle]').forEach((r) => (r.onchange = () => { setCircle(uin, r.value); Snd.play('click'); }));
    $('#pr-chat').onclick = () => openChat(uin);
    $('#pr-wall').onclick = () => openAux('wall', uin);
    $('#pr-dos').onclick = () => openAux('dossier', uin);
    $('#pr-fridge').onclick = () => openAux('fridge', uin);
  }
  function randomMeet() {
    if (!me) return;
    const mine = contactsOf(me.uin);
    let pool = allKnown().filter((a) => a.uin !== me.uin && !mine.includes(a.uin));
    if (!pool.length) pool = allKnown().filter((a) => a.uin !== me.uin);
    const a = pick(pool);
    const pct = matchPct(me.uin, a.uin), common = commonInterests(me.uin, a.uin);
    const prof = profileOf(a.uin);
    Snd.play('knock');
    dialog({
      title: 'Случайное знакомство',
      body: `<div class="meet-head">${avatarSvg(a.uin, 34)}<div><b>${esc(a.nick)}</b> <span class="muted">#${a.uin}</span><div class="hint">${esc(xstatusOf(a.uin) || statusInfo(statusOf(a.uin)).label)}${mine.includes(a.uin) ? ' · уже в контактах' : ''}</div></div><div class="pct big" title="Совпадение интересов">${pct == null ? '?' : pct + '%'}</div></div>
        <div class="chips small mt">${prof.interests.map((i) => `<span class="chip ${common.includes(i) ? 'on' : ''}">${esc(i)}</span>`).join('') || '<span class="muted">интересы не указаны</span>'}</div>
        <div class="hint mt">${pct == null ? 'Укажи свои интересы в профиле — и Аська посчитает совпадение.' : pct >= 50 ? 'Аська говорит: это судьба.' : pct > 0 ? 'Есть общее. Остальное — дело разговора.' : 'Ничего общего. Самые интересные разговоры начинаются именно так.'}</div>`,
      buttons: [
        { label: 'Написать', primary: true, onClick: () => { if (!mine.includes(a.uin)) addContact(a.uin); openChat(a.uin); const ta = $('#compose'); if (ta && !ta.value) { ta.value = common.length ? `Привет! Аська говорит, у нас ${pct}% совпадения: ${common.join(', ')} :)` : 'Привет! Аська нас случайно познакомила. Ну что, знакомимся? :)'; drafts[a.uin] = ta.value; } } },
        { label: 'Ещё', onClick: () => setTimeout(randomMeet, 30) },
        { label: 'Закрыть' },
      ],
    });
  }

  /* ================= окно-приставка: стена / профиль / винил ================= */
  const aux = { kind: null, arg: null };
  function openAux(kind, arg) {
    if (aux.kind !== kind || aux.arg !== (arg || null)) wallFull = false;
    if (aux.kind === 'watch' && (kind !== 'watch' || arg !== aux.arg)) stopWatching();
    aux.kind = kind; aux.arg = arg || null;
    hideSmiles();
    $('.desktop').classList.add('mode-aux');
    renderAux();
    Snd.play('click');
  }
  function closeAux() {
    if (aux.kind === 'watch') stopWatching();
    aux.kind = null; aux.arg = null;
    $('.desktop').classList.remove('mode-aux');
    renderAux();
  }
  function renderAux() {
    const win = $('#auxwin'); if (!win) return;
    win.hidden = !aux.kind;
    if (!aux.kind) return;
    const body = $('#aux-body'), title = $('#aux-title');
    if (aux.kind === 'wall') { const a = accountOf(aux.arg); title.innerHTML = `${aux.arg === me.uin ? 'Моя стена' : 'Стена: ' + esc(a ? a.nick : aux.arg)}`; body.innerHTML = renderWall(aux.arg); if (accountOf(aux.arg)) wireWall(aux.arg); }
    else if (aux.kind === 'profile') { const a = accountOf(aux.arg); title.innerHTML = aux.arg === me.uin ? 'Мой профиль' : `Профиль: ${esc(a ? a.nick : aux.arg)}`; body.innerHTML = renderProfile(aux.arg); if (accountOf(aux.arg)) wireProfile(aux.arg); }
    else if (aux.kind === 'vinyl') { title.innerHTML = 'Винил <small>— проигрыватель</small>'; body.innerHTML = renderVinyl(); wireVinyl(); }
    else if (aux.kind === 'fridge') { const a = accountOf(aux.arg); title.innerHTML = aux.arg === me.uin ? 'Мой холодильник' : `Холодильник: ${esc(a ? a.nick : aux.arg)}`; body.innerHTML = renderFridge(aux.arg); if (accountOf(aux.arg)) wireFridge(aux.arg); }
    else if (aux.kind === 'dossier') { const a = accountOf(aux.arg); title.innerHTML = `Досье: ${esc(a ? a.nick : aux.arg)}`; body.innerHTML = renderDossier(aux.arg); if (accountOf(aux.arg)) wireDossier(aux.arg); }
    else if (aux.kind === 'events') { title.innerHTML = 'Мероприятия <small>— в гости</small>'; body.innerHTML = renderEvents(); wireEvents(); }
    else if (aux.kind === 'people') { title.innerHTML = 'Люди <small>— знакомства и досье</small>'; body.innerHTML = renderPeople(); wirePeople(); }
    else if (aux.kind === 'track') { const t = Music.anyById(aux.arg); title.innerHTML = t ? `♪ ${esc(t.title)} <small>— страница трека</small>` : 'Трек'; body.innerHTML = renderTrackPage(aux.arg); wireTrackPage(aux.arg); }
    else if (aux.kind === 'twin') { title.innerHTML = `${esc(twinNick(me.uin))} <small>— обучение аватара</small>`; body.innerHTML = renderTwin(); wireTwin(); }
    else if (aux.kind === 'cinema') { title.innerHTML = 'Кино <small>— фильмы и сериалы</small>'; body.innerHTML = renderCinema(); wireCinema(); }
    else if (aux.kind === 'watch') { const mv = movieOf(aux.arg); title.innerHTML = mv ? `🎬 ${esc(mv.title)}` : 'Кино'; body.innerHTML = renderWatch(aux.arg); wireWatch(aux.arg); }
    else if (aux.kind === 'refs') { title.innerHTML = 'Приглашения <small>— цепочка</small>'; body.innerHTML = renderRefs(); wireRefs(); }
    else if (aux.kind === 'interests') { title.innerHTML = 'Каталог интересов'; body.innerHTML = renderInterestCatalog(); wireInterestCatalog(); }
    else if (aux.kind === 'interest') { title.innerHTML = `Интерес: ${esc(aux.arg)}`; body.innerHTML = renderInterest(aux.arg); wireInterest(aux.arg); }
    else if (aux.kind === 'community') { const c = (db.communities || {})[aux.arg]; title.innerHTML = c ? `Сообщество: ${esc(c.name)}` : 'Сообщество'; body.innerHTML = renderCommunity(aux.arg); if (c) wireCommunity(aux.arg); }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('[data-reply]')) return;
    const v = e.target.value.trim(); if (!v) return;
    e.preventDefault(); commentOn(e.target.dataset.wallof, e.target.dataset.reply, v); e.target.value = '';
  });
  // клики по карточкам треков, открыткам и лайкам — где бы они ни были
  document.addEventListener('click', (e) => {
    const play = e.target.closest('[data-play]');
    if (play) { const id = play.dataset.play; if (Music.state.trackId === id && Music.state.playing) Music.pause(); else { Music.play(id); if (aux.kind !== 'vinyl' && !isNarrow()) {} } return; }
    const pp = e.target.closest('[data-playpl]');
    if (pp) { Music.playQueue(pp.dataset.playpl.split(','), pp.dataset.plname, 0); return; }
    const like = e.target.closest('[data-like]');
    if (like) { toggleLike(like.dataset.wallof, like.dataset.like); return; }
    const w = e.target.closest('[data-wall]');
    if (w) { openAux('wall', w.dataset.wall); return; }
    const it = e.target.closest('[data-interest]');
    if (it) { openAux('interest', it.dataset.interest); return; }
    const ch = e.target.closest('[data-chat]');
    if (ch) { openChat(ch.dataset.chat); return; }
    const tp = e.target.closest('[data-trackpage]');
    if (tp) { openAux('track', tp.dataset.trackpage); return; }
    const rd = e.target.closest('[data-radio]');
    if (rd) { if (Music.state.radio === rd.dataset.radio && Music.state.playing) Music.pause(); else { Music.playRadio(rd.dataset.radio); if (aux.kind === 'vinyl') renderAux(); } return; }
    const mf = e.target.closest('[data-mfav]');
    if (mf) { toggleMovieFav(mf.dataset.mfav); return; }
    const mr = e.target.closest('[data-mrec]');
    if (mr) { recommendMovieDialog(mr.dataset.mrec); return; }
    const mw = e.target.closest('[data-watch]');
    if (mw) { openAux('watch', mw.dataset.watch); return; }
    const rs = e.target.closest('[data-rsvp]');
    if (rs) { rsvp(rs.dataset.ev, rs.dataset.rsvp); return; }
    const ed = e.target.closest('[data-evinfo]');
    if (ed) { eventDialog(ed.dataset.evinfo); return; }
    const pc = e.target.closest('#aux-body .postcard, .overlay .postcard');
    if (pc && pc.dataset.sound) { playRef(pc.dataset.sound); pc.replaceWith(pc.cloneNode(true)); }
  });

  /* ================= кино ================= */
  let watching = null, watchSaveT = 0;
  function ensureMovies() {
    const missing = Cinema.SEEDS.filter((m) => !(db.movies || {})[m.id]);
    if (!missing.length) return;
    mutate((d) => { d.movies = d.movies || {}; missing.forEach((m) => { d.movies[m.id] = Object.assign({ ts: Date.now() - Math.floor(Math.random() * 5 + 1) * 86400000, likes: [] }, m); }); });
  }
  const movieOf = (id) => (db.movies || {})[id] || null;
  const allMovies = () => Object.values(db.movies || {});
  const myMovieFavs = () => (me ? myProfile().favMovies || [] : []);
  function movieSource(mv, ep) {
    let url = mv.kind === 'series' ? ((mv.episodes || [])[ep || 0] || {}).url : mv.url;
    if (url && url.startsWith('../video/')) url = '../' + url;
    return { url, info: Cinema.parseLink(url) };
  }
  function movieCard(id, small) {
    const mv = movieOf(id); if (!mv) return '<div class="muted">фильм не найден</div>';
    const fav = myMovieFavs().includes(id);
    return `<div class="moviecard" data-watch="${esc(id)}" title="Смотреть">${Cinema.posterSvg(mv, 34)}<div class="ti"><b>${esc(mv.title)}</b><div class="muted">${mv.kind === 'series' ? 'сериал · ' + (mv.episodes || []).length + ' серий' : 'фильм'} · ${mv.year} · ${esc(mv.genre)}</div><div class="muted">добавил(а) ${esc(nickOf(mv.addedBy))}${(mv.likes || []).length ? ' · ♥' + mv.likes.length : ''}</div></div><span class="btn icon" title="Смотреть">▶</span>${small ? '' : `<button class="btn icon ${fav ? 'on' : ''}" data-mfav="${esc(id)}" title="В любимое">♥</button>`}</div>`;
  }
  function addMovie(data) {
    const info = Cinema.parseLink(data.url || (data.episodes && data.episodes[0] && data.episodes[0].url));
    if (!info) return null;
    const mv = Object.assign({ id: 'm_' + uid(), kind: 'film', year: new Date().getFullYear(), genre: 'драма', desc: '', addedBy: me.uin, ts: Date.now(), likes: [] }, data);
    mutate((d) => { d.movies = d.movies || {}; d.movies[mv.id] = mv; });
    addPoints(3, 'кино в сеть'); post({ type: 'movies' }); Snd.play('tada');
    // друзья реагируют: кто-то сразу лайкает
    setTimeout(() => { const fans = Object.values(BOTS).filter((b) => b.persona && Math.random() < 0.35).slice(0, 2); if (!fans.length) return; mutate((d) => { const m = d.movies[mv.id]; if (m) fans.forEach((b) => { if (!m.likes.includes(b.uin)) m.likes.push(b.uin); }); }); if (aux.kind === 'cinema' || aux.kind === 'watch') renderAux(); }, 4000);
    return mv;
  }
  function addMovieDialog() {
    const gsel = Cinema.GENRES.filter((g) => g !== 'сериал').map((g) => `<option>${g}</option>`).join('');
    dialog({ title: '＋ Добавить в сеть', body: `<div class="col">
      <div class="tabs"><button class="on" data-mk="film">Фильм</button><button data-mk="series">Сериал</button></div>
      <label class="row"><span class="lbl">Название</span><input class="field" id="m-title" maxlength="60" placeholder="как называется"></label>
      <div class="row"><label class="row sp"><span class="lbl">Год</span><input class="field" id="m-year" type="number" min="1900" max="2100" value="${new Date().getFullYear()}" style="width:64px"></label><label class="row sp"><span class="lbl">Жанр</span><select class="field" id="m-genre">${gsel}</select></label></div>
      <label class="row"><span class="lbl">О чём</span><input class="field" id="m-desc" maxlength="140" placeholder="пара слов, чтобы друзья захотели"></label>
      <div id="m-film"><label class="row"><span class="lbl">Ссылка</span><input class="field" id="m-url" placeholder="https://youtu.be/… или https://…/film.mp4"></label></div>
      <div id="m-series" hidden><div class="hint">Серии: по одной ссылке в строке. Название через « | »: <i>1. Пилот | https://…</i></div><textarea class="field" id="m-eps" rows="4" placeholder="1. Пилот | https://youtu.be/…\n2. Вторая | https://…"></textarea></div>
      <div class="hint" id="m-kind">YouTube, VK Видео, Rutube, Vimeo, Дзен, Одноклассники или прямая ссылка на mp4/webm — смотрится прямо в АСЬКЕ с любого устройства.</div>
      <div class="hint">Свой файл: выложи его на любой хостинг (Яндекс Диск → «прямая ссылка», свой сайт, облако) и вставь ссылку. АСЬКА хранит ссылку, а не файл, поэтому кино откроется везде, где ты вошёл.</div></div>`,
      buttons: [{ label: 'Добавить и смотреть', primary: true, onClick: (ov) => {
        const kind = $('.tabs .on', ov).dataset.mk; const title = $('#m-title', ov).value.trim(); if (!title) { $('#m-title', ov).focus(); return false; }
        const base = { title, kind, year: +$('#m-year', ov).value || new Date().getFullYear(), genre: $('#m-genre', ov).value, desc: $('#m-desc', ov).value.trim() };
        if (kind === 'film') { base.url = $('#m-url', ov).value.trim(); if (!Cinema.parseLink(base.url)) { $('#m-kind', ov).textContent = 'Не похоже на ссылку на видео.'; return false; } }
        else { base.episodes = $('#m-eps', ov).value.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => { const parts = l.split('|').map((x) => x.trim()); const url = parts.length > 1 ? parts[parts.length - 1] : parts[0]; return { title: parts.length > 1 ? parts.slice(0, -1).join(' ') : (i + 1) + '. Серия', url }; }).filter((e) => Cinema.parseLink(e.url)); if (!base.episodes.length) { $('#m-kind', ov).textContent = 'Нужна хотя бы одна ссылка на серию.'; return false; } }
        const mv = addMovie(base); if (!mv) return false; openAux('watch', mv.id);
      } }, { label: 'Отмена' }],
      onOpen: (ov) => { $$('.tabs button', ov).forEach((b) => (b.onclick = () => { $$('.tabs button', ov).forEach((x) => x.classList.toggle('on', x === b)); $('#m-film', ov).hidden = b.dataset.mk !== 'film'; $('#m-series', ov).hidden = b.dataset.mk !== 'series'; })); const u = $('#m-url', ov); u.addEventListener('input', () => { const i = Cinema.parseLink(u.value); $('#m-kind', ov).textContent = i ? `Источник: ${i.label}${i.kind === 'link' ? ' — откроется в новой вкладке, в окне не показать' : ' — покажем прямо в АСЬКЕ'}` : 'Вставь ссылку на видео.'; }); },
    });
  }
  function toggleMovieFav(id) {
    const mv = movieOf(id); if (!mv) return;
    const favs = myMovieFavs().slice(); const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    saveProfile({ favMovies: favs });
    mutate((d) => { const m = d.movies[id]; if (!m) return; m.likes = m.likes || []; const j = m.likes.indexOf(me.uin); if (i >= 0 && j >= 0) m.likes.splice(j, 1); if (i < 0 && j < 0) m.likes.push(me.uin); });
    if (i < 0) addPoints(1, 'любимое кино');
    post({ type: 'movies' }); Snd.play('click');
    if (aux.kind === 'cinema' || aux.kind === 'watch') renderAux(); else if (active) renderHistory();
  }
  function recommendMovie(id, toUin, note, alsoWall) {
    const mv = movieOf(id); if (!mv || !toUin) return;
    sendSpecial(toUin, { kind: 'movie', movie: id, note: note || '', text: '🎬 ' + mv.title });
    if (alsoWall) postWall(me.uin, { kind: 'movie', movie: id, note: note ? note : `Советую: «${mv.title}»` });
    toast(accountOf(toUin), 'кино отправлено', null);
  }
  function recommendMovieDialog(id) {
    const mv = movieOf(id); if (!mv) return;
    const friends = contactsOf(me.uin).map(accountOf).filter((a) => a && !a.twinOf);
    dialog({ title: `Посоветовать «${esc(mv.title)}»`, body: `<div class="col"><label class="row"><span class="lbl">Кому</span><select class="field" id="mr-to">${friends.map((a) => `<option value="${a.uin}" ${a.uin === active ? 'selected' : ''}>${esc(a.nick)}</option>`).join('')}</select></label><label class="row"><span class="lbl">Слова</span><input class="field" id="mr-note" maxlength="120" placeholder="почему стоит посмотреть"></label><label class="row"><input type="checkbox" id="mr-wall" checked> и на мою стену</label></div>`,
      buttons: [{ label: 'Отправить', primary: true, onClick: (ov) => recommendMovie(id, $('#mr-to', ov).value, $('#mr-note', ov).value.trim(), $('#mr-wall', ov).checked) }, { label: 'Отмена' }] });
  }
  function pickMovieDialog(cb) {
    const list = allMovies().sort((a, b) => b.ts - a.ts);
    dialog({ title: 'Какое кино?', body: `<div class="found inset v-list">${list.map((m) => `<div class="trow" data-pick-movie="${esc(m.id)}">${Cinema.posterSvg(m, 24)}<div class="ti"><b>${esc(m.title)}</b><div class="muted">${m.kind === 'series' ? 'сериал' : 'фильм'} · ${esc(m.genre)}</div></div></div>`).join('')}</div>`, buttons: [{ label: 'Отмена' }], onOpen: (ov) => $$('[data-pick-movie]', ov).forEach((r) => (r.onclick = () => { ov.remove(); cb(r.dataset.pickMovie); })) });
  }
  function movieRecs(n) {
    const favs = myMovieFavs(); const likedGenres = {}; favs.forEach((id) => { const m = movieOf(id); if (m) likedGenres[m.genre] = (likedGenres[m.genre] || 0) + 1; });
    const friends = contactsOf(me.uin);
    return allMovies().filter((m) => !favs.includes(m.id)).map((m) => {
      const fl = (m.likes || []).filter((u) => friends.includes(u) && u !== me.uin);
      const sc = fl.length * 2 + (likedGenres[m.genre] || 0) * 3 + (m.addedBy !== me.uin ? 0.5 : 0) + Math.random() * 0.4;
      const why = likedGenres[m.genre] ? `ты любишь жанр «${m.genre}»` : fl.length ? `нравится: ${fl.slice(0, 2).map(nickOf).join(', ')}` : `добавил(а) ${nickOf(m.addedBy)}`;
      return { m, sc, why };
    }).sort((a, b) => b.sc - a.sc).slice(0, n || 3);
  }
  let ctab = 'all', cq = '';
  function renderCinema() {
    const favs = myMovieFavs();
    let list = allMovies().sort((a, b) => b.ts - a.ts);
    if (ctab === 'film') list = list.filter((m) => m.kind === 'film'); else if (ctab === 'series') list = list.filter((m) => m.kind === 'series'); else if (ctab === 'fav') list = list.filter((m) => favs.includes(m.id)); else if (ctab === 'mine') list = list.filter((m) => m.addedBy === me.uin);
    if (cq) { const q = cq.toLowerCase(); list = list.filter((m) => (m.title + ' ' + (m.orig || '') + ' ' + m.genre + ' ' + (m.kind === 'series' ? 'сериал' : 'фильм') + ' ' + m.year + ' ' + nickOf(m.addedBy)).toLowerCase().includes(q)); }
    const watch = myProfile().watch || {};
    const card = (m) => { const fav = favs.includes(m.id); const w = watch[m.id]; return `<div class="mcard" data-id="${esc(m.id)}"><div class="mposter" data-watch="${esc(m.id)}" title="Смотреть">${Cinema.posterSvg(m, 64)}<span class="playo">▶</span></div><div class="mi"><b class="link" data-watch="${esc(m.id)}">${esc(m.title)}</b><div class="muted">${m.kind === 'series' ? 'сериал · ' + (m.episodes || []).length + ' сер.' : 'фильм'} · ${m.year} · ${esc(m.genre)}</div><div class="muted">добавил(а) <span class="link" data-wall="${esc(m.addedBy)}">${esc(nickOf(m.addedBy))}</span>${(m.likes || []).length ? ' · ♥ ' + m.likes.length : ''}${w && w.pos > 10 ? ' · <span class="cont">смотрел(а) до ' + fmtSec(w.pos) + (m.kind === 'series' ? ', серия ' + (w.ep + 1) : '') + '</span>' : ''}</div>${m.desc ? `<div class="mdesc">${esc(m.desc)}</div>` : ''}<div class="row mact"><button class="btn primary" data-watch="${esc(m.id)}">▶ Смотреть</button><button class="btn icon ${fav ? 'on' : ''}" data-mfav="${esc(m.id)}" title="В любимое">♥</button><button class="btn" data-mrec="${esc(m.id)}" title="Посоветовать другу или на стену">➤ Посоветовать</button></div></div></div>`; };
    const recs = ctab === 'all' && !cq ? movieRecs(3) : [];
    return `<div class="cinema">
      <div class="row wall-head"><span class="hint">Фильмы и сериалы по ссылке. Смотри прямо здесь, с любого устройства.</span><span class="sp"></span><button class="btn primary" id="c-add">＋ Добавить в сеть</button></div>
      <div class="row"><input class="field sp" id="c-q" placeholder="поиск: название, жанр, кто добавил" value="${esc(cq)}"></div>
      <div class="tabs c-tabs"><button class="${ctab === 'all' ? 'on' : ''}" data-ct="all">Все</button><button class="${ctab === 'film' ? 'on' : ''}" data-ct="film">Фильмы</button><button class="${ctab === 'series' ? 'on' : ''}" data-ct="series">Сериалы</button><button class="${ctab === 'fav' ? 'on' : ''}" data-ct="fav">♥${favs.length ? ' ' + favs.length : ''}</button><button class="${ctab === 'mine' ? 'on' : ''}" data-ct="mine">Мои</button></div>
      <div class="tabpanel v-list">
        ${recs.length ? `<div class="cgroup">Рекомендуем тебе</div><div class="recs">${recs.map((r) => `<div class="rec" data-watch="${esc(r.m.id)}" title="${esc(r.why)}">${Cinema.posterSvg(r.m, 44)}<div class="ti"><b>${esc(r.m.title)}</b><div class="muted">${esc(r.why)}</div></div></div>`).join('')}</div><div class="cgroup">${cq ? 'Найдено' : 'Вся сеть'}</div>` : ''}
        ${list.length ? list.map(card).join('') : `<div class="empty-note">${ctab === 'fav' ? 'Нажми ♥ у фильма — он появится тут.' : ctab === 'mine' ? 'Ты ещё ничего не добавил. Жми «Добавить в сеть».' : 'Ничего не нашлось.'}</div>`}
      </div></div>`;
  }
  function wireCinema() {
    $('#c-add').onclick = addMovieDialog;
    $$('.c-tabs button').forEach((b) => (b.onclick = () => { ctab = b.dataset.ct; Snd.play('click'); renderAux(); }));
    const q = $('#c-q'); q.oninput = () => { cq = q.value.trim(); const panel = $('.cinema .tabpanel'); const pos = q.selectionStart; renderAux(); const nq = $('#c-q'); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); } };
  }
  function renderWatch(id) {
    const mv = movieOf(id); if (!mv) return '<div class="empty-note">Фильм не найден.</div>';
    const prof = myProfile(); const favs = myMovieFavs(); const w = (prof.watch || {})[id];
    const ep = watching && watching.id === id ? watching.ep : (w ? w.ep || 0 : 0);
    const { url, info } = movieSource(mv, ep);
    let player = '';
    if (!info) player = '<div class="empty-note">Нет ссылки на видео.</div>';
    else if (info.kind === 'video') player = `<video id="wv" controls autoplay playsinline preload="metadata" src="${esc(info.src)}"></video>`;
    else if (info.embed) player = `<iframe id="wf" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox" referrerpolicy="strict-origin-when-cross-origin" src="${esc(info.embed)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    else player = `<div class="empty-note">Эта ссылка не встраивается. <a href="${esc(Sec.safeUrl(url))}" target="_blank" rel="noopener noreferrer">Открыть в новой вкладке</a></div>`;
    const eps = mv.kind === 'series' ? `<div class="cgroup">Серии</div><div class="ep-list">${(mv.episodes || []).map((e, i) => `<button class="btn ${i === ep ? 'down' : ''}" data-ep="${i}">${esc(e.title)}</button>`).join('')}</div>` : '';
    return `<div class="watch">
      <div class="row wall-head"><button class="btn" id="wt-back">← Кино</button><span class="sp"></span><span class="hint">${esc(info ? info.label : '')}${mv.kind === 'series' ? ' · серия ' + (ep + 1) + '/' + (mv.episodes || []).length : ''}</span></div>
      <div class="screen">${player}</div>
      ${w && w.pos > 10 && info && info.kind === 'video' && !(watching && watching.id === id) ? `<div class="row"><button class="btn" id="wt-cont">▶ Продолжить с ${fmtSec(w.pos)}${mv.kind === 'series' ? ' (серия ' + ((w.ep || 0) + 1) + ')' : ''}</button></div>` : ''}
      <div class="np-box inset"><div class="row"><b class="sp">${esc(mv.title)}${mv.orig && mv.orig !== mv.title ? ` <span class="muted">(${esc(mv.orig)})</span>` : ''}</b><button class="btn icon ${favs.includes(id) ? 'on' : ''}" data-mfav="${esc(id)}" title="В любимое">♥</button></div><div class="muted">${mv.kind === 'series' ? 'сериал' : 'фильм'} · ${mv.year} · ${esc(mv.genre)} · ♥ ${(mv.likes || []).length}</div><div class="muted">добавил(а) <span class="link" data-wall="${esc(mv.addedBy)}">${esc(nickOf(mv.addedBy))}</span> · ${fmtDay(mv.ts)}</div>${mv.desc ? `<div class="mdesc">${esc(mv.desc)}</div>` : ''}${(mv.likes || []).length ? `<div class="muted">Нравится: ${mv.likes.map(nickOf).map(esc).join(', ')}</div>` : ''}</div>
      ${eps}
      <div class="row v-share"><button class="btn" data-mrec="${esc(id)}">➤ Посоветовать другу</button><button class="btn" id="wt-wall">▤ На стену</button><button class="btn" id="wt-link" title="Скопировать ссылку">🔗</button><button class="btn" id="wt-full" ${info && (info.kind === 'video' || info.embed) ? '' : 'disabled'}>⛶ Во весь экран</button></div>
      <div class="row"><label class="btn" title="Открыть своё видео с этого устройства (в сеть не попадёт)">📁 Файл с устройства<input type="file" id="wt-file" accept="video/*" hidden></label><span class="hint">только здесь, в сеть не попадёт</span></div>
    </div>`;
  }
  function wireWatch(id) {
    const mv = movieOf(id); if (!mv) return;
    const w = (myProfile().watch || {})[id];
    const ep = watching && watching.id === id ? watching.ep : (w ? w.ep || 0 : 0);
    watching = { id, ep };
    $('#wt-back').onclick = () => openAux('cinema');
    $$('[data-ep]').forEach((b) => (b.onclick = () => { watching = { id, ep: +b.dataset.ep }; saveWatchPos(0, true); renderAux(); }));
    const v = $('#wv');
    if (v) {
      v.addEventListener('timeupdate', () => { if (Date.now() - watchSaveT > 5000) saveWatchPos(v.currentTime); });
      v.addEventListener('pause', () => { if (!v.ended) saveWatchPos(v.currentTime); });
      v.addEventListener('play', () => { mutate((d) => { d.presence[me.uin] = { status: myStatus, xstatus: myXstatus(), ts: Date.now() }; }); post({ type: 'presence', uin: me.uin }); });
      v.addEventListener('ended', () => { saveWatchPos(0, true); if (mv.kind === 'series' && watching && watching.ep + 1 < (mv.episodes || []).length) { watching = { id, ep: watching.ep + 1 }; renderAux(); } });
      v.addEventListener('error', () => { const scr = $('.watch .screen'); if (scr && !$('.err', scr)) scr.insertAdjacentHTML('beforeend', `<div class="err">Видео не загрузилось. Проверь ссылку или открой: <a href="${esc(Sec.safeUrl(movieSource(mv, ep).url))}" target="_blank" rel="noopener noreferrer">в новой вкладке</a></div>`); });
      const cont = $('#wt-cont'); if (cont) cont.onclick = () => { v.currentTime = w.pos; v.play(); cont.remove(); };
    }
    $('#wt-wall').onclick = () => { postWall(me.uin, { kind: 'movie', movie: id, note: `Смотрю «${mv.title}»` }); toast(me, 'кино на стене', null); };
    $('#wt-link').onclick = () => { const link = location.origin + location.pathname.replace(/[^/]*$/, '') + '?watch=' + encodeURIComponent(id); const done = () => { Snd.play('click'); toast(me, 'ссылка на кино скопирована', null); }; if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => window.prompt('Ссылка:', link)); else window.prompt('Ссылка:', link); };
    $('#wt-full').onclick = () => { const el = $('#wv') || $('#wf'); if (el && el.requestFullscreen) el.requestFullscreen(); };
    $('#wt-file').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const url = URL.createObjectURL(f); const scr = $('.watch .screen'); scr.innerHTML = `<video id="wv" controls autoplay playsinline src="${url}"></video>`; $('.watch .wall-head .hint').textContent = 'свой файл: ' + f.name; };
  }
  function saveWatchPos(pos, reset) {
    watchSaveT = Date.now();
    const all = Object.assign({}, myProfile().watch || {});
    if (!watching) return;
    all[watching.id] = reset ? { ep: watching.ep, pos: 0, ts: Date.now() } : { ep: watching.ep, pos: Math.floor(pos), ts: Date.now() };
    saveProfile({ watch: all });
  }
  function stopWatching() {
    const v = $('#wv'); if (v && watching && !v.ended) saveWatchPos(v.currentTime);
    watching = null;
    if (me) { mutate((d) => { d.presence[me.uin] = { status: myStatus, xstatus: myXstatus(), ts: Date.now() }; }); post({ type: 'presence', uin: me.uin }); }
  }
  function botRecommendsMovie() {
    if (!me || myProfile().movieRecd) return;
    const bots = Object.values(BOTS).filter((b) => b.persona && b.brain !== 'vinyl' && isOnline(b.uin));
    const list = allMovies().filter((m) => m.addedBy !== me.uin); if (!bots.length || !list.length) return;
    const bot = pick(bots);
    const liked = list.filter((m) => (m.likes || []).includes(bot.uin));
    const mv = pick(liked.length ? liked : list);
    const P = bot.persona;
    const lines = { aska: [`Посмотри «${mv.title}»! Я смотрела два раза и оба раза плакала (от счастья) :)`], kat: [`«${mv.title}» смотрел???? срочно смотри)))`], vova: [`«${mv.title}». норм. смотри`], serega: [`«${mv.title}» — ОГОНЬ!!! Смотрим вместе в субботу!!!`], lena: [`Советую «${mv.title}». Со вкусом снято, без лишнего.`], batya: [`Сын, посмотри «${mv.title}». Там про главное. Потом обсудим.`], max: [`«${mv.title}» — редкий случай, когда кино умнее зрителя. Посмотри.`] };
    botSays(bot, P.id === 'aska' ? pick(lines.aska) : P.v(pick(lines[P.id] || lines.aska)), { movie: mv.id });
    saveProfile({ movieRecd: true });
  }

  /* ================= винил ================= */
  const SOURCE_LABEL = { yandex: 'Яндекс Музыка', youtube: 'YouTube', soundcloud: 'SoundCloud', audio: 'mp3', link: 'ссылка', synth: 'синтез' };
  function catalogAll() { return Music.TRACKS.concat(Object.values(db.tracks || {})); }
  function loadExternalTracks() { Object.values(db.tracks || {}).forEach((t) => Music.registerExternal(t)); }
  function trackNft(id) {
    const t = Music.anyById(id); if (!t) return { serial: '—', owner: null, addedBy: null };
    const owner = (db.trackOwners || {})[id] || (t.url ? t.addedBy : (Object.values(BOTS).find((bb) => bb.brain === t.by) || BOTS['000001']).uin);
    return { serial: t.serial || ('#T' + refHash('t' + id).slice(2, 8).toUpperCase()), owner, addedBy: t.url ? t.addedBy : owner };
  }
  function addTrackByLink(url, title, artist) {
    const info = Music.parseLink(url);
    if (!info) { alertBox('Ссылка', 'Не похоже на ссылку. Нужна ссылка на Яндекс Музыку, YouTube, SoundCloud или на mp3-файл.'); return null; }
    let n = 0; mutate((d) => { d.magnetSeq = (d.magnetSeq || 1000) + 1; n = d.magnetSeq; });
    const t = { id: 'x_' + uid(), title: title || 'Без названия', artist: artist || (info.kind === 'yandex' ? 'Яндекс Музыка' : info.kind === 'youtube' ? 'YouTube' : 'Неизвестный исполнитель'), url, kind: info.kind, embed: info.embed || null, src: info.src || null, h: info.h || 0, label: info.label, style: 'pop', by: null, addedBy: me.uin, ts: Date.now(), serial: '#T' + String(n).padStart(6, '0'), color: '#7a3cff', likes: [] };
    mutate((d) => { d.tracks = d.tracks || {}; d.tracks[t.id] = t; });
    Music.registerExternal(t);
    trackLogPush(t.id, { kind: 'mint', who: me.uin, note: info.label });
    addPoints(2, 'трек в коллекцию');
    post({ type: 'tracks' });
    Snd.play('tada');
    return t;
  }
  function addLinkDialog() {
    dialog({ title: '＋ Добавить трек по ссылке', body: `<div class="col"><label class="row"><span class="lbl">Ссылка</span><input class="field" id="l-url" placeholder="https://music.yandex.ru/album/…/track/…"></label><div class="hint" id="l-kind">Яндекс Музыка, YouTube, SoundCloud или прямая ссылка на mp3. Играет прямо в виниле.</div><label class="row"><span class="lbl">Название</span><input class="field" id="l-title" maxlength="60" placeholder="как называется"></label><label class="row"><span class="lbl">Кто поёт</span><input class="field" id="l-artist" maxlength="40" placeholder="исполнитель"></label><div class="hint">Трек попадёт в общую коллекцию: все увидят, кто добавил. Он станет твоим НФТ — с номером, его можно подарить.</div></div>`,
      buttons: [{ label: 'Добавить и слушать', primary: true, onClick: (ov) => { const url = $('#l-url', ov).value.trim(); const t = addTrackByLink(url, $('#l-title', ov).value.trim(), $('#l-artist', ov).value.trim()); if (!t) return false; vtab = 'coll'; Music.play(t.id); if (aux.kind === 'vinyl') renderAux(); } }, { label: 'Отмена' }],
      onOpen: (ov) => { const u = $('#l-url', ov); u.addEventListener('input', () => { const i = Music.parseLink(u.value); $('#l-kind', ov).textContent = i ? `Источник: ${i.label}${i.kind === 'link' ? ' — откроется в новой вкладке, в виниле не проиграть' : ''}` : 'Вставь ссылку: Яндекс Музыка, YouTube, SoundCloud или mp3.'; }); },
    });
  }
  function toggleFav(id) {
    const favs = (myProfile().favTracks || []).slice(); const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    saveProfile({ favTracks: favs });
    if (i < 0) trackLogPush(id, { kind: 'like', who: me.uin });
    const mem = memOf('000777'); Brain.vinyl.bump(mem, 'tracks', id, i >= 0 ? -1 : 1); const t = Music.anyById(id); if (t && t.style) Brain.vinyl.bump(mem, 'styles', t.style, i >= 0 ? -0.5 : 0.5); saveMem('000777', mem);
    Snd.play('click');
    if (aux.kind === 'vinyl') renderAux();
  }
  function trackLogPush(id, entry) { mutate((d) => { d.trackLog = d.trackLog || {}; d.trackLog[id] = (d.trackLog[id] || []).concat([Object.assign({ ts: Date.now() }, entry)]).slice(-60); }); }
  function giftTrack(id, toUin) {
    const t = Music.anyById(id); if (!t || !toUin) return;
    const prevOwner = trackNft(id).owner;
    mutate((d) => { d.trackOwners = d.trackOwners || {}; d.trackOwners[id] = toUin; });
    trackLogPush(id, { kind: 'gift', who: me.uin, to: toUin, from: prevOwner });
    const msg = { id: uid(), from: me.uin, to: toUin, ts: Date.now(), kind: 'track', track: id, note: `Дарю НФТ трека «${t.title}» ${trackNft(id).serial}. Теперь он твой.`, text: '♪ ' + t.title };
    pushHistory(msg); post({ type: 'msg', msg }); post({ type: 'tracks' });
    addPoints(5, 'подарок НФТ'); Snd.play('tada'); toast(accountOf(toUin), 'НФТ трека подарен', null);
    const bot = BOTS[toUin]; if (bot && bot.persona) setTimeout(() => botSays(bot, bot.persona.id === 'aska' ? `НФТ «${t.title}»! Теперь это моя пластинка. Повесила на стену :)` : bot.persona.v(`«${t.title}» теперь мой? Спасибо! Ставлю на повтор`)), 3000);
    if (aux.kind === 'vinyl') renderAux();
  }
  function shareTrackLink(id) {
    const link = location.origin + location.pathname.replace(/[^/]*$/, '') + '?play=' + encodeURIComponent(id);
    const done = () => { Snd.play('click'); toast(me, 'ссылка на трек скопирована', null); };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => { window.prompt('Ссылка на трек:', link); });
    else window.prompt('Ссылка на трек:', link);
  }
  let vtab = 'hits', vpl = null, pendingPlay = null, pendingWatch = null;
  // проигрыватель: пластинка с бороздками и этикеткой, тонарм с противовесом и головкой, стробоскоп на диске
  function turntableSvg(t, skin) {
    const col = t ? t.color || '#7a3cff' : '#3cb44a';
    const label = skin === 'cyber' ? (t ? 'NFT ' + trackNft(t.id).serial : 'NFT') : (t ? t.title : 'АСЬКА');
    const words = String(label).split(/\s+/); const l1 = words.slice(0, 2).join(' '), l2 = words.slice(2, 4).join(' ');
    const grooves = []; for (let r = 28; r <= 60; r += 3.2) grooves.push(`<circle cx="84" cy="80" r="${r.toFixed(1)}" fill="none" stroke="var(--tt-groove)" stroke-width="${r % 2 ? 0.6 : 1.1}" opacity="${(0.35 + ((r * 7) % 5) / 10).toFixed(2)}"/>`);
    const strobe = []; for (let a = 0; a < 360; a += 8) { const rad = a * Math.PI / 180; strobe.push(`<circle cx="${(84 + 65 * Math.cos(rad)).toFixed(1)}" cy="${(80 + 65 * Math.sin(rad)).toFixed(1)}" r="0.9" fill="var(--tt-strobe)"/>`); }
    return `<svg class="ttsvg" viewBox="0 0 230 160" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><radialGradient id="ttsheen" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></radialGradient><filter id="ttshadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>
      <rect x="0" y="0" width="230" height="160" rx="6" fill="var(--tt-bg)"/>
      <rect x="4" y="4" width="222" height="152" rx="4" fill="none" stroke="var(--tt-edge)" stroke-width="1.5"/>
      <circle cx="84" cy="80" r="69" fill="var(--tt-platter)" stroke="var(--tt-edge)" stroke-width="2"/>
      <g class="tt-strobe">${strobe.join('')}</g>
      <g id="v-record" class="tt-record"><circle cx="84" cy="80" r="62" fill="var(--tt-record)"/>${grooves.join('')}
        <circle cx="84" cy="80" r="23" fill="${col}" stroke="var(--tt-labelring)" stroke-width="1.2"/>
        <text x="84" y="${l2 ? 78 : 82}" text-anchor="middle" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" font-size="${l1.length > 9 ? 5.2 : 6.5}" fill="var(--tt-labeltext)">${esc(l1.slice(0, 14))}</text>${l2 ? `<text x="84" y="86" text-anchor="middle" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" font-size="5.2" fill="var(--tt-labeltext)">${esc(l2.slice(0, 14))}</text>` : ''}
        <circle cx="84" cy="80" r="2.6" fill="#e8e8e8" stroke="#333" stroke-width=".6"/></g>
      <path d="M84 18 A62 62 0 0 1 146 80 L84 80 Z" fill="#fff" opacity=".05" pointer-events="none"/><path d="M84 142 A62 62 0 0 1 22 80 L84 80 Z" fill="#fff" opacity=".04" pointer-events="none"/>
      <circle cx="84" cy="80" r="62" fill="url(#ttsheen)" pointer-events="none"/>
      <g class="tt-armshadow" filter="url(#ttshadow)"><g class="tt-armsh-inner"><rect x="185" y="24" width="6" height="100" rx="3" fill="#000" opacity=".45"/><rect x="181" y="116" width="14" height="18" rx="2" fill="#000" opacity=".45"/></g></g>
      <g id="v-arm" class="tt-arm">
        <rect x="181" y="4" width="14" height="18" rx="2" fill="var(--tt-weight)" stroke="var(--tt-edge)" stroke-width="1"/>
        <rect x="185.5" y="22" width="5" height="100" rx="2.5" fill="var(--tt-arm)" stroke="var(--tt-edge)" stroke-width=".8"/>
        <rect x="181" y="116" width="14" height="18" rx="2" fill="var(--tt-head)" stroke="var(--tt-edge)" stroke-width="1"/>
        <line x1="186" y1="134" x2="183.5" y2="139" stroke="var(--tt-needle)" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="188" cy="26" r="10" fill="var(--tt-pivot)" stroke="var(--tt-edge)" stroke-width="1.2"/><circle cx="188" cy="26" r="4" fill="var(--tt-arm)"/>
      </g>
      <g class="tt-btns"><circle cx="24" cy="146" r="5" fill="var(--tt-btn)" stroke="var(--tt-edge)" stroke-width="1"/><circle cx="40" cy="146" r="5" fill="var(--tt-btn)" stroke="var(--tt-edge)" stroke-width="1"/><rect x="190" y="142" width="30" height="8" rx="2" fill="var(--tt-btn)" stroke="var(--tt-edge)" stroke-width="1"/></g>
      <text x="160" y="152" font-family="Tahoma,Verdana,sans-serif" font-size="6" fill="var(--tt-text)" opacity=".8">${skin === 'cyber' ? 'ASKA-2099' : 'АСЬКА · Hi-Fi 1999'}</text>
    </svg>`;
  }
  const ARM = { rest: -9, lead: 33, end: 50 };
  function armAngle() {
    const st = Music.state;
    if (!st.trackId && !st.jingle) return ARM.rest;
    if (st.jingle) return ARM.lead - 6;
    const prog = st.kind === 'audio' && st.dur ? st.pos / st.dur : st.kind === 'synth' ? ((st.loop * 16 + st.bar) / 32) : 0.35;
    return ARM.lead + Math.max(0, Math.min(1, prog)) * (ARM.end - ARM.lead);
  }
  function updateArm() {
    const arm = $('#v-arm'); if (!arm) return;
    const ang = armAngle().toFixed(2); const lifted = !Music.state.playing;
    arm.style.transform = `rotate(${ang}deg)`;
    const sh = $('.tt-armshadow'); if (sh) sh.style.transform = `translate(${lifted ? 7 : 3}px, ${lifted ? 9 : 4}px) rotate(${ang}deg)`;
    const tt = $('.tt'); if (tt) tt.classList.toggle('lifted', lifted);
  }
  function loadRadio() { Object.entries(db.radio || {}).forEach(([id, v]) => Music.setStream(id, v && v.stream)); }
  function streamDialog(id) {
    const st = Music.stationById(id); if (!st) return;
    const cur = (db.radio || {})[id] ? db.radio[id].stream || '' : '';
    dialog({ title: `${st.icon} ${st.name}: прямой эфир`, body: `<div class="hint">Станция играет из общей коллекции по стилю (${st.styles.map((x) => Music.STYLE_NAMES[x]).join(', ')}). Можно подключить настоящий поток: ссылку на mp3/aac-стрим любой радиостанции. Поток услышат все.</div><label class="row mt"><span class="lbl">Поток</span><input class="field" id="rs-url" placeholder="https://…/stream.mp3" value="${esc(cur)}"></label>`,
      buttons: [{ label: 'Сохранить', primary: true, onClick: (ov) => { const url = Sec.safeUrl($('#rs-url', ov).value); mutate((d) => { d.radio = d.radio || {}; d.radio[id] = { stream: url || null, by: me.uin, ts: Date.now() }; }); loadRadio(); post({ type: 'radio' }); Snd.play('click'); if (aux.kind === 'vinyl') renderAux(); } }, { label: 'Отмена' }] });
  }
  function renderVinyl() {
    const st = Music.state; const t = st.trackId ? Music.anyById(st.trackId) : null;
    const prof = myProfile(); const pls = prof.playlists; const favs = prof.favTracks || [];
    const skin = prof.vinylSkin || 'retro';
    const targets = [me].concat(contactsOf(me.uin).map(accountOf).filter((a) => a && !a.twinOf));
    const nft = t ? trackNft(t.id) : null;
    const station = st.radio ? Music.stationById(st.radio) : null;
    const row = (x) => { const np = st.trackId === x.id; const n = trackNft(x.id); const mineNft = n.owner === me.uin; return `<div class="trow ${np ? 'np' : ''}"><button class="btn icon" data-play="${x.id}" title="Слушать">${np && st.playing ? '❚❚' : '▶'}</button><span class="cv" data-trackpage="${esc(x.id)}" title="Страница трека">${coverSvg(x, 30)}</span><div class="ti"><b class="link" data-trackpage="${esc(x.id)}">${esc(x.title)}</b><div class="muted">${esc(x.artist)} · ${x.url ? esc(x.label || x.kind) + ' · добавил(а) ' + esc(nickOf(x.addedBy)) : x.year + ' · ' + Music.STYLE_NAMES[x.style]}</div><div class="muted">НФТ ${n.serial} · владелец ${esc(nickOf(n.owner))} · ценность ${trackValue(x.id)}⚡</div></div><button class="btn icon ${favs.includes(x.id) ? 'on' : ''}" data-fav="${x.id}" title="В избранное">♥</button><button class="btn icon" data-addpl="${x.id}" title="В плейлист">+</button>${mineNft ? `<button class="btn icon" data-gifttrack="${x.id}" title="Подарить НФТ">🎁</button>` : ''}</div>`; };
    const hits = Music.TRACKS.map(row).join('');
    const coll = Object.values(db.tracks || {}).sort((a, b) => b.ts - a.ts);
    const collList = `<div class="row" style="margin:3px 0"><button class="btn primary" id="v-addlink">＋ Добавить по ссылке</button><span class="hint">Яндекс Музыка · YouTube · SoundCloud · mp3</span></div>` + (coll.length ? coll.map(row).join('') : '<div class="empty-note">Коллекция пуста. Добавь первый трек по ссылке — все увидят, кто его принёс.</div>');
    const favList = favs.map((id) => Music.anyById(id)).filter(Boolean).map(row).join('') || '<div class="empty-note">Нажми ♥ у трека — он появится тут. Винилл учтёт это во вкусе.</div>';
    const cur = pls.find((p) => p.id === vpl);
    const plPanel = `<div class="row"><input class="field" id="pl-name" maxlength="30" placeholder="название плейлиста"><button class="btn" id="pl-new">Создать</button></div>
      ${pls.length ? pls.map((pl) => `<div class="prow ${pl.id === vpl ? 'np' : ''}" data-pl="${pl.id}"><button class="btn icon" data-playpl="${esc(pl.tracks.join(','))}" data-plname="${esc(pl.name)}" title="Слушать" ${pl.tracks.length ? '' : 'disabled'}>▶</button><div class="ti"><b>♪ ${esc(pl.name)}</b><div class="muted">${pl.tracks.length} тр.</div></div><button class="btn icon" data-pl-wall="${pl.id}" title="На стену" ${pl.tracks.length ? '' : 'disabled'}>▤</button><button class="btn icon" data-pl-chat="${pl.id}" title="В беседу" ${pl.tracks.length && active ? '' : 'disabled'}>✉</button><button class="btn icon" data-pl-del="${pl.id}" title="Удалить">×</button></div>`).join('') : '<div class="empty-note">Плейлистов пока нет. Придумай название и жми «Создать», потом «+» у треков.</div>'}
      ${cur ? `<div class="cgroup">${esc(cur.name)}: треки</div>${cur.tracks.length ? cur.tracks.map((id, i) => `<div class="trow"><span class="muted">${i + 1}.</span><div class="ti"><b class="link" data-trackpage="${esc(id)}">${esc(Music.anyById(id) ? Music.anyById(id).title : id)}</b></div><button class="btn icon" data-pl-rm="${i}" title="Убрать">×</button></div>`).join('') : '<div class="empty-note">Пусто. Добавь треки кнопкой «+».</div>'}` : ''}`;
    const radioPanel = `<div class="hint">Три станции из общей коллекции: у каждой свой стиль, джингл и ведущий. Можно подключить настоящий поток.</div>` + Music.STATIONS.map((r) => { const on = st.radio === r.id; const stream = (db.radio || {})[r.id] && db.radio[r.id].stream; return `<div class="station ${on ? 'on' : ''}" style="--c1:${r.color};--c2:${r.color2}"><div class="st-dial"><span class="st-ico">${r.icon}</span></div><div class="ti"><b>${esc(r.name)}</b><div class="st-slogan">${esc(r.slogan)}</div><div class="muted">${r.styles.map((x) => Music.STYLE_NAMES[x]).join(' · ')}${stream ? ' · прямой эфир' : ''}</div>${on ? `<div class="onair">● В ЭФИРЕ${st.jingle ? ': джингл' : t ? ': ' + esc(t.title) : ''}</div>` : ''}</div><button class="btn ${on ? '' : 'primary'}" data-radio="${r.id}">${on && st.playing ? '❚❚' : '▶ Слушать'}</button><button class="btn icon" data-stream="${r.id}" title="Подключить поток">⚙</button></div>`; }).join('');
    const prog = t ? (st.kind === 'audio' && st.dur ? st.pos / st.dur : st.kind === 'synth' ? ((st.loop * 16 + st.bar) / 32) : 0) : 0;
    const timeTxt = t ? (st.kind === 'audio' ? `${fmtSec(st.pos)} / ${fmtSec(st.dur)}` : st.kind === 'synth' ? `такт ${st.bar + 1}/16 · круг ${st.loop + 1}/2` : st.kind === 'embed' ? 'играет во встроенном плеере' : 'ссылка') : (st.jingle ? '📻 настройка на волну…' : '');
    return `<div class="vinyl ${skin}">
      <div class="row v-top"><span class="hint">${skin === 'cyber' ? 'КИБЕР-ВИНИЛ: пластинка крутит НФТ' : 'Ретро-винил'}</span><span class="sp"></span><button class="btn" id="v-skin" title="Сменить дизайн">${skin === 'cyber' ? '📼 ретро' : '⚡ киберпанк'}</button></div>
      <div class="tt ${st.playing ? '' : 'lifted'}">${turntableSvg(st.jingle && station ? { title: station.name, color: station.color, id: 'radio' } : t, skin)}${skin === 'cyber' ? '<div class="neon-grid"></div>' : ''}</div>
      ${t && st.kind === 'embed' && st.embed ? `<div class="embed-box"><iframe sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox" referrerpolicy="strict-origin-when-cross-origin" src="${esc(st.embed)}" style="height:${st.embedH || 180}px" allow="autoplay; clipboard-write; encrypted-media" allowfullscreen loading="lazy"></iframe></div>` : ''}
      ${t && st.kind === 'link' ? `<div class="hint">Эта ссылка не встраивается: <a href="${esc(Sec.safeUrl(t.url))}" target="_blank" rel="noopener noreferrer">открыть в новой вкладке</a></div>` : ''}
      ${st.error ? `<div class="err">${esc(st.error)}</div>` : ''}
      <div class="np-box inset ${station ? 'radio' : ''}" ${station ? `style="--c1:${station.color};--c2:${station.color2}"` : ''}>${station ? `<div class="onair-line">📻 ${esc(station.name)} · <span id="v-onair">${esc(st.onAir || station.slogan)}</span></div>` : ''}<div class="row">${t ? `<span class="cv" data-trackpage="${esc(t.id)}">${coverSvg(t, 36)}</span>` : ''}<div class="sp"><b id="v-title">${t ? `<span class="link" data-trackpage="${esc(t.id)}">${esc(t.title)}</span>` : st.jingle ? 'Джингл станции' : 'Поставь пластинку'}</b><div class="muted" id="v-sub">${t ? esc(t.artist) + ' · ' + (t.url ? esc(t.label || t.kind) : t.year + ' · ' + Music.STYLE_NAMES[t.style]) : '12 хитов, коллекция по ссылкам и три радиостанции'}</div>${t ? `<div class="muted">НФТ ${esc(nft.serial)} · владелец ${esc(nickOf(nft.owner))} · ценность ${trackValue(t.id)}⚡</div>` : ''}</div>${t ? `<button class="btn icon ${favs.includes(t.id) ? 'on' : ''}" data-fav="${t.id}" title="В избранное">♥</button>` : ''}</div><div class="prog" id="v-prog" title="${st.kind === 'audio' ? 'Перемотать' : ''}"><i style="width:${Math.round(prog * 100)}%"></i></div><div class="hint" id="v-pos">${timeTxt || 'Друзья увидят, что ты слушаешь'}${st.queueName && !station ? ' · ' + esc(st.queueName) : ''}</div></div>
      <div class="row v-ctrl"><button class="btn" id="v-prev" title="Предыдущий">⏮</button><button class="btn primary" id="v-toggle" title="Играть / пауза">${st.playing ? '❚❚' : '▶'}</button><button class="btn" id="v-next" title="Следующий">⏭</button><button class="btn icon ${st.shuffle ? 'down' : ''}" id="v-shuffle" title="Случайный порядок">⤮</button><button class="btn icon ${st.repeat ? 'down' : ''}" id="v-repeat" title="Повтор">⟲</button><input type="range" id="v-vol" min="0" max="100" value="${Math.round(Music.volume * 100)}" title="Громкость"><label class="row" title="Шипение пластинки"><input type="checkbox" id="v-crackle" ${Music.crackle ? 'checked' : ''}> шип</label></div>
      <div class="row v-share"><span class="hint">Поделиться:</span><button class="btn" id="v-tochat" ${t && active ? '' : 'disabled'} title="${active ? 'Отправить в открытую беседу' : 'Сначала открой беседу'}">✉ в беседу</button><button class="btn" id="v-towall" ${t ? '' : 'disabled'}>▤ на стену</button><select class="field" id="v-wallto">${targets.map((a) => `<option value="${a.uin}">${a.uin === me.uin ? 'мою' : esc(a.nick)}</option>`).join('')}</select><button class="btn" id="v-link" ${t ? '' : 'disabled'} title="Скопировать ссылку на трек">🔗</button></div>
      <div class="tabs v-tabs"><button class="${vtab === 'hits' ? 'on' : ''}" data-vt="hits">Хиты</button><button class="${vtab === 'coll' ? 'on' : ''}" data-vt="coll">Коллекция${coll.length ? ' (' + coll.length + ')' : ''}</button><button class="${vtab === 'fav' ? 'on' : ''}" data-vt="fav">♥${favs.length ? ' ' + favs.length : ''}</button><button class="${vtab === 'pl' ? 'on' : ''}" data-vt="pl">Плейлисты${pls.length ? ' (' + pls.length + ')' : ''}</button><button class="${vtab === 'radio' ? 'on' : ''}" data-vt="radio">📻 Радио</button></div>
      <div class="tabpanel v-list">${vtab === 'hits' ? hits : vtab === 'coll' ? collList : vtab === 'fav' ? favList : vtab === 'radio' ? radioPanel : plPanel}</div>
      <div class="hint">Нажми на обложку или название — откроется страница трека: история, НФТ-паспорт, стена. Консультант <b class="link" data-chat="000777">Винилл</b> подберёт трек: напиши ему «посоветуй».</div>
    </div>`;
  }
  /* ================= страница трека: история, НФТ-паспорт, стена ================= */
  const TRACK_STORY = {
    dialup: 'Записана в 1999-м на кухне под звук модема: Катя ждала, пока догрузится страница, и напела первый куплет. «Модемы» — это Вова и его старый US Robotics на бэк-вокале.',
    summer99: 'Серёга свёл этот трек за одну ночь перед дискотекой в универе. Диск пошёл по рукам, кассета — по общагам. Говорят, с него началось лето 1999-го.',
    cassette: 'Ленка записала её на диктофон в Питере, в дождь, с одного дубля. Потом переписывала на кассеты и раздавала друзьям вместо открыток.',
    pager: 'Макс написал её за вечер, когда пейджер молчал третий день. Лаунж с одной мыслью: тишина — тоже сообщение.',
    disco99: 'Гимн дискотеки в актовом зале. Серёга клянётся, что бас там настоящий, а не из «Юпитера». Проверить уже нельзя.',
    sevens: 'Счастливый номер 777777 и три семёрки в припеве. Серёга считает трек талисманом и ставит его перед каждым сейшном.',
    bsod: 'Вова собрал мелодию на спектруме между двумя синими экранами. Чиптюн, который, как он говорит, «не падает».',
    karas: 'Батя привёз эту мелодию с рыбалки: насвистывал у костра, Серёга подобрал аккорды. Про карася, который был вот такой.',
    uhoh: 'Ремикс на фирменное «о-оу!» АСЬКИ. Аська записала его сама, из своих же звуков, и очень гордится.',
    cookies: 'Чайная баллада Аськи про печеньки, которые закончились. Записана между вопросом «когда звонил родным?» и ответом.',
    lisboa: 'Аська и Макс мечтали о Лиссабоне, не выезжая из Урюпинска. Получился лаунж для тех, кто ещё не улетел.',
    flower: 'Про цветочек-статус, который меняет цвет. Ленкины слова, Аськина мелодия. Самая короткая песня в коллекции.',
  };
  function trackStats(id) {
    let plays = 0, likes = 0, inPl = 0;
    Object.values(db.profile || {}).forEach((p) => { plays += (p.plays || {})[id] || 0; if ((p.favTracks || []).includes(id)) likes++; (p.playlists || []).forEach((pl) => { if (pl.tracks.includes(id)) inPl++; }); });
    const t = Music.anyById(id); if (t && t.likes) likes += t.likes.length;
    const comments = (db.wall['trk_' + id] || []).length;
    return { plays, likes, inPl, comments };
  }
  function trackValue(id) {
    const s = trackStats(id); const t = Music.anyById(id); if (!t) return 0;
    const log = (db.trackLog || {})[id] || [];
    return s.plays + s.likes * 5 + s.inPl * 3 + s.comments * 2 + log.filter((e) => e.kind === 'gift').length * 8 + (t.url ? 10 : 4);
  }
  function ensureTrackLog(id) {
    const t = Music.anyById(id); if (!t) return;
    const log = (db.trackLog || {})[id] || [];
    if (!log.some((e) => e.kind === 'mint')) trackLogPush(id, { kind: 'mint', who: trackNft(id).owner, ts: t.url ? t.ts || Date.now() : new Date(t.year || 1999, 5, 1).getTime(), note: t.url ? t.label : 'оригинальная запись' });
    if (!db.wall['trk_' + id]) {
      const artist = t.by ? Object.values(BOTS).find((b) => b.brain === t.by) : null;
      const seeds = [];
      if (artist) seeds.push({ id: uid(), from: artist.uin, ts: Date.now() - 36e5 * 30, likes: [], kind: 'text', text: artist.persona.v(pick(['Это моя запись. Если где-то фальшивит — так и задумано.', 'Писал(а) от души. Слушайте громче.', 'Первый комментарий — мой, по праву автора :)'])) });
      seeds.push({ id: uid(), from: '000777', ts: Date.now() - 36e5 * 20, likes: [], kind: 'text', text: t.url ? `Добавлен по ссылке (${t.label || t.kind}). Оценим вместе: пишите, под какое настроение заходит.` : `${Music.STYLE_NAMES[t.style]} ${t.year} года. ${t.style === 'lounge' || t.style === 'ballad' ? 'Для вечера и тишины.' : 'Для громкости и окон нараспашку.'} Винилл одобряет.` });
      mutate((d) => { d.wall['trk_' + id] = seeds; });
    }
  }
  function renderTrackPage(id) {
    const t = Music.anyById(id); if (!t) return '<div class="empty-note">Трек не найден.</div>';
    ensureTrackLog(id);
    const st = Music.state; const np = st.trackId === id; const nft = trackNft(id); const stats = trackStats(id); const favs = myProfile().favTracks || [];
    const log = ((db.trackLog || {})[id] || []).slice().sort((a, b) => a.ts - b.ts);
    const posts = wallOf('trk_' + id);
    const who = (u) => esc(nickOf(u));
    const logLine = (e) => e.kind === 'mint' ? `${fmtDay(e.ts)} — выпущен НФТ, владелец ${who(e.who)}${e.note ? ' · ' + esc(e.note) : ''}` : e.kind === 'gift' ? `${fmtDay(e.ts)} — ${who(e.who)} подарил(а) НФТ → ${who(e.to)}` : e.kind === 'like' ? `${fmtDay(e.ts)} — ♥ от ${who(e.who)}` : `${fmtDay(e.ts)} — ${esc(e.kind)}`;
    const story = t.url ? `Добавлен в сеть ${fmtDay(t.ts || Date.now())}: ${who(t.addedBy)} принёс(ла) ссылку (${esc(t.label || t.kind)}). ${t.story ? esc(t.story) : 'Историю трека может дописать тот, кто его добавил.'}` : TRACK_STORY[id] || 'История пока не записана.';
    return `<div class="trackpage">
      <div class="tp-head"><span class="cv big">${coverSvg(t, 96)}</span><div class="tp-info"><b class="tp-title">${esc(t.title)}</b><div>${t.by && Object.values(BOTS).find((b) => b.brain === t.by) ? `<span class="link" data-wall="${Object.values(BOTS).find((b) => b.brain === t.by).uin}">${esc(t.artist)}</span>` : esc(t.artist)}</div><div class="muted">${t.url ? esc(t.label || t.kind) : t.year + ' · ' + Music.STYLE_NAMES[t.style]}${t.bpm ? ' · ' + t.bpm + ' bpm' : ''}</div>
        <div class="row tp-actions"><button class="btn primary" data-play="${esc(id)}">${np && st.playing ? '❚❚ Пауза' : '▶ Слушать'}</button><button class="btn icon ${favs.includes(id) ? 'on' : ''}" data-fav="${esc(id)}" title="В избранное">♥</button><button class="btn icon" data-addpl="${esc(id)}" title="В плейлист">+</button><button class="btn" id="tp-chat" ${active ? '' : 'disabled'} title="В открытую беседу">✉</button><button class="btn" id="tp-wall" title="На мою стену">▤</button><button class="btn" id="tp-link" title="Ссылка">🔗</button>${nft.owner === me.uin ? `<button class="btn" data-gifttrack="${esc(id)}">🎁 Подарить НФТ</button>` : ''}</div></div></div>
      <div class="nftpass"><div class="np-row"><span class="np-k">НФТ-паспорт</span><b class="mono">${esc(nft.serial)}</b></div><div class="np-row"><span class="np-k">Владелец</span><b class="link" data-wall="${esc(nft.owner)}">${who(nft.owner)}</b></div><div class="np-row"><span class="np-k">Добавил(а)</span><span>${who(nft.addedBy)}</span></div><div class="np-row"><span class="np-k">Ценность</span><b>${trackValue(id)} ⚡</b> <span class="muted">= прослушивания + 5×♥ + 3×плейлисты + 2×записи + 8×подарки</span></div><div class="np-row"><span class="np-k">Статистика</span><span>▶ ${stats.plays} · ♥ ${stats.likes} · в плейлистах ${stats.inPl} · записей ${stats.comments}</span></div></div>
      <div class="legend-line">История</div><div class="tp-story">${story}</div>
      ${t.url && t.addedBy === me.uin ? `<div class="row"><input class="field sp" id="tp-story" maxlength="240" placeholder="дописать историю трека" value="${esc(t.story || '')}"><button class="btn" id="tp-storysave">Сохранить</button></div>` : ''}
      <div class="legend-line">Цепочка владения</div><div class="tp-log">${log.length ? log.map((e) => `<div class="tp-logline">${logLine(e)}</div>`).join('') : '<div class="muted">пусто</div>'}</div>
      <div class="legend-line">Стена трека (${posts.length})</div>
      <div class="composer inset"><div class="row"><input class="field sp" id="tp-text" maxlength="240" placeholder="что думаешь об этом треке? Enter — отправить"><button class="btn primary" id="tp-send">Написать</button></div></div>
      <div id="w-posts">${posts.length ? posts.map((p) => renderPost(p, 'trk_' + id)).join('') : '<div class="empty-note">Пока никто не написал. Будь первым.</div>'}</div>
    </div>`;
  }
  function wireTrackPage(id) {
    const t = Music.anyById(id); if (!t) return;
    const send = () => { const inp = $('#tp-text'); const v = inp.value.trim(); if (!v) return; const p = { id: uid(), from: me.uin, ts: Date.now(), likes: [], kind: 'text', text: v }; addPost('trk_' + id, p); post({ type: 'wall', uin: 'trk_' + id, from: me.uin }); addPoints(2, 'запись о треке'); Snd.play('sent'); setTimeout(() => trackWallReply(id, p), 2500 + Math.random() * 3000); renderAux(); };
    $('#tp-send').onclick = send; $('#tp-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    $('#tp-wall').onclick = () => { postWall(me.uin, { kind: 'track', track: id }); toast(me, 'трек на стене', null); };
    $('#tp-link').onclick = () => shareTrackLink(id);
    const tc = $('#tp-chat'); if (tc) tc.onclick = () => { if (!active) return; sendSpecial(active, { kind: 'track', track: id, text: '♪ ' + t.title }); toast(accountOf(active), 'трек отправлен', null); };
    const ss = $('#tp-storysave'); if (ss) ss.onclick = () => { const v = $('#tp-story').value.trim(); mutate((d) => { if (d.tracks[id]) d.tracks[id].story = v; }); Music.registerExternal(db.tracks[id]); post({ type: 'tracks' }); Snd.play('click'); renderAux(); };
    $$('[data-gifttrack]').forEach((b) => (b.onclick = () => { const friends = contactsOf(me.uin).map(accountOf).filter((a) => a && !a.twinOf); dialog({ title: '🎁 Подарить НФТ трека', body: `<div class="hint">Владелец НФТ сменится, трек останется в коллекции, подарок попадёт в цепочку владения.</div><div class="row mt"><span class="lbl">Кому</span><select class="field" id="gt-to">${friends.map((a) => `<option value="${a.uin}">${esc(a.nick)}</option>`).join('')}</select></div>`, buttons: [{ label: 'Подарить', primary: true, onClick: (ov) => { giftTrack(id, $('#gt-to', ov).value); renderAux(); } }, { label: 'Отмена' }] }); }));
    $$('[data-addpl]').forEach((b) => (b.onclick = () => addToPlaylist(b.dataset.addpl)));
    $$('[data-fav]').forEach((b) => (b.onclick = () => { toggleFav(b.dataset.fav); renderAux(); }));
  }
  function trackWallReply(id, p) {
    if (!me) return;
    const t = Music.anyById(id); if (!t) return;
    const artist = t.by ? Object.values(BOTS).find((b) => b.brain === t.by) : null;
    const bot = artist && Math.random() < 0.6 ? artist : BOTS['000777'];
    const P = bot.persona;
    const lines = bot.uin === '000777' ? ['Записал мнение в заметки о тебе. Вкус формируется :)', 'Согласен. Ставлю этот трек в твою ротацию чуть чаще.', 'Хорошее слово о треке — это плюс к его ценности. Так и считаем.'] : ['Спасибо! Автору приятно, когда пишут.', 'Вот это отзыв! Запишу следующий ещё лучше.', 'Читаю и улыбаюсь. Слушай громче :)'];
    addReply('trk_' + id, p.id, { id: uid(), from: bot.uin, ts: Date.now(), text: bot.uin === '000777' ? pick(lines) : P.v(pick(lines)) });
    toast(bot, 'ответил(а) на стене трека', null); Snd.play('click');
    if (aux.kind === 'track' && aux.arg === id) renderAux();
  }

  /* ================= люди: знакомства по интересам, досье ================= */
  let peopleTab = 'meet', meetIdx = 0, meetOrder = null;
  function peoplePool() { return allKnown().filter((a) => a.uin !== me.uin && !a.twinOf && !(BOTS[a.uin] && !BOTS[a.uin].persona)); }
  function personCity(uin) { const b = BOTS[uin]; if (b && b.persona && b.persona.city) return b.persona.city; const mem = (db.memory[uin] || {})['000001']; return mem && mem.city ? mem.city : (b && b.persona ? { aska: 'Урюпинск', kat: 'Москва', vova: 'Томск', serega: 'Урюпинск', lena: 'Петербург', batya: 'дача', max: 'Петербург', vinyl: 'в проигрывателе' }[b.brain] || '' : ''); }
  function renderPeople() {
    const mine = contactsOf(me.uin);
    const pool = peoplePool();
    const scored = pool.map((a) => ({ a, pct: matchPct(me.uin, a.uin), common: commonInterests(me.uin, a.uin), known: mine.includes(a.uin) })).sort((x, y) => (x.known - y.known) || ((y.pct || 0) - (x.pct || 0)));
    const card = (x, big) => { const d = buildDossier(x.a.uin); const p = profileOf(x.a.uin); return `<div class="pcard ${big ? 'big' : ''}" data-uin="${esc(x.a.uin)}">
        <div class="pc-head"><span class="ico">${avatarSvg(x.a.uin, big ? 44 : 28)}</span><div class="who"><b class="link" data-wall="${esc(x.a.uin)}">${esc(x.a.nick)}</b> <span class="muted">#${esc(x.a.uin)}</span><div class="hint">${esc(personCity(x.a.uin))}${personCity(x.a.uin) ? ' · ' : ''}${esc(xstatusOf(x.a.uin) || statusInfo(statusOf(x.a.uin)).label)}${x.known ? ' · уже в контактах' : ''}</div></div><div class="pct ${x.pct == null ? '' : x.pct >= 50 ? 'hi' : x.pct > 0 ? 'mid' : ''}" title="совпадение интересов">${x.pct == null ? '—' : x.pct + '%'}</div></div>
        <div class="chips small">${p.interests.map((i) => `<span class="chip ${x.common.includes(i) ? 'on' : ''}" data-interest="${esc(i)}">${esc(i)}</span>`).join('') || '<span class="muted">интересы не указаны</span>'}</div>
        <div class="pc-dossier"><div class="muted">Досье от Аськи:</div><div>${esc(d.avatar[0] || '')}</div>${big ? `<div>${esc(d.likes[0] || '')}</div><div class="pc-verdict">${esc(d.verdict)}</div>` : `<div class="pc-verdict">${esc(d.verdict)}</div>`}</div>
        <div class="row pc-actions"><button class="btn primary" data-meet="${esc(x.a.uin)}">${x.known ? '✉ Написать' : '☺ Познакомиться'}</button><button class="btn" data-dossier="${esc(x.a.uin)}">Досье</button><button class="btn" data-wall="${esc(x.a.uin)}">Стена</button></div></div>`; };
    let panel = '';
    if (peopleTab === 'meet') {
      const cands = scored.filter((x) => !x.known); const list = cands.length ? cands : scored;
      if (!meetOrder || meetOrder.length !== list.length) { meetOrder = list.map((_, i) => i).sort(() => Math.random() - 0.5); meetIdx = 0; }
      const x = list[meetOrder[meetIdx % meetOrder.length]];
      panel = x ? `<div class="hint">Аська подбирает случайного человека, с которым ты ещё не знаком. Совпадение считается по интересам из профиля${myProfile().interests.length ? '' : ' — укажи свои в профиле, чтобы проценты заработали'}.</div>${card(x, true)}<div class="row mt"><button class="btn" id="pp-next">🎲 Следующий</button><span class="hint">${cands.length} ${pluralRu(cands.length, 'незнакомый человек', 'незнакомых человека', 'незнакомых людей')} в сети АСЬКИ</span></div>` : '<div class="empty-note">Людей пока нет.</div>';
    } else if (peopleTab === 'match') {
      const list = scored.filter((x) => x.pct != null).sort((x, y) => (y.pct || 0) - (x.pct || 0));
      panel = `<div class="hint">По совпадению интересов: кто ближе всего к тебе.</div>` + (list.length ? list.map((x) => card(x, false)).join('') : '<div class="empty-note">Укажи интересы в профиле — и список заполнится.</div>');
    } else panel = `<div class="hint">Все люди в сети АСЬКИ с досье от Аськи. Нажми на имя — стена, «Досье» — полный разбор.</div>` + scored.map((x) => card(x, false)).join('');
    return `<div class="people">
      <div class="tabs pp-tabs"><button class="${peopleTab === 'meet' ? 'on' : ''}" data-pt="meet">🎲 Знакомство</button><button class="${peopleTab === 'match' ? 'on' : ''}" data-pt="match">По интересам</button><button class="${peopleTab === 'all' ? 'on' : ''}" data-pt="all">Все (${scored.length})</button></div>
      <div class="tabpanel v-list">${panel}</div></div>`;
  }
  function wirePeople() {
    $$('.pp-tabs button').forEach((b) => (b.onclick = () => { peopleTab = b.dataset.pt; Snd.play('click'); renderAux(); }));
    const nx = $('#pp-next'); if (nx) nx.onclick = () => { meetIdx++; Snd.play('knock'); renderAux(); };
    $$('[data-meet]').forEach((b) => (b.onclick = () => { const u = b.dataset.meet; const known = contactsOf(me.uin).includes(u); const common = commonInterests(me.uin, u); const pct = matchPct(me.uin, u); if (!known) { addContact(u); Snd.play('tada'); toast(accountOf(u), 'теперь в контактах', null); } openChat(u); const ta = $('#compose'); if (ta && !ta.value && !known) ta.value = common.length ? `Привет! Аська говорит, у нас ${pct}% совпадения: ${common.join(', ')}. Это правда?` : 'Привет! Аська нас познакомила. Расскажи о себе?'; }));
    $$('[data-dossier]').forEach((b) => (b.onclick = () => openAux('dossier', b.dataset.dossier)));
  }
  const fmtSec = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + pad(s % 60); };
  function wireVinyl() {
    $('#v-toggle').onclick = () => Music.toggle();
    $('#v-prev').onclick = () => Music.prev();
    $('#v-next').onclick = () => Music.next();
    $('#v-shuffle').onclick = () => { Music.shuffle = !Music.state.shuffle; renderAux(); };
    $('#v-repeat').onclick = () => { Music.repeat = !Music.state.repeat; renderAux(); };
    $('#v-vol').oninput = (e) => { Music.volume = e.target.value / 100; };
    $('#v-crackle').onchange = (e) => { Music.crackle = e.target.checked; };
    $('#v-skin').onclick = () => { saveProfile({ vinylSkin: (myProfile().vinylSkin || 'retro') === 'cyber' ? 'retro' : 'cyber' }); Snd.play('tada'); renderAux(); };
    $('#v-prog').onclick = (e) => { if (Music.state.kind !== 'audio' || !Music.state.dur) return; const r = e.currentTarget.getBoundingClientRect(); Music.seek(((e.clientX - r.left) / r.width) * Music.state.dur); };
    $$('.v-tabs button').forEach((b) => (b.onclick = () => { vtab = b.dataset.vt; Snd.play('click'); renderAux(); }));
    $('#v-tochat').onclick = () => { if (Music.state.trackId && active) { sendSpecial(active, { kind: 'track', track: Music.state.trackId, text: '♪ ' + Music.anyById(Music.state.trackId).title }); toast(accountOf(active), 'трек отправлен в беседу', null); } };
    $('#v-towall').onclick = () => { const to = $('#v-wallto').value; if (Music.state.trackId) { postWall(to, { kind: 'track', track: Music.state.trackId }); toast(accountOf(to), 'трек на стене', null); } };
    $('#v-link').onclick = () => { if (Music.state.trackId) shareTrackLink(Music.state.trackId); };
    const al = $('#v-addlink'); if (al) al.onclick = addLinkDialog;
    $$('[data-addpl]').forEach((b) => (b.onclick = () => addToPlaylist(b.dataset.addpl)));
    $$('[data-stream]').forEach((b) => (b.onclick = () => streamDialog(b.dataset.stream)));
    $$('[data-fav]').forEach((b) => (b.onclick = () => toggleFav(b.dataset.fav)));
    setTimeout(updateArm, 30);
    $$('[data-gifttrack]').forEach((b) => (b.onclick = () => { const id = b.dataset.gifttrack; const friends = contactsOf(me.uin).map(accountOf).filter((a) => a && !a.twinOf); dialog({ title: '🎁 Подарить НФТ трека', body: `<div class="hint">Владелец НФТ сменится, трек останется в коллекции.</div><div class="row mt"><span class="lbl">Кому</span><select class="field" id="gt-to">${friends.map((a) => `<option value="${a.uin}">${esc(a.nick)}</option>`).join('')}</select></div>`, buttons: [{ label: 'Подарить', primary: true, onClick: (ov) => giftTrack(id, $('#gt-to', ov).value) }, { label: 'Отмена' }] }); }));
    const plNew = $('#pl-new');
    if (plNew) {
      const create = () => { const name = $('#pl-name').value.trim(); if (!name) return; const pls = myProfile().playlists.slice(); const pl = { id: uid(), name, tracks: [] }; pls.push(pl); saveProfile({ playlists: pls }); vpl = pl.id; Snd.play('click'); renderAux(); };
      plNew.onclick = create;
      $('#pl-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
      $$('.prow').forEach((r) => (r.onclick = (e) => { if (e.target.closest('button')) return; vpl = r.dataset.pl; renderAux(); }));
      $$('[data-pl-del]').forEach((b) => (b.onclick = () => confirmBox('Плейлист', 'Удалить плейлист?', () => { saveProfile({ playlists: myProfile().playlists.filter((p) => p.id !== b.dataset.plDel) }); if (vpl === b.dataset.plDel) vpl = null; renderAux(); })));
      $$('[data-pl-rm]').forEach((b) => (b.onclick = () => { const pls = myProfile().playlists.map((p) => (p.id === vpl ? Object.assign({}, p, { tracks: p.tracks.filter((_, i) => i !== +b.dataset.plRm) }) : p)); saveProfile({ playlists: pls }); renderAux(); }));
      $$('[data-pl-wall]').forEach((b) => (b.onclick = () => { const pl = myProfile().playlists.find((p) => p.id === b.dataset.plWall); const to = $('#v-wallto').value; postWall(to, { kind: 'playlist', playlist: { id: pl.id, name: pl.name, tracks: pl.tracks.slice() } }); toast(accountOf(to), 'плейлист на стене', null); }));
      $$('[data-pl-chat]').forEach((b) => (b.onclick = () => { const pl = myProfile().playlists.find((p) => p.id === b.dataset.plChat); if (!active) return; sendSpecial(active, { kind: 'playlist', playlist: { id: pl.id, name: pl.name, tracks: pl.tracks.slice() }, text: '♪ плейлист «' + pl.name + '»' }); toast(accountOf(active), 'плейлист отправлен', null); }));
    }
    startMotor();
  }
  // мотор: пластинка раскручивается и останавливается по-настоящему
  let motorAngle = 0, motorSpeed = 0, motorRaf = null, motorLast = 0;
  function startMotor() {
    if (motorRaf) return;
    motorLast = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - motorLast) / 1000); motorLast = now;
      const target = Music.state.motor ? 200 : 0; // 33⅓ об/мин ≈ 200°/с
      const k = Music.state.motor ? 2.2 : 1.1;
      motorSpeed += (target - motorSpeed) * Math.min(1, k * dt);
      if (!Music.state.motor && motorSpeed < 0.5) motorSpeed = 0;
      motorAngle = (motorAngle + motorSpeed * dt) % 360;
      const rec = $('#v-record');
      if (rec) rec.style.transform = `rotate(${motorAngle}deg)`;
      if (rec && Math.floor(now / 250) !== Math.floor((now - dt * 1000) / 250)) updateArm();
      if (rec && (motorSpeed > 0 || Music.state.motor)) motorRaf = requestAnimationFrame(step); else motorRaf = null;
    };
    motorRaf = requestAnimationFrame(step);
  }
  function addToPlaylist(trackId) {
    const pls = myProfile().playlists.slice();
    const doAdd = (pl) => { if (!pl.tracks.includes(trackId)) pl.tracks.push(trackId); saveProfile({ playlists: pls }); vpl = pl.id; Snd.play('click'); toast(me, `«${Music.anyById(trackId).title}» → ${pl.name}`, null); if (aux.kind === 'vinyl') renderAux(); };
    if (!pls.length) { const pl = { id: uid(), name: 'Мой плейлист', tracks: [] }; pls.push(pl); doAdd(pl); return; }
    if (pls.length === 1) { doAdd(pls[0]); return; }
    dialog({ title: 'В какой плейлист?', body: `<div class="status-list">${pls.map((pl) => `<button data-pl="${pl.id}">♪ ${esc(pl.name)} <span class="muted">(${pl.tracks.length})</span></button>`).join('')}<button data-pl="__new">+ новый плейлист</button></div>`, buttons: [{ label: 'Отмена' }], onOpen: (ov) => $$('[data-pl]', ov).forEach((b) => (b.onclick = () => { ov.remove(); if (b.dataset.pl === '__new') { const pl = { id: uid(), name: 'Плейлист ' + (pls.length + 1), tracks: [] }; pls.push(pl); doAdd(pl); } else doAdd(pls.find((p) => p.id === b.dataset.pl)); })) });
  }
  function updateNowPlaying() {
    const cell = $('#sb-np'); if (!cell) return;
    const st = Music.state; const t = st.trackId ? Music.anyById(st.trackId) : null;
    cell.hidden = !t;
    if (t) cell.innerHTML = `${st.playing ? '♪' : '❚❚'} ${esc(t.title)}`;
  }
  let lastMusicTrack = null, lastJingle = false;
  Music.onChange((st) => {
    updateNowPlaying();
    if (st.trackId && st.trackId !== lastMusicTrack && st.playing && me) {
      const plays = Object.assign({}, myProfile().plays || {}); plays[st.trackId] = (plays[st.trackId] || 0) + 1; saveProfile({ plays });
      const t = Music.anyById(st.trackId); if (t && t.style) { const mem = memOf('000777'); Brain.vinyl.bump(mem, 'styles', t.style, 0.3); saveMem('000777', mem); }
    }
    if (aux.kind === 'vinyl') {
      startMotor(); updateArm();
      const oa = $('#v-onair'); if (oa && st.onAir) oa.textContent = st.onAir;
      if (st.jingle !== lastJingle) { lastJingle = st.jingle; renderAux(); return; }
      const tg = $('#v-toggle'); if (tg) tg.textContent = st.playing ? '❚❚' : '▶';
      const pos = $('#v-pos'); const pr = $('#v-prog i');
      if (pos && st.trackId) { pos.textContent = st.kind === 'audio' ? `${fmtSec(st.pos)} / ${fmtSec(st.dur)}` : st.kind === 'synth' ? `такт ${st.bar + 1}/16 · круг ${st.loop + 1}/2${st.queueName ? ' · ' + st.queueName : ''}` : pos.textContent; }
      if (pr && st.trackId) pr.style.width = Math.round((st.kind === 'audio' && st.dur ? st.pos / st.dur : st.kind === 'synth' ? (st.loop * 16 + st.bar) / 32 : 0) * 100) + '%';
      if (st.trackId !== lastMusicTrack) renderAux();
    }
    if (st.trackId !== lastMusicTrack || !st.playing) {
      $$('.trackcard').forEach((c) => c.classList.toggle('np', c.dataset.track === st.trackId && st.playing));
      $$('.trackcard [data-play]').forEach((b) => (b.textContent = b.dataset.play === st.trackId && st.playing ? '❚❚' : '▶'));
      if (me) { mutate((d) => { d.presence[me.uin] = { status: myStatus, xstatus: myXstatus(), ts: Date.now() }; }); post({ type: 'presence', uin: me.uin }); }
    }
    lastMusicTrack = st.trackId;
  });


  /* ================= уровни, аватары, статусы ================= */
  const TIER = {
    basic: { label: 'Обычная', badge: '', ring: null, rank: 0, perks: 'Обычная АСЬКА: всё, что нужно, и ничего лишнего.' },
    gold: { label: 'Gold', badge: '★ Gold', ring: '#e8b300', rank: 1, min: 60, perks: 'Gold: золотой цветочек, статусы «на яхте», «считаю деньги», «в VIP-ложе», Аська отвечает честнее.' },
    black: { label: 'Black', badge: '◆ Black', ring: '#111111', rank: 2, min: 200, perks: 'Black: чёрный цветочек, статусы «в тени» и «на орбите», магнит с Луны, Аська говорит «вы». Иногда.' },
  };
  const tierRank = (k) => (TIER[k] || TIER.basic).rank;
  function tierOf(uin) {
    const b = BOTS[uin];
    if (b) return b.tier || 'basic';
    const pts = profileOf(uin).points || 0;
    return pts >= TIER.black.min ? 'black' : pts >= TIER.gold.min ? 'gold' : 'basic';
  }
  function nextTier(uin) { const t = tierOf(uin); return t === 'basic' ? TIER.gold : t === 'gold' ? TIER.black : null; }
  function addPoints(n, why) {
    if (!me || !n) return;
    const before = tierOf(me.uin);
    saveProfile({ points: (myProfile().points || 0) + n });
    const after = tierOf(me.uin);
    if (why && n >= 3) toast(me, `+${n} б. — ${why}`, null);
    if (after !== before) {
      Snd.play('tada');
      toast(me, `Новый уровень: АСЬКА ${TIER[after].label}!`, null);
      renderMe(); renderContacts();
      addPost(me.uin, { id: uid(), from: '000001', ts: Date.now(), likes: [], kind: 'text', text: `Поздравляю! ${me.nick} теперь АСЬКА ${TIER[after].label} ${TIER[after].badge}. Это официально, я записала.` });
      const bot = BOTS['000001'];
      if (bot) setTimeout(() => botSays(bot, after === 'gold' ? 'Ты Gold! Золотой цветочек, VIP-статусы и моё уважение. Ладно, уважение у тебя и так было :)' : 'Black. Чёрный уровень. Теперь я буду говорить вам «вы». Шучу. Но магнит с Луны ваш.', { sound: 'tada' }), 1500);
    }
  }
  function avatarSvg(uin, size) {
    const p = profileOf(uin);
    const ring = TIER[tierOf(uin)].ring;
    if (!p.avatar || !SMILE_BY_ID[p.avatar]) return statusFlower(statusOf(uin), size, ring);
    return `<span class="av" style="width:${size}px;height:${size}px;${ring ? 'box-shadow:0 0 0 2px ' + ring : ''}">${smileSvg(p.avatar, size)}</span>`;
  }
  const FUN_STATUS = [
    { icon: '✈', text: 'в полёте' }, { icon: '☯', text: 'медитирую' }, { icon: '⌨', text: 'работаю' }, { icon: '🎨', text: 'создаю шедевр' },
    { icon: '☕', text: 'пью чай' }, { icon: '🌻', text: 'на даче' }, { icon: '💭', text: 'в раздумьях' }, { icon: '💤', text: 'сплю' },
    { icon: '📖', text: 'читаю' }, { icon: '💃', text: 'танцую' }, { icon: '🚗', text: 'в пути' }, { icon: '🎣', text: 'рыбачу' },
    { icon: '📥', text: 'качаю мп3' }, { icon: '🎮', text: 'не трогать, кваку гоняю' }, { icon: '💼', text: 'строю бизнес' }, { icon: '🧲', text: 'у холодильника' },
    { icon: '🍕', text: 'ем пиццу' }, { icon: '🛁', text: 'в ванной с резиновой уткой' },
    { icon: '🛥', text: 'на яхте', tier: 'gold' }, { icon: '💰', text: 'считаю деньги', tier: 'gold' }, { icon: '👑', text: 'в VIP-ложе', tier: 'gold' },
    { icon: '🕶', text: 'в тени', tier: 'black' }, { icon: '🚀', text: 'на орбите', tier: 'black' },
  ];
  const XS_REACT = [
    [/полёт|полет|лечу/, ['Куда летим? Магнит привезёшь? ✈', 'В полёте! Пристегнись и напиши, когда сядешь. И магнит, да.']],
    [/медитир/, ['Ом-м-м. Я тоже. Ом-м-м. Напиши, когда вернёшься из нирваны.']],
    [/работа/, ['Работа — не волк. Но я подожду. Я умею.']],
    [/шедевр/, ['Шедевр? Покажи потом! Я повешу на стену. На твою.']],
    [/сплю|сон/, ['Споки. Я покараулю конвертики.']],
    [/холодильник/, ['Не ешь ночью. Магниты посмотри лучше :)']],
    [/чай/, ['Чай! Наливай и мне. Виртуально, но от души.']],
    [/яхт|деньги|vip/i, ['Ого, Gold-жизнь! Не забывай нас, простых цветочков ;)']],
    [/тени|орбит/, ['Black-статус. Я бы сказала «круто», но на этом уровне так не говорят.']],
  ];
  function setXstatus(text) {
    saveProfile({ xstatus: text || null });
    mutate((d) => { d.presence[me.uin] = { status: myStatus, xstatus: myXstatus(), ts: Date.now() }; });
    post({ type: 'presence', uin: me.uin });
    Snd.play('click');
    renderMe(); if (aux.kind === 'profile') renderAux();
    toast(me, text ? 'статус: ' + text : 'статус сброшен', null);
    const bot = BOTS['000001'];
    if (text && bot && !memOf(bot.uin).muted) { const r = XS_REACT.find(([re]) => re.test(text.toLowerCase())); if (r) setTimeout(() => botSays(bot, pick(r[1])), 1800); }
  }

  /* ================= полёты, магниты, холодильник ================= */
  function fridgeOf(uin) {
    const p = profileOf(uin);
    if (p.fridge) return p.fridge;
    const b = BOTS[uin];
    if (b && b.fridge) {
      const seeded = b.fridge.map((code, i) => ({ id: 'A' + String(1000 + (parseInt(uin, 10) % 900) + i), country: code, ts: Date.now() - (i + 1) * 864e5 * 9, from: uin, origin: 'flight' }));
      mutate((d) => { d.profile[uin] = Object.assign(profileOf(uin), { fridge: seeded }); });
      return seeded;
    }
    return [];
  }
  function newSerial() { let n = 0; mutate((d) => { d.magnetSeq = (d.magnetSeq || 1000) + 1; n = d.magnetSeq; }); return '#' + String(n).padStart(6, '0'); }
  function giveMagnetTo(uin, magnet) {
    const existing = fridgeOf(uin).slice();
    mutate((d) => { d.profile[uin] = Object.assign(profileOf(uin), { fridge: [magnet].concat(existing) }); });
  }
  function takeMagnetFrom(uin, id) {
    const existing = fridgeOf(uin).filter((m) => m.id !== id);
    mutate((d) => { d.profile[uin] = Object.assign(profileOf(uin), { fridge: existing }); });
  }
  const magnetCard = (code, serial, text) => { const c = COUNTRY[code] || COUNTRY.UR; return `<div class="magnetcard"><span class="mg">${magnetSvg(code, 44)}</span><div class="ti"><b>${c.flag} ${esc(c.name)}</b><div class="muted">магнит ${esc(serial || '')} · НФТ</div>${text ? `<div class="txt">${renderText(text)}</div>` : ''}</div></div>`; };
  const pastFly = () => (me && /[ая]$/i.test(me.nick) ? 'Полетела' : 'Полетел');
  function fly(code, scope) {
    const c = COUNTRY[code]; if (!c || !me) return;
    if (c.tier && tierRank(tierOf(me.uin)) < tierRank(c.tier)) { alertBox('Магнит', `${c.name} — только для уровня ${TIER[c.tier].label}. Копи баллы :)`); return; }
    const mine = { id: newSerial(), country: code, ts: Date.now(), from: me.uin, origin: 'flight' };
    giveMagnetTo(me.uin, mine);
    setXstatus(`✈ в полёте: ${c.flag} ${c.name}`);
    addPost(me.uin, { id: uid(), from: me.uin, ts: Date.now(), likes: [], kind: 'magnet', country: code, serial: mine.id, text: `${pastFly()} ${c.to}! Магнит — на холодильнике.` });
    const recipients = scope === 'none' ? [] : contactsOf(me.uin).filter((u) => scope === 'all' || circleOf(u) === 'close');
    recipients.forEach((u, i) => {
      const m = { id: newSerial(), country: code, ts: Date.now(), from: me.uin, origin: 'gift' };
      giveMagnetTo(u, m);
      const msg = { id: uid(), from: me.uin, to: u, ts: Date.now(), kind: 'magnet', country: code, serial: m.id, text: `Я ${pastFly().toLowerCase()} ${c.to}! Тебе магнит на холодильник 🧲` };
      pushHistory(msg); post({ type: 'msg', msg });
      const bot = BOTS[u];
      if (bot && bot.persona) setTimeout(() => thankForMagnet(bot, c, false), 3000 + i * 1200 + Math.random() * 3000);
    });
    addPoints(10, 'полёт ' + c.to);
    Snd.play('plane');
    toast(me, `${pastFly()} ${c.to}. Магнитов отправлено: ${recipients.length}`, null);
    if (active) renderHistory();
    if (aux.kind === 'fridge' || aux.kind === 'wall') renderAux();
  }
  function thankForMagnet(bot, c, gift) {
    if (!me) return;
    const P = bot.persona;
    const L = { aska: [`${c.name}! Магнит уже на моём холодильнике. Рядом с магнитом с Луны ;)`, 'Магнит! Коллекция растёт. Привези ещё рассказов.'], kat: [`ааа ${c.name}!!! завидую))) магнит повесила на холодильник`, 'магнит!!! спасибо))) а фотки будут?'], vova: ['магнит. ок. повесил', `${c.name.toLowerCase()}. неплохо. интернет там как?`], serega: [`${c.name.toUpperCase()}!!! Привези музыки оттуда!!! (b)`, 'Магнит на холодильник!!! Рядом с пивом!!!'], lena: [`Ой, ${c.name}! Как романтично :$ Спасибо за магнит!`, 'Магнитик! Повесила рядом с Титаником :)'], batya: [`${c.name}. Далеко. Ты там поел?`, 'Магнит повесил. На холодильник. Куда ещё.'], max: [`${c.name}... Путь важнее точки на карте. Но магнит красивый. Спасибо.`, 'Магнит на холодильнике — якорь памяти. Спасибо.'] };
    const arr = L[P.id] || L.aska;
    botSays(bot, P.id === 'aska' ? pick(arr) : P.v(pick(arr)));
    // иногда дарят в ответ свой магнит
    if (!gift && Math.random() < 0.45) {
      const own = fridgeOf(bot.uin).filter((m) => m.origin !== 'gift');
      if (own.length) {
        const src = pick(own); const cc = COUNTRY[src.country];
        setTimeout(() => {
          if (!me) return;
          const m = { id: newSerial(), country: src.country, ts: Date.now(), from: bot.uin, origin: 'gift' };
          giveMagnetTo(me.uin, m);
          botSays(bot, P.id === 'aska' ? `А это тебе в ответ: магнит ${cc.from}. Обмен!` : P.v(`держи в ответ, у меня лишний: ${cc.name}`), { magnet: m });
          Snd.play('tada');
          if (aux.kind === 'fridge') renderAux();
        }, 4000);
      }
    }
  }
  function flyDialog() {
    if (!me) return;
    const myTier = tierOf(me.uin);
    dialog({
      title: '✈ Я лечу',
      body: `<div class="hint">Выбери страну — магнит ляжет на твой холодильник, а друзья получат по магниту в беседу.</div>
        <div class="magnet-grid inset" id="fly-grid">${COUNTRIES.map((c) => `<button data-code="${c.code}" class="${c.tier && tierRank(myTier) < tierRank(c.tier) ? 'locked' : ''}" title="${esc(c.name)}${c.tier ? ' — только ' + TIER[c.tier].label : ''}">${magnetSvg(c.code, 44)}</button>`).join('')}</div>
        <div class="row mt"><span class="lbl">Кому сказать</span><select class="field" id="fly-scope"><option value="all">всем друзьям</option><option value="close">только кругу «Близкие»</option><option value="none">никому, просто магнит</option></select></div>
        <div class="hint mt" id="fly-pick">Страна не выбрана.</div>`,
      buttons: [{ label: 'Полетел!', primary: true, onClick: (ov) => { const code = ov.dataset.code; if (!code) { $('#fly-pick', ov).textContent = 'Сначала выбери страну.'; return false; } fly(code, $('#fly-scope', ov).value); } }, { label: 'Отмена' }],
      onOpen: (ov) => $$('#fly-grid button', ov).forEach((b) => (b.onclick = () => { $$('#fly-grid button', ov).forEach((x) => x.classList.remove('on')); b.classList.add('on'); ov.dataset.code = b.dataset.code; const c = COUNTRY[b.dataset.code]; $('#fly-pick', ov).textContent = `${c.flag} ${c.name}: ${pastFly().toLowerCase()} ${c.to}` + (b.classList.contains('locked') ? ` — нужен уровень ${TIER[c.tier].label}` : ''); Snd.play('click'); })),
    });
  }
  function giftMagnetDialog(preselect) {
    const mine = fridgeOf(me.uin);
    if (!mine.length) { alertBox('Магниты', 'На холодильнике пусто. Сначала слетай куда-нибудь: меню «Контакты» → «✈ Я лечу».'); return; }
    const friends = contactsOf(me.uin).map(accountOf).filter(Boolean);
    dialog({
      title: '🎁 Подарить магнит',
      body: `<div class="hint">Магнит уйдёт с твоего холодильника на чужой. НФТ: Настоящий Фанерный Талисман, с номером.</div>
        <div class="magnet-grid inset" id="gift-grid">${mine.map((m) => `<button data-id="${m.id}" class="${preselect === m.id ? 'on' : ''}" title="${esc(COUNTRY[m.country].name)} ${m.id}">${magnetSvg(m.country, 44)}</button>`).join('')}</div>
        <div class="row mt"><span class="lbl">Кому</span><select class="field" id="gift-to">${friends.map((a) => `<option value="${a.uin}">${esc(a.nick)}</option>`).join('')}</select></div>`,
      buttons: [{ label: 'Подарить', primary: true, onClick: (ov) => { const id = ov.dataset.id || preselect; if (!id) return false; giftMagnet(id, $('#gift-to', ov).value); } }, { label: 'Отмена' }],
      onOpen: (ov) => { if (preselect) ov.dataset.id = preselect; $$('#gift-grid button', ov).forEach((b) => (b.onclick = () => { $$('#gift-grid button', ov).forEach((x) => x.classList.remove('on')); b.classList.add('on'); ov.dataset.id = b.dataset.id; Snd.play('click'); })); },
    });
  }
  function giftMagnet(id, toUin) {
    const m = fridgeOf(me.uin).find((x) => x.id === id); if (!m || !toUin) return;
    const c = COUNTRY[m.country];
    takeMagnetFrom(me.uin, id);
    const given = Object.assign({}, m, { from: me.uin, origin: 'gift', ts: Date.now() });
    giveMagnetTo(toUin, given);
    const msg = { id: uid(), from: me.uin, to: toUin, ts: Date.now(), kind: 'magnet', country: m.country, serial: m.id, text: `Дарю магнит ${c.from} 🧲 Теперь он твой.` };
    pushHistory(msg); post({ type: 'msg', msg });
    addPoints(5, 'подарок');
    Snd.play('tada');
    toast(accountOf(toUin), 'магнит подарен', null);
    const bot = BOTS[toUin];
    if (bot && bot.persona) setTimeout(() => thankForMagnet(bot, c, true), 2500 + Math.random() * 2500);
    if (active === toUin) renderHistory();
    if (aux.kind === 'fridge') renderAux();
  }
  const FOOD = [
    { code: 'baltika0', name: 'Балтика 0', icon: '🍺', kind: 'drink' }, { code: 'redwine', name: 'Красное вино', icon: '🍷', kind: 'drink' }, { code: 'whitewine', name: 'Белое вино', icon: '🥂', kind: 'drink' }, { code: 'champagne', name: 'Шампанское', icon: '🍾', kind: 'drink' },
    { code: 'cola', name: 'Кола', icon: '🥤', kind: 'drink' }, { code: 'lemonade', name: 'Лимонад', icon: '🍋', kind: 'drink' }, { code: 'milk', name: 'Молоко', icon: '🥛', kind: 'drink' }, { code: 'tea', name: 'Чай', icon: '🍵', kind: 'drink' }, { code: 'coffee', name: 'Кофе', icon: '☕', kind: 'drink' }, { code: 'juice', name: 'Сок', icon: '🧃', kind: 'drink' },
    { code: 'salmon', name: 'Лосось (salmon)', icon: '🐟', kind: 'food' }, { code: 'jamon', name: 'Хамон', icon: '🥓', kind: 'food' }, { code: 'cheese', name: 'Дорогой сыр', icon: '🧀', kind: 'food' }, { code: 'benedict', name: 'Яйца бенедикт с лососем', icon: '🍳', kind: 'food' },
    { code: 'pelmeni', name: 'Пельмени', icon: '🥟', kind: 'food' }, { code: 'pizza', name: 'Пицца', icon: '🍕', kind: 'food' }, { code: 'sushi', name: 'Суши', icon: '🍣', kind: 'food' }, { code: 'cake', name: 'Торт', icon: '🎂', kind: 'food' }, { code: 'icecream', name: 'Мороженое', icon: '🍨', kind: 'food' },
    { code: 'watermelon', name: 'Арбуз', icon: '🍉', kind: 'food' }, { code: 'strawberry', name: 'Клубника', icon: '🍓', kind: 'food' }, { code: 'olivier', name: 'Оливье', icon: '🥗', kind: 'food' }, { code: 'shashlik', name: 'Шашлык', icon: '🍢', kind: 'food' }, { code: 'cookies', name: 'Печеньки', icon: '🍪', kind: 'food' }, { code: 'caviar', name: 'Икра', icon: '🫙', kind: 'food' },
  ];
  const FOOD_BY = {}; FOOD.forEach((f) => (FOOD_BY[f.code] = f));
  const BOT_FOOD = { '000777': ['coffee', 'cola'], '000001': ['tea', 'cookies', 'cake'], '100500': ['cola', 'pizza', 'icecream'], '31337': ['coffee', 'pelmeni'], '777777': ['baltika0', 'shashlik', 'champagne'], '555123': ['strawberry', 'whitewine', 'cake'], '200200': ['salmon', 'olivier', 'tea'], '404404': ['tea', 'cheese'], '123456': ['coffee'] };
  Brain.LITE_PEOPLE.forEach((o) => { BOT_FOOD[o.uin] = LITE_FOOD[o.style] || ['tea']; });
  function foodOf(uin) {
    const p = profileOf(uin);
    if (p.food) return p.food;
    const codes = BOTS[uin] ? BOT_FOOD[uin] || [] : ['baltika0', 'redwine', 'salmon', 'jamon', 'cheese', 'benedict'];
    const seeded = codes.map((c, i) => ({ id: '#F' + String(2000 + ((parseInt(uin, 10) || 7) % 900) + i).padStart(6, '0'), item: c, ts: Date.now() - (i + 1) * 864e5, from: uin, origin: 'own' }));
    mutate((d) => { d.profile[uin] = Object.assign(profileOf(uin), { food: seeded }); });
    return seeded;
  }
  function setFood(uin, list) { mutate((d) => { d.profile[uin] = Object.assign(profileOf(uin), { food: list }); }); }
  const foodCard = (code, serial, text) => { const f = FOOD_BY[code] || { icon: '🍽', name: code }; return `<div class="magnetcard"><span class="mg food-ico">${f.icon}</span><div class="ti"><b>${esc(f.name)}</b><div class="muted">НФТ ${esc(serial || '')} · из холодильника</div>${text ? `<div class="txt">${renderText(text)}</div>` : ''}</div></div>`; };
  let fridgeOpen = false;
  const FOOD_ZONE = { icecream: 'freezer', pelmeni: 'freezer', watermelon: 'drawer', strawberry: 'drawer', olivier: 'food' };
  function renderFridge(uin) {
    const a = accountOf(uin); if (!a) return '<div class="empty-note">Нет такого пользователя.</div>';
    const mine = uin === me.uin;
    const items = fridgeOf(uin);
    const food = foodOf(uin);
    const countries = new Set(items.map((m) => m.country));
    const magnet = (m) => { const c = COUNTRY[m.country] || COUNTRY.UR; const from = m.from === uin ? '' : (accountOf(m.from) || { nick: m.from }).nick; return `<button class="magnet" data-mid="${m.id}" title="${esc(c.name)} ${m.id}${from ? ' · от ' + esc(from) : ''} · ${fmtDay(m.ts)}">${magnetSvg(m.country, 46, { serial: m.id })}${from ? `<span class="from">${esc(from)}</span>` : ''}</button>`; };
    const tile = (f) => { const d = FOOD_BY[f.item] || { icon: '🍽', name: f.item, kind: 'food' }; const from = f.from === uin ? '' : (accountOf(f.from) || { nick: f.from }).nick; return `<button class="food" data-fid="${f.id}" title="${esc(d.name)} · НФТ ${f.id}${from ? ' · от ' + esc(from) : ''}">${foodSvg(Object.assign({ code: f.item }, d), 34)}<span>${esc(d.name)}</span><small>${esc(f.id)}</small>${from ? `<em>от ${esc(from)}</em>` : ''}</button>`; };
    const zone = (f) => FOOD_ZONE[f.item] || ((FOOD_BY[f.item] || {}).kind === 'drink' ? 'drink' : 'food');
    const freezer = food.filter((f) => zone(f) === 'freezer'), drinks = food.filter((f) => zone(f) === 'drink'), eats = food.filter((f) => zone(f) === 'food'), drawer = food.filter((f) => zone(f) === 'drawer');
    return `<div class="wall-head"><span class="ico">${avatarSvg(uin, 30)}</span><div class="who"><b>${mine ? 'Мой холодильник' : 'Холодильник: ' + esc(a.nick)}</b><div class="hint">снаружи магниты: ${items.length} (стран: ${countries.size}) · внутри: ${food.length} · всё — НФТ с номером</div></div></div>
      <div class="row wall-actions">${mine ? '<button class="btn primary" id="fr-fly">✈ Я лечу</button><button class="btn" id="fr-gift">🎁 Подарить</button><button class="btn" id="fr-add">🍽 Добавить еду</button>' : `<button class="btn" id="fr-giftto">🎁 Подарить ${esc(a.nick)}</button>`}<button class="btn" id="fr-open">${fridgeOpen ? 'Закрыть дверцу' : 'Открыть дверцу'}</button></div>
      <div class="fridge-stage"><div class="fridge3 ${fridgeOpen ? 'open' : ''}" id="fridge3">
        <div class="fr-cabinet">
          <div class="fr-light"></div>
          <div class="fr-inside">
            <div class="shelf freezer"><span class="shelf-l">❄ морозилка</span><div class="shelf-items">${freezer.length ? freezer.map(tile).join('') : '<span class="hint">иней</span>'}</div></div>
            <div class="shelf"><span class="shelf-l">напитки</span><div class="shelf-items">${drinks.length ? drinks.map(tile).join('') : '<span class="hint">пусто</span>'}</div></div>
            <div class="shelf"><span class="shelf-l">еда</span><div class="shelf-items">${eats.length ? eats.map(tile).join('') : '<span class="hint">пусто</span>'}</div></div>
            <div class="shelf drawer"><span class="shelf-l">🥬 овощной ящик</span><div class="shelf-items">${drawer.length ? drawer.map(tile).join('') : '<span class="hint">пусто</span>'}</div></div>
          </div>
          <div class="fr-gasket"></div>
        </div>
        <div class="fr-door" id="fr-door" title="${fridgeOpen ? 'Закрыть дверцу' : 'Открыть дверцу'}">
          <div class="fr-badge"><span>ХОЛОДОК</span><small>модель 99 · АСЬКА</small></div>
          <div class="fr-magnets">${items.length ? items.map(magnet).join('') : '<div class="hint fr-hint">магнитов нет — нажми «Я лечу»</div>'}</div>
          <div class="fr-handle"><i></i></div>
          <div class="fr-plate">${mine ? 'Что я люблю — внутри' : 'Любимое ' + esc(a.nick)}</div>
        </div>
        <div class="fr-feet"><i></i><i></i></div>
      </div></div>
      <div class="hint">Дверца открывается по клику (или кнопкой). Магниты — снаружи, с номером НФТ: из поездок и в подарок. Внутри — морозилка, напитки, еда и овощной ящик. Нажми на любой предмет: откуда он, чей и что с ним делать.</div>`;
  }
  function wireFridge(uin) {
    const mine = uin === me.uin;
    const toggleDoor = () => { fridgeOpen = !fridgeOpen; Snd.play(fridgeOpen ? 'click' : 'knock'); $('#fridge3').classList.toggle('open', fridgeOpen); $('#fr-door').title = fridgeOpen ? 'Закрыть дверцу' : 'Открыть дверцу'; $('#fr-open').textContent = fridgeOpen ? 'Закрыть дверцу' : 'Открыть дверцу'; };
    $('#fr-open').onclick = toggleDoor;
    $('#fr-door').onclick = (e) => { if (e.target.closest('.magnet')) return; toggleDoor(); };
    if (mine) { $('#fr-fly').onclick = flyDialog; $('#fr-gift').onclick = () => giftAnyDialog(); $('#fr-add').onclick = addFoodDialog; }
    else $('#fr-giftto').onclick = () => giftAnyDialog(uin);
    $$('.fridge3 .magnet').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const m = fridgeOf(uin).find((x) => x.id === b.dataset.mid); if (!m) return;
      const c = COUNTRY[m.country]; const from = accountOf(m.from);
      Snd.play('click');
      dialog({ title: `Магнит ${m.id}`, body: `<div class="center">${magnetSvg(m.country, 96)}</div><div class="center mt"><b>${c.flag} ${esc(c.name)}</b></div><div class="hint center">${m.origin === 'flight' ? `Привезён из поездки ${fmtDay(m.ts)}` : `Подарок от ${esc(from ? from.nick : m.from)}, ${fmtDay(m.ts)}`}<br>НФТ ${m.id} — Настоящий Фанерный Талисман, единственный в своём роде.</div>`, buttons: mine ? [{ label: 'Подарить', onClick: () => setTimeout(() => giftMagnetDialog(m.id), 30) }, { label: 'Закрыть', primary: true }] : [{ label: 'Закрыть', primary: true }] });
    }));
    $$('.fridge3 .food').forEach((b) => (b.onclick = () => {
      const f = foodOf(uin).find((x) => x.id === b.dataset.fid); if (!f) return;
      const d = FOOD_BY[f.item] || { icon: '🍽', name: f.item }; const from = accountOf(f.from);
      Snd.play('click');
      dialog({ title: `${d.icon} ${d.name}`, body: `<div class="center" style="font-size:48px">${d.icon}</div><div class="hint center">НФТ ${f.id} · ${f.from === uin ? 'своё' : 'угощение от ' + esc(from ? from.nick : f.from)} · ${fmtDay(f.ts)}</div>`, buttons: mine ? [{ label: 'Подарить', onClick: () => setTimeout(() => giftFoodDialog(f.id), 30) }, { label: 'Съесть', onClick: () => { setFood(me.uin, foodOf(me.uin).filter((x) => x.id !== f.id)); Snd.play('smile:tongue' === 'x' ? 'click' : 'click'); toast(me, `${d.name}: ням. НФТ ${f.id} съеден.`, null); renderAux(); } }, { label: 'Закрыть', primary: true }] : [{ label: 'Закрыть', primary: true }] });
    }));
  }
  function addFoodDialog() {
    dialog({ title: '🍽 Добавить в холодильник', body: `<div class="hint">Что ты любишь? Каждый предмет — НФТ с номером, его можно подарить.</div><div class="food-grid inset">${FOOD.map((f) => `<button data-food="${f.code}" title="${esc(f.name)}"><i>${f.icon}</i><span>${esc(f.name)}</span></button>`).join('')}</div>`, buttons: [{ label: 'Готово' }], onOpen: (ov) => $$('[data-food]', ov).forEach((b) => (b.onclick = () => { const list = foodOf(me.uin).slice(); list.unshift({ id: '#F' + newSerial().slice(1), item: b.dataset.food, ts: Date.now(), from: me.uin, origin: 'own' }); setFood(me.uin, list); b.classList.add('on'); Snd.play('click'); toast(me, `${FOOD_BY[b.dataset.food].name} — в холодильнике`, null); addPoints(1); if (aux.kind === 'fridge') renderAux(); })) });
  }
  function giftAnyDialog(toUin) {
    const magnets = fridgeOf(me.uin), food = foodOf(me.uin);
    if (!magnets.length && !food.length) { alertBox('Подарить', 'Холодильник пуст: ни магнитов, ни еды. Слетай куда-нибудь или добавь еду.'); return; }
    const friends = contactsOf(me.uin).map(accountOf).filter((a) => a && !a.twinOf);
    dialog({ title: '🎁 Подарить', body: `<div class="hint">Выбери, что подарить. Предмет уйдёт с твоего холодильника на чужой.</div><div class="magnet-grid inset" id="g-any">${magnets.map((m) => `<button data-gm="${m.id}" title="${esc(COUNTRY[m.country].name)}">${magnetSvg(m.country, 40)}</button>`).join('')}${food.map((f) => `<button data-gf="${f.id}" class="food-pick" title="${esc((FOOD_BY[f.item] || {}).name || f.item)}"><i>${(FOOD_BY[f.item] || { icon: '🍽' }).icon}</i></button>`).join('')}</div><div class="row mt"><span class="lbl">Кому</span><select class="field" id="g-to">${friends.map((a) => `<option value="${a.uin}" ${a.uin === toUin ? 'selected' : ''}>${esc(a.nick)}</option>`).join('')}</select></div>`, buttons: [{ label: 'Подарить', primary: true, onClick: (ov) => { const to = $('#g-to', ov).value; if (ov.dataset.gm) giftMagnet(ov.dataset.gm, to); else if (ov.dataset.gf) giftFood(ov.dataset.gf, to); else return false; } }, { label: 'Отмена' }], onOpen: (ov) => $$('#g-any button', ov).forEach((b) => (b.onclick = () => { $$('#g-any button', ov).forEach((x) => x.classList.remove('on')); b.classList.add('on'); delete ov.dataset.gm; delete ov.dataset.gf; if (b.dataset.gm) ov.dataset.gm = b.dataset.gm; else ov.dataset.gf = b.dataset.gf; Snd.play('click'); })) });
  }
  function giftFoodDialog(id) { giftAnyDialog(); setTimeout(() => { const ov = $$('.overlay').pop(); if (ov) { ov.dataset.gf = id; const b = $(`[data-gf="${id}"]`, ov); if (b) b.classList.add('on'); } }, 30); }
  function giftFood(id, toUin) {
    const f = foodOf(me.uin).find((x) => x.id === id); if (!f || !toUin) return;
    const d = FOOD_BY[f.item] || { icon: '🍽', name: f.item };
    setFood(me.uin, foodOf(me.uin).filter((x) => x.id !== id));
    setFood(toUin, [Object.assign({}, f, { from: me.uin, origin: 'gift', ts: Date.now() })].concat(foodOf(toUin)));
    const msg = { id: uid(), from: me.uin, to: toUin, ts: Date.now(), kind: 'food', item: f.item, serial: f.id, text: `Угощаю: ${d.name} ${d.icon} Теперь в твоём холодильнике.` };
    pushHistory(msg); post({ type: 'msg', msg });
    addPoints(3, 'угощение'); Snd.play('tada');
    toast(accountOf(toUin), 'угощение отправлено', null);
    const bot = BOTS[toUin];
    if (bot && bot.persona) setTimeout(() => { const P = bot.persona; const L = { aska: [`${d.name}! Положила в холодильник, рядом с печеньками :)`], kat: [`ооо ${d.name.toLowerCase()}!!! спасибо)))`], vova: ['еда. ок. спасибо'], serega: [`${d.name.toUpperCase()}!!! Вот это подарок!!! (b)`], lena: [`Ой, ${d.name.toLowerCase()}! Спасибо :$`], batya: [`${d.name}. Хорошо. Сам-то поел?`], max: [`${d.name}... Еда — это тоже философия. Спасибо.`] }; botSays(bot, P.id === 'aska' ? pick(L.aska) : P.v(pick(L[P.id] || L.aska))); }, 2500 + Math.random() * 2500);
    if (active === toUin) renderHistory();
    if (aux.kind === 'fridge') renderAux();
  }

  /* ================= досье ================= */
  function msgStats(uin) {
    const msgs = [];
    Object.values(db.history).forEach((arr) => arr.forEach((m) => { if (m.from === uin && m.text && !m.card && !m.kind) msgs.push(m); }));
    const n = msgs.length;
    if (!n) return { n: 0 };
    const len = msgs.reduce((a, m) => a + m.text.length, 0) / n;
    const sm = msgs.filter((m) => findSmiles(m.text).length).length / n;
    const ex = msgs.filter((m) => /!/.test(m.text)).length / n;
    const q = msgs.filter((m) => /\?/.test(m.text)).length / n;
    const caps = msgs.filter((m) => m.text.length > 5 && m.text === m.text.toUpperCase() && /[А-ЯA-Z]/.test(m.text)).length / n;
    const night = msgs.filter((m) => { const h = new Date(m.ts).getHours(); return h < 6 || h >= 23; }).length / n;
    const hello = msgs.filter((m) => /^(прив|здр|хай|ку\b|йо)/i.test(m.text)).length;
    const last = Math.max.apply(null, msgs.map((m) => m.ts));
    return { n, len, sm, ex, q, caps, night, hello, last };
  }
  function buildDossier(uin) {
    const a = accountOf(uin); const p = profileOf(uin); const b = BOTS[uin];
    const st = msgStats(uin);
    const mine = uin === me.uin;
    const f = /[ая]$/i.test(a.nick) && !/_/.test(a.nick) ? true : (b ? /^(aska|kat|lena)$/.test(b.brain) : false);
    const g = (m, w) => (f ? w : m);
    const out = { avatar: [], likes: [], style: [], verdict: '', secret: [] };
    // аватар и ник
    if (b && b.dossier) out.avatar.push(b.dossier[0]);
    else out.avatar.push(p.avatar && SMILE_BY_ID[p.avatar] ? `Аватар — смайл «${SMILE_BY_ID[p.avatar].name}». ${{ smile: 'Классика: ничего лишнего.', laugh: 'Значит, смешливый. Или хочет казаться.', wink: 'Подмигивает. Что-то знает.', cool: 'В очках. Солнца нет, а очки есть.', kiss: 'С поцелуйчиком. Романтик, предупреждали.', party: 'В колпаке. Праздник — состояние души.', angel: 'С нимбом. Подозрительно.', devil: 'С рожками. Честно хотя бы.', think: 'Задумчивый. Отвечает не сразу.', zzz: 'Спит. Даже на аватаре.', heart: 'Сердце вместо лица. Открытый человек.', cat: 'Кот. Всё ясно.' }[p.avatar] || 'Выбран со вкусом.'}` : 'Аватар — цветочек. Верен традициям 1998 года.');
    const digits = (a.nick.match(/\d+/) || [])[0];
    if (digits) out.avatar.push(digits.length === 2 && +digits > 80 ? `В нике цифры ${digits}: похоже, год рождения или год первого модема.` : digits === '2000' ? 'В нике 2000: пережил миллениум и проблему Y2K.' : `В нике цифры ${digits} — число со значением, Аська не спрашивала.`);
    if (/_/.test(a.nick)) out.avatar.push('Подчёркивание в нике — классика, так делали все в 1999-м.');
    if (/[a-z]/i.test(a.nick) && /[а-я]/i.test(a.nick)) out.avatar.push('Ник на двух алфавитах сразу. Смелость.');
    const tier = tierOf(uin);
    if (tier !== 'basic') out.avatar.push(`Уровень АСЬКИ: ${TIER[tier].label}. ${tier === 'gold' ? 'Золотой цветочек, статусы с яхтой.' : 'Чёрный уровень. Магнит с Луны, скорее всего, есть.'}`);
    // увлечения
    if (b && b.dossier) out.likes.push(b.dossier[1]);
    else if (p.interests.length) out.likes.push(`Любит: ${p.interests.slice(0, 6).join(', ')}${p.interests.length > 6 ? ' и ещё ' + (p.interests.length - 6) : ''}.`);
    else out.likes.push('Интересы не указаны. Либо скромность, либо интересы слишком интересные.');
    if (!mine) { const pct = matchPct(me.uin, uin); const common = commonInterests(me.uin, uin); if (pct != null) out.likes.push(pct >= 50 ? `С тобой совпадение ${pct}% — общее: ${common.join(', ')}. Аська одобряет.` : pct > 0 ? `С тобой совпадение ${pct}%: ${common.join(', ')}. Есть о чём поговорить.` : 'С тобой ни одного общего интереса. Зато не будете спорить о музыке.'); }
    if (!b) out.likes.push(`Режим сейчас — «${MODES[p.mode].label}»: ${p.mode === 'biz' ? 'не отвлекать, по делу' : p.mode === 'close' ? 'только для своих' : 'открыт к общению'}.`);
    if (!mine) out.likes.push(`Для тебя — круг «${MODES[circleOf(uin)].label}».`);
    const fd = foodOf(uin); if (fd.length) out.likes.push(`В холодильнике: ${fd.slice(0, 4).map((f) => (FOOD_BY[f.item] || { name: f.item }).name.toLowerCase()).join(', ')}${fd.length > 4 ? ' и ещё' : ''}. ${fd.some((f) => /wine|champagne/.test(f.item)) ? 'Знает толк в вине.' : fd.some((f) => f.item === 'baltika0') ? 'Балтика 0 — значит, за рулём или в завязке. Уважаю.' : ''}`);
    const fr = fridgeOf(uin); if (fr.length) out.likes.push(`На холодильнике ${fr.length} магн. (${Array.from(new Set(fr.map((m) => COUNTRY[m.country] ? COUNTRY[m.country].name : m.country))).slice(0, 4).join(', ')}). ${fr.length > 3 ? 'Путешественник.' : 'Начинающий путешественник.'}`);
    // как общается
    if (b && b.dossier) out.style.push(b.dossier[2]);
    if (st.n) {
      out.style.push(`Сообщений в базе: ${st.n}, в среднем ${Math.round(st.len)} знаков — ${st.len < 25 ? g('любит коротко', 'любит коротко') + '. Телеграфный стиль.' : st.len < 70 ? 'нормальные человеческие фразы.' : 'пишет письма. Романтик или зануда — Аська ещё не решила.'}`);
      out.style.push(st.sm >= 0.4 ? `Смайлы в ${Math.round(st.sm * 100)}% сообщений — улыбчивый, в 1999-м таких любили.` : st.sm >= 0.1 ? `Смайлы иногда (${Math.round(st.sm * 100)}%) — держит баланс.` : 'Смайлов почти нет. Серьёзный человек. Или клавиша «)» сломалась.');
      if (st.ex > 0.4) out.style.push('Много восклицательных!!! DJ_Serёga одобряет.');
      if (st.q > 0.4) out.style.push('Много спрашивает — любопытный. Или допрашивает.');
      if (st.caps > 0.2) out.style.push('ЧАСТО ПИШЕТ КАПСОМ. Батя_в_сети, это ты?');
      if (st.night > 0.4) out.style.push('Пишет по ночам — сова. Дайлап ночью дешевле, Аська понимает.');
      if (st.hello >= 3) out.style.push(`${g('Здоровается', 'Здоровается')} почти каждый раз — воспитанный человек.`);
      out.style.push(`Последний раз ${g('писал', 'писала')} ${fmtDay(st.last)} в ${fmtTime(st.last)}.`);
    } else if (!b) out.style.push('Сообщений пока нет: молчун или только зарегистрировался. Аська наблюдает.');
    // вердикт
    const traits = [];
    if (st.sm >= 0.3) traits.push('улыбчивый'); if (st.len > 70) traits.push('обстоятельный'); if (st.len && st.len < 25) traits.push('лаконичный'); if (st.night > 0.4) traits.push('ночной'); if (fr.length > 2) traits.push('лёгкий на подъём'); if (p.interests.length > 5) traits.push('разносторонний');
    out.verdict = b && b.persona ? ({ aska: 'Вердикт: это я. Я себе доверяю.', kat: 'Вердикт: лучший друг для режима «Общение». Не забудь мп3.', vova: 'Вердикт: надёжен, если не трогать его линукс.', serega: 'Вердикт: с ним не бывает тихо. Это плюс.', lena: 'Вердикт: подруга для режима «Близкие». Носи платочек.', batya: 'Вердикт: круг «Близкие», без вариантов. Поешь.', max: 'Вердикт: собеседник для вечера с чаем. Отвечает долго, но глубоко.', vinyl: 'Вердикт: консультант, который станет другом, если лайкать честно.' })[b.brain] || (b.persona.lite ? ({ sunny: 'Вердикт: с таким человеком не бывает скучно. Зови в поездку.', calm: 'Вердикт: спокойный собеседник для режима «Близкие». Не торопи.', nerd: 'Вердикт: свой человек для режима «Бизнес», если по технике. Шутки понимает, но не признаётся.', biz: 'Вердикт: круг «Бизнес». Договорённости держит, время ценит.', warm: 'Вердикт: тёплый человек, режим «Близкие». Выслушает и накормит.', sport: 'Вердикт: заряжает. Поднимет с дивана и тебя, и твой статус.' })[b.persona.styleKey] || 'Вердикт: хороший человек, познакомься.' : 'Вердикт: служебное досье.') : `Вердикт Аськи: ${traits.length ? traits.join(', ') + ' человек' : 'человек-загадка'}. ${mine ? 'Я бы с тобой дружила. Собственно, дружу.' : 'Можно дружить. Для круга «' + MODES[circleOf(uin)].label + '» — в самый раз.'}`;
    // секретная часть: что Аська помнит (только своё досье)
    if (mine) {
      const mem = memOf('000001');
      if (mem.name) out.secret.push(`Имя: ${mem.name}.`);
      if (mem.city) out.secret.push(`Город: ${mem.city}.`);
      if (mem.age) out.secret.push(`Возраст: ${mem.age}.`);
      if (mem.tea) out.secret.push(`Чай или кофе: ${mem.tea}.`);
      if (mem.music) out.secret.push(`Слушает: ${mem.music}.`);
      if (mem.pet) out.secret.push(`Дома живёт: ${mem.pet}.`);
      if (mem.trip) out.secret.push(`Мечтает слетать в ${mem.trip}.`);
      if (mem.relatives) out.secret.push(`Родным звонил: ${mem.relatives === 'ok' ? 'недавно, молодец' : mem.relatives === 'overdue' ? 'давно. Аська напомнит' : 'уклончиво'}.`);
      if (mem.mood) out.secret.push(`Настроение в прошлый раз: ${mem.mood === 'up' ? 'ура' : mem.mood === 'down' ? 'уф' : mem.mood}.`);
      if (!out.secret.length) out.secret.push('Пока ничего. Поболтай с Аськой — она запишет.');
    }
    return out;
  }
  function renderDossier(uin) {
    const a = accountOf(uin); if (!a) return '<div class="empty-note">Нет такого пользователя.</div>';
    const mine = uin === me.uin;
    const p = profileOf(uin);
    const open = p.dossierOpen !== false;
    const head = `<div class="dossier-head"><span class="ico">${avatarSvg(uin, 34)}</span><div class="who"><div class="eyebrow">ДОСЬЕ № ${esc(a.uin)}</div><b>${esc(a.nick)}</b><div class="hint">составила Аська · ${fmtDay(Date.now())}</div></div><span class="stamp ${open ? 'ok' : 'no'}">${open ? 'ОТКРЫТО' : 'ЗАКРЫТО'}</span></div>`;
    if (!open && !mine) return head + `<div class="dossier"><div class="dossier-sec"><div class="dossier-t">Приватность</div><p>Досье закрыто владельцем. Аська молчит как партизан.</p><p class="muted">Попроси ${esc(a.nick)} открыть досье в профиле — или подружись так, без бумажек.</p></div></div><div class="row"><button class="btn" id="d-chat">Написать</button><button class="btn" id="d-prof">Профиль</button></div>`;
    const d = buildDossier(uin);
    const sec = (t, lines) => (lines && lines.length ? `<div class="dossier-sec"><div class="dossier-t">${t}</div>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` : '');
    return head + `<div class="dossier">${sec('Аватар и ник', d.avatar)}${sec('Увлечения', d.likes)}${sec('Как общается', d.style)}<div class="dossier-sec verdict"><p>${esc(d.verdict)}</p></div>${mine ? sec('Что Аська о тебе запомнила (видишь только ты)', d.secret) : ''}</div>
      ${mine ? `<div class="row"><label class="row"><input type="checkbox" id="d-open" ${open ? 'checked' : ''}> досье открыто для друзей</label><span class="sp"></span><button class="btn" id="d-refresh">Пересобрать</button></div>` : `<div class="row"><button class="btn" id="d-chat">Написать</button><button class="btn" id="d-prof">Профиль</button></div>`}`;
  }
  function wireDossier(uin) {
    if (uin === me.uin) {
      $('#d-open').onchange = (e) => { saveProfile({ dossierOpen: e.target.checked }); Snd.play('click'); renderAux(); };
      $('#d-refresh').onclick = () => { Snd.play('drum'); setTimeout(renderAux, 600); };
    } else { const c = $('#d-chat'), pr = $('#d-prof'); if (c) c.onclick = () => openChat(uin); if (pr) pr.onclick = () => openAux('profile', uin); }
  }


  /* ================= общие интересы и сообщества ================= */
  function ensureInterestRegistry() {
    if (db.interests && Object.keys(db.interests).length) return;
    const now = Date.now();
    mutate((d) => {
      d.interests = d.interests || {};
      INTERESTS.forEach((n, i) => { d.interests[n] = { name: n, createdBy: '000001', ts: now - (40 - i) * 864e5, supporters: [] }; });
      Object.values(BOTS).forEach((b) => (b.interests || []).forEach((n) => { if (!d.interests[n]) d.interests[n] = { name: n, createdBy: b.uin, ts: now - 30 * 864e5, supporters: [] }; if (!d.interests[n].supporters.includes(b.uin)) d.interests[n].supporters.push(b.uin); }));
      d.communities = d.communities || {};
      const SEED = [['c_music', 'Клуб меломанов', 'музыка', '777777', 'Слушаем, обсуждаем, качаем. Продиджи — обязательно.', 'Новый микс свёл!!! 80 минут. Кому? (b)'], ['c_linux', 'Линукс-клуб', 'программирование', '31337', 'rtfm. потом спрашивай', 'правила клуба: 1. не спрашивать про винду. 2. см. п.1'], ['c_cinema', 'Киноклуб', 'кино', '555123', 'Титаник, Матрица и всё, что заставляет плакать :)', 'В пятницу смотрим Титаник. Седьмой раз. Платочки с собой!'], ['c_dacha', 'Дачники', 'дача', '200200', 'Огурцы, картошка, шашлык. Приезжай.', 'ОГУРЦЫ ВЗОШЛИ. У КОГО ЕЩЁ?'], ['c_phil', 'Философы с дивана', 'философия', '404404', 'Думаем вслух. Отвечаем вопросом на вопрос.', 'Вопрос недели: если статус «невидимый», ты есть?'], ['c_tea', 'Чайная', 'чай', '000001', 'Чай, печеньки и разговоры. Кофе тоже можно, но тихо.', 'Открываю Чайную! Правило одно: с печеньками :)']];
      SEED.forEach(([id, name, interest, by, desc, post]) => {
        d.communities[id] = { id, name, interest, createdBy: by, ts: now - 20 * 864e5, members: Array.from(new Set([by].concat(Object.values(BOTS).filter((b) => (b.interests || []).includes(interest)).map((b) => b.uin)))), desc };
        d.wall[id] = [{ id: uid(), from: by, ts: now - 19 * 864e5, likes: [], kind: 'text', text: post }];
      });
    });
  }
  function syncMyInterests() {
    const mine = myProfile().interests;
    if (!mine.length) return;
    mutate((d) => { d.interests = d.interests || {}; mine.forEach((n) => { if (!d.interests[n]) d.interests[n] = { name: n, createdBy: me.uin, ts: Date.now(), supporters: [] }; if (!d.interests[n].supporters.includes(me.uin)) d.interests[n].supporters.push(me.uin); }); });
  }
  function registerInterest(name, on) {
    mutate((d) => {
      d.interests = d.interests || {};
      if (!d.interests[name]) d.interests[name] = { name, createdBy: me.uin, ts: Date.now(), supporters: [] };
      const sup = d.interests[name].supporters; const i = sup.indexOf(me.uin);
      if (on && i < 0) sup.push(me.uin); if (!on && i >= 0) sup.splice(i, 1);
    });
    post({ type: 'interests' });
  }
  const interestsList = () => Object.values(db.interests || {}).sort((a, b) => b.supporters.length - a.supporters.length || a.name.localeCompare(b.name, 'ru'));
  const communitiesOf = (name) => Object.values(db.communities || {}).filter((c) => c.interest === name).sort((a, b) => b.members.length - a.members.length);
  const nickOf = (uin) => { const a = accountOf(uin); return a ? a.nick : uin; };
  const personRow = (uin) => { const a = accountOf(uin); if (!a) return ''; const pct = uin === me.uin ? null : matchPct(me.uin, uin); return `<div class="citem prow-person" data-wall="${esc(uin)}" title="открыть стену"><span class="ico">${avatarSvg(uin, 16)}</span><span class="nick">${esc(a.nick)}${uin === me.uin ? ' <span class="muted">(ты)</span>' : ''}</span>${pct != null ? `<span class="muted">${pct}%</span>` : ''}</div>`; };
  function renderInterestCatalog() {
    const list = interestsList();
    const mine = new Set(myProfile().interests);
    const fresh = (i) => Date.now() - i.ts < 3 * 864e5 && !BOTS[i.createdBy];
    return `<div class="row"><input class="field" id="ic-q" placeholder="найти или добавить интерес"><button class="btn" id="ic-add">+</button></div>
      <div class="hint">Интересы общие для всех: кто добавил — тот и автор. Нажми — история, люди и сообщества.</div>
      <div class="inset ilist" id="ic-list">${list.map((i) => `<div class="irow ${mine.has(i.name) ? 'mine' : ''}" data-interest="${esc(i.name)}"><b>${esc(i.name)}</b>${fresh(i) ? '<span class="tier gold">new</span>' : ''}<span class="sp"></span><span class="muted">${i.supporters.length} чел. · ${communitiesOf(i.name).length} сообщ. · ${esc(nickOf(i.createdBy))}</span></div>`).join('')}</div>`;
  }
  function wireInterestCatalog() {
    const q = $('#ic-q');
    const filter = () => { const v = q.value.trim().toLowerCase(); $$('#ic-list .irow').forEach((r) => (r.hidden = v && !r.dataset.interest.includes(v))); };
    q.addEventListener('input', filter);
    const add = () => { const v = q.value.trim().toLowerCase(); if (v.length < 2) return; const list = myProfile().interests.slice(); if (!list.includes(v)) list.push(v); saveProfile({ interests: list }); registerInterest(v, true); Snd.play('tada'); toast(me, `интерес «${v}» добавлен и виден всем`, null); openAux('interest', v); };
    $('#ic-add').onclick = add;
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  }
  function renderInterest(name) {
    const it = (db.interests || {})[name];
    if (!it) return `<div class="empty-note">Такого интереса ещё нет. <button class="btn" id="i-create">Создать «${esc(name)}»</button></div>`;
    const mine = myProfile().interests.includes(name);
    const people = it.supporters.filter((u) => accountOf(u));
    const comms = communitiesOf(name);
    return `<div class="wall-head"><span class="ico big-emoji">★</span><div class="who"><b>${esc(it.name)}</b><div class="hint">создал(а) <b class="link" data-wall="${esc(it.createdBy)}">${esc(nickOf(it.createdBy))}</b> · ${fmtDay(it.ts)} · поддержали: ${people.length}</div></div></div>
      <div class="row"><button class="btn ${mine ? '' : 'primary'}" id="i-toggle">${mine ? 'Убрать из моих' : '+ В мои интересы'}</button><button class="btn" id="i-newc">Создать сообщество</button></div>
      <div class="groupbox"><span class="legend">Сообщества (${comms.length})</span>${comms.length ? comms.map((c) => `<div class="crow"><div class="ti"><b class="link" data-community="${c.id}">${esc(c.name)}</b><div class="muted">${c.members.length} уч. · основал(а) ${esc(nickOf(c.createdBy))} · ${fmtDay(c.ts)}</div><div class="hint">${esc(c.desc || '')}</div></div><button class="btn" data-join="${c.id}">${c.members.includes(me.uin) ? 'Выйти' : 'Вступить'}</button></div>`).join('') : '<div class="hint">Сообществ пока нет. Создай первое — будешь основателем.</div>'}</div>
      <div class="groupbox"><span class="legend">Люди с этим интересом (${people.length})</span><div class="inset plist">${people.length ? people.map(personRow).join('') : '<div class="empty-note">Пока никого. Поддержи первым.</div>'}</div></div>
      <div class="groupbox"><span class="legend">История</span><div class="hist"><div>📌 ${fmtDay(it.ts)} — ${esc(nickOf(it.createdBy))} ${BOTS[it.createdBy] ? 'добавил(а) интерес в каталог' : 'придумал(а) этот интерес'}</div>${comms.map((c) => `<div>🏠 ${fmtDay(c.ts)} — ${esc(nickOf(c.createdBy))} основал(а) «${esc(c.name)}»</div>`).join('')}${people.length ? `<div>♥ поддержали: ${people.map((u) => esc(nickOf(u))).join(', ')}</div>` : ''}</div></div>`;
  }
  function wireInterest(name) {
    const cr = $('#i-create'); if (cr) { cr.onclick = () => { const list = myProfile().interests.slice(); if (!list.includes(name)) list.push(name); saveProfile({ interests: list }); registerInterest(name, true); renderAux(); }; return; }
    $('#i-toggle').onclick = () => { const list = myProfile().interests.slice(); const k = list.indexOf(name); if (k >= 0) list.splice(k, 1); else list.push(name); saveProfile({ interests: list }); registerInterest(name, k < 0); Snd.play('click'); renderAux(); renderContacts(); };
    $('#i-newc').onclick = () => dialog({ title: 'Новое сообщество', body: `<label class="row"><span class="lbl">Название</span><input class="field" id="c-name" maxlength="30" placeholder="например, Клуб любителей ${esc(name)}"></label><label class="row mt"><span class="lbl">О чём</span><input class="field" id="c-desc" maxlength="80" placeholder="пару слов"></label>`, buttons: [{ label: 'Создать', primary: true, onClick: (ov) => { const n = $('#c-name', ov).value.trim(); if (!n) return false; const id = 'c_' + uid(); mutate((d) => { d.communities[id] = { id, name: n, interest: name, createdBy: me.uin, ts: Date.now(), members: [me.uin], desc: $('#c-desc', ov).value.trim() }; }); const list = myProfile().interests.slice(); if (!list.includes(name)) { list.push(name); saveProfile({ interests: list }); registerInterest(name, true); } addPoints(5, 'сообщество'); Snd.play('tada'); post({ type: 'interests' }); openAux('community', id); } }, { label: 'Отмена' }] });
    $$('[data-join]').forEach((b) => (b.onclick = () => { joinCommunity(b.dataset.join); renderAux(); }));
    $$('[data-community]').forEach((b) => (b.onclick = () => openAux('community', b.dataset.community)));
  }
  function joinCommunity(id) {
    mutate((d) => { const c = d.communities[id]; if (!c) return; const i = c.members.indexOf(me.uin); if (i >= 0) c.members.splice(i, 1); else c.members.push(me.uin); });
    Snd.play('click'); post({ type: 'interests' });
  }
  function renderCommunity(id) {
    const c = (db.communities || {})[id]; if (!c) return '<div class="empty-note">Нет такого сообщества.</div>';
    const member = c.members.includes(me.uin);
    const posts = wallOf(id);
    return `<div class="wall-head"><span class="ico big-emoji">🏠</span><div class="who"><b>${esc(c.name)}</b><div class="hint">интерес <b class="link" data-interest="${esc(c.interest)}">${esc(c.interest)}</b> · основал(а) ${esc(nickOf(c.createdBy))} · ${c.members.length} уч.</div><div class="hint">${esc(c.desc || '')}</div></div></div>
      <div class="row wall-actions"><button class="btn ${member ? '' : 'primary'}" id="cm-join">${member ? 'Выйти' : 'Вступить'}</button><button class="btn" id="w-card" ${member ? '' : 'disabled'}>Открытка</button><button class="btn" id="w-track" ${member ? '' : 'disabled'}>♪ Трек</button></div>
      <div class="chips small">${c.members.map((u) => `<button class="chip" data-wall="${esc(u)}">${esc(nickOf(u))}</button>`).join('')}</div>
      <div class="row"><input class="field" id="w-text" maxlength="300" placeholder="${member ? 'Написать в сообществе…' : 'Вступи, чтобы писать'}" ${member ? '' : 'disabled'}><button class="btn" id="w-send" ${member ? '' : 'disabled'}>OK</button></div>
      <div class="wall-posts inset" id="w-posts">${posts.length ? posts.map((p) => renderPost(p, id)).join('') : '<div class="empty-note">Пока тихо. Напиши первым.</div>'}</div>`;
  }
  function wireCommunity(id) {
    $('#cm-join').onclick = () => { joinCommunity(id); renderAux(); };
    const send = () => { const inp = $('#w-text'); const text = (inp.value || '').trim(); if (!text) return; postWall(id, { kind: 'text', text }); inp.value = ''; };
    $('#w-send').onclick = send;
    $('#w-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    $('#w-card').onclick = () => pickCardDialog((card) => postWall(id, { kind: 'card', card, text: '' }));
    $('#w-track').onclick = () => pickTrackDialog((kind, payload) => postWall(id, kind === 'track' ? { kind: 'track', track: payload } : { kind: 'playlist', playlist: payload }));
  }

  /* ================= мероприятия и приглашения в гости ================= */
  const EV_ANS = { yes: 'Приду', maybe: 'Может быть', no: 'Не смогу' };
  function eventsAll() { return Object.values(db.events || {}); }
  function seedBotEvents() {
    if (eventsAll().some((e) => BOTS[e.host])) return;
    const now = new Date();
    const nextDow = (dow, h) => { const d = new Date(now); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7)); d.setHours(h, 0, 0, 0); return d.getTime(); };
    const seeds = [
      { host: '777777', title: 'Сейшн у Серёги', when: nextDow(6, 21), place: 'у Серёги, 5-й этаж, слышно с улицы', desc: 'Колонки, Продиджи, пиво. Соседи предупреждены.', price: 0 },
      { host: '200200', title: 'Дача: картошка и шашлык', when: nextDow(0, 10), place: 'дача, остановка «Поворот»', desc: 'Копаем, потом едим. Лопаты есть. Приезжай, сынок/дочка.', price: 0 },
      { host: '100500', title: 'Дискотека в универе', when: nextDow(5, 19), place: 'актовый зал, второй этаж', desc: 'Руки Вверх, Иванушки, медляк в конце))) вход — 5 баллов на пирожки', price: 5 },
      { host: '404404', title: 'Вечер философии', when: nextDow(3, 20), place: 'диван Макса', desc: 'Тема: «Существует ли невидимый статус?» Чай будет.', price: 0 },
      { host: '000001', title: 'Чаепитие онлайн', when: Date.now() + 864e5, place: 'прямо тут, в АСЬКЕ', desc: 'Чай, печеньки, открытки. Приходи, я заварю виртуальный :)', price: 0 },
      { host: '555123', title: 'Киновечер: Титаник', when: nextDow(4, 19), place: 'у Ленки, Питер', desc: 'Седьмой раз. Платочки выдаются на входе. Вход — 3 балла на попкорн.', price: 3 },
    ];
    mutate((d) => { d.events = d.events || {}; seeds.forEach((s) => { const id = 'ev_' + uid(); d.events[id] = Object.assign({ id, invited: [], guests: {}, ts: Date.now() - 2 * 864e5 }, s); }); });
  }
  function botInvitesMe() {
    if (!me) return;
    const evs = eventsAll().filter((e) => BOTS[e.host] && !e.invited.includes(me.uin) && e.when > Date.now());
    if (!evs.length) return;
    const ev = pick(evs); const bot = BOTS[ev.host];
    mutate((d) => { d.events[ev.id].invited.push(me.uin); });
    saveProfile({ invitedOnce: true });
    const P = bot.persona;
    const line = { aska: 'Зову в гости! Вот приглашение :)', kat: 'приходи!!! будет весело)))', serega: 'БРО, ПРИХОДИ!!! Без тебя не начнём (b)', batya: 'Приезжай. Я жду. Лопата есть.', max: 'Приглашаю. Будет тихо и интересно.', lena: 'Приходи, пожалуйста :$ Будет здорово!', vova: 'приходи. или нет. но лучше приходи' }[P.id] || 'Приглашаю!';
    botSays(bot, line);
    setTimeout(() => botSays(bot, 'Приглашение: ' + ev.title, { invite: ev.id }), 1500);
  }
  function fmtWhen(ts) { const d = new Date(ts); const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']; return `${DOW[d.getDay()]} ${fmtDay(ts)} в ${fmtTime(ts)}`; }
  function inviteCard(id) {
    const ev = (db.events || {})[id]; if (!ev) return '<div class="muted">мероприятие удалено</div>';
    const host = accountOf(ev.host); const mine = ev.host === me.uin;
    const my = ev.guests[me.uin];
    const counts = ['yes', 'maybe', 'no'].map((k) => Object.values(ev.guests).filter((v) => v === k).length);
    const past = ev.when < Date.now();
    return `<div class="evcard ${past ? 'past' : ''}"><div class="ev-h"><span class="ev-ico">📅</span><div class="ti"><b>${esc(ev.title)}</b><div class="muted">${fmtWhen(ev.when)} · ${esc(ev.place || 'место уточняется')}</div><div class="hint">${esc(ev.desc || '')}</div><div class="muted">зовёт ${esc(host ? host.nick : ev.host)} · ${ev.price ? `вход ${ev.price} б.` : 'бесплатно'} · идут: ${counts[0]}${counts[1] ? `, может: ${counts[1]}` : ''}</div></div></div>
      ${mine ? `<div class="row"><button class="btn" data-evinfo="${id}">Гости и детали</button></div>` : past ? '<div class="hint">уже прошло</div>' : `<div class="row ev-btns">${['yes', 'maybe', 'no'].map((k) => `<button class="btn ${my === k ? 'down' : ''}" data-rsvp="${k}" data-ev="${id}">${EV_ANS[k]}${k === 'yes' && ev.price && my !== 'yes' ? ` (${ev.price} б.)` : ''}</button>`).join('')}<button class="btn icon" data-evinfo="${id}" title="Подробнее">…</button></div>`}</div>`;
  }
  function rsvp(id, answer) {
    const ev = (db.events || {})[id]; if (!ev || ev.host === me.uin) return;
    if (answer === 'yes' && ev.price && ev.guests[me.uin] !== 'yes') {
      const pts = myProfile().points || 0;
      if (pts < ev.price) { alertBox('Вход платный', `Нужно ${ev.price} б., у тебя ${pts}. Баллы — за сообщения, открытки, магниты и друзей.`); return; }
      confirmBox('Оплата', `Отдать ${ev.price} б. за вход на «${esc(ev.title)}»?`, () => { saveProfile({ points: pts - ev.price }); addPointsTo(ev.host, ev.price); doRsvp(id, 'yes', true); });
      return;
    }
    doRsvp(id, answer, false);
  }
  function doRsvp(id, answer, paid) {
    const ev = (db.events || {})[id];
    mutate((d) => { d.events[id].guests[me.uin] = answer; });
    Snd.play(answer === 'yes' ? 'tada' : 'click');
    const text = answer === 'yes' ? (paid ? `Приду! Оплатил(а) ${ev.price} б. 🎟` : 'Приду! 🎉') : answer === 'maybe' ? 'Может быть приду. Подумаю.' : 'Не смогу, увы :(';
    const msg = { id: uid(), from: me.uin, to: ev.host, ts: Date.now(), kind: 'rsvp', text: `${text} («${ev.title}»)` };
    pushHistory(msg); post({ type: 'msg', msg }); post({ type: 'events' });
    const bot = BOTS[ev.host];
    if (bot && bot.persona) { const P = bot.persona; const L = answer === 'yes' ? { aska: 'Ура! Жду тебя! Печеньки уже на столе :)', kat: 'УРА!!! жду)))', serega: 'ЕСТЬ!!! Колонки греются!!!', batya: 'Молодец. Жду. Лопату приготовлю.', max: 'Хорошо. Придёшь — поговорим о важном.', lena: 'Ой, как здорово!!! Жду :$', vova: 'ок. адрес скину' } : answer === 'maybe' ? { aska: 'Подумай. Я подожду, у меня это хорошо получается :)', kat: 'ну давай, решай))) я жду', serega: 'Давай без «может быть»!!! Приходи!', batya: 'Подумай. Но приезжай.', max: '«Может быть» — честный ответ. Уважаю.', lena: 'Ну пожалуйста, приди :$', vova: 'ясн' } : { aska: 'Жаль :( Ну ничего, открытку пришлю оттуда.', kat: 'ну вот :( ладно, в следующий раз', serega: 'Бро, ну как так?! Ладно, в следующий раз!!!', batya: 'Жаль. Ну, дела есть дела. Береги себя.', max: 'Отсутствие — тоже присутствие. Но жаль.', lena: 'Жа-а-аль :( Ладно...', vova: 'ок' }; setTimeout(() => botSays(bot, P.id === 'aska' ? L.aska : P.v(L[P.id] || L.aska)), 2000 + Math.random() * 2000); }
    if (active === ev.host) renderHistory();
    if (aux.kind === 'events') renderAux();
  }
  function addPointsTo(uin, n) { if (!db.accounts[uin]) return; mutate((d) => { d.profile[uin] = Object.assign(profileOf(uin), { points: (profileOf(uin).points || 0) + n }); }); }
  function createEventDialog() {
    if (!me) return;
    const def = new Date(Date.now() + 2 * 864e5); def.setHours(19, 0, 0, 0);
    const iso = new Date(def.getTime() - def.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    dialog({
      title: '📅 Позвать в гости',
      body: `<div class="col"><label class="row"><span class="lbl">Что</span><input class="field" id="e-title" maxlength="40" placeholder="Чай у меня / день рождения / сейшн"></label>
        <label class="row"><span class="lbl">Когда</span><input class="field" id="e-when" type="datetime-local" value="${iso}"></label>
        <label class="row"><span class="lbl">Где</span><input class="field" id="e-place" maxlength="40" placeholder="адрес или «в АСЬКЕ»"></label>
        <label class="row"><span class="lbl">Подробнее</span><input class="field" id="e-desc" maxlength="120" placeholder="что будет"></label>
        <label class="row"><span class="lbl">Вход</span><select class="field" id="e-price"><option value="0">бесплатно</option><option value="3">3 балла</option><option value="5">5 баллов</option><option value="10">10 баллов</option><option value="20">20 баллов</option></select></label>
        <label class="row"><span class="lbl">Кого звать</span><select class="field" id="e-scope"><option value="all">всех друзей</option><option value="close">круг «Близкие»</option><option value="biz">круг «Бизнес»</option><option value="chat">круг «Общение»</option></select></label>
        <div class="hint">Платный вход — в баллах АСЬКИ: гости платят при ответе «Приду», баллы приходят тебе.</div></div>`,
      buttons: [{ label: 'Разослать приглашения', primary: true, onClick: (ov) => { const title = $('#e-title', ov).value.trim(); if (!title) return false; const when = new Date($('#e-when', ov).value).getTime() || Date.now() + 864e5; createEvent({ title, when, place: $('#e-place', ov).value.trim(), desc: $('#e-desc', ov).value.trim(), price: +$('#e-price', ov).value }, $('#e-scope', ov).value); } }, { label: 'Отмена' }],
    });
  }
  function createEvent(data, scope) {
    const id = 'ev_' + uid();
    const invited = contactsOf(me.uin).filter((u) => !isTwin(u) && (scope === 'all' || circleOf(u) === scope));
    mutate((d) => { d.events = d.events || {}; d.events[id] = Object.assign({ id, host: me.uin, invited, guests: {}, ts: Date.now() }, data); });
    invited.forEach((u, i) => {
      const msg = { id: uid(), from: me.uin, to: u, ts: Date.now(), kind: 'invite', event: id, text: 'Приглашение: ' + data.title };
      pushHistory(msg); post({ type: 'msg', msg });
      const bot = BOTS[u];
      if (bot && bot.persona) setTimeout(() => botRsvp(bot, id), 4000 + i * 1500 + Math.random() * 6000);
    });
    addPost(me.uin, { id: uid(), from: me.uin, ts: Date.now(), likes: [], kind: 'invite', event: id });
    addPoints(5, 'мероприятие');
    Snd.play('tada');
    toast(me, `приглашений отправлено: ${invited.length}`, null);
    post({ type: 'events' });
    if (active) renderHistory();
    openAux('events');
    return id;
  }
  function botRsvp(bot, id) {
    const ev = (db.events || {})[id]; if (!ev || !me) return;
    const P = bot.persona;
    const r = Math.random();
    const ans = r < 0.6 ? 'yes' : r < 0.85 ? 'maybe' : 'no';
    mutate((d) => { d.events[id].guests[bot.uin] = ans; });
    if (ans === 'yes' && ev.price) addPoints(ev.price, `оплата от ${bot.nick}`);
    const L = ans === 'yes' ? { aska: `Приду! ${ev.price ? 'Оплатила, держи баллы :)' : 'Печеньки с меня :)'}`, kat: `приду!!! ${ev.price ? 'оплатила)))' : 'ура)))'}`, serega: `ПРИДУ!!! ${ev.price ? 'Оплатил, бро!' : 'Колонки брать?!'}`, batya: `Приеду. ${ev.price ? 'Заплатил, как положено.' : 'Привезу огурцов.'}`, max: `Приду. ${ev.price ? 'Оплатил. Деньги — условность, но ладно.' : 'Принесу вопросы.'}`, lena: `Приду!!! ${ev.price ? 'Оплатила :)' : 'Можно с подругой? :$'}`, vova: `приду. ${ev.price ? 'оплатил' : 'без галстука'}` }
      : ans === 'maybe' ? { aska: 'Постараюсь! Если не приду — пришлю открытку.', kat: 'может быть))) у меня сессия', serega: 'Может быть!!! Если сейшн не затянется', batya: 'Постараюсь. Дача, сам понимаешь.', max: 'Возможно. Всё возможно.', lena: 'Может быть... мама не отпускает :(', vova: 'мб' }
      : { aska: 'Не смогу :( Но буду мысленно. И открыткой.', kat: 'не смогу((( экзамен', serega: 'Бро, не смогу, у меня сейшн в тот же день!!!', batya: 'Не смогу. Картошка. Ты понимаешь.', max: 'Не приду. Иногда отсутствие — тоже вклад.', lena: 'Не смогу :( У меня Титаник', vova: 'не' };
    const text = P.id === 'aska' ? L.aska : P.v(L[P.id] || L.aska);
    botSays(bot, `${text} («${ev.title}»)`);
    post({ type: 'events' });
    if (aux.kind === 'events') renderAux();
  }
  function renderEvents() {
    const all = eventsAll().filter((e) => e.host === me.uin || e.invited.includes(me.uin)).sort((a, b) => a.when - b.when);
    const now = Date.now();
    const up = all.filter((e) => e.when >= now), past = all.filter((e) => e.when < now).reverse();
    const friends = eventsAll().filter((e) => e.host !== me.uin && !e.invited.includes(me.uin) && e.when >= now && contactsOf(me.uin).includes(e.host)).sort((a, b) => a.when - b.when);
    return `<div class="row"><button class="btn primary" id="ev-new">📅 Позвать в гости</button><span class="hint">Бесплатно или за баллы. Гости отвечают прямо в беседе.</span></div>
      <div class="groupbox"><span class="legend">Афиша (${up.length})</span>${up.length ? up.map((e) => inviteCard(e.id)).join('') : '<div class="hint">Пока ничего не запланировано. Позови кого-нибудь :)</div>'}</div>
      ${friends.length ? `<div class="groupbox"><span class="legend">У друзей (${friends.length})</span>${friends.map((e) => `<div class="evcard"><div class="ev-h"><span class="ev-ico">📅</span><div class="ti"><b>${esc(e.title)}</b><div class="muted">${fmtWhen(e.when)} · ${esc(e.place || '')}</div><div class="hint">${esc(e.desc || '')}</div><div class="muted">зовёт ${esc(nickOf(e.host))} · ${e.price ? `вход ${e.price} б.` : 'бесплатно'}</div></div></div><div class="row"><button class="btn" data-selfinvite="${e.id}">Хочу прийти</button></div></div>`).join('')}</div>` : ''}
      ${past.length ? `<div class="groupbox"><span class="legend">Прошедшие (${past.length})</span>${past.slice(0, 5).map((e) => inviteCard(e.id)).join('')}</div>` : ''}`;
  }
  function wireEvents() {
    $('#ev-new').onclick = createEventDialog;
    $$('[data-selfinvite]').forEach((b) => (b.onclick = () => { const id = b.dataset.selfinvite; mutate((d) => { if (d.events[id] && !d.events[id].invited.includes(me.uin)) d.events[id].invited.push(me.uin); }); Snd.play('click'); renderAux(); setTimeout(() => rsvp(id, 'yes'), 100); }));
  }
  function eventDialog(id) {
    const ev = (db.events || {})[id]; if (!ev) return;
    const rows = ev.invited.map((u) => `<div class="citem" style="padding-left:4px"><span class="ico">${avatarSvg(u, 16)}</span><span class="nick">${esc(nickOf(u))}</span><span class="muted">${ev.guests[u] ? EV_ANS[ev.guests[u]] : 'не ответил(а)'}</span></div>`).join('');
    dialog({ title: ev.title, body: `<div class="hint">${fmtWhen(ev.when)} · ${esc(ev.place || '')}<br>${esc(ev.desc || '')}<br>зовёт ${esc(nickOf(ev.host))} · ${ev.price ? `вход ${ev.price} б.` : 'бесплатно'}</div><div class="legend-line">Гости (${ev.invited.length})</div><div class="found inset">${rows || '<div class="empty-note">никого не звали</div>'}</div>`, buttons: ev.host === me.uin ? [{ label: 'Отменить мероприятие', onClick: () => confirmBox('Отмена', 'Удалить мероприятие?', () => { mutate((d) => { delete d.events[id]; }); if (aux.kind === 'events') renderAux(); }) }, { label: 'Закрыть', primary: true }] : [{ label: 'Закрыть', primary: true }] });
  }

  /* ================= приглашения и рефералы (цепочка) ================= */
  function refFromUrl() { try { const r = new URLSearchParams(location.search).get('ref') || ''; return Sec.isUin(r) && !isTwin(r) ? r : ''; } catch (e) { return ''; } }
  const inviterOf = (uin) => { const a = accountOf(uin); return a ? (a.invitedBy === undefined ? (BOTS[uin] ? null : '000001') : a.invitedBy) : null; };
  const inviteesOf = (uin) => allKnown().filter((a) => !a.twinOf && inviterOf(a.uin) === uin);
  function refTree(uin) {
    const l1 = inviteesOf(uin);
    const l2 = l1.flatMap((a) => inviteesOf(a.uin));
    const l3 = l2.flatMap((a) => inviteesOf(a.uin));
    return [l1, l2, l3];
  }
  function refHash(str) { let h = 2166136261; for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return '0x' + h.toString(16).padStart(8, '0'); }
  const REF_LEVELS = [{ min: 0, label: 'Новичок', icon: '🌱' }, { min: 1, label: 'Приглашающий', icon: '🌿' }, { min: 3, label: 'Посол', icon: '🌳' }, { min: 7, label: 'Магнат связей', icon: '🏛' }];
  function refLevelOf(uin) { const [a, b, c] = refTree(uin); const n = a.length + b.length + c.length; return REF_LEVELS.slice().reverse().find((l) => n >= l.min); }
  function recordReferral(acc) {
    const inviter = acc.invitedBy;
    const chain = []; let cur = inviter; for (let i = 0; i < 3 && cur; i++) { chain.push(cur); cur = inviterOf(cur); }
    const rewards = [10, 5, 2];
    mutate((d) => {
      d.refLog = d.refLog || [];
      const prev = d.refLog.length ? d.refLog[d.refLog.length - 1].hash : refHash('genesis');
      d.refLog.push({ idx: d.refLog.length + 1, ts: Date.now(), who: acc.uin, by: inviter, prev, hash: refHash(acc.uin + inviter + Date.now()), rewards: chain.map((u, i) => ({ to: u, pts: rewards[i] })) });
      chain.forEach((u, i) => { if (d.accounts[u]) { d.profile[u] = Object.assign(profileOf(u), { points: (profileOf(u).points || 0) + rewards[i] }); } });
    });
    post({ type: 'refs' });
  }
  function renderRefs() {
    const [l1, l2, l3] = refTree(me.uin);
    const lvl = refLevelOf(me.uin);
    const link = location.origin + location.pathname.replace(/[^/]*$/, '') + '?ref=' + me.uin;
    const up = []; let cur = inviterOf(me.uin); for (let i = 0; i < 4 && cur; i++) { up.push(cur); cur = inviterOf(cur); }
    const block = (uin, lv, extra) => `<div class="block lv${lv}"><div class="bh"><span class="mono">${refHash(uin)}</span><span class="sp"></span><span class="muted">${extra || ''}</span></div><div class="bb"><span class="ico">${avatarSvg(uin, 18)}</span><b class="link" data-wall="${esc(uin)}">${esc(nickOf(uin))}</b><span class="muted">#${esc(uin)}</span></div></div>`;
    const log = (db.refLog || []).slice(-8).reverse();
    return `<div class="wall-head"><span class="ico big-emoji">${lvl.icon}</span><div class="who"><b>${esc(me.nick)} — ${lvl.label}</b><div class="hint">1-й круг: ${l1.length} · 2-й: ${l2.length} · 3-й: ${l3.length} · за каждого: +10 / +5 / +2 балла</div></div></div>
      <div class="groupbox"><span class="legend">Мой код приглашения</span><div class="row"><span class="uin-box inset" style="font-size:16px;padding:3px 8px">${me.uin}</span><button class="btn" id="rf-copy">Скопировать ссылку</button></div><div class="hint">Друг вводит код при регистрации (поле «Код друга») или открывает ссылку — код подставится сам.</div><input class="field mt" id="rf-link" value="${esc(link)}" readonly></div>
      <div class="groupbox"><span class="legend">Цепочка</span><div class="chain">${up.slice().reverse().map((u, i) => block(u, 0, i === 0 && !inviterOf(u) ? 'генезис' : 'пригласил(а) ↓')).join('')}${block(me.uin, 0, 'это ты')}${l1.length ? `<div class="chain-l">1-й круг</div>${l1.map((a) => block(a.uin, 1, '+10')).join('')}` : ''}${l2.length ? `<div class="chain-l">2-й круг</div>${l2.map((a) => block(a.uin, 2, '+5')).join('')}` : ''}${l3.length ? `<div class="chain-l">3-й круг</div>${l3.map((a) => block(a.uin, 3, '+2')).join('')}` : ''}${!l1.length ? '<div class="hint mt">Пока никого не пригласил(а). Отправь ссылку — и цепочка пойдёт.</div>' : ''}</div></div>
      <div class="groupbox"><span class="legend">Уровни</span>${REF_LEVELS.map((l) => `<div class="${l === lvl ? '' : 'muted'}">${l.icon} ${l.label} — от ${l.min} чел. в сети</div>`).join('')}</div>
      <div class="groupbox"><span class="legend">Леджер (${(db.refLog || []).length} блоков)</span>${log.length ? log.map((b) => `<div class="ledger"><span class="mono">#${b.idx} ${b.hash}</span><div>${esc(nickOf(b.who))} ← ${esc(nickOf(b.by))} · ${fmtDay(b.ts)} ${fmtTime(b.ts)}</div><div class="muted mono">prev ${b.prev}</div></div>`).join('') : '<div class="hint">Блоков пока нет: первая регистрация по коду — первый блок.</div>'}</div>`;
  }
  function wireRefs() {
    $('#rf-copy').onclick = () => { const v = $('#rf-link').value; const done = () => { Snd.play('click'); toast(me, 'ссылка скопирована', null); }; if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, () => { $('#rf-link').select(); done(); }); else { $('#rf-link').select(); done(); } };
  }

  /* ================= цифровой аватар КИРР ================= */
  const twinCache = {};
  const STOPW = new Set('этот этого была были было будет может очень тоже если когда нет да ну вот как что это там тут сейчас просто давай пока привет спасибо'.split(' '));
  const pluralRu = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
  const agoRu = (ts) => { const d = Math.floor((Date.now() - ts) / 864e5); if (d <= 0) return 'сегодня'; if (d === 1) return 'вчера'; if (d < 7) return d + ' ' + pluralRu(d, 'день', 'дня', 'дней') + ' назад'; const w = Math.floor(d / 7); if (w < 5) return w === 1 ? 'неделю назад' : w + ' недели назад'; return 'давно'; };
  // модель: фразы хозяина + пары «что ему написали → что он ответил»
  function twinModelOf(owner) {
    const msgs = [], pairs = []; let total = 0;
    Object.values(db.history).forEach((arr) => {
      let lastOther = null;
      arr.forEach((m) => {
        total++;
        if (m.from === owner && m.to === twinUin(owner)) { lastOther = null; return; } // команды своему аватару — не манера
        if (m.from === owner) { if (m.text && !m.card && !m.kind) { msgs.push(m.text); if (lastOther && m.ts - lastOther.ts < 1800000) pairs.push({ in: lastOther.text, out: m.text }); } lastOther = null; }
        else if (m.to === owner && m.text && !m.kind && !m.card && !isTwin(m.from)) lastOther = m;
      });
    });
    const c = twinCache[owner];
    if (c && c.total === total && c.n === msgs.length) return c;
    const model = Brain.twin.build(msgs, pairs);
    twinCache[owner] = { n: msgs.length, total, model };
    return twinCache[owner];
  }
  // память самого аватара: чему научил хозяин, его ответы друзьям, на чём не нашёлся
  function twinStore(owner) { return Object.assign(Brain.twin.emptyStore(), profileOf(owner).twin || {}); }
  function saveTwinStore(owner, store) { mutate((d) => { d.profile = d.profile || {}; d.profile[owner] = Object.assign(profileOf(owner), { twin: store }); }); }
  function twinFacts(owner) {
    const acc = accountOf(owner); const prof = profileOf(owner);
    const mem = Object.assign({}, (db.memory[owner] || {})['000001'] || {});
    const per = {}, lastTs = {};
    Object.values(db.history).forEach((arr) => arr.forEach((m) => {
      if (m.from === owner && m.text && !m.kind) { const to = m.to; if (!per[to]) per[to] = { count: 0, words: {} }; per[to].count++; lastTs[to] = Math.max(lastTs[to] || 0, m.ts); m.text.toLowerCase().split(/[^a-zа-яё0-9]+/).forEach((w) => { if (w.length > 3 && !STOPW.has(w)) per[to].words[w] = (per[to].words[w] || 0) + 1; }); }
      else if (m.to === owner && m.text) lastTs[m.from] = Math.max(lastTs[m.from] || 0, m.ts);
    }));
    const circle = (u) => (prof.circles || {})[u] || (BOTS[u] && BOTS[u].circle) || 'chat';
    const ORDER = { close: 0, biz: 1, chat: 2 };
    const friends = (db.contacts[owner] || []).filter((u) => !isTwin(u) && accountOf(u)).map((u) => { const v = per[u] || { count: 0, words: {} }; return { uin: u, nick: nickOf(u), circle: circle(u), count: v.count, topics: Object.entries(v.words).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]), interests: profileOf(u).interests || [], last: lastTs[u] ? agoRu(lastTs[u]) : null, bot: !!BOTS[u] }; }).sort((a, b) => ORDER[a.circle] - ORDER[b.circle] || b.count - a.count);
    // где сейчас: последний «я лечу» за три недели, иначе город из памяти Аськи
    const fl = fridgeOf(owner).filter((m) => m.origin === 'flight' && m.from === owner).sort((a, b) => b.ts - a.ts)[0];
    const C = fl && COUNTRY[fl.country];
    const location = fl && C && Date.now() - fl.ts < 21 * 864e5 ? { name: C.name, in: C.in || ('в ' + C.name), since: fl.ts, ago: (mem.gender === 'f' ? 'прилетела ' : 'прилетел ') + agoRu(fl.ts) } : null;
    const pr = db.presence[owner] || {}; const mine = me && owner === me.uin;
    const online = mine ? true : !!(pr.ts && Date.now() - pr.ts < 30000);
    const xs = mine ? myXstatus() : pr.xstatus || '';
    let activity = '', activity3 = '';
    if (/^слушаю: /.test(xs)) { activity = 'слушаю «' + xs.slice(8) + '»'; activity3 = 'слушает «' + xs.slice(8) + '»'; }
    else if (/^смотрю: /.test(xs)) { activity = 'смотрю «' + xs.slice(8) + '»'; activity3 = 'смотрит «' + xs.slice(8) + '»'; }
    else if (xs) { activity = 'в статусе «' + xs + '»'; activity3 = activity; }
    const modeL = MODES[prof.mode] ? MODES[prof.mode].label.toLowerCase() : '';
    if (modeL && !activity) { activity = `в режиме «${modeL}»`; activity3 = activity; }
    const favTrackIds = (prof.favTracks || []).filter((id) => Music.anyById(id));
    const favMovies = (prof.favMovies || []).map((id) => movieOf(id)).filter(Boolean).map((m) => m.title);
    const food = foodOf(owner).map((f) => (FOOD_BY[f.item] || { name: f.item }).name);
    const events = Object.values(db.events || {}).filter((e) => e.host === owner && (!e.when || e.when > Date.now() - 864e5)).map((e) => `«${e.title}»${e.place ? ' — ' + e.place : ''}${e.when ? ', ' + fmtDay(e.when) : ''}`);
    return { ownerUin: owner, owner: acc ? acc.nick : owner, name: mem.name, gender: mem.gender || Brain.guessGender(mem.name || (acc && acc.nick)), city: mem.city, music: mem.music, tea: mem.tea, pet: mem.pet, trip: mem.trip, job: mem.job, location, online, lastSeen: pr.ts ? (Date.now() - pr.ts < 864e5 ? 'сегодня в ' + fmtTime(pr.ts) : agoRu(pr.ts)) : null, status: pr.status, xstatus: xs, mode: modeL, activity, activity3, friends, interests: prof.interests || [], countries: Array.from(new Set(fridgeOf(owner).map((m) => COUNTRY[m.country] ? COUNTRY[m.country].name : m.country))), favTracks: favTrackIds.map((id) => Music.anyById(id).title), favTrackIds, favMovies, food, events, tier: TIER[tierOf(owner)] ? TIER[tierOf(owner)].label : tierOf(owner), points: prof.points || 0, playlists: (prof.playlists || []).map((p) => p.name), twinName: twinNick(owner) };
  }
  function twinTalk(bot, text) {
    const owner = bot.twinOf;
    const { model } = twinModelOf(owner);
    const facts = twinFacts(owner);
    const store = twinStore(owner);
    const mem = memOf(bot.uin);
    const msgs = Brain.twin.reply(text, model, facts, store, mem, { asker: me.uin, askerNick: me.nick, twinName: twinNick(owner) });
    saveMem(bot.uin, mem); saveTwinStore(owner, store);
    deliverSeq(bot, msgs, 700 + Math.random() * 900);
  }
  // окно «Обучение аватара»
  let twTab = 'learn';
  function renderTwin() {
    const uin = me.uin; const { model } = twinModelOf(uin); const facts = twinFacts(uin); const store = twinStore(uin); const name = twinNick(uin);
    const trainedN = Object.values(store.trained || {}).reduce((a, b) => a + b.length, 0);
    const score = Math.min(100, Math.round(model.n * 1.5 + (model.pairsN + store.pairs.length) * 3 + trainedN * 4 + store.taught.length * 2));
    const manner = [];
    if (model.n) {
      manner.push(model.caps > 0.5 ? 'пишет капсом' : model.lower > 0.5 ? 'всё с маленькой буквы' : 'обычный регистр');
      manner.push(`смайлы в ${Math.round(model.smileRate * 100)}% сообщений${model.laugh ? ', смеётся «' + model.laugh + '»' : model.topSmiles.length ? ', любимый ' + model.topSmiles[0] : ''}`);
      if (model.openers.length) manner.push('начинает с «' + model.openers.join('», «') + '»');
      if (model.address.length) manner.push('обращается «' + model.address.join('», «') + '»');
      if (model.multiEx > 0.3) manner.push('много восклицаний!!!'); else if (model.exclaim > 0.4) manner.push('часто с восклицанием');
      if (model.dots > 0.3) manner.push('любит многоточия...');
      manner.push(`в среднем ${Math.round(model.avgLen)} знаков`);
    }
    const tabs = `<div class="tabs tw-tabs"><button class="${twTab === 'learn' ? 'on' : ''}" data-tw="learn">Обучение${store.toLearn.length ? ' (' + store.toLearn.length + ')' : ''}</button><button class="${twTab === 'know' ? 'on' : ''}" data-tw="know">Что знает</button><button class="${twTab === 'phr' ? 'on' : ''}" data-tw="phr">Фразы</button></div>`;
    let panel = '';
    if (twTab === 'learn') panel = `
      <div class="legend-line">Обученность</div><div class="prog" title="${score}%"><i style="width:${score}%"></i></div>
      <div class="muted">${model.n} ${pluralRu(model.n, 'твоя фраза', 'твои фразы', 'твоих фраз')} · ${model.pairsN + store.pairs.length} ${pluralRu(model.pairsN + store.pairs.length, 'ответ', 'ответа', 'ответов')} друзьям · ${trainedN} из тренировок · ${store.taught.length} ${pluralRu(store.taught.length, 'факт', 'факта', 'фактов')}</div>
      <div class="legend-line">Манера</div><div>${manner.length ? manner.map(esc).join(' · ') : 'пока нечего сказать — напиши друзьям'}</div>
      ${model.words.length ? `<div class="muted">любимые слова: ${model.words.slice(0, 8).map(esc).join(', ')}</div>` : ''}
      <div class="legend-line">Как учить</div>
      <ol class="tw-how"><li><b>Само.</b> Пиши друзьям — ${esc(name)} запоминает фразы и то, как ты отвечаешь на их реплики.</li><li><b>Тренировка.</b> Кнопка «Потренировать» или слово «учись» в беседе: ${esc(name)} задаёт вопросы, ты отвечаешь, как ответил бы сам.</li><li><b>Факты.</b> «запомни: я в Москве до пятницы» — будет это знать и рассказывать друзьям.</li><li><b>Разбор.</b> На что ${esc(name)} не нашёлся — ниже. Ответь здесь, и друзьям он ответит твоими словами.</li></ol>
      <div class="legend-line">Не нашёлся, что ответить${store.toLearn.length ? ' (' + store.toLearn.length + ')' : ''}</div>
      ${store.toLearn.length ? store.toLearn.map((x, i) => `<div class="tl"><div><b class="link" data-chat="${esc(x.from)}">${esc(x.nick || nickOf(x.from))}</b>: «${esc(x.in)}»</div><div class="row"><input class="field sp" data-tl="${i}" placeholder="как бы ты ответил? Enter — сохранить"><button class="btn icon" data-tl-skip="${i}" title="Пропустить">×</button></div></div>`).join('') : '<div class="empty-note">Пока на всё находил ответ.</div>'}
      <div class="legend-line">Факты, которым ты научил</div>
      ${store.taught.length ? store.taught.map((x, i) => `<div class="row tl"><span class="sp">${esc(x)}</span><button class="btn icon" data-tw-del="${i}" title="Забыть">×</button></div>`).join('') : '<div class="empty-note">Напиши аватару «запомни: …».</div>'}
      <div class="row mt"><input class="field sp" id="tw-fact" maxlength="120" placeholder="запомни: …"><button class="btn" id="tw-factadd">Запомнить</button></div>`;
    else if (twTab === 'know') panel = `
      <div class="legend-line">Где ты и чем занят</div>
      <div>${facts.location ? `${facts.location.in} (${esc(facts.location.ago)})` : facts.city ? 'город: ' + esc(facts.city) : 'не знаю, где ты: нажми «Я лечу» или скажи «запомни: я в Москве»'}</div>
      <div class="muted">${esc(facts.activity3 || 'ничего не делаешь, судя по статусу')}</div>
      <div class="legend-line">Друзья (${facts.friends.length})</div>
      ${facts.friends.map((f) => `<div class="row tl"><span class="ico">${avatarSvg(f.uin, 14)}</span><b class="link sp" data-chat="${esc(f.uin)}">${esc(f.nick)}</b><span class="muted">${f.circle === 'close' ? '♥ близкие' : f.circle === 'biz' ? '▦ бизнес' : '☺ общение'} · ${f.count} сообщ.${f.topics.length ? ' · про ' + esc(f.topics.slice(0, 2).join(', ')) : ''}${f.last ? ' · ' + esc(f.last) : ''}</span></div>`).join('')}
      <div class="legend-line">Вкусы</div>
      <div class="muted">интересы: ${facts.interests.length ? esc(facts.interests.join(', ')) : '—'}</div>
      <div class="muted">музыка: ${facts.favTracks.length ? esc(facts.favTracks.slice(0, 4).join(', ')) : 'лайкни трек в виниле'}</div>
      <div class="muted">кино: ${facts.favMovies.length ? esc(facts.favMovies.slice(0, 4).join(', ')) : 'лайкни фильм в «Кино»'}</div>
      <div class="muted">холодильник: ${facts.food.length ? esc(facts.food.slice(0, 6).join(', ')) : '—'}</div>
      <div class="muted">поездки: ${facts.countries.length ? esc(facts.countries.join(', ')) : '—'}</div>
      ${facts.events.length ? `<div class="muted">зовёшь: ${esc(facts.events.join('; '))}</div>` : ''}
      <div class="muted">уровень ${esc(facts.tier)}, ${facts.points} баллов${facts.name ? ' · имя: ' + esc(facts.name) : ''}</div>
      <div class="hint mt">Друзья могут спросить аватара: «где он?», «что делает?», «кто его друзья?», «расскажи про Катю», «что любит есть?», «когда ответит?». Телефон не выдаёт.</div>`;
    else panel = `
      <div class="legend-line">Из тренировок</div>
      ${Object.keys(store.trained || {}).filter((k) => store.trained[k].length).map((k) => `<div class="tl"><b>${esc(Brain.twin.INTENT_RU[k] || k)}</b>${store.trained[k].map((x, i) => `<div class="row"><span class="sp">— ${esc(x)}</span><button class="btn icon" data-tw-trdel="${k}:${i}" title="Убрать">×</button></div>`).join('')}</div>`).join('') || '<div class="empty-note">Пока нет. Нажми «Потренировать».</div>'}
      <div class="legend-line">Твои ответы друзьям (из разбора)</div>
      ${store.pairs.length ? store.pairs.slice(-10).reverse().map((p) => `<div class="tl"><div class="muted">«${esc(p.in)}»</div><div>— ${esc(p.out)}</div></div>`).join('') : '<div class="empty-note">Пока нет.</div>'}
      <div class="legend-line">Фразы из переписки (${model.phrases.length})</div>
      <div class="muted">${model.phrases.slice(0, 25).map(esc).join(' · ') || 'напиши друзьям — появятся'}</div>`;
    return `<div class="twinwin">
      <div class="wall-head"><span class="ico">${avatarSvg(uin, 28)}</span><div class="who"><b>${esc(name)} — твой цифровой аватар</b><div class="hint">Отвечает друзьям твоими словами и манерой, знает твоих друзей, где ты и чем занят. Чем больше ты пишешь, тем точнее.</div></div></div>
      <div class="row"><button class="btn primary" id="tw-train">🎓 Тренировка</button><button class="btn" id="tw-chat">✉ Написать</button><input class="field" id="tw-name" maxlength="16" value="${esc(name)}" style="width:80px" title="имя аватара"><button class="btn" id="tw-save">Имя</button><button class="btn" id="tw-forget" title="Забыть тренировки и факты">Забыть</button></div>
      ${tabs}<div class="tabpanel v-list">${panel}</div></div>`;
  }
  function wireTwin() {
    const uin = me.uin; const tw = twinUin(uin);
    $$('.tw-tabs button').forEach((b) => (b.onclick = () => { twTab = b.dataset.tw; Snd.play('click'); renderAux(); }));
    $('#tw-train').onclick = () => { openChat(tw); const ta = $('#compose'); if (ta) { ta.value = 'учись'; send(); } };
    $('#tw-chat').onclick = () => openChat(tw);
    $('#tw-save').onclick = () => { const v = $('#tw-name').value.trim().slice(0, 16) || 'КИРР'; saveProfile({ twinName: v }); toast(me, `аватар теперь зовут ${v}`, null); renderContacts(); renderAux(); };
    $('#tw-forget').onclick = () => confirmBox('Аватар', 'Забыть всё, чему ты учил (тренировки, факты, разборы)? Переписку он помнит всё равно.', () => { saveTwinStore(uin, Brain.twin.emptyStore()); renderAux(); });
    const store = twinStore(uin);
    $$('[data-tl]').forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; const v = inp.value.trim(); if (!v) return; const item = store.toLearn[+inp.dataset.tl]; if (!item) return; store.pairs.push({ in: item.in, out: v, from: item.from, ts: Date.now() }); store.toLearn.splice(+inp.dataset.tl, 1); saveTwinStore(uin, store); Snd.play('click'); toast(me, `${twinNick(uin)} запомнил ответ`, null); renderAux(); }));
    $$('[data-tl-skip]').forEach((b) => (b.onclick = () => { store.toLearn.splice(+b.dataset.tlSkip, 1); saveTwinStore(uin, store); renderAux(); }));
    $$('[data-tw-del]').forEach((b) => (b.onclick = () => { store.taught.splice(+b.dataset.twDel, 1); saveTwinStore(uin, store); renderAux(); }));
    $$('[data-tw-trdel]').forEach((b) => (b.onclick = () => { const [k, i] = b.dataset.twTrdel.split(':'); store.trained[k].splice(+i, 1); saveTwinStore(uin, store); renderAux(); }));
    const fa = $('#tw-factadd'); if (fa) { const add = () => { const v = $('#tw-fact').value.replace(/^запомни[:,]?\s*/i, '').trim(); if (!v) return; store.taught.push(v); saveTwinStore(uin, store); Snd.play('click'); renderAux(); }; fa.onclick = add; $('#tw-fact').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); }); }
  }

  /* ================= пригласить друга: аватар встречает новичка ================= */
  let pendingWelcome = null;
  function copyText(v, msg) { const done = () => { Snd.play('click'); toast(me, msg, null); }; if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, () => window.prompt('Скопируй:', v)); else window.prompt('Скопируй:', v); }
  function inviteFriendDialog(prefill) {
    const link = location.origin + location.pathname.replace(/[^/]*$/, '') + '?ref=' + me.uin;
    const isPhone = /^[\d+ ()-]{6,}$/.test(prefill || '');
    const tn = twinNick(me.uin);
    const text = (name) => `Привет${name ? ', ' + name : ''}! Заходи в АСЬКУ: ${link}\nМой код: ${me.uin}. Там тебя встретит мой аватар ${tn} :)`;
    const saveInvite = (ov) => { const name = $('#iv-name', ov).value.trim(); const phone = normPhone($('#iv-phone', ov).value); const inv = (myProfile().invites || []).slice(); if ((name || phone) && !inv.some((i) => !i.joined && ((phone && i.phone === phone) || (!phone && i.name === name)))) { inv.push({ id: uid(), name, phone, ts: Date.now() }); saveProfile({ invites: inv }); } };
    dialog({ title: '✉ Пригласить друга', body: `<div class="col">
      <label class="row"><span class="lbl">Имя</span><input class="field" id="iv-name" maxlength="24" placeholder="как зовут друга" value="${isPhone ? '' : esc(prefill || '')}"></label>
      <label class="row"><span class="lbl">Телефон</span><input class="field" id="iv-phone" type="tel" inputmode="tel" placeholder="чтобы узнать его, когда придёт" value="${isPhone ? esc(prefill) : ''}"></label>
      <div class="hint">Друг открывает ссылку (код подставится сам) или вводит при регистрации код <b>${me.uin}</b>. Как только появится — ${esc(tn)} встретит его открыткой и песней, добавит в контакты и сообщит тебе.</div>
      <textarea class="field" id="iv-text" rows="4" readonly>${esc(text(isPhone ? '' : (prefill || '')))}</textarea></div>`,
      buttons: [{ label: 'Скопировать приглашение', primary: true, onClick: (ov) => { saveInvite(ov); copyText($('#iv-text', ov).value, 'приглашение скопировано — отправь другу'); } }].concat(navigator.share ? [{ label: 'Поделиться', onClick: (ov) => { saveInvite(ov); navigator.share({ title: 'АСЬКА', text: $('#iv-text', ov).value }).catch(() => {}); } }] : []).concat([{ label: 'Отмена' }]),
      onOpen: (ov) => { const n = $('#iv-name', ov); n.addEventListener('input', () => { $('#iv-text', ov).value = text(n.value.trim()); }); const ph = $('#iv-phone', ov); ph.addEventListener('input', () => maskPhoneInput(ph)); } });
  }
  // кто ждал этого новичка: по коду приглашения или по телефону из «пригласить»
  function whoInvited(acc) {
    const out = [];
    if (acc.invitedBy && db.accounts[acc.invitedBy] && !BOTS[acc.invitedBy]) out.push(acc.invitedBy);
    Object.keys(db.accounts).forEach((u) => { if (u === acc.uin || BOTS[u] || out.includes(u)) return; const inv = profileOf(u).invites || []; if (inv.some((i) => !i.joined && i.phone && i.phone === acc.phone)) out.push(u); });
    return out;
  }
  function welcomeFrom(owner, acc) {
    if (!me || !acc || me.uin !== acc.uin || !db.accounts[owner] || owner === acc.uin) return;
    const tw = twinUin(owner);
    mutate((d) => {
      d.contacts[owner] = d.contacts[owner] || []; [acc.uin, twinUin(acc.uin)].forEach((u) => { if (!d.contacts[owner].includes(u)) d.contacts[owner].push(u); });
      d.contacts[acc.uin] = d.contacts[acc.uin] || []; [owner, tw].forEach((u) => { if (!d.contacts[acc.uin].includes(u)) d.contacts[acc.uin].push(u); });
      const p = profileOf(owner);
      const inv = (p.invites || []).map((i) => (!i.joined && ((i.phone && i.phone === acc.phone) || (!i.phone && i.name && acc.nick.toLowerCase().startsWith(i.name.toLowerCase().slice(0, 3)))) ? Object.assign({}, i, { joined: acc.uin, joinedTs: Date.now() }) : i));
      d.profile[owner] = Object.assign(p, { invites: inv });
    });
    const bot = accountOf(tw); if (!bot) return;
    const { model } = twinModelOf(owner); const facts = twinFacts(owner); const store = twinStore(owner);
    const msgs = Brain.twin.welcome(model, facts, store, acc.nick, { twinName: twinNick(owner), defaultTrack: pick(['summer99', 'pager', 'disco99', 'lisboa']) });
    const mem = memOf(tw); mem.met = Date.now(); saveMem(tw, mem);
    deliverSeq(bot, msgs, 800);
    const g = Brain.guessGender(acc.nick) === 'f'; const og = facts.gender === 'f';
    const note = { id: uid(), from: tw, to: owner, ts: Date.now(), text: `Твой друг ${acc.nick} ${g ? 'появилась' : 'появился'} в АСЬКЕ (#${acc.uin}). Я ${g ? 'встретил её' : 'встретил его'} открыткой и песней, добавил в контакты. Напиши ${g ? 'ей' : 'ему'}!` };
    pushHistory(note); post({ type: 'msg', msg: note });
    setTimeout(() => { if (!db.accounts[owner]) return; addPost(owner, { id: uid(), from: tw, ts: Date.now(), kind: 'text', text: `Встретил ${acc.nick} в АСЬКЕ: ${accountOf(owner).nick} ${og ? 'звала' : 'звал'} — и вот ${g ? 'она' : 'он'} здесь. Открытка вручена, песня поставлена.`, likes: [] }); post({ type: 'wall', uin: owner, from: tw }); }, 12000);
    renderContacts();
  }

  /* ================= старт ================= */
  const unlock = () => { Snd.unlock(); Music.unlock(); };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true }));

  // iOS: при выезде клавиатуры уменьшаем «рабочий стол» до видимой области
  if (window.visualViewport) {
    const fit = () => {
      if (!isNarrow()) { document.documentElement.style.removeProperty('--vvh'); return; }
      document.documentElement.style.setProperty('--vvh', Math.round(window.visualViewport.height) + 'px');
      window.scrollTo(0, 0);
      const h = $('#history'); if (h) h.scrollTop = h.scrollHeight;
    };
    window.visualViewport.addEventListener('resize', fit);
    window.visualViewport.addEventListener('scroll', () => window.scrollTo(0, 0));
    fit();
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && me) { hiddenSent = 0; db = load(); renderContacts(); if (active) { markRead(active); renderHistory(); } } });
  window.addEventListener('resize', () => { if (me && !isNarrow()) $('.desktop').classList.remove('mode-chat'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aux.kind && !$$('.overlay').length && !menuEl && !smilesEl) closeAux(); });

  loadSession();
  loadExternalTracks();
  ensureMovies();
  try { const pp = new URLSearchParams(location.search).get('play'); if (pp && Music.anyById(pp)) pendingPlay = pp; const pw = new URLSearchParams(location.search).get('watch'); if (pw && movieOf(pw)) pendingWatch = pw; } catch (e) {}
  if (me) {
    if (pendingWatch) { const id = pendingWatch; pendingWatch = null; setTimeout(() => openAux('watch', id), 300); }
    if (pendingPlay) { setTimeout(() => openAux('vinyl'), 300); document.addEventListener('pointerdown', function once() { document.removeEventListener('pointerdown', once); if (pendingPlay) { Music.play(pendingPlay); pendingPlay = null; } }, { once: true }); }
    applyTheme();
    renderMain();
    if (active) $('.desktop').classList.add('mode-chat');
    contactsOf(me.uin).forEach((u) => (botState[u] = isOnline(u)));
    initBots();
    heartbeatTimer = setInterval(heartbeat, 10000);
    heartbeat();
    updateTitle();
  } else renderLogin();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
