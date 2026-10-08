/* АСЬКА — мессенджер в духе ICQ 99/2000.
   Всё живёт в браузере: номера, контакты и переписка хранятся в localStorage,
   между вкладками одного устройства сообщения летают через BroadcastChannel,
   а компанию составляют боты-собеседники из 1999 года. */
(function () {
  'use strict';

  const VERSION = '1.0 · простая';
  const DB_KEY = 'aska.v1';
  const SESSION_KEY = 'aska.session';
  const Snd = window.AskaSound;

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
    return { accounts: {}, contacts: {}, history: {}, unread: {}, presence: {}, memory: {}, settings: { sound: true, volume: 0.8 }, lastLogin: '' };
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
      help: 'Что умеет АСЬКА:\n• номер + ник + телефон при регистрации\n• контакты с цветочками-статусами\n• «о-оу!» на входящее сообщение\n• 22 смайла, у каждого свой звук\n• переписка между вкладками одного устройства\n• боты-собеседники из 1999-го\n\nСпроси: «контакты», «статус», «смайлы», «звук», «вкладки».',
    },
  };
  // Аська и друзья — персонажи с характером, живут в brain.js
  Object.values(window.AskaBrain.personas).forEach((P) => {
    BOTS[P.uin] = { uin: P.uin, nick: P.nick, phone: P.phone, bot: true, brain: P.id, persona: P, always: !!P.always, seed: P.seed };
  });

  const SMILE_TAUNTS = ['Ой, какой смайлик! :)', 'Отвечаю тем же! :D', 'хихи :$', ';)', 'Ух ты! :O', 'Люблю смайлы @}->--', '8) круто'];

  /* ================= графика (art.js) ================= */
  const { STATUSES, statusInfo, flowerSvg, statusFlower, envelopeSvg, SMILES, SMILE_BY_ID, smileSvg, postcardSvg } = window.AskaArt;

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

  function heartbeat() {
    if (!me) return;
    db = load();
    mutate((d) => { d.presence[me.uin] = { status: myStatus, ts: Date.now() }; });
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
    mutate((d) => { d.presence[me.uin] = { status: key, ts: Date.now() }; });
    post({ type: 'presence', uin: me.uin });
    Snd.play('click');
    renderMe();
    renderContacts();
  }

  /* ================= контакты ================= */
  function contactsOf(uin) { return db.contacts[uin] || []; }
  function addContact(uin) {
    mutate((d) => {
      d.contacts[me.uin] = d.contacts[me.uin] || [];
      if (!d.contacts[me.uin].includes(uin)) d.contacts[me.uin].push(uin);
    });
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
      if (m.text || m.card) { typing[bot.uin] = true; renderContacts(); renderChatHead(); }
      setTimeout(() => {
        if (!me) return;
        if (m.status) setBotStatus(bot, m.status);
        if (m.text || m.card) {
          typing[bot.uin] = msgs.slice(i + 1).some((x) => x.text || x.card);
          botSays(bot, m.text || '', { card: m.card, sound: m.sound });
        }
      }, at);
    });
  }
  function brainTalk(bot, text) {
    const rt = rtOf(bot.uin);
    Object.values(botRt).forEach((r) => (r.unanswered = 0));
    const mem = memOf(bot.uin);
    const msgs = Brain.reply(text, mem, { persona: bot.brain, xstatus: rt.xstatus, nick: me.nick });
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
    rt.lastProactive = now; lastAnyProactive = now;
    if (msgs.some((m) => m.text || m.card)) rt.unanswered++;
    deliverSeq(bot, msgs, 600 + Math.random() * 1500);
  }
  setInterval(askaTick, 15000);
  if (/debug/.test(location.search)) window.AskaDebug = { tick: (uin) => askaTick(uin || true), mem: () => load().memory, bots: () => botRt };

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
          <div class="bigflower">${flowerSvg('#3cb44a', 44, { logo: true })}<div class="logo-word center">АСЬКА<small>I seek you · по-русски · с 1998 года</small></div><a class="link" href="../" style="margin-top:6px">АСЬКА v2 — со всеми новшествами →</a><span class="hint" style="margin-top:3px">Это простая v1: контакты, беседы, «о-оу», смайлы, Аська и друзья.</span></div>
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
    myStatus = 'online';
    openChats = []; active = null; drafts = {};
    saveSession();
    botState = {};
    contactsOf(me.uin).forEach((u) => (botState[u] = isOnline(u)));
    mutate((d) => { d.presence[me.uin] = { status: myStatus, ts: Date.now() }; });
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
    saveSession();
    clearInterval(heartbeatTimer);
    updateTitle();
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
        <div class="me-panel" id="me-panel"></div>
        <div class="clist inset" id="clist"></div>
        <div class="bottom-bar"><button class="btn status-btn" id="status-btn"></button><button class="btn icon" id="add-btn" title="Добавить контакт">+</button></div>
        <div class="statusbar"><div class="cell" id="sb-count"></div><div class="cell fit" id="sb-net">${statusFlower('online', 12)} в сети</div></div>
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

    renderMe(); renderContacts(); renderChatWindow();

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
    el.innerHTML = `<span class="ico">${statusFlower(myStatus, 16)}</span><span class="nick">${esc(me.nick)}</span><span class="sp"></span><span class="uin">#${me.uin}</span>`;
    const sb = $('#status-btn');
    if (sb) sb.innerHTML = `${statusFlower(myStatus, 16)}<span class="lab">${esc(statusInfo(myStatus).label)}</span><span class="sp"></span><span>▾</span>`;
    const net = $('#sb-net');
    if (net) net.innerHTML = `${statusFlower(myStatus, 12)} ${myStatus === 'offline' ? 'не в сети' : 'в сети'}`;
  }

  const collapsed = {};
  function renderContacts() {
    const el = $('#clist'); if (!el || !me) return;
    const list = contactsOf(me.uin).map((u) => accountOf(u)).filter(Boolean);
    const byNick = (a, b) => (b.brain === 'aska') - (a.brain === 'aska') || a.nick.localeCompare(b.nick, 'ru');
    const on = list.filter((a) => isOnline(a.uin)).sort(byNick);
    const off = list.filter((a) => !isOnline(a.uin)).sort(byNick);
    const item = (a) => {
      const n = unreadFrom(a.uin);
      const st = statusOf(a.uin);
      const ico = n ? `<span class="blink">${envelopeSvg(16)}</span>` : statusFlower(st, 16);
      return `<div class="citem ${active === a.uin ? 'sel' : ''} ${st === 'offline' ? 'off' : ''}" data-uin="${a.uin}" title="${esc(a.nick)} · ${a.uin}${a.phone ? ' · ' + esc(fmtPhone(a.phone)) : ''}${botRt[a.uin] && botRt[a.uin].xstatus ? ' · ' + esc(botRt[a.uin].xstatus) : ''}"><span class="ico">${ico}</span><span class="nick">${esc(a.nick)}</span>${typing[a.uin] ? '<span class="typing">печатает…</span>' : ''}${n ? `<span class="muted">${n}</span>` : ''}</div>`;
    };
    const group = (key, label, arr) => `<div class="cgroup" data-g="${key}"><span class="box">${collapsed[key] ? '+' : '−'}</span>${label} <span class="cnt">(${arr.length})</span></div>${collapsed[key] ? '' : arr.map(item).join('')}`;
    el.innerHTML = group('on', 'В сети', on) + group('off', 'Не в сети', off) + (!list.length ? '<div class="empty-note">Список пуст. Нажми «+» и найди друга по номеру, телефону или нику.</div>' : '');
    $$('.citem', el).forEach((c) => {
      c.onclick = () => openChat(c.dataset.uin);
    });
    $$('.cgroup', el).forEach((g) => (g.onclick = () => { collapsed[g.dataset.g] = !collapsed[g.dataset.g]; Snd.play('click'); renderContacts(); }));
    const cnt = $('#sb-count');
    if (cnt) cnt.textContent = `Контактов: ${list.length}, в сети: ${on.length}`;
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
    head.innerHTML = `<span class="ico">${statusFlower(st, 16)}</span><span class="nick">${esc(a.nick)}</span><span class="muted">#${a.uin}</span>${a.phone ? `<span class="muted">· ${esc(fmtPhone(a.phone))}</span>` : ''}<span class="sp"></span><span class="hint">${typing[active] ? 'печатает…' : esc(statusInfo(st).label) + (botRt[active] && botRt[active].xstatus ? ' · ' + esc(botRt[active].xstatus) : '')}</span>`;
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
      body: `<div class="status-list">${STATUSES.filter((s) => s.key !== 'offline').map((s) => `<button data-st="${s.key}">${statusFlower(s.key, 16)}<span>${esc(s.label)}</span>${s.key === myStatus ? '<span class="sp"></span><span>✓</span>' : ''}</button>`).join('')}</div>`,
      buttons: [{ label: 'Отмена' }],
      onOpen: (ov) => $$('[data-st]', ov).forEach((b) => (b.onclick = () => { setStatus(b.dataset.st); ov.remove(); })),
    });
  }

  /* ================= старт ================= */
  const unlock = () => { Snd.unlock(); };
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

  loadSession();
  if (me) {
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
