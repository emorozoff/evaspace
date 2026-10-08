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
    return { accounts: {}, contacts: {}, history: {}, unread: {}, presence: {}, settings: { sound: true, volume: 0.8 }, lastLogin: '' };
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
    '100500': {
      uin: '100500', nick: 'Катюха_98', phone: '+7 (916) 100-05-00', bot: true, seed: 3,
      hello: ['Приветик! :) Ты новенький? Я тут с 98-го сижу', 'Ку! Как сам? :)', 'О, кто-то в сети! Привет :)'],
      replies: ['ааа, понятно :)', 'Ну ты даёшь :D', 'слушай, а у тебя какой модем? у меня 33.6, еле тянет', 'Скинь мп3 какую-нить, а? Только не больше 3 мегов, а то до утра качать', 'я тут на инфе сижу в универе, препод не видит ;)', 'Пошли в чат на кроватке? там весело', 'Ща, мне мама звонить хочет, инет вырубит... ((', 'А ты из какого города?', ':* ', 'хихи :$', 'ооо круто!!! 8)', 'не, ну ты что :(', 'ща чайник поставлю и вернусь, не теряй'],
      bye: ['Пока-пока! Пиши! :*', 'Давай, удачи! Я на связи :)', 'Ну всё, побежала. Чмоки :*'],
      how: ['Да норм, модем только отваливается постоянно :( А у тебя?', 'Отлично! Сессию закрыла :D', 'Скучно... развесели меня :)'],
    },
    '31337': {
      uin: '31337', nick: 'ha©keR', phone: '+7 (495) 313-37-13', bot: true, seed: 11,
      hello: ['йо', 'привед. ты кто?', 'в сети. чё надо'],
      replies: ['lol', 'не, фигня', 'это всё ламерство', 'у меня линукс стоит, венда для домохозяек 8)', 'качаю дистрибутив уже 3 дня по дайлапу', 'напиши мне на мыло, тут небезопасно', 'я тебе уин подарю красивый, если фрилансер найдёшь', 'ы', 'мда', 'ясн', 'а ты в кваку играешь? го на сервак', 'ща ядро пересоберу и напишу', '>:) хехе', 'не палюсь', 'ок'],
      bye: ['bb', 'cya', 'давай. не пались'],
      how: ['норм. компилю', 'хз. винда опять синий экран показала, снёс', 'гуд. 3 ночи, самое время кодить 8)'],
    },
    '777777': {
      uin: '777777', nick: 'DJ_Serёga', phone: '+7 (903) 777-77-77', bot: true, seed: 7,
      hello: ['Хэй! Здарова! :D', 'Привет-привет! У меня тут вечеринка намечается <:o)', 'Серёга на связи! Чё как?'],
      replies: ['Ооо, это круто!!! <:o)', 'Слушай, в субботу у меня сейшн, приходи! (b)', 'А какую музыку любишь? Я щас Продиджи гоняю', 'Хахаха :D', 'Ну давай, рассказывай', 'Ты не поверишь, что вчера было :O', 'блин, кассета зажевалась :(', 'записал новый микс на диск, 80 минут чистого кайфа', 'ща колонки подключу, погоди', 'ваще бомба!!! 8)', 'не, ну это надо отметить (b)', 'а поехали на дачу в выходные?'],
      bye: ['Давай, бро! На связи! (b)', 'Пока! Не скучай :D', 'Всё, умотал. Пиши!'],
      how: ['Да всё супер!!! <:o) Тусим!', 'Нормально, микс свёл наконец :D', 'Ваще зашибись! А у тебя?'],
    },
    '123456': {
      uin: '123456', nick: 'Админ АСЬКИ', phone: '', bot: true, seed: 1, always: true,
      hello: ['Добро пожаловать в АСЬКУ! Я помогу разобраться. Напиши «помощь» :)'],
      replies: ['Чтобы добавить друга — меню «Контакты» → «Добавить контакт», ищи по номеру, телефону или нику.', 'Сменить статус можно кнопкой с цветочком внизу списка контактов.', 'Смайлы вставляются кнопкой :) под полем ввода. У каждого свой звук — нажми на смайл в переписке, чтобы послушать.', 'Открой АСЬКУ во второй вкладке, зарегистрируй ещё один номер и напиши сам себе — так можно проверить звук «о-оу» :)', 'Звук можно выключить в меню «Звук».', 'Добавь АСЬКУ на экран «Домой» — она откроется как приложение, даже без интернета.', 'Enter отправляет сообщение, Shift+Enter — новая строка.'],
      bye: ['До связи! Я всегда онлайн :)'],
      how: ['Работаю круглосуточно, без выходных :)'],
      help: 'Что умеет АСЬКА:\n• номер + ник + телефон при регистрации\n• контакты с цветочками-статусами\n• «о-оу!» на входящее сообщение\n• 22 смайла, у каждого свой звук\n• переписка между вкладками одного устройства\n• боты-собеседники из 1999-го\n\nСпроси: «контакты», «статус», «смайлы», «звук», «вкладки».',
    },
    '555123': {
      uin: '555123', nick: 'Ленка :)', phone: '+7 (921) 555-12-30', bot: true, seed: 5,
      hello: ['Приветики!!! :) А я тебя знаю? :-?', 'Ой, привет! А я думала никого нет', 'Хай :) Я Лена, из Питера'],
      replies: ['Ой, правда? :O', 'Ха-ха-ха, умора :D', 'А я вчера Титаник в пятый раз смотрела :\'(', 'Расскажи что-нить интересное', 'Ты такой милый :$', 'Сейчас мама придёт, модем отберёт', 'у меня тамагочи помер :(', 'слушаю Руки Вверх на всю громкость!!! @}->--', 'А тебе кто больше нравится, Децл или Дельфин?', 'О:) я само совершенство', 'Пиши ещё, мне скучно', ';) ну-ну'],
      bye: ['Пока! Целую :*', 'Ну пока-пока :( Пиши обязательно!', 'Побежала, мама зовёт. Чмок :*'],
      how: ['Супер!!! Завтра выходной :D А у тебя?', 'Так себе... контрольная завтра :(', 'Хорошо :) Чай с печеньками пью'],
    },
  };

  const SMILE_TAUNTS = ['Ой, какой смайлик! :)', 'Отвечаю тем же! :D', 'хихи :$', ';)', 'Ух ты! :O', 'Люблю смайлы @}->--', '8) круто'];

  /* ================= статусы ================= */
  const STATUSES = [
    { key: 'online', label: 'В сети', color: '#3cb44a' },
    { key: 'chat', label: 'Готов болтать', color: '#1fa3e0', glyph: 'chat' },
    { key: 'away', label: 'Отошёл', color: '#e8c22d', glyph: 'clock' },
    { key: 'na', label: 'Недоступен', color: '#e88b2d', glyph: 'clock' },
    { key: 'occupied', label: 'Занят', color: '#d85050', glyph: 'minus' },
    { key: 'dnd', label: 'Не беспокоить', color: '#b01818', glyph: 'minus' },
    { key: 'invisible', label: 'Невидимый', color: '#a8a8a8', glyph: 'ghost' },
    { key: 'offline', label: 'Не в сети', color: '#d8232a' },
  ];
  const statusInfo = (key) => STATUSES.find((s) => s.key === key) || STATUSES[STATUSES.length - 1];

  /* ================= цветочек ================= */
  function flowerSvg(color, size, opts) {
    opts = opts || {};
    size = size || 16;
    let petals = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const cx = (8 + 5 * Math.cos(a)).toFixed(2), cy = (8 + 5 * Math.sin(a)).toFixed(2);
      const fill = opts.logo && i === 3 ? '#d8232a' : color;
      petals += `<circle cx="${cx}" cy="${cy}" r="2.7" fill="${fill}" stroke="#1a1a1a" stroke-width=".55"/>`;
    }
    let glyph = '';
    if (opts.glyph === 'minus') glyph = '<rect x="4" y="7" width="8" height="2" fill="#fff"/><rect x="4.5" y="7.5" width="7" height="1" fill="#b01818"/>';
    if (opts.glyph === 'clock') glyph = '<path d="M8 5.5V8h2" stroke="#000" stroke-width="1" fill="none"/>';
    if (opts.glyph === 'chat') glyph = '<rect x="5" y="6" width="6" height="4" rx="1" fill="#fff" stroke="#000" stroke-width=".6"/><path d="M6.5 10l-1 1.6 2-1.6" fill="#fff" stroke="#000" stroke-width=".6"/>';
    if (opts.glyph === 'ghost') glyph = '';
    const op = opts.glyph === 'ghost' ? ' opacity=".55"' : '';
    const center = opts.glyph === 'minus' || opts.glyph === 'chat' ? '' : `<circle cx="8" cy="8" r="2.5" fill="#fff" stroke="#1a1a1a" stroke-width=".55"/>`;
    return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"${op}>${petals}${center}${glyph}</svg>`;
  }
  const statusFlower = (key, size) => { const s = statusInfo(key); return flowerSvg(s.color, size, { glyph: s.glyph }); };
  const envelopeSvg = (size) => `<svg viewBox="0 0 16 16" width="${size || 16}" height="${size || 16}" aria-hidden="true"><rect x="1" y="3.5" width="14" height="9" fill="#ffe14d" stroke="#000" stroke-width=".7"/><path d="M1 3.5l7 5 7-5M1 12.5l5.5-5M15 12.5l-5.5-5" stroke="#000" stroke-width=".7" fill="none"/></svg>`;

  /* ================= смайлы ================= */
  const SMILES = [
    { id: 'smile', codes: [':)', ':-)'], name: 'улыбка' },
    { id: 'laugh', codes: [':D', ':-D'], name: 'смех' },
    { id: 'wink', codes: [';)', ';-)'], name: 'подмигиваю' },
    { id: 'sad', codes: [':(', ':-('], name: 'грусть' },
    { id: 'cry', codes: [":'(", ':_('], name: 'плачу' },
    { id: 'tongue', codes: [':P', ':-P', ':p'], name: 'язык' },
    { id: 'cool', codes: ['8)', '8-)', 'B)'], name: 'крутой' },
    { id: 'surprise', codes: [':O', ':-O', ':o'], name: 'ого' },
    { id: 'kiss', codes: [':*', ':-*'], name: 'чмок' },
    { id: 'angry', codes: ['>:(', ':@'], name: 'злюсь' },
    { id: 'neutral', codes: [':|', ':-|'], name: 'хм' },
    { id: 'blush', codes: [':$', ':-$'], name: 'смущаюсь' },
    { id: 'heart', codes: ['<3'], name: 'сердце' },
    { id: 'rose', codes: ['@}->--', '@)->--', '(f)'], name: 'роза' },
    { id: 'beer', codes: ['(b)', '(B)'], name: 'пиво' },
    { id: 'zzz', codes: ['|-)', '(zzz)'], name: 'сплю' },
    { id: 'devil', codes: ['>:)', '}:)'], name: 'чёртик' },
    { id: 'party', codes: ['<:o)', '(party)'], name: 'праздник' },
    { id: 'think', codes: [':-?', '(think)'], name: 'думаю' },
    { id: 'sick', codes: [':-&', '(sick)'], name: 'фу' },
    { id: 'angel', codes: ['O:)', 'O:-)'], name: 'ангел' },
    { id: 'shock', codes: ['8-O', '8O', ':-0'], name: 'шок' },
  ];
  const SMILE_BY_ID = {};
  SMILES.forEach((s) => (SMILE_BY_ID[s.id] = s));

  const FACE = (fill, stroke) => `<defs><radialGradient id="g_${fill.slice(1)}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".35" stop-color="${fill}"/><stop offset="1" stop-color="${stroke}"/></radialGradient></defs><circle cx="10" cy="10" r="8.6" fill="url(#g_${fill.slice(1)})" stroke="#000" stroke-width=".8"/>`;
  const Y = ['#ffd21e', '#c98a00'], R = ['#ff5a3c', '#a01a00'], G = ['#9bd14a', '#4b7d12'], P = ['#ff9ec7', '#b5376f'];
  const EYES = (dx, dy) => `<circle cx="${7 - (dx || 0)}" cy="${8 + (dy || 0)}" r="1.1"/><circle cx="${13 + (dx || 0)}" cy="${8 + (dy || 0)}" r="1.1"/>`;
  const SMILE_ART = {
    smile: () => FACE(...Y) + EYES() + '<path d="M5.5 11.5q4.5 4.5 9 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    laugh: () => FACE(...Y) + '<path d="M5 8q2-2 4 0M11 8q2-2 4 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M5 11h10q-1 5-5 5t-5-5z" fill="#6b1010" stroke="#000" stroke-width=".7"/><path d="M6 11.3h8l-.4 1.4H6.4z" fill="#fff"/>',
    wink: () => FACE(...Y) + '<circle cx="7" cy="8" r="1.1"/><path d="M11.5 8.2h3.5" stroke="#000" stroke-width="1.2" stroke-linecap="round"/><path d="M5.5 11.5q4.5 4.5 9 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    sad: () => FACE(...Y) + EYES() + '<path d="M6 14.5q4-4 8 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    cry: () => FACE(...Y) + EYES() + '<path d="M6 14.5q4-4 8 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M6.5 9.5q-1.3 3 0 3.6q1.3-.6 0-3.6z" fill="#3fa0ff" stroke="#1659a8" stroke-width=".4"/><path d="M13.5 9.5q-1.3 3 0 3.6q1.3-.6 0-3.6z" fill="#3fa0ff" stroke="#1659a8" stroke-width=".4"/>',
    tongue: () => FACE(...Y) + EYES() + '<path d="M5.5 11.5q4.5 4 9 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M9 13.2h4.2v2.2q0 2-2.1 2t-2.1-2z" fill="#ff5f8f" stroke="#a01a40" stroke-width=".6"/>',
    cool: () => FACE(...Y) + '<path d="M3.5 7.5h13" stroke="#000" stroke-width="1"/><rect x="4" y="7" width="5" height="3.5" rx="1" fill="#111"/><rect x="11" y="7" width="5" height="3.5" rx="1" fill="#111"/><path d="M6.5 13q4 2.5 7.5-.5" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    surprise: () => FACE(...Y) + '<circle cx="7" cy="7.8" r="1.5"/><circle cx="13" cy="7.8" r="1.5"/><ellipse cx="10" cy="13.3" rx="2" ry="2.5" fill="#6b1010" stroke="#000" stroke-width=".7"/>',
    kiss: () => FACE(...Y) + '<circle cx="7" cy="8" r="1.1"/><path d="M11.5 8.2h3.5" stroke="#000" stroke-width="1.2" stroke-linecap="round"/><path d="M8.5 12.8q1.5-1.2 3 0q-1.5 1.6-3 0z" fill="#e02050" stroke="#7a0020" stroke-width=".5"/><path d="M14.2 12.6l1-1q1-.6 1.3.4q.2.9-2.3 2.3q-2.5-1.4-2.3-2.3q.3-1 1.3-.4z" fill="#e02050"/>',
    angry: () => FACE(...R) + '<path d="M4.5 5.5l4 1.8M15.5 5.5l-4 1.8" stroke="#000" stroke-width="1.2" stroke-linecap="round"/>' + EYES(0, .6) + '<path d="M6 14.5q4-3 8 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    neutral: () => FACE(...Y) + EYES() + '<path d="M6 13.2h8" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    blush: () => FACE(...Y) + '<circle cx="5.5" cy="11" r="1.7" fill="#ff8aa0" opacity=".8"/><circle cx="14.5" cy="11" r="1.7" fill="#ff8aa0" opacity=".8"/>' + EYES(0, .8) + '<path d="M7.5 13.5q2.5 1.8 5 0" fill="none" stroke="#000" stroke-width="1" stroke-linecap="round"/>',
    heart: () => '<path d="M10 17.5L3.2 10.6A3.9 3.9 0 0 1 10 5.9a3.9 3.9 0 0 1 6.8 4.7z" fill="#e8203a" stroke="#7a0010" stroke-width=".8"/><path d="M6 7.5q1.5-1.8 3.2-.3" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>',
    rose: () => '<path d="M10 18V9" stroke="#2f7d1e" stroke-width="1.3"/><path d="M10 13q-3-.5-4 2.5q3 .5 4-2.5zM10 11q3-.5 4 2.5q-3 .5-4-2.5z" fill="#4ca12c" stroke="#2f7d1e" stroke-width=".5"/><circle cx="10" cy="6.5" r="4.2" fill="#d8182e" stroke="#7a0010" stroke-width=".7"/><path d="M8 6q2-2.5 4 0q-1 2.5-4 1.5z" fill="#ff5c6c" opacity=".8"/>',
    beer: () => '<rect x="4" y="6" width="9" height="11" rx="1" fill="#f7b31c" stroke="#7a4a00" stroke-width=".8"/><path d="M13 8h2.5a1.5 1.5 0 0 1 0 3V13a1.5 1.5 0 0 1 0 3H13" fill="none" stroke="#7a4a00" stroke-width=".9"/><path d="M4 7q1-3 3-2q1-2.5 3.5-1.5q2-1 3 2.5v1H4z" fill="#fff" stroke="#999" stroke-width=".6"/><path d="M6.5 9v6M9 9v6M11.5 9v6" stroke="#fff" stroke-width=".7" opacity=".6"/>',
    zzz: () => FACE(...Y) + '<path d="M5 8.5q2 1.2 4 0M11 8.5q2 1.2 4 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><ellipse cx="10" cy="13.5" rx="1.3" ry="1" fill="#6b1010"/><text x="12.5" y="5" font-size="5.5" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#1a3ea8">z</text><text x="15.3" y="3.5" font-size="3.8" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#1a3ea8">z</text>',
    devil: () => '<path d="M3 3l3 4h-1zM17 3l-3 4h1z" fill="#8a1010"/>' + FACE(...R) + '<path d="M4.5 6.5l4 1.3M15.5 6.5l-4 1.3" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>' + EYES(0, .8) + '<path d="M5.5 12q4.5 4 9 0" fill="#fff" stroke="#000" stroke-width=".9"/><path d="M6.5 12.3h7" stroke="#000" stroke-width=".4"/>',
    party: () => '<path d="M10 1.5l-3.5 7.5h7z" fill="#5a3df0" stroke="#2a1a90" stroke-width=".6"/><circle cx="10" cy="1.8" r="1" fill="#ffd21e"/>' + FACE(...Y) + EYES() + '<path d="M5.5 11.5q4.5 5 9 0z" fill="#6b1010" stroke="#000" stroke-width=".8"/><circle cx="3" cy="4" r=".9" fill="#ff5a3c"/><circle cx="17.5" cy="5" r=".9" fill="#1fa3e0"/><circle cx="2.5" cy="15" r=".8" fill="#3cb44a"/>',
    think: () => FACE(...Y) + '<path d="M11 5.8l3.5-.8" stroke="#000" stroke-width="1" stroke-linecap="round"/><circle cx="7" cy="8" r="1.1"/><circle cx="13" cy="8" r="1.1"/><path d="M7 13.2h6" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><text x="14" y="5" font-size="6" font-family="Tahoma,Verdana,sans-serif" font-weight="bold" fill="#1a3ea8">?</text>',
    sick: () => FACE(...G) + '<path d="M5 7.5q2-1.5 4 0M11 7.5q2-1.5 4 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M6 13.5q1-1.2 2 0t2 0t2 0t2 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    angel: () => '<ellipse cx="10" cy="3" rx="6" ry="1.6" fill="none" stroke="#f0c020" stroke-width="1.2"/>' + FACE(...Y) + '<path d="M5 8.5q2-1.4 4 0M11 8.5q2-1.4 4 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/><path d="M6.5 12q3.5 3 7 0" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round"/>',
    shock: () => FACE(...Y) + '<path d="M4.5 5.5l4-1M15.5 5.5l-4-1" stroke="#000" stroke-width="1" stroke-linecap="round"/><circle cx="7" cy="8" r="1.9" fill="#fff" stroke="#000" stroke-width=".7"/><circle cx="13" cy="8" r="1.9" fill="#fff" stroke="#000" stroke-width=".7"/><circle cx="7" cy="8" r=".9"/><circle cx="13" cy="8" r=".9"/><ellipse cx="10" cy="13.8" rx="3" ry="2.6" fill="#6b1010" stroke="#000" stroke-width=".7"/>',
  };
  function smileSvg(id, size) {
    const art = SMILE_ART[id];
    if (!art) return '';
    return `<svg viewBox="0 0 20 20" width="${size || 18}" height="${size || 18}" aria-hidden="true">${art()}</svg>`;
  }

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
    if (sm.length) setTimeout(() => Snd.smile(sm[0]), 700);
    if (navigator.vibrate) try { navigator.vibrate(60); } catch (err) {}
    if (!inChat) toast(from, msg.text, msg.from);
    renderContacts();
    if (active === msg.from) renderHistory();
    updateTitle();
  }

  function scheduleBotReply(bot, text) {
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
  function botSays(bot, text) {
    if (!me) return;
    const msg = { id: uid(), from: bot.uin, to: me.uin, text, ts: Date.now() };
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
          <div class="bigflower">${flowerSvg('#3cb44a', 44, { logo: true })}<div class="logo-word center">АСЬКА<small>I seek you · по-русски · с 1998 года</small></div></div>
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
    // первое знакомство: админ здоровается
    if (!historyOf('123456').length) setTimeout(() => botSays(BOTS['123456'], BOTS['123456'].hello[0]), 1600);
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
    const on = list.filter((a) => isOnline(a.uin)).sort((a, b) => a.nick.localeCompare(b.nick, 'ru'));
    const off = list.filter((a) => !isOnline(a.uin)).sort((a, b) => a.nick.localeCompare(b.nick, 'ru'));
    const item = (a) => {
      const n = unreadFrom(a.uin);
      const st = statusOf(a.uin);
      const ico = n ? `<span class="blink">${envelopeSvg(16)}</span>` : statusFlower(st, 16);
      return `<div class="citem ${active === a.uin ? 'sel' : ''} ${st === 'offline' ? 'off' : ''}" data-uin="${a.uin}" title="${esc(a.nick)} · ${a.uin}${a.phone ? ' · ' + esc(fmtPhone(a.phone)) : ''}"><span class="ico">${ico}</span><span class="nick">${esc(a.nick)}</span>${typing[a.uin] ? '<span class="typing">печатает…</span>' : ''}${n ? `<span class="muted">${n}</span>` : ''}</div>`;
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
      });
    }
    $('#ch-hint').textContent = isTouch() ? '' : 'Enter — отправить, Shift+Enter — новая строка';
  }
  function renderChatHead() {
    if (!active) return;
    const a = accountOf(active); if (!a) return;
    const st = statusOf(active);
    const head = $('#ch-head'); if (!head) return;
    head.innerHTML = `<span class="ico">${statusFlower(st, 16)}</span><span class="nick">${esc(a.nick)}</span><span class="muted">#${a.uin}</span>${a.phone ? `<span class="muted">· ${esc(fmtPhone(a.phone))}</span>` : ''}<span class="sp"></span><span class="hint">${typing[active] ? 'печатает…' : esc(statusInfo(st).label)}</span>`;
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
    heartbeatTimer = setInterval(heartbeat, 10000);
    heartbeat();
    updateTitle();
  } else renderLogin();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
