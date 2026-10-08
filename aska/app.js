/* АСЬКА — мессенджер в духе ICQ 99/2000.
   Всё живёт в браузере: номера, контакты и переписка хранятся в localStorage,
   между вкладками одного устройства сообщения летают через BroadcastChannel,
   а компанию составляют боты-собеседники из 1999 года. */
(function () {
  'use strict';

  const VERSION = '1.0';
  const DB_KEY = 'aska.v1';
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
  function emptyDb() {
    return { accounts: {}, contacts: {}, history: {}, unread: {}, presence: {}, memory: {}, profile: {}, wall: {}, settings: { sound: true, volume: 0.8 }, lastLogin: '' };
  }
  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      const d = raw ? JSON.parse(raw) : emptyDb();
      const e = emptyDb();
      for (const k in e) if (d[k] == null) d[k] = e[k];
      return d;
    } catch (err) { return emptyDb(); }
  }
  let db = load();
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (err) {} }
  // перечитать → изменить → записать: так вкладки не затирают друг друга
  function mutate(fn) { db = load(); fn(db); save(); }

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
      help: 'Что умеет АСЬКА:\n• номер + ник + телефон при регистрации\n• контакты с цветочками-статусами\n• «о-оу!» на входящее сообщение\n• 22 смайла, у каждого свой звук\n• стена: открытки, записи, музыка — её видят друзья\n• интересы и процент совпадения, случайное знакомство\n• режимы «Близкие / Бизнес / Общение» — меняют статус и стиль\n• виниловый плеер с хитами и плейлистами\n• Аська и друзья с характером\n\nСпроси: «контакты», «статус», «смайлы», «звук», «вкладки».',
    },
  };
  // Аська и друзья — персонажи с характером, живут в brain.js
  Object.values(window.AskaBrain.personas).forEach((P) => {
    BOTS[P.uin] = { uin: P.uin, nick: P.nick, phone: P.phone, bot: true, brain: P.id, persona: P, always: !!P.always, seed: P.seed };
  });

  const SMILE_TAUNTS = ['Ой, какой смайлик! :)', 'Отвечаю тем же! :D', 'хихи :$', ';)', 'Ух ты! :O', 'Люблю смайлы @}->--', '8) круто'];

  /* ================= графика (art.js) ================= */
  const { STATUSES, statusInfo, flowerSvg, statusFlower, envelopeSvg, SMILES, SMILE_BY_ID, smileSvg, postcardSvg, COUNTRIES, COUNTRY, magnetSvg } = window.AskaArt;

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
      return esc(p[1]).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
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
  function accountOf(uin) { return db.accounts[uin] || BOTS[uin] || null; }
  function allKnown() {
    const list = Object.values(db.accounts).concat(Object.values(BOTS));
    return list;
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
  let toastTimer = null;

  function loadSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (s && db.accounts[s.uin]) {
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
      else sessionStorage.setItem(SESSION_KEY, JSON.stringify({ uin: me.uin, status: myStatus, open: openChats, active, drafts }));
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
    const text = ta.value.replace(/\s+$/, '');
    if (!text) return;
    const msg = { id: uid(), from: me.uin, to: active, text, ts: Date.now() };
    pushHistory(msg);
    addPoints(1);
    ta.value = '';
    delete drafts[active];
    saveSession();
    post({ type: 'msg', msg });
    Snd.play('sent');
    renderHistory();
    const bot = BOTS[active];
    if (bot) scheduleBotReply(bot, text);
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
    const bot = BOTS[to];
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
    const msg = { id: uid(), from: bot.uin, to: me.uin, text, ts: Date.now() };
    if (extra && extra.card) msg.card = extra.card;
    if (extra && extra.sound) msg.sound = extra.sound;
    if (extra && extra.track) { msg.kind = 'track'; msg.track = extra.track; }
    if (extra && extra.magnet) { msg.kind = 'magnet'; msg.country = extra.magnet.country; msg.serial = extra.magnet.id; }
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
    else if (m.type === 'wall') { db = load(); if (m.uin === me.uin && m.from !== me.uin) { const a = accountOf(m.from); if (a) { toast(a, 'оставил(а) запись у тебя на стене', null); Snd.play('tada'); } } if (aux.kind === 'wall' && aux.arg === m.uin) renderAux(); }
  };
  window.addEventListener('storage', (e) => {
    if (e.key !== DB_KEY || !me) return;
    db = load();
    renderContacts();
  });

  /* ================= Аська и друзья ================= */
  const Brain = window.AskaBrain;
  const botRt = {};              // состояние персонажей в этой вкладке: статус, подпись, таймеры
  let lastAnyProactive = 0;
  const playRef = (ref) => (ref && ref.startsWith('smile:') ? Snd.smile(ref.slice(6)) : Snd.play(ref));
  function rtOf(uin) { return botRt[uin] || (botRt[uin] = { status: null, xstatus: null, lastProactive: 0, unanswered: 0 }); }
  function memOf(uin) { db = load(); return Object.assign({}, (db.memory[me.uin] || {})[uin] || {}); }
  function saveMem(uin, mem) { mutate((d) => { d.memory[me.uin] = d.memory[me.uin] || {}; d.memory[me.uin][uin] = mem; }); }
  const femaleOf = (bot) => /^(aska|kat|lena)$/.test(bot.brain);

  // все персонажи — в список контактов; у каждого своя подпись к статусу и свой таймер
  function initBots() {
    mutate((d) => {
      d.contacts[me.uin] = d.contacts[me.uin] || [];
      Object.keys(BOTS).forEach((u) => { if (!d.contacts[me.uin].includes(u)) d.contacts[me.uin].push(u); });
    });
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
  function brainTalk(bot, text) {
    const rt = rtOf(bot.uin);
    Object.values(botRt).forEach((r) => (r.unanswered = 0));
    const mem = memOf(bot.uin);
    const msgs = Brain.reply(text, mem, { persona: bot.brain, xstatus: rt.xstatus, nick: me.nick, tier: tierOf(me.uin) });
    saveMem(bot.uin, mem);
    const first = msgs[0] && msgs[0].text ? msgs[0].text : '';
    const delay = 900 + Math.min(first.length, 160) * 16 + Math.random() * 1200;
    deliverSeq(bot, msgs, delay);
  }
  // персонажи пишут сами: вопросы, открытки, статусы
  function askaTick(force) {
    if (!me) return;
    const now = Date.now();
    if (!force && now - lastAnyProactive < 40000) return;
    const bots = contactsOf(me.uin).map(accountOf).filter((b) => b && b.persona && isOnline(b.uin));
    const totalUn = bots.reduce((a, b) => a + rtOf(b.uin).unanswered, 0);
    if (!force && totalUn >= 4) return;
    let pool = bots.filter((b) => { const rt = rtOf(b.uin); return force || (now - rt.lastProactive >= b.persona.gapMs && rt.unanswered < b.persona.maxUnanswered && !memOf(b.uin).muted); });
    if (typeof force === 'string') pool = pool.filter((b) => b.uin === force);
    if (!pool.length) return;
    if (!force && Math.random() > 0.55) return;
    const total = pool.reduce((a, b) => a + b.persona.weight, 0);
    let r = Math.random() * total, bot = pool[0];
    for (const b of pool) { r -= b.persona.weight; if (r <= 0) { bot = b; break; } }
    const rt = rtOf(bot.uin);
    const mem = memOf(bot.uin);
    const msgs = Brain.proactive(mem, { persona: bot.brain, xstatus: rt.xstatus });
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
    if (msgs.some((m) => m.text || m.card || m.track)) rt.unanswered++;
    deliverSeq(bot, msgs, 600 + Math.random() * 1500);
  }
  setInterval(askaTick, 15000);
  if (/debug/.test(location.search)) window.AskaDebug = { tick: (uin) => askaTick(uin || true), mem: () => load().memory, bots: () => botRt, wall: (u) => wallOf(u || me.uin), openAux, setMode, randomMeet, fly, addPoints, profile: () => myProfile(), dossier: buildDossier };

  /* ================= заголовок вкладки ================= */
  function updateTitle() {
    const n = me ? unreadTotal() : 0;
    clearInterval(titleTimer); titleTimer = null;
    if (!n) { document.title = 'АСЬКА'; return; }
    let flip = false;
    document.title = `(${n}) АСЬКА`;
    titleTimer = setInterval(() => { flip = !flip; document.title = flip ? '✉ Новое сообщение!' : `(${n}) АСЬКА`; }, 900);
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
    const known = Object.values(db.accounts);
    const last = prefill || db.lastLogin || '';
    app.innerHTML = `
    <div class="wins">
      <div class="win dialog" id="loginwin">
        <div class="titlebar">${flowerSvg('#3cb44a', 14, { logo: true })}<span class="ttl">АСЬКА — вход в сеть</span></div>
        <div class="login-body">
          <div class="bigflower">${flowerSvg('#3cb44a', 44, { logo: true })}<div class="logo-word center">АСЬКА<small>I seek you · по-русски · с 1998 года</small></div><a class="link" href="promo/" style="margin-top:6px">Чем она крута? 10 преимуществ →</a></div>
          <div class="tabs"><button class="on" data-tab="reg">Новый номер</button><button data-tab="login">Уже есть номер</button></div>
          <div class="tabpanel" id="tab-reg">
            <div class="col">
              <label class="row"><span class="lbl">Телефон</span><input class="field" id="r-phone" type="tel" inputmode="tel" placeholder="+7 (___) ___-__-__" autocomplete="tel"></label>
              <label class="row"><span class="lbl">Ник</span><input class="field" id="r-nick" maxlength="24" placeholder="как тебя звать в сети" autocomplete="nickname"></label>
              <label class="row"><span class="lbl">Пароль</span><input class="field" id="r-pass" type="password" maxlength="32" placeholder="можно без него" autocomplete="new-password"></label>
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
              ${known.length ? `<div class="hint">Номера на этом устройстве:</div><div class="found inset">${known.map((a) => `<div class="citem" data-pick="${a.uin}"><span class="ico">${statusFlower('offline')}</span><span class="nick">${esc(a.nick)}</span><span class="muted">${a.uin}</span></div>`).join('')}</div>` : '<div class="hint">На этом устройстве ещё нет номеров. Заведи новый на соседней вкладке.</div>'}
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
    $$('#tab-reg input', app).forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') register(); }));
    $('#l-go').onclick = login;
    $$('#tab-login input', app).forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); }));
    $$('[data-pick]', app).forEach((el) => (el.onclick = () => { $('#l-id').value = el.dataset.pick; $('#l-pass').focus(); }));
    if (last && known.length) $$('.tabs button', app)[1].click();
  }

  function register() {
    const phone = normPhone($('#r-phone').value);
    const nick = $('#r-nick').value.trim();
    const pass = $('#r-pass').value;
    const err = $('#r-err');
    if (phone.length < 10 || phone.length > 15) { err.textContent = 'Введи настоящий номер телефона.'; Snd.play('error'); return; }
    if (nick.length < 2) { err.textContent = 'Ник — хотя бы две буквы.'; Snd.play('error'); return; }
    if (Object.values(db.accounts).some((a) => a.phone === phone)) { err.textContent = 'На этот телефон уже заведён номер — войди через «Уже есть номер».'; Snd.play('error'); return; }
    err.textContent = '';
    const acc = { uin: newUin(), phone, nick, pass, created: Date.now() };
    mutate((d) => {
      d.accounts[acc.uin] = acc;
      d.contacts[acc.uin] = Object.keys(BOTS);
      d.lastLogin = acc.uin;
    });
    Snd.play('connect');
    dialog({
      title: 'Регистрация завершена',
      body: `<div class="center">Твой номер АСЬКИ:</div><div class="uin-box inset mt">${acc.uin}</div><div class="hint mt center">Запиши его на бумажке — по нему тебя будут искать друзья.<br>Телефон: ${esc(fmtPhone(phone))}</div>`,
      buttons: [{ label: 'Войти в сеть', primary: true, onClick: () => enter(acc) }],
    });
  }
  function login() {
    const id = $('#l-id').value.trim();
    const pass = $('#l-pass').value;
    const err = $('#l-err');
    const phone = normPhone(id);
    const acc = db.accounts[id] || Object.values(db.accounts).find((a) => a.phone === phone && phone.length >= 10);
    if (!acc) { err.textContent = 'Такого номера на этом устройстве нет.'; Snd.play('error'); return; }
    if ((acc.pass || '') !== pass) { err.textContent = 'Неверный пароль.'; Snd.play('error'); return; }
    mutate((d) => { d.lastLogin = acc.uin; });
    enter(acc);
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
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(heartbeat, 10000);
    updateTitle();
    const pending = unreadTotal();
    if (pending) setTimeout(() => Snd.play('incoming'), 900);
    // первое знакомство: админ здоровается, потом Аська
    if (!historyOf('123456').length) setTimeout(() => botSays(BOTS['123456'], BOTS['123456'].hello[0]), 1200);
    initBots();
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
        <div class="toolbar"><div class="modes" id="modes"></div><button class="btn icon" id="tb-wall" title="Моя стена">▤</button><button class="btn icon" id="tb-vinyl" title="Винил">♪</button><button class="btn icon" id="tb-random" title="Случайное знакомство">☺</button><button class="btn icon" id="tb-fridge" title="Холодильник с магнитами">🧲</button></div>
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
          <textarea class="field" id="compose" placeholder="Напиши что-нибудь… Enter — отправить" rows="3"></textarea>
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
    $('#tb-random').onclick = randomMeet;
    $('#tb-fridge').onclick = () => openAux('fridge', me.uin);
    $('#sb-np').onclick = () => openAux('vinyl');
    $('#aux-back').onclick = closeAux;
    $('#aux-close').onclick = closeAux;
    $('#c-exit').onclick = () => confirmBox('Выход', 'Выйти из АСЬКИ?', logout);
    $('#c-about').onclick = about;
    $('#add-btn').onclick = addContactDialog;
    $('#status-btn').onclick = statusDialog;
    $('#m-contacts').onclick = (e) => showMenu(e.currentTarget, [
      { label: 'Добавить контакт…', onClick: addContactDialog },
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
    const inMode = (a) => a.brain === 'aska' || circleOf(a.uin) === mode; // Аська — в любом круге
    const mine = list.filter(inMode);
    const other = list.filter((a) => !inMode(a)).sort(byNick);
    const on = mine.filter((a) => isOnline(a.uin)).sort(byNick);
    const off = mine.filter((a) => !isOnline(a.uin)).sort(byNick);
    const item = (a) => {
      const n = unreadFrom(a.uin);
      const st = statusOf(a.uin);
      const ico = n ? `<span class="blink">${envelopeSvg(16)}</span>` : statusFlower(st, 16, TIER[tierOf(a.uin)].ring);
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
    tabs.innerHTML = openChats.map((u) => { const a = accountOf(u); const n = unreadFrom(u); return `<button class="${u === active ? 'on' : ''}" data-uin="${u}">${n ? `<span class="blink">${envelopeSvg(12)}</span>` : statusFlower(statusOf(u), 12)}<span>${esc(a.nick)}</span><i data-close="${u}" title="Закрыть">×</i></button>`; }).join('');
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
      ta.addEventListener('input', () => { drafts[active] = ta.value; });
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
      if (m.kind === 'magnet') {
        html += `<div class="msg ${mine ? 'me' : 'them'}"><span class="hdr">${esc(who ? who.nick : m.from)} <span class="time">(${fmtTime(m.ts)})</span>:</span>${magnetCard(m.country, m.serial, m.text)}</div>`;
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
      body: `<label class="row"><span class="lbl">Кого ищем</span><input class="field" id="f-q" placeholder="номер, телефон или ник"></label><div class="found inset" id="f-res"><div class="empty-note">Набери хотя бы две буквы или цифры.</div></div>`,
      buttons: [{ label: 'Закрыть' }],
      onOpen: (ov) => {
        const q = $('#f-q', ov), res = $('#f-res', ov);
        const run = () => {
          const v = q.value.trim().toLowerCase();
          const ph = normPhone(v);
          if (v.length < 2) { res.innerHTML = '<div class="empty-note">Набери хотя бы две буквы или цифры.</div>'; return; }
          const mine = contactsOf(me.uin);
          const found = allKnown().filter((a) => a.uin !== me.uin && (a.uin.includes(v) || a.nick.toLowerCase().includes(v) || (ph.length >= 4 && a.phone && normPhone(a.phone).includes(ph))));
          if (!found.length) { res.innerHTML = '<div class="empty-note">Никого не нашли. Друг должен завести номер на этом же устройстве — или открой АСЬКУ во второй вкладке.</div>'; return; }
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
  };
  Object.keys(BOT_EXTRA).forEach((u) => { if (BOTS[u]) Object.assign(BOTS[u], { interests: BOT_EXTRA[u].interests, circle: BOT_EXTRA[u].circle, wallSeed: BOT_EXTRA[u].wall }, BOT_MORE[u] || {}); });

  function profileOf(uin) {
    const p = (db.profile || {})[uin];
    const b = BOTS[uin];
    return Object.assign({ interests: b ? b.interests || [] : [], mode: 'chat', circles: {}, playlists: [], avatar: b ? (b.avatar === undefined ? null : b.avatar) : SMILES[parseInt(uin, 10) % SMILES.length].id, xstatus: null, points: 0, fridge: null, dossierOpen: b ? b.dossierOpen !== false : true }, p || {});
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
    if (st.playing && st.trackId && Music.byId[st.trackId]) return 'слушаю: ' + Music.byId[st.trackId].title;
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
    el.innerHTML = Object.keys(MODES).map((k) => `<button class="${k === cur ? 'on' : ''}" data-mode="${k}" title="${esc(MODES[k].label)} — ${esc(MODES[k].hint)}"><span class="mi">${MODES[k].icon}</span><span class="lab">${MODES[k].label}</span></button>`).join('');
    $$('button', el).forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
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
    if (aux.kind === 'wall' && aux.arg === toUin) renderAux();
  }
  function postWall(toUin, data) {
    const p = Object.assign({ id: uid(), from: me.uin, ts: Date.now(), likes: [] }, data);
    addPost(toUin, p);
    post({ type: 'wall', uin: toUin, from: me.uin });
    Snd.play(data.kind === 'card' ? 'tada' : 'sent');
    addPoints(data.kind === 'card' ? 5 : 3, data.kind === 'card' ? 'открытка' : 'запись на стене');
    const bot = BOTS[toUin];
    if (bot && bot.persona && toUin !== me.uin) thankForWall(bot, p);
    return p;
  }
  function botPostsWall(bot, toUin, data) {
    const p = Object.assign({ id: uid(), from: bot.uin, ts: Date.now(), likes: [] }, data);
    addPost(toUin, p);
    return p;
  }
  function thankForWall(bot, p) {
    const P = bot.persona;
    const L = p.kind === 'card'
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
    const t = Music.byId[id]; if (!t) return '<div class="muted">трек не найден</div>';
    const np = Music.state.trackId === id && Music.state.playing;
    return `<div class="trackcard ${np ? 'np' : ''}" data-track="${id}"><span class="disc" style="--c:${t.color}"></span><div class="ti"><b>${esc(t.title)}</b><div class="muted">${esc(t.artist)} · ${t.year} · ${Music.STYLE_NAMES[t.style]}</div></div><button class="btn icon" data-play="${id}" title="${np ? 'Пауза' : 'Слушать'}">${np ? '❚❚' : '▶'}</button></div>`;
  };
  const playlistCard = (pl) => {
    if (!pl) return '';
    const names = pl.tracks.map((i) => (Music.byId[i] ? Music.byId[i].title : '')).filter(Boolean);
    return `<div class="trackcard pl"><span class="disc stack"></span><div class="ti"><b>♪ ${esc(pl.name)}</b><div class="muted">${pl.tracks.length} тр.: ${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? '…' : ''}</div></div><button class="btn icon" data-playpl="${esc(pl.tracks.join(','))}" data-plname="${esc(pl.name)}" title="Слушать плейлист">▶</button></div>`;
  };
  function renderPost(p, wallUin) {
    const from = accountOf(p.from) || { nick: p.from, uin: p.from };
    let content = '';
    if (p.kind === 'card') content = `<div class="postcard pc-${esc(p.card)}" data-sound="${esc(Brain.CARDS[p.card] ? Brain.CARDS[p.card].sound : '')}" title="Нажми, чтобы послушать">${postcardSvg(p.card)}</div>${p.text ? `<div class="pc-cap">${renderText(p.text)}</div>` : ''}`;
    else if (p.kind === 'track') content = trackCard(p.track) + (p.note ? `<div class="txt">${renderText(p.note)}</div>` : '');
    else if (p.kind === 'playlist') content = playlistCard(p.playlist) + (p.note ? `<div class="txt">${renderText(p.note)}</div>` : '');
    else if (p.kind === 'magnet') content = magnetCard(p.country, p.serial, p.text);
    else content = `<div class="txt">${renderText(p.text || '')}</div>`;
    const likes = p.likes || [];
    const liked = likes.includes(me.uin);
    return `<div class="post" data-id="${p.id}"><div class="post-h"><span class="ico">${statusFlower(statusOf(p.from), 14)}</span><b class="link" data-wall="${esc(from.uin)}">${esc(from.nick)}</b><span class="muted">${fmtDay(p.ts)} ${fmtTime(p.ts)}</span><span class="sp"></span><button class="like ${liked ? 'on' : ''}" data-like="${p.id}" data-wallof="${esc(wallUin)}" title="Нравится">♥${likes.length ? ' ' + likes.length : ''}</button></div>${content}</div>`;
  }
  function renderWall(uin) {
    const a = accountOf(uin); if (!a) return '<div class="empty-note">Нет такого пользователя.</div>';
    const mine = uin === me.uin;
    const pct = mine ? null : matchPct(me.uin, uin);
    const prof = profileOf(uin);
    const common = mine ? [] : commonInterests(me.uin, uin);
    const posts = wallOf(uin);
    const tierW = tierOf(uin);
    return `<div class="wall-head"><span class="ico">${avatarSvg(uin, 30)}</span><div class="who"><b>${esc(a.nick)}</b> <span class="muted">#${a.uin}</span> ${tierW !== 'basic' ? `<span class="tier ${tierW}">${TIER[tierW].badge}</span>` : ''}<div class="hint">${esc(xstatusOf(uin) || statusInfo(statusOf(uin)).label)}</div></div>${mine ? '' : `<div class="pct" title="Совпадение интересов">${pct == null ? '—' : pct + '%'}</div>`}</div>
      <div class="chips small">${prof.interests.length ? prof.interests.map((i) => `<span class="chip ${common.includes(i) ? 'on' : ''}">${esc(i)}</span>`).join('') : `<span class="muted">${mine ? 'интересы не указаны — добавь в профиле' : 'интересы не указаны'}</span>`}</div>
      <div class="row wall-actions">${mine ? '<button class="btn" id="w-profile">Профиль</button>' : '<button class="btn" id="w-chat">Написать</button><button class="btn" id="w-profile">Профиль</button>'}<button class="btn" id="w-card">Открытка</button><button class="btn" id="w-track">♪ Трек</button><button class="btn" id="w-dos">📁</button><button class="btn" id="w-fr">🧲</button></div>
      <div class="row"><input class="field" id="w-text" maxlength="300" placeholder="${mine ? 'Что нового?' : 'Написать на стене…'}"><button class="btn" id="w-send">OK</button></div>
      <div class="wall-posts inset" id="w-posts">${posts.length ? posts.map((p) => renderPost(p, uin)).join('') : '<div class="empty-note">На стене пока пусто. Будь первым :)</div>'}</div>`;
  }
  function wireWall(uin) {
    const mine = uin === me.uin;
    const send = () => { const inp = $('#w-text'); const text = (inp.value || '').trim(); if (!text) return; postWall(uin, { kind: 'text', text }); inp.value = ''; };
    $('#w-send').onclick = send;
    $('#w-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    $('#w-profile').onclick = () => openAux('profile', uin);
    $('#w-dos').onclick = () => openAux('dossier', uin);
    $('#w-fr').onclick = () => openAux('fridge', uin);
    if (!mine) $('#w-chat').onclick = () => openChat(uin);
    $('#w-card').onclick = () => pickCardDialog((card) => {
      dialog({ title: 'Подпись к открытке', body: `<div class="center"><div class="postcard pc-${card}" style="display:inline-block">${postcardSvg(card)}</div></div><input class="field mt" id="c-text" maxlength="200" placeholder="пару слов (можно без них)">`, buttons: [{ label: 'На стену', primary: true, onClick: (ov) => { postWall(uin, { kind: 'card', card, text: $('#c-text', ov).value.trim() }); } }, { label: 'Отмена' }] });
    });
    $('#w-track').onclick = () => pickTrackDialog((kind, payload) => {
      if (kind === 'track') postWall(uin, { kind: 'track', track: payload });
      else postWall(uin, { kind: 'playlist', playlist: payload });
    });
  }
  function pickCardDialog(cb) {
    const kinds = Object.keys(Brain.CARDS).filter((k) => k !== 'trip');
    dialog({ title: 'Выбери открытку', body: `<div class="card-pick">${kinds.map((k) => `<button data-card="${k}" title="${k}"><div class="postcard pc-${k}">${postcardSvg(k)}</div></button>`).join('')}</div>`, buttons: [{ label: 'Отмена' }], onOpen: (ov) => $$('[data-card]', ov).forEach((b) => (b.onclick = () => { playRef(Brain.CARDS[b.dataset.card].sound); ov.remove(); cb(b.dataset.card); })) });
  }
  function pickTrackDialog(cb) {
    const pls = myProfile().playlists;
    dialog({ title: 'Поделиться музыкой', body: `<div class="found inset v-list">${Music.TRACKS.map((t) => `<div class="trow" data-pick-track="${t.id}"><span class="disc" style="--c:${t.color}"></span><div class="ti"><b>${esc(t.title)}</b><div class="muted">${esc(t.artist)}</div></div></div>`).join('')}${pls.length ? '<div class="cgroup">Плейлисты</div>' + pls.map((pl) => `<div class="trow" data-pick-pl="${pl.id}"><span class="disc stack"></span><div class="ti"><b>♪ ${esc(pl.name)}</b><div class="muted">${pl.tracks.length} тр.</div></div></div>`).join('') : ''}</div>`, buttons: [{ label: 'Отмена' }], onOpen: (ov) => {
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
        <div class="groupbox"><span class="legend">Мои интересы (${prof.interests.length})</span><div class="chips" id="p-chips">${INTERESTS.map((i) => `<button class="chip ${prof.interests.includes(i) ? 'on' : ''}" data-int="${esc(i)}">${esc(i)}</button>`).join('')}${custom.map((i) => `<button class="chip on" data-int="${esc(i)}" title="убрать">${esc(i)} ×</button>`).join('')}</div>
          <div class="row mt"><input class="field" id="p-custom" maxlength="20" placeholder="свой интерес"><button class="btn" id="p-add">+</button></div></div>
        <div class="groupbox"><span class="legend">Режим</span><div class="modes" id="p-modes">${Object.keys(MODES).map((k) => `<button class="${prof.mode === k ? 'on' : ''}" data-mode="${k}">${MODES[k].icon} ${MODES[k].label}</button>`).join('')}</div><div class="hint mt">Режим меняет статус, цвет окон и то, чей круг показан первым. Круг контакта — в его профиле.</div></div>
        <div class="hint">Интересы видят друзья на твоей стене. По ним считается процент совпадения и подбирается случайное знакомство.</div>`;
    }
    const pct = matchPct(me.uin, uin), common = commonInterests(me.uin, uin);
    const tierC = tierOf(uin);
    return `<div class="wall-head"><span class="ico">${avatarSvg(uin, 30)}</span><div class="who"><b>${esc(a.nick)}</b> <span class="muted">#${a.uin}</span> ${tierC !== 'basic' ? `<span class="tier ${tierC}">${TIER[tierC].badge}</span>` : ''}<div class="hint">${a.phone ? esc(fmtPhone(a.phone)) + ' · ' : ''}${esc(xstatusOf(uin) || statusInfo(statusOf(uin)).label)}</div></div><div class="pct" title="Совпадение интересов">${pct == null ? '—' : pct + '%'}</div></div>
      <div class="groupbox"><span class="legend">Интересы</span><div class="chips">${prof.interests.length ? prof.interests.map((i) => `<span class="chip ${common.includes(i) ? 'on' : ''}">${esc(i)}</span>`).join('') : '<span class="muted">не указаны</span>'}</div><div class="hint mt">${pct == null ? 'Укажи свои интересы — и Аська посчитает совпадение.' : common.length ? 'Общее: ' + esc(common.join(', ')) : 'Общих интересов нет. Самые интересные разговоры начинаются так.'}</div></div>
      <div class="groupbox"><span class="legend">Круг</span>${Object.keys(MODES).map((k) => `<label class="row"><input type="radio" name="circle" value="${k}" ${circleOf(uin) === k ? 'checked' : ''}> ${MODES[k].icon} ${MODES[k].label}</label>`).join('')}</div>
      <div class="row"><button class="btn primary" id="pr-chat">Написать</button><button class="btn" id="pr-wall">Стена</button><button class="btn" id="pr-dos">Досье</button><button class="btn" id="pr-fridge">🧲</button></div>`;
  }
  function wireProfile(uin) {
    if (uin === me.uin) {
      $$('#p-chips .chip').forEach((b) => (b.onclick = () => {
        const i = b.dataset.int; const list = myProfile().interests.slice();
        const k = list.indexOf(i); if (k >= 0) list.splice(k, 1); else list.push(i);
        saveProfile({ interests: list }); Snd.play('click'); renderAux(); renderContacts();
      }));
      const add = () => { const v = $('#p-custom').value.trim().toLowerCase(); if (v.length < 2) return; const list = myProfile().interests.slice(); if (!list.includes(v)) list.push(v); saveProfile({ interests: list }); renderAux(); };
      $('#p-add').onclick = add;
      $('#p-custom').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
      $$('#p-modes button').forEach((b) => (b.onclick = () => { setMode(b.dataset.mode); renderAux(); }));
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
    aux.kind = kind; aux.arg = arg || null;
    hideSmiles();
    $('.desktop').classList.add('mode-aux');
    renderAux();
    Snd.play('click');
  }
  function closeAux() {
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
  }
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
    const pc = e.target.closest('#aux-body .postcard, .overlay .postcard');
    if (pc && pc.dataset.sound) { playRef(pc.dataset.sound); pc.replaceWith(pc.cloneNode(true)); }
  });

  /* ================= винил ================= */
  let vtab = 'tracks', vpl = null;
  function renderVinyl() {
    const st = Music.state; const t = st.trackId ? Music.byId[st.trackId] : null;
    const prof = myProfile(); const pls = prof.playlists;
    const targets = [me].concat(contactsOf(me.uin).map(accountOf).filter(Boolean));
    const tracksList = Music.TRACKS.map((x) => `<div class="trow ${st.trackId === x.id ? 'np' : ''}"><button class="btn icon" data-play="${x.id}" title="Слушать">${st.trackId === x.id && st.playing ? '❚❚' : '▶'}</button><span class="disc" style="--c:${x.color}"></span><div class="ti"><b>${esc(x.title)}</b><div class="muted">${esc(x.artist)} · ${x.year} · ${Music.STYLE_NAMES[x.style]}</div></div><button class="btn icon" data-addpl="${x.id}" title="В плейлист">+</button></div>`).join('');
    const cur = pls.find((p) => p.id === vpl);
    const plPanel = `<div class="row"><input class="field" id="pl-name" maxlength="30" placeholder="название плейлиста"><button class="btn" id="pl-new">Создать</button></div>
      ${pls.length ? pls.map((pl) => `<div class="prow ${pl.id === vpl ? 'np' : ''}" data-pl="${pl.id}"><button class="btn icon" data-playpl="${esc(pl.tracks.join(','))}" data-plname="${esc(pl.name)}" title="Слушать" ${pl.tracks.length ? '' : 'disabled'}>▶</button><div class="ti"><b>♪ ${esc(pl.name)}</b><div class="muted">${pl.tracks.length} тр.</div></div><button class="btn icon" data-pl-wall="${pl.id}" title="На стену" ${pl.tracks.length ? '' : 'disabled'}>▤</button><button class="btn icon" data-pl-chat="${pl.id}" title="В беседу" ${pl.tracks.length && active ? '' : 'disabled'}>✉</button><button class="btn icon" data-pl-del="${pl.id}" title="Удалить">×</button></div>`).join('') : '<div class="empty-note">Плейлистов пока нет. Придумай название и жми «Создать», потом «+» у треков.</div>'}
      ${cur ? `<div class="cgroup">${esc(cur.name)}: треки</div>${cur.tracks.length ? cur.tracks.map((id, i) => `<div class="trow"><span class="muted">${i + 1}.</span><div class="ti"><b>${esc(Music.byId[id] ? Music.byId[id].title : id)}</b></div><button class="btn icon" data-pl-rm="${i}" title="Убрать">×</button></div>`).join('') : '<div class="empty-note">Пусто. Добавь треки кнопкой «+» во вкладке «Хиты».</div>'}` : ''}`;
    return `<div class="vinyl">
      <div class="tt"><div class="platter"><div class="record ${st.playing ? 'spin' : ''}" id="v-record"><div class="label" style="background:${t ? t.color : '#3cb44a'}"><span>${t ? esc(t.title) : 'АСЬКА'}</span></div></div></div><div class="arm ${st.trackId ? 'on' : ''}" id="v-arm"></div></div>
      <div class="np-box inset"><b id="v-title">${t ? esc(t.title) : 'Поставь пластинку'}</b><div class="muted" id="v-sub">${t ? esc(t.artist) + ' · ' + t.year + ' · ' + Music.STYLE_NAMES[t.style] : '12 хитов конца девяностых, синтезируются на лету'}</div><div class="hint" id="v-pos">${t ? `такт ${st.bar + 1}/16 · круг ${st.loop + 1}/2${st.queueName ? ' · ' + esc(st.queueName) : ''}` : 'Друзья увидят, что ты слушаешь'}</div></div>
      <div class="row v-ctrl"><button class="btn" id="v-prev" title="Предыдущий">⏮</button><button class="btn primary" id="v-toggle" title="Играть / пауза">${st.playing ? '❚❚' : '▶'}</button><button class="btn" id="v-next" title="Следующий">⏭</button><input type="range" id="v-vol" min="0" max="100" value="${Math.round(Music.volume * 100)}" title="Громкость"><label class="row" title="Шипение пластинки"><input type="checkbox" id="v-crackle" ${Music.crackle ? 'checked' : ''}> шип</label></div>
      <div class="row v-share"><span class="hint">Поделиться:</span><button class="btn" id="v-tochat" ${t && active ? '' : 'disabled'} title="${active ? 'Отправить в открытую беседу' : 'Сначала открой беседу'}">в беседу</button><button class="btn" id="v-towall" ${t ? '' : 'disabled'}>на стену</button><select class="field" id="v-wallto">${targets.map((a) => `<option value="${a.uin}">${a.uin === me.uin ? 'мою' : esc(a.nick)}</option>`).join('')}</select></div>
      <div class="tabs v-tabs"><button class="${vtab === 'tracks' ? 'on' : ''}" data-vt="tracks">Хиты</button><button class="${vtab === 'pl' ? 'on' : ''}" data-vt="pl">Плейлисты${pls.length ? ' (' + pls.length + ')' : ''}</button></div>
      <div class="tabpanel v-list">${vtab === 'tracks' ? tracksList : plPanel}</div>
    </div>`;
  }
  function wireVinyl() {
    $('#v-toggle').onclick = () => Music.toggle();
    $('#v-prev').onclick = () => Music.prev();
    $('#v-next').onclick = () => Music.next();
    $('#v-vol').oninput = (e) => { Music.volume = e.target.value / 100; };
    $('#v-crackle').onchange = (e) => { Music.crackle = e.target.checked; };
    $$('.v-tabs button').forEach((b) => (b.onclick = () => { vtab = b.dataset.vt; Snd.play('click'); renderAux(); }));
    $('#v-tochat').onclick = () => { if (Music.state.trackId && active) { sendSpecial(active, { kind: 'track', track: Music.state.trackId, text: '♪ ' + Music.byId[Music.state.trackId].title }); toast(accountOf(active), 'трек отправлен в беседу', null); } };
    $('#v-towall').onclick = () => { const to = $('#v-wallto').value; if (Music.state.trackId) { postWall(to, { kind: 'track', track: Music.state.trackId }); toast(accountOf(to), 'трек на стене', null); } };
    $$('[data-addpl]').forEach((b) => (b.onclick = () => addToPlaylist(b.dataset.addpl)));
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
  }
  function addToPlaylist(trackId) {
    const pls = myProfile().playlists.slice();
    const doAdd = (pl) => { if (!pl.tracks.includes(trackId)) pl.tracks.push(trackId); saveProfile({ playlists: pls }); vpl = pl.id; Snd.play('click'); toast(me, `«${Music.byId[trackId].title}» → ${pl.name}`, null); if (aux.kind === 'vinyl') renderAux(); };
    if (!pls.length) { const pl = { id: uid(), name: 'Мой плейлист', tracks: [] }; pls.push(pl); doAdd(pl); return; }
    if (pls.length === 1) { doAdd(pls[0]); return; }
    dialog({ title: 'В какой плейлист?', body: `<div class="status-list">${pls.map((pl) => `<button data-pl="${pl.id}">♪ ${esc(pl.name)} <span class="muted">(${pl.tracks.length})</span></button>`).join('')}<button data-pl="__new">+ новый плейлист</button></div>`, buttons: [{ label: 'Отмена' }], onOpen: (ov) => $$('[data-pl]', ov).forEach((b) => (b.onclick = () => { ov.remove(); if (b.dataset.pl === '__new') { const pl = { id: uid(), name: 'Плейлист ' + (pls.length + 1), tracks: [] }; pls.push(pl); doAdd(pl); } else doAdd(pls.find((p) => p.id === b.dataset.pl)); })) });
  }
  function updateNowPlaying() {
    const cell = $('#sb-np'); if (!cell) return;
    const st = Music.state; const t = st.trackId ? Music.byId[st.trackId] : null;
    cell.hidden = !t;
    if (t) cell.innerHTML = `${st.playing ? '♪' : '❚❚'} ${esc(t.title)}`;
  }
  let lastMusicTrack = null;
  Music.onChange((st) => {
    updateNowPlaying();
    if (aux.kind === 'vinyl') {
      const rec = $('#v-record'); if (rec) rec.classList.toggle('spin', st.playing);
      const arm = $('#v-arm'); if (arm) arm.classList.toggle('on', !!st.trackId);
      const tg = $('#v-toggle'); if (tg) tg.textContent = st.playing ? '❚❚' : '▶';
      const t = st.trackId ? Music.byId[st.trackId] : null;
      const pos = $('#v-pos'); if (pos && t) pos.textContent = `такт ${st.bar + 1}/16 · круг ${st.loop + 1}/2${st.queueName ? ' · ' + st.queueName : ''}`;
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
  function renderFridge(uin) {
    const a = accountOf(uin); if (!a) return '<div class="empty-note">Нет такого пользователя.</div>';
    const mine = uin === me.uin;
    const items = fridgeOf(uin);
    const countries = new Set(items.map((m) => m.country));
    const magnet = (m) => { const c = COUNTRY[m.country] || COUNTRY.UR; const from = m.from === uin ? '' : (accountOf(m.from) || { nick: m.from }).nick; return `<button class="magnet ${m.origin === 'gift' ? 'gift' : ''}" data-mid="${m.id}" title="${esc(c.name)} ${m.id}${from ? ' · от ' + esc(from) : ''} · ${fmtDay(m.ts)}">${magnetSvg(m.country, 56)}${from ? `<span class="from">от ${esc(from)}</span>` : ''}</button>`; };
    return `<div class="wall-head"><span class="ico">${avatarSvg(uin, 30)}</span><div class="who"><b>${mine ? 'Мой холодильник' : esc(a.nick)}</b><div class="hint">стран: ${countries.size} · магнитов: ${items.length}${mine ? ' · все магниты — НФТ с номером' : ''}</div></div></div>
      <div class="row wall-actions">${mine ? '<button class="btn primary" id="fr-fly">✈ Я лечу</button><button class="btn" id="fr-gift">🎁 Подарить</button>' : `<button class="btn" id="fr-giftto">🎁 Подарить ${esc(a.nick)}</button>`}</div>
      <div class="fridge"><div class="fridge-top"></div><div class="fridge-door">${items.length ? items.map(magnet).join('') : `<div class="empty-note">${mine ? 'Пусто. Нажми «Я лечу» — и первый магнит твой.' : 'Пока ни одного магнита. Подари первый!'}</div>`}</div><div class="fridge-handle"></div></div>
      <div class="hint">Нажми на магнит — узнаешь, откуда он и кто подарил.</div>`;
  }
  function wireFridge(uin) {
    const mine = uin === me.uin;
    if (mine) { $('#fr-fly').onclick = flyDialog; $('#fr-gift').onclick = () => giftMagnetDialog(); }
    else $('#fr-giftto').onclick = () => { const f = fridgeOf(me.uin); if (!f.length) { alertBox('Магниты', 'У тебя пока нет магнитов. Слетай куда-нибудь сначала ✈'); return; } dialog({ title: 'Подарить магнит', body: `<div class="magnet-grid inset" id="g2">${f.map((m) => `<button data-id="${m.id}" title="${esc(COUNTRY[m.country].name)}">${magnetSvg(m.country, 44)}</button>`).join('')}</div>`, buttons: [{ label: 'Отмена' }], onOpen: (ov) => $$('#g2 button', ov).forEach((b) => (b.onclick = () => { ov.remove(); giftMagnet(b.dataset.id, uin); })) }); };
    $$('.fridge .magnet').forEach((b) => (b.onclick = () => {
      const m = fridgeOf(uin).find((x) => x.id === b.dataset.mid); if (!m) return;
      const c = COUNTRY[m.country]; const from = accountOf(m.from);
      Snd.play('click');
      dialog({ title: `Магнит ${m.id}`, body: `<div class="center">${magnetSvg(m.country, 96)}</div><div class="center mt"><b>${c.flag} ${esc(c.name)}</b></div><div class="hint center">${m.origin === 'flight' ? `Привезён из поездки ${fmtDay(m.ts)}` : `Подарок от ${esc(from ? from.nick : m.from)}, ${fmtDay(m.ts)}`}<br>НФТ ${m.id} — Настоящий Фанерный Талисман, единственный в своём роде.</div>`, buttons: mine ? [{ label: 'Подарить', onClick: () => setTimeout(() => giftMagnetDialog(m.id), 30) }, { label: 'Закрыть', primary: true }] : [{ label: 'Закрыть', primary: true }] });
    }));
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
    out.verdict = b && b.persona ? ({ aska: 'Вердикт: это я. Я себе доверяю.', kat: 'Вердикт: лучший друг для режима «Общение». Не забудь мп3.', vova: 'Вердикт: надёжен, если не трогать его линукс.', serega: 'Вердикт: с ним не бывает тихо. Это плюс.', lena: 'Вердикт: подруга для режима «Близкие». Носи платочек.', batya: 'Вердикт: круг «Близкие», без вариантов. Поешь.', max: 'Вердикт: собеседник для вечера с чаем. Отвечает долго, но глубоко.' })[b.brain] || 'Вердикт: служебное досье.' : `Вердикт Аськи: ${traits.length ? traits.join(', ') + ' человек' : 'человек-загадка'}. ${mine ? 'Я бы с тобой дружила. Собственно, дружу.' : 'Можно дружить. Для круга «' + MODES[circleOf(uin)].label + '» — в самый раз.'}`;
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

  document.addEventListener('visibilitychange', () => { if (!document.hidden && me) { db = load(); renderContacts(); if (active) { markRead(active); renderHistory(); } } });
  window.addEventListener('resize', () => { if (me && !isNarrow()) $('.desktop').classList.remove('mode-chat'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aux.kind && !$$('.overlay').length && !menuEl && !smilesEl) closeAux(); });

  loadSession();
  if (me) {
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
