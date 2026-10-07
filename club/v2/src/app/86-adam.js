/* Адам — персональный ассистент команды, и сообщения внутри штаба.
   Круглая кнопка с Адамом в правом нижнем углу открывает панель с тремя
   вкладками: «Адам» (вопросы, утренняя сводка, черновики сообщений по
   задачам), «Команда» (общий чат) и «Личные» (диалоги один на один).
   Адам отвечает двумя способами:
   • с Claude — когда штаб открыт в Claude и человек разрешил (claude.use
     ('sample'), расход — из лимита этого человека). Claude видит только
     то, что штаб передал в вопросе: задачи, собрания, команду и цели —
     без денег, если роли они закрыты. Предложить задачу или сообщение
     он может, но выполняет их только сам человек — кнопкой;
   • сам — везде ещё и если Claude недоступен: сводка по задачам,
     ответы на частые вопросы о штабе, шаблоны сообщений.
   Сообщения команды — коллекция messages: {ch: 'team' | 'dm:<учётка>|<учётка>',
   by, text, at}. Разговор с Адамом — личный: в Claude он хранится в
   личном разделе базы (data/users/<id>), который не видит никто, кроме
   самого человека; без него — в этом браузере. */

let adamSeq = 0;
/* аватар Адама: тёплый круг бренда, улыбка и искра — без файлов */
function adamFace(cls = '') {
  const g = 'adamG' + (++adamSeq);
  return `<span class="adam-av ${cls}" aria-hidden="true"><svg viewBox="0 0 48 48">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B2556"/><stop offset=".55" stop-color="#7A3D78"/><stop offset="1" stop-color="#C9638F"/></linearGradient></defs>
    <circle cx="24" cy="24" r="23" fill="url(#${g})"/>
    <path d="M11.5 22.5c0-7.4 5.6-12.5 12.5-12.5s12.5 5.1 12.5 12.5c-2.6-3.1-6.9-5-12.5-5s-9.9 1.9-12.5 5z" fill="#fff" opacity=".2"/>
    <g class="adam-eyes"><ellipse cx="18.6" cy="24.5" rx="2.3" ry="2.9" fill="#fff"/><ellipse cx="29.4" cy="24.5" rx="2.3" ry="2.9" fill="#fff"/></g>
    <path d="M18 31.2c3.4 3.2 8.6 3.2 12 0" stroke="#fff" stroke-width="2.3" fill="none" stroke-linecap="round"/>
    <path class="adam-spark" d="M37.5 6.5c.4 2.6 1.3 3.6 3.9 4-2.6.4-3.5 1.4-3.9 4-.4-2.6-1.3-3.6-3.9-4 2.6-.4 3.5-1.4 3.9-4z" fill="#E7C58B"/>
  </svg></span>`;
}

/* ── сообщения команды ── */
const MSG_MAX = 2000;
const dmKey = (a, b) => 'dm:' + [a, b].sort().join('|');
const accPerson = acc => (acc ? personById(acc.personId) : null);
function accName(id) {
  if (id === 'adam') return 'Адам';
  const a = id ? Store.get('accounts', id) : null;
  const p = accPerson(a);
  return p && p.name ? personName(p) : (a ? a.name : 'кто-то');
}
const accFirst = id => accName(id).split(' ')[0];
const accAvatar = (id, cls = '') => {
  const a = Store.get('accounts', id);
  return avatar(accPerson(a) || {name: a ? a.name : '?'}, cls);
};
const Msgs = {
  me() { return (Auth.me() || {}).id; },
  of(ch) { return Store.all('messages').filter(m => m.ch === ch && m.text).sort((a, b) => (a.at || 0) - (b.at || 0)); },
  /* сообщение касается меня: общий чат или мой диалог */
  mine(m) { const me = this.me(); return !!me && (m.ch === 'team' || (String(m.ch).startsWith('dm:') && m.ch.slice(3).split('|').includes(me))); },
  peer(ch) { const me = this.me(); const ids = String(ch).slice(3).split('|'); return ids.find(x => x !== me) || me; },
  seenMap() { const v = Prefs.get('msgSeen', {}); return v && typeof v === 'object' ? v : {}; },
  seen(ch) { return this.seenMap()[ch] || 0; },
  markSeen(ch) {
    const last = Math.max(0, ...this.of(ch).map(m => m.at || 0));
    const s = this.seenMap();
    if (last > (s[ch] || 0)) Prefs.set('msgSeen', {...s, [ch]: last});
  },
  unread(ch) { const me = this.me(), seen = this.seen(ch); return this.of(ch).filter(m => m.by !== me && (m.at || 0) > seen).length; },
  /* люди, с которыми можно переписываться: у кого есть учётка */
  peers() {
    const me = this.me();
    return Store.all('accounts').filter(a => a.active !== false && a.id !== me && a.name)
      .map(a => { const ch = dmKey(me, a.id), list = this.of(ch); return {a, ch, last: list[list.length - 1] || null, n: this.unread(ch)}; })
      .sort((x, y) => ((y.last || {}).at || 0) - ((x.last || {}).at || 0) || accName(x.a.id).localeCompare(accName(y.a.id), 'ru'));
  },
  unreadDm() { return this.peers().reduce((s, x) => s + x.n, 0); },
  unreadTotal() { return this.me() ? this.unread('team') + this.unreadDm() : 0; },
  send(ch, text) {
    const t = String(text || '').trim().slice(0, MSG_MAX);
    if (!t || !this.me()) return null;
    const id = Store.add('messages', {ch, by: this.me(), text: t, at: Date.now()});
    return id;
  },
};

/* новые сообщения, пока штаб открыт: звук и уведомление */
const MsgNotify = {
  since: 0,
  wired: false,
  init() {
    if (this.wired) return;
    this.wired = true;
    this.since = Date.now() - 2000;
    Store.subscribe(c => { if (c === 'messages' || c === 'accounts') setTimeout(() => { if (c === 'messages') this.check(); Chat.paint(); }, 30); });
  },
  check() {
    const me = Msgs.me();
    if (!me) return [];
    const fresh = Store.all('messages').filter(m => (m.at || 0) > this.since && m.by !== me && m.text && Msgs.mine(m)).sort((a, b) => a.at - b.at);
    if (!fresh.length) return [];
    this.since = Math.max(this.since, ...fresh.map(m => m.at || 0));
    const shown = fresh.filter(m => !(Chat.open && Chat.chan() === m.ch && !document.hidden));
    if (!shown.length) return [];
    const dm = shown.some(m => m.ch !== 'team');
    Sound.play(dm ? 'msg' : 'info');
    shown.slice(-2).forEach(m => toast(`${m.ch === 'team' ? 'В команде · ' : ''}${accFirst(m.by)}: ${m.text.replace(/\s+/g, ' ').slice(0, 90)}`, {ring: m.ch !== 'team', action: {label: 'Ответить', fn: () => Chat.show(m.ch === 'team' ? 'team' : 'dm', m.ch)}}));
    return shown;
  },
};

/* ── Адам ── */
const ADAM_OFF = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
/* частые вопросы — Адам отвечает сам, без Claude */
const ADAM_FAQ = [
  {k: /горит|с чего нача|что делать|сегодня|план на день|сводк|приоритет/i, brief: true},
  {k: /постав|создат|нов(ая|ую) задач|добав.*задач/i, a: 'Задачу ставят прямо там, где ты работаешь: строка «Новая задача» вверху вкладки «Задачи» (Enter — готово), кнопка «+ Задача» в карточке «Фокус» на главной или «Задача» на странице человека. Выбери кому и срок — исполнитель получит уведомление со звуком. Галочка «Срок важен» — тогда перенос срока только с твоего согласия.'},
  {k: /срок|перен|дедлайн/i, a: 'Срок меняется кнопкой с датой на карточке задачи. Свою задачу переносишь сам — срок меняется у всех. Если задачу тебе поставил коллега: в пределах того же месяца переносишь сам, а если срок отмечен «важен» или перенос на другой месяц — уйдёт запрос постановщику, он согласует одной кнопкой.'},
  {k: /мои задач|только мои|фильтр|сортир|от меня|общие задачи/i, a: 'Во вкладке «Задачи» сверху переключатель: «Мне» — что поставили тебе, «От меня» — что ты поставил(а) другим, «Все» — задачи всей команды. Справа можно выбрать конкретного человека. Виды: доска, по месяцам, по неделям или списком.'},
  {k: /согласов|прин(ять|яти)|вернуть на доработ|review/i, a: 'Когда работа готова — статус «На согласовании». Постановщику придёт уведомление со звуком, в блоке «Для вас» он нажмёт «Принять» или «Вернуть» с комментарием.'},
  {k: /пароль|войти|вход|логин/i, a: 'Пароль меняется на твоей странице (нажми на своё имя внизу меню) → «Сменить пароль». Забыли пароль — основатель во вкладке «Команда» сделает ссылку для сброса. Если штаб открыт в Claude и учётка привязана — вход без пароля.'},
  {k: /гост|telegram|телеграм|\bтг\b|напомин/i, a: 'В окне собрания есть «Гости не из команды»: имя, почта — туда придёт приглашение Google, и Telegram — для напоминания. Здесь, в штабе, у собрания появляется кнопка «Напомнить»: текст копируется и открывается чат с гостем. На своём сервере штаба с ботом напоминания уходят сами — гость один раз нажимает «Старт» у бота.'},
  {k: /календар|собран|встреч|созвон|google/i, a: 'Во вкладке «Календарь» подключи свой Google Календарь — один раз. Команда увидит только, когда ты занят. «+ Собрание»: название, время, участники и гости — приглашения уйдут в их календари со ссылкой на Meet. Нажми на своё событие в сетке — его можно сделать собранием штаба.'},
  {k: /выгруз|экспорт|резерв|сервер|хостинг|перенос данных|данные штаба|backup/i, a: 'Во вкладке «Команда» → «Данные штаба»: «Выгрузить всё» — один файл JSON со всеми задачами и цифрами, плюс таблицы CSV для Excel. Этот же файл загружается в штаб на своём сервере (club/v2/server) — переезд на любой хостинг без потерь.'},
  {k: /подсказ|тур|обучен|как пользоваться/i, a: 'На каждой странице есть цветная подсказка — «Просмотрено» её сворачивает, а строка «Подсказка: …» снова открывает. Кнопка «Тур по странице» — пошаговый показ с подсветкой. Показать все туры заново — на твоей странице.'},
  {k: /команд|структур|подчин|иерарх|директор/i, a: 'Вкладка «Команда» → «Структура»: сверху генеральный директор, под ним управление — финансовый, исполнительный и коммерческий директора, ниже их команды. Кому подчиняется человек, основатель меняет в карточке («Подчиняется»).'},
  {k: /пригла|регистрац|ссылк/i, a: 'Основатель во вкладке «Команда» добавляет человека и нажимает «Пригласить» — получается ссылка с ролью. Человек открывает её, видит свои данные (имя, должность, день рождения), дополняет и задаёт пароль.'},
  {k: /звук|уведомл|колокол/i, a: 'Колокольчик внизу меню включает и выключает звук. Новая задача, задача на согласование и личные сообщения приходят со звуком и всплывающим уведомлением.'},
  {k: /деньг|расход|оплат|бюджет|платеж/i, a: 'Во вкладке «Деньги» — быстрая запись операции, план платежей («Оплатить» — и операция сама попадёт в журнал) и журнал. Бюджет задачи выше лимита уходит на согласование основателю.'},
  {k: /цифр|отчёт|отчет|продаж|выручк/i, a: 'Цифры дня вносятся во вкладке «Отчёты»: охват, регистрации, оплаты — до созвона в понедельник. Выручка и темп против плана считаются сами.'},
  {k: /напиш|сообщени|написать/i, a: 'Открой задачу и нажми «Адам: написать сообщение» — я подготовлю черновик коллеге, его можно отправить в личные одним нажатием. Или спроси: «Напиши напоминание Анне по задаче …».'},
  {k: /привет|здравств|добр(ое|ый)|хай|hello/i, hello: true},
  {k: /спасибо|благодар/i, a: 'Всегда пожалуйста! Я рядом — нажми на меня, когда понадоблюсь.'},
];
const ADAM_CHIPS = ['Что у меня горит?', 'Как поставить задачу?', 'Как перенести срок?', 'Как позвать гостя на встречу?', 'Как выгрузить данные?'];

const Adam = {
  hist: [],
  key: null,
  sample: undefined,
  off: false,
  ctl: null,
  busy: false,
  _save: null,
  _ref: null,

  async init() {
    if (this.sample === undefined) {
      this.sample = null;
      try { this.sample = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('sample') : null; } catch (e) { this.sample = null; }
      Chat.paintSub();
      Chat.paint();
    }
  },
  claude() { return !!this.sample && !this.off; },
  /* личный разговор: в Claude — в личном разделе базы, иначе — в браузере */
  async ref() {
    if (this._ref !== null && this._ref !== undefined) return this._ref || null;
    this._ref = false;
    const me = Msgs.me();
    if (Store.state.mode !== 'db' || !Auth.claudeId || !me) return null;
    try {
      const db = await window.claude.use('db');
      if (db) this._ref = db.collection('data/users/' + Auth.claudeId).doc('adam-' + me);
    } catch (e) { this._ref = false; }
    return this._ref || null;
  },
  async load() {
    const me = Msgs.me();
    if (!me || this.key === me) return;
    this.key = me;
    this._ref = null;
    this.hist = (Local.get('eva-hq-adam:' + me, []) || []).filter(x => x && x.t);
    try {
      const ref = await this.ref();
      if (ref && typeof ref.get === 'function') {
        const snap = await ref.get();
        const d = snap && snap.exists ? snap.data() : null;
        if (d && Array.isArray(d.turns) && (d.at || 0) >= (Local.get('eva-hq-adam-at:' + me, 0) || 0)) this.hist = clone(d.turns).filter(x => x && x.t);
      }
    } catch (e) { /* остаётся разговор из браузера */ }
    Chat.renderList();
  },
  /* в браузер — сразу, в личный раздел базы — раз в полсекунды */
  save() {
    const me = Msgs.me();
    if (!me || this.key !== me) return;
    const turns = this.hist.filter(x => !x.pending).slice(-60).map(({r, t, at, cards, note}) => ({r, t, at, ...(cards ? {cards} : {}), ...(note ? {note} : {})}));
    const at = Date.now();
    Local.set('eva-hq-adam:' + me, turns);
    Local.set('eva-hq-adam-at:' + me, at);
    clearTimeout(this._save);
    this._save = setTimeout(async () => {
      try { const ref = await this.ref(); if (ref && this.key === me) await ref.set({turns, at}); } catch (e) { /* нет доступа на запись — останется в браузере */ }
    }, 500);
  },
  push(turn) {
    const x = {at: Date.now(), ...turn};
    this.hist.push(x);
    this.save();
    Chat.renderList(true);
    return x;
  },
  clear() { this.hist = []; this.save(); Chat.renderList(); },

  /* есть что сказать: сводка за сегодня ещё не показана */
  hasNews() { return !!Msgs.me() && Prefs.get('adamDay', '') !== today(); },
  greetIfNeeded() {
    if (!this.hasNews()) return;
    Prefs.set('adamDay', today());
    if (!this.hist.length) this.push(this.intro());
    this.push(this.brief());
  },

  name() { const p = Auth.person(), me = Auth.me() || {}; return p ? givenOf(p) : String(me.name || '').split(' ')[0]; },
  hello() {
    const h = Math.floor(mskMin(nowMs()) / 60);
    return `${h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'}, ${this.name()}!`;
  },
  /* знакомство и адаптация новичка: что сделать в первые дни */
  intro() {
    const p = Auth.person() || {};
    const busy = Auth.personId() ? Store.get('busy', Auth.personId()) : null;
    const steps = [
      [!!(p.photo || p.about), 'Заполни свою страницу — фото, пару слов о себе, Human Design', '#me', 'Моя страница'],
      [!!(busy && busy.from), 'Подключи Google Календарь — команда увидит, когда ты занят(а)', '#calendar', 'Календарь'],
      [false, 'Посмотри свои задачи: переключатель «Мне» вверху', '#tasks', 'Задачи'],
      [Sound.on(), 'Включи звук уведомлений — колокольчик внизу меню', null, null],
    ];
    return {r: 'a', t: `Привет! Я Адам — ассистент команды Eva Club. Подскажу, что горит, помогу освоиться в штабе и напишу сообщение коллеге по задаче.\n\nС чего начать:\n${steps.map(([done, text], i) => `${done ? '✓' : `${i + 1}.`} ${text}`).join('\n')}\n\nСпрашивай о чём угодно про штаб — я рядом.`,
      cards: steps.filter(s => s[2]).map(s => ({k: 'go', href: s[2], label: s[3]}))};
  },
  /* утренняя сводка: что ждёт решения, что горит, собрания, дни рождения */
  brief() {
    const lines = [], cards = [], me = Tasks.meKey();
    if (Auth.can('tasks.view')) {
      const a = Inbox.actions();
      const titles = list => list.slice(0, 2).map(t => `«${t.title}»`).join(', ') + (list.length > 2 ? ` и ещё ${list.length - 2}` : '');
      if (a.review.length) lines.push(`Ждут твоего согласования: ${titles(a.review)}`);
      if (a.dueReq.length) lines.push(`Просят перенести срок: ${titles(a.dueReq)}`);
      if (a.budget.length) lines.push(`Бюджет на согласовании: ${titles(a.budget)}`);
      if (a.late.length) lines.push(`Просрочено у тебя: ${titles(a.late)} — перенеси срок или напиши постановщику`);
      if (a.soon.length) lines.push(`Срок сегодня или завтра: ${titles(a.soon)}`);
      [...a.review, ...a.dueReq, ...a.late, ...a.soon].filter((t, i, l) => l.indexOf(t) === i).slice(0, 3).forEach(t => cards.push({k: 'task', id: t.id, label: t.title}));
      const theirs = Tasks.all().filter(t => t.createdBy === me && t.assignee && t.assignee !== me && Tasks.overdue(t));
      if (theirs.length) {
        lines.push(`У коллег просрочено по твоим задачам: ${theirs.length} — могу написать им напоминание`);
        theirs.slice(0, 2).forEach(t => cards.push({k: 'remind', id: t.id, label: `Напомнить: ${whoFirst(t.assignee)}`}));
      }
      const open = Tasks.sort(Tasks.all().filter(t => Tasks.mine(t) && Tasks.isOpen(t)));
      if (!lines.length && open.length) {
        lines.push(`В работе ${open.length} ${plural(open.length, 'задача', 'задачи', 'задач')}, ничего не горит. Начни с «${open[0].title}»`);
        cards.push({k: 'task', id: open[0].id, label: open[0].title});
      }
    }
    const pid = Auth.personId();
    if (pid) Meetings.occ(today(), today()).filter(o => Meetings.people(o.m).includes(pid) && o.e > nowMs()).slice(0, 2).forEach(o => lines.push(`Сегодня собрание «${o.m.title}» в ${hmMs(o.s)}`));
    birthdaysSoon(0).filter(x => x.b.days === 0 && x.p.id !== pid).forEach(x => lines.push(`Сегодня день рождения: ${personName(x.p)} — поздравь в «Команде»!`));
    const n = Msgs.unreadTotal();
    if (n) { lines.push(`Непрочитанных сообщений: ${n}`); cards.push({k: 'chat', tab: Msgs.unread('team') ? 'team' : 'dm', label: 'Открыть сообщения'}); }
    const g = Strategy.goals()[0];
    return {r: 'a', t: `${this.hello()}\n${lines.length ? lines.map(l => '• ' + l).join('\n') : `Ничего срочного — хороший день, чтобы продвинуть главное${g ? `: «${g.short || g.title}»` : ''}.`}`, cards};
  },
  /* ответ без Claude: частые вопросы и сводка */
  local(q) {
    const hit = ADAM_FAQ.find(f => f.k.test(q));
    if (hit && hit.brief) return this.brief();
    if (hit && hit.hello) return {r: 'a', t: `${this.hello()} Чем помочь? Могу рассказать, что у тебя горит, или подсказать, как что-то сделать в штабе.`};
    if (hit) return {r: 'a', t: hit.a};
    return {r: 'a', t: this.sample === null
      ? 'Пока я отвечаю на частые вопросы о штабе и собираю сводку по задачам. Полные ответы — когда штаб открыт в Claude. Попробуй: «Что у меня горит?», «Как перенести срок?», «Как позвать гостя на встречу?»'
      : 'Здесь я отвечаю сам, коротко: на частые вопросы о штабе и сводку по задачам. Спроси, например: «Что у меня горит?» или «Как перенести срок?»'};
  },

  /* что Адам знает о штабе — передаём Claude вместе с вопросом */
  context() {
    const me = Auth.me() || {}, p = Auth.person(), pid = Auth.personId(), k = Tasks.meKey();
    const L = [];
    L.push(`Сегодня: ${dayWd(today())} ${today()}, время ${hmMs(nowMs())} по Москве.`);
    L.push(`Собеседник: ${p ? personName(p) : me.name}${p && p.title ? `, ${p.title}` : ''}; роль в штабе — ${ROLES[roleOf(me.role)].name}${p && HD_TYPES[p.hdType] ? `; Human Design — ${HD_TYPES[p.hdType].name}${p.hdProfile ? ' ' + p.hdProfile : ''}` : ''}.`);
    const dl = t => { const d = Tasks.due(t); return d ? (t.due ? d : 'до конца ' + monthName(t.month).toLowerCase()) : 'без срока'; };
    const line = t => `- «${t.title}» · ${STATUSES[t.status] ? STATUSES[t.status].name.toLowerCase() : t.status} · срок ${dl(t)}${Tasks.overdue(t) ? ' (просрочено)' : ''}${t.dueFixed ? ', срок важен' : ''}`;
    if (Auth.can('tasks.view')) {
      const all = Tasks.sort(Tasks.all());
      const mine = all.filter(t => t.assignee === pid && Tasks.isOpen(t)).slice(0, 15);
      L.push(`\nЗадачи собеседника (открытые, ${mine.length}):\n${mine.map(t => `${line(t)}${t.createdBy && t.createdBy !== k ? ` · поставил(а) ${whoName(t.createdBy)}` : ''}`).join('\n') || '- нет'}`);
      const given = all.filter(t => t.createdBy === k && t.assignee && t.assignee !== pid && Tasks.isOpen(t)).slice(0, 12);
      if (given.length) L.push(`\nЗадачи, которые собеседник поставил другим:\n${given.map(t => `${line(t)} · делает ${whoName(t.assignee)}`).join('\n')}`);
      const a = Inbox.actions();
      if (a.review.length || a.dueReq.length || a.budget.length) L.push(`\nЖдут решения собеседника: на согласовании — ${a.review.map(t => `«${t.title}»`).join(', ') || 'нет'}; перенос срока — ${a.dueReq.map(t => `«${t.title}»`).join(', ') || 'нет'}; бюджет — ${a.budget.map(t => `«${t.title}»`).join(', ') || 'нет'}.`);
      const doneWeek = all.filter(t => t.status === 'done' && (t.doneAt || 0) > Date.now() - 7 * 864e5).length;
      L.push(`Команда закрыла задач за неделю: ${doneWeek}. Открытых задач у всей команды: ${all.filter(t => Tasks.isOpen(t)).length}.`);
    }
    if (pid) {
      const occ = Meetings.occ(today(), addDays(today(), 7)).filter(o => Meetings.people(o.m).includes(pid)).slice(0, 6);
      if (occ.length) L.push(`\nСобрания собеседника на неделе:\n${occ.map(o => `- «${o.m.title}» ${dayWd(o.date)} в ${hmMs(o.s)}`).join('\n')}`);
    }
    const team = people().filter(x => x.name && pStatus(x) === 'active').slice(0, 30);
    L.push(`\nКоманда:\n${team.map(x => `- ${personName(x)}${x.title ? ' — ' + x.title : ''}${accountOf(x.id) ? '' : ' (ещё не в штабе)'}`).join('\n')}`);
    const bd = birthdaysSoon(7);
    if (bd.length) L.push(`Дни рождения на неделе: ${bd.map(x => `${personName(x.p)} — ${dayShort(x.b.date)}`).join(', ')}.`);
    const goals = Strategy.goals().slice(0, 6);
    if (goals.length) L.push(`\nЦели квартала: ${goals.map(g => `«${g.short || g.title}»${g.short && g.title ? ` (${g.title})` : ''}`).join('; ')}.`);
    if (Auth.can('cf.view')) { const q = quarterPace(settings().scenario || 'goal'); if (q.started) L.push(`Продажи квартала: ${q.fact} из плана ${Math.round(q.total)}, идём ${q.heading}.`); }
    return L.join('\n');
  },
  rules() {
    return `Ты — Адам, персональный ассистент команды Eva Club внутри «Штаба» (веб-приложение команды: задачи, календарь, отчёты, деньги, команда). Тебя видят как аватар на кнопке в углу экрана.
Говори по-русски, тепло, по-дружески и коротко: 2–6 предложений или короткий список. Обращайся на «ты» и по имени. Без воды и канцелярита.
Помогай: что сделать сегодня и в каком порядке, как пользоваться штабом, черновики сообщений коллегам, разбить задачу на шаги, поддержать.
Используй только данные ниже. Не выдумывай задачи, людей, цифры и сроки; если чего-то нет — так и скажи.
Ты не меняешь данные сам. Если уместно предложить действие, добавь в самом конце ответа отдельную строку:
[[задача|Название задачи|Имя исполнителя или пусто|ГГГГ-ММ-ДД или пусто]] — предложить новую задачу;
[[сообщение|Имя получателя или «команда»|Текст сообщения]] — предложить сообщение коллеге или в общий чат.
Человек сам решит и нажмёт кнопку. Не больше двух таких строк.

Как устроен штаб (для подсказок):
- «Задачи»: переключатель «Мне / От меня / Все», строка «Новая задача» сверху; галочка «Срок важен» — перенос только с согласия постановщика; без неё исполнитель переносит срок сам в пределах месяца. Статусы: к работе, в работе, на согласовании, готово.
- «Календарь»: подключение Google Календаря, собрания с приглашениями и Google Meet, гости не из команды с почтой и Telegram, кнопка «Напомнить».
- «Команда»: структура (генеральный директор → финансовый, исполнительный, коммерческий директора → их команды), приглашения ссылкой, «Данные штаба» — выгрузка в файл.
- «Отчёты»: цифры дня до понедельника. «Деньги»: операции и план платежей (не всем ролям).
- Сообщения: вкладки «Команда» и «Личные» в этой же панели.

Данные штаба:
${this.context()}`;
  },
  /* строки-предложения из ответа Claude → карточки с кнопками */
  cards(text) {
    const cards = [];
    const clean = String(text || '').replace(/\[\[\s*(задача|сообщение)\s*\|([^\]]*)\]\]/gi, (all, kind, rest) => {
      const parts = rest.split('|').map(x => x.trim());
      if (/задача/i.test(kind) && parts[0]) {
        const who = personByWord(parts[1]);
        const due = /^\d{4}-\d\d-\d\d$/.test(parts[2] || '') ? parts[2] : '';
        cards.push({k: 'newtask', title: parts[0].slice(0, 200), pid: who ? who.id : null, due});
      } else if (/сообщение/i.test(kind) && parts.length >= 2) {
        const team = /^команд/i.test(parts[0]);
        const who = team ? null : personByWord(parts[0]);
        const acc = who ? accountOf(who.id) : null;
        cards.push({k: 'msg', to: team ? 'team' : acc ? acc.id : null, pid: who ? who.id : null, text: parts.slice(1).join('|').slice(0, MSG_MAX)});
      }
      return '';
    }).trim();
    return {text: clean, cards: cards.slice(0, 3)};
  },

  stop() { if (this.ctl) this.ctl.abort(); },
  async ask(q) {
    q = String(q || '').trim();
    if (!q || this.busy) return;
    this.push({r: 'u', t: q.slice(0, 2000)});
    await this.init();
    if (!this.claude()) { setTimeout(() => this.push(this.local(q)), 250); return; }
    const turns = this.hist.filter(x => !x.pending && x.t).slice(-12).map(x => ({role: x.r === 'u' ? 'user' : 'assistant', content: x.t}));
    while (turns.length && turns[turns.length - 1].role !== 'user') turns.pop();
    const turn = this.push({r: 'a', t: '', pending: true});
    await this.run(turn, [{role: 'user', content: this.rules()}, ...turns], () => this.local(q));
  },
  /* один вызов Claude с потоковым ответом; при отказе — ответ без Claude */
  async run(turn, input, fallback, after) {
    this.busy = true;
    this.ctl = new AbortController();
    Chat.paint();
    try {
      const res = await this.sample(input, {modelTier: 'quick', cache: false, signal: this.ctl.signal, onText: ({text}) => { turn.t = text; Chat.paintTurn(turn); }});
      const c = this.cards(res.text);
      turn.t = c.text || res.text;
      if (c.cards.length) turn.cards = c.cards;
      if (res.truncated) turn.note = 'Ответ обрезан — спроси короче.';
    } catch (e) {
      const code = e && e.code;
      if (code === 'cancelled') { turn.t = (e.text || '').trim() || 'Остановлено.'; }
      else if (ADAM_OFF.includes(code)) {
        this.off = true;
        const fb = fallback();
        turn.t = fb.t;
        if (fb.cards) turn.cards = fb.cards;
        turn.note = code === 'not_granted' ? 'Доступ к Claude не разрешён — отвечаю сам, коротко.' : 'Claude здесь недоступен — отвечаю сам, коротко.';
      } else if (code === 'refused') { turn.t = 'На это я не отвечу. Спроси по-другому — помогу с задачами и штабом.'; }
      else {
        const part = (e && e.text || '').trim();
        const fb = fallback();
        turn.t = part || fb.t;
        if (!part && fb.cards) turn.cards = fb.cards;
        turn.note = code === 'rate_limited' ? 'Слишком много вопросов подряд — попробуй через минуту.' : code === 'session_expired' ? 'Нужно заново войти в Claude.' : 'Связь с Claude прервалась — можно спросить ещё раз.';
      }
    } finally {
      delete turn.pending;
      this.busy = false;
      this.ctl = null;
      if (after) after(turn);
      this.save();
      Chat.paint();
      Chat.renderList(true);
    }
  },

  /* черновик сообщения по задаче: кому писать — второму человеку в задаче */
  async draftFor(t) {
    if (!t) return;
    Chat.show('adam');
    await this.load();
    const me = Tasks.meKey();
    const to = t.assignee && t.assignee !== me ? t.assignee : (t.createdBy && t.createdBy !== me ? t.createdBy : null);
    if (!to) { this.push({r: 'a', t: `В задаче «${t.title}» ты и постановщик, и исполнитель — писать некому. Могу помочь разбить её на шаги — просто спроси.`}); return; }
    const p = personById(to), acc = accountOf(to), name = givenOf(p);
    this.push({r: 'u', t: `Напиши сообщение по задаче «${t.title}» — кому: ${name}`});
    const draft = draftText(t, to, me);
    const card = {k: 'msg', to: acc ? acc.id : null, pid: to, text: draft, task: t.id};
    await this.init();
    if (!this.claude()) { this.push({r: 'a', t: `Черновик сообщения — кому: ${name}`, cards: [card]}); return; }
    const turn = this.push({r: 'a', t: '', pending: true});
    const rel = t.assignee === to ? `${name} — исполнитель, собеседник поставил(а) задачу` : `${name} — постановщик, собеседник делает задачу`;
    const d = Tasks.due(t);
    const prompt = `${this.rules()}\n\nНапиши короткое тёплое сообщение (2–4 предложения) от имени собеседника для ${personName(p)} по задаче «${t.title}». ${rel}. Статус: ${STATUSES[t.status] ? STATUSES[t.status].name.toLowerCase() : t.status}. Срок: ${d || 'без срока'}${Tasks.overdue(t) ? ' — уже просрочено' : ''}.${t.desc ? ` Описание: ${String(t.desc).slice(0, 400)}` : ''}${t.result ? ` Ожидаемый результат: ${String(t.result).slice(0, 200)}` : ''}\nОтветь только текстом сообщения — без кавычек, пояснений и строк [[…]].`;
    await this.run(turn, prompt, () => ({t: draft}), x => {
      const text = String(x.t || '').replace(/^["«]|["»]$/g, '').trim();
      card.text = text && !x.note ? text.slice(0, MSG_MAX) : draft;
      x.t = `Черновик сообщения — кому: ${name}`;
      x.cards = [card];
    });
  },
};

/* черновик без Claude: по статусу задачи и тому, кто кому пишет */
function draftText(t, to, me) {
  const name = givenOf(personById(to));
  const d = Tasks.due(t), ds = d ? (t.due ? dayLong(d) : 'конец ' + monthName(t.month).toLowerCase()) : '';
  if (t.assignee === to) {
    if (t.status === 'review') return `${name}, привет! Вижу, что «${t.title}» на согласовании — посмотрю сегодня. Спасибо!`;
    if (Tasks.overdue(t)) return `${name}, привет! Как продвигается «${t.title}»? Срок был ${ds}. Если нужно больше времени или помощь — напиши, вместе решим.`;
    if (ds) return `${name}, привет! Напоминаю про «${t.title}» — срок ${ds}. Если есть вопросы или что-то мешает — пиши, помогу.`;
    return `${name}, привет! Как дела с «${t.title}»? Подскажи, когда ориентировочно будет готово.`;
  }
  if (t.status === 'review') return `${name}, привет! «${t.title}» готово и ждёт твоего согласования — посмотри, пожалуйста, когда будет минутка.`;
  if (Tasks.overdue(t)) return `${name}, привет! По «${t.title}» не успеваю к сроку (${ds}). Предлагаю перенести на пару дней — так получится качественно. Ок?`;
  if (t.status === 'doing') return `${name}, привет! По «${t.title}»: в работе, иду по плану${ds ? ` к ${ds}` : ''}. Если появятся вопросы — напишу.`;
  return `${name}, привет! Беру «${t.title}» в работу. Если есть детали, которые важно учесть, — напиши.`;
}
/* человек по слову из ответа: имя, имя и фамилия */
function personByWord(w) {
  const s = String(w || '').toLowerCase().replace(/ё/g, 'е').trim();
  if (!s) return null;
  const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е');
  const list = people().filter(p => p.name);
  return list.find(p => norm(p.name) === s) || list.find(p => norm(p.name).startsWith(s)) || list.find(p => s.split(/\s+/).some(part => part.length > 2 && norm(givenOf(p)).startsWith(part.slice(0, Math.max(3, part.length - 2))))) || null;
}
/* текст в пузыре: абзацы, **жирный**, ссылки */
function adamFormat(text) {
  return esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)»])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}

/* ── панель: Адам, команда, личные ── */
const Chat = {
  open: false,
  tab: 'adam',
  dm: null,
  _wired: false,

  chan() { return this.tab === 'team' ? 'team' : this.tab === 'dm' ? this.dm : null; },
  html() {
    return `<button class="adam-fab" id="adamFab" type="button" aria-label="Адам и сообщения команды" title="Адам — ассистент команды, сообщения">${adamFace()}<span class="fab-n" id="fabN" hidden></span></button>
      <aside class="chat" id="chat" hidden aria-label="Адам и сообщения команды">
        <header class="chat-head">
          <div class="chat-tabs" role="tablist">
            <button type="button" data-chat-tab="adam">${adamFace('xs')}Адам</button>
            <button type="button" data-chat-tab="team">${icon('users')}Команда<span class="n" id="chatNTeam"></span></button>
            <button type="button" data-chat-tab="dm">${icon('msg')}Личные<span class="n" id="chatNDm"></span></button>
          </div>
          <button type="button" class="icon-btn" data-chat-close aria-label="Закрыть">${icon('x')}</button>
        </header>
        <div class="chat-sub" id="chatSub"></div>
        <div class="chat-list" id="chatList" aria-live="polite"></div>
        <div class="chat-chips" id="chatChips"></div>
        <form class="chat-form" id="chatForm"><textarea class="textarea" id="chatInput" rows="1" maxlength="${MSG_MAX}"></textarea>
          <button class="btn primary chat-send" id="chatSend" type="submit" aria-label="Отправить">${icon('arrow')}</button></form>
      </aside>`;
  },
  wire() {
    const root = $('#app');
    $('#adamFab').onclick = () => (this.open ? this.hide() : this.show());
    on(root, 'click', '[data-chat-close]', () => this.hide());
    on(root, 'click', '[data-chat-tab]', (e, b) => this.show(b.dataset.chatTab));
    const inp = $('#chatInput');
    const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 140) + 'px'; };
    inp.addEventListener('input', grow);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); this.submit(); } });
    $('#chatForm').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    const chat = $('#chat');
    on(chat, 'click', '[data-chip]', (e, b) => Adam.ask(b.dataset.chip));
    on(chat, 'click', '[data-adam-stop]', () => Adam.stop());
    on(chat, 'click', '[data-adam-clear]', () => Adam.clear());
    on(chat, 'click', '[data-dm-open]', (e, b) => this.show('dm', b.dataset.dmOpen));
    on(chat, 'click', '[data-dm-back]', () => { this.dm = null; this.render(); });
    on(chat, 'click', '[data-msg-del]', async (e, b) => {
      if (await confirmPop(b, {text: 'Удалить сообщение?', yes: 'Удалить', danger: true})) Store.remove('messages', b.dataset.msgDel);
    });
    on(chat, 'click', '[data-card]', (e, b) => this.card(b));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.open && !modalOpen() && !$('.pop')) this.hide(); });
    this._wired = true;
    this.paint();
  },
  show(tab, dm) {
    if (!$('#chat')) return;
    if (tab) this.tab = tab;
    if (dm !== undefined) this.dm = dm;
    this.open = true;
    $('#chat').hidden = false;
    document.body.classList.add('chat-on');
    Adam.init();
    Adam.load().then(() => { if (this.tab === 'adam') { Adam.greetIfNeeded(); this.renderList(true); } });
    this.render();
    if (window.matchMedia && !window.matchMedia('(max-width: 640px)').matches) setTimeout(() => { const i = $('#chatInput'); if (i && !i.disabled) i.focus(); }, 40);
  },
  hide() {
    this.open = false;
    const c = $('#chat');
    if (c) c.hidden = true;
    document.body.classList.remove('chat-on');
    this.paint();
  },
  /* перерисовать всё в панели, кроме набранного текста */
  render() {
    if (!$('#chat')) return;
    $$('[data-chat-tab]').forEach(b => b.classList.toggle('on', b.dataset.chatTab === this.tab));
    this.paintSub();
    this.renderList(true);
    this.paintForm();
    this.paint();
  },
  paintSub() {
    const sub = $('#chatSub');
    if (!sub) return;
    if (this.tab === 'adam') sub.innerHTML = `<span class="note">${Adam.claude() ? 'Отвечает с помощью Claude — из вашего лимита Claude' : Adam.sample === null || Adam.off ? 'Простой режим: частые вопросы, сводка, черновики' : 'Адам — ассистент команды'}</span>${Adam.hist.length ? '<button type="button" class="link-btn" data-adam-clear>Очистить разговор</button>' : ''}`;
    else if (this.tab === 'team') sub.innerHTML = '<span class="note">Общий чат команды — видят все в штабе</span>';
    else if (this.dm) sub.innerHTML = `<button type="button" class="link-btn chat-back" data-dm-back>${icon('back')}Все диалоги</button><span class="chat-peer">${accAvatar(Msgs.peer(this.dm), 'xs')}<b>${esc(accName(Msgs.peer(this.dm)))}</b></span>`;
    else sub.innerHTML = '<span class="note">Личные сообщения: видны в штабе только вам двоим</span>';
  },
  paintForm() {
    const inp = $('#chatInput'), send = $('#chatSend'), chips = $('#chatChips');
    if (!inp) return;
    const ro = Store.state.readOnly && this.tab !== 'adam';
    const noForm = this.tab === 'dm' && !this.dm;
    $('#chatForm').hidden = noForm;
    inp.disabled = ro || (this.tab === 'adam' && Adam.busy);
    send.disabled = inp.disabled;
    inp.placeholder = ro ? 'Только просмотр — писать нельзя' : this.tab === 'adam' ? 'Спросите Адама…' : this.tab === 'team' ? 'Сообщение команде…' : this.dm ? `Сообщение — ${accFirst(Msgs.peer(this.dm))}…` : '';
    chips.innerHTML = this.tab === 'adam' && !Adam.busy ? ADAM_CHIPS.map(c => `<button type="button" class="chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')
      : this.tab === 'adam' && Adam.busy ? '<button type="button" class="btn xs" data-adam-stop>Остановить</button>' : '';
    chips.hidden = !chips.innerHTML;
  },
  /* кнопка и счётчики: непрочитанные сообщения + точка, если Адаму есть что сказать */
  paint() {
    const fab = $('#adamFab');
    if (!fab) return;
    const n = Msgs.unreadTotal();
    const b = $('#fabN');
    b.hidden = !n && !Adam.hasNews();
    b.textContent = n ? (n > 99 ? '99+' : String(n)) : '';
    b.classList.toggle('dot', !n);
    fab.classList.toggle('news', !this.open && (n > 0 || Adam.hasNews()));
    const nt = Msgs.unread('team'), nd = Msgs.unreadDm();
    const t1 = $('#chatNTeam'), t2 = $('#chatNDm');
    if (t1) t1.textContent = nt ? String(nt) : '';
    if (t2) t2.textContent = nd ? String(nd) : '';
    if (this.open) this.paintForm();
  },
  /* список: сообщения выбранного чата; прокрутка остаётся внизу, если была внизу */
  renderList(toBottom) {
    const box = $('#chatList');
    if (!box || !this.open) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    const me = Msgs.me();
    if (this.tab === 'adam') {
      box.innerHTML = Adam.hist.length ? Adam.hist.map((x, i) => this.turnHtml(x, i)).join('') : `<div class="chat-empty">${adamFace('lg')}<b>Привет! Я Адам</b><span>Спросите, что горит, как что-то сделать в штабе, или попросите написать сообщение коллеге.</span></div>`;
    } else {
      const ch = this.chan();
      if (!ch) {
        const peers = Msgs.peers();
        box.innerHTML = peers.length ? `<div class="dm-list">${peers.map(x => `<button type="button" class="dm-row" data-dm-open="${esc(x.ch)}">${accAvatar(x.a.id)}<span><b>${esc(accName(x.a.id))}</b><small>${x.last ? esc((x.last.by === me ? 'Вы: ' : '') + x.last.text.replace(/\s+/g, ' ').slice(0, 60)) : esc((accPerson(x.a) || {}).title || 'Написать первым')}</small></span>${x.n ? `<em>${x.n}</em>` : ''}</button>`).join('')}</div>`
          : '<div class="chat-empty"><b>Пока не с кем переписываться</b><span>Когда коллеги зарегистрируются по приглашению, они появятся здесь.</span></div>';
      } else {
        const list = Msgs.of(ch).slice(-200);
        let day = '';
        box.innerHTML = list.length ? list.map(m => {
          const d = mskDate(m.at);
          const sep = d !== day ? `<div class="msg-day">${d === today() ? 'Сегодня' : dayLong(d)}</div>` : '';
          day = d;
          const own = m.by === me;
          const canDel = own || Auth.isOwner();
          return `${sep}<div class="msg ${own ? 'own' : ''}">${own ? '' : accAvatar(m.by, 'xs')}<div class="msg-b">${own || ch !== 'team' ? '' : `<b>${esc(accFirst(m.by))}</b>`}<p>${adamFormat(m.text)}</p><small>${hmMs(m.at)}${canDel ? ` <button type="button" class="msg-del" data-msg-del="${esc(m.id)}" aria-label="Удалить" title="Удалить">${icon('x')}</button>` : ''}</small></div></div>`;
        }).join('') : `<div class="chat-empty"><b>${ch === 'team' ? 'Здесь — общий чат команды' : 'Начните диалог'}</b><span>${ch === 'team' ? 'Новости, вопросы и поздравления — их увидят все.' : 'Сообщение придёт со звуком, если штаб открыт.'}</span></div>`;
        Msgs.markSeen(ch);
      }
    }
    /* сначала подсказки и поле (они меняют высоту списка), потом прокрутка */
    this.paint();
    if (toBottom || near) box.scrollTop = box.scrollHeight;
  },
  turnHtml(x, i) {
    if (x.r === 'u') return `<div class="msg own"><div class="msg-b"><p>${adamFormat(x.t)}</p></div></div>`;
    const cards = (x.cards || []).map((c, j) => this.cardHtml(c, i, j)).join('');
    return `<div class="msg adam" data-turn="${i}">${adamFace('xs')}<div class="msg-b"><p class="adam-t">${x.pending && !x.t ? '<span class="typing"><i></i><i></i><i></i></span>' : adamFormat(x.t)}</p>${cards ? `<div class="adam-cards">${cards}</div>` : ''}${x.note ? `<small class="adam-note">${esc(x.note)}</small>` : ''}</div></div>`;
  },
  cardHtml(c, i, j) {
    const id = `${i}:${j}`;
    if (c.k === 'go') return `<button type="button" class="chip" data-card="${id}">${esc(c.label)}${icon('arrow')}</button>`;
    if (c.k === 'task') return `<button type="button" class="chip" data-card="${id}">${icon('check')}${esc(String(c.label).slice(0, 40))}</button>`;
    if (c.k === 'remind') return `<button type="button" class="chip" data-card="${id}">${icon('msg')}${esc(c.label)}</button>`;
    if (c.k === 'chat') return `<button type="button" class="chip" data-card="${id}">${icon('msg')}${esc(c.label)}</button>`;
    if (c.k === 'newtask') return `<div class="adam-card"><span class="label">Предлагаю задачу</span><b>${esc(c.title)}</b><small>${c.pid ? esc(personName(personById(c.pid))) : 'без исполнителя'}${c.due ? ' · до ' + dayLong(c.due) : ''}</small>
      <div class="row"><button type="button" class="btn xs primary" data-card="${id}">${icon('plus')}Создать задачу</button></div></div>`;
    if (c.k === 'msg') {
      const name = c.to === 'team' ? 'команде' : c.pid ? givenOf(personById(c.pid)) : '';
      const tg = c.pid && !c.to ? normTg((personById(c.pid) || {}).telegram) : '';
      return `<div class="adam-card msg-card"><span class="label">Сообщение${name ? ' — ' + esc(name) : ''}</span><blockquote>${adamFormat(c.text)}</blockquote>
        <div class="row">${c.to ? `<button type="button" class="btn xs primary" data-card="${id}" data-act="send">${icon('arrow')}Отправить${c.to === 'team' ? ' в чат' : ''}</button>` : ''}
          ${c.to ? `<button type="button" class="btn xs" data-card="${id}" data-act="edit">${icon('edit')}Изменить</button>` : ''}
          ${c.task && Tasks.get(c.task) ? `<button type="button" class="btn xs" data-card="${id}" data-act="comment">${icon('msg')}В комментарий задачи</button>` : ''}
          ${tg ? `<a class="btn xs" href="${esc(tgUrl(tg))}" target="_blank" rel="noopener" data-card="${id}" data-act="copy">${icon('ext')}Telegram</a>` : ''}
          <button type="button" class="btn xs ghost" data-card="${id}" data-act="copy">${icon('copy')}Скопировать</button></div>
        ${!c.to && c.pid ? `<small class="note">${esc(givenOf(personById(c.pid)))} ещё не в штабе — отправьте в Telegram или комментарием к задаче.</small>` : ''}</div>`;
    }
    return '';
  },
  card(b) {
    const [i, j] = b.dataset.card.split(':').map(Number);
    const c = ((Adam.hist[i] || {}).cards || [])[j];
    if (!c) return;
    const act = b.dataset.act;
    if (c.k === 'go') { location.hash = c.href.slice(1); if (window.matchMedia('(max-width: 640px)').matches) this.hide(); return; }
    if (c.k === 'task') { openTask(c.id); return; }
    if (c.k === 'remind') { Adam.draftFor(Tasks.get(c.id)); return; }
    if (c.k === 'chat') { this.show(c.tab, null); return; }
    if (c.k === 'newtask') { openTask(null, {defaults: {title: c.title, assignee: c.pid || Auth.personId(), ...(c.due ? {due: c.due, month: monthOf(c.due)} : {})}}); return; }
    if (c.k === 'msg') {
      if (act === 'copy') { copyText(c.text, b.tagName === 'A' ? null : b); if (b.tagName === 'A') toast('Текст скопирован — вставьте его в чат'); return; }
      if (act === 'comment') { const t = Tasks.get(c.task); if (t) { Tasks.comment(t, c.text); toast('Добавлено комментарием к задаче — придёт участникам задачи'); } return; }
      const ch = c.to === 'team' ? 'team' : c.to ? dmKey(Msgs.me(), c.to) : null;
      if (!ch) return;
      if (act === 'edit') { this.show(c.to === 'team' ? 'team' : 'dm', c.to === 'team' ? null : ch); const inp = $('#chatInput'); inp.value = c.text; inp.dispatchEvent(new Event('input')); inp.focus(); return; }
      if (Msgs.send(ch, c.text)) {
        Sound.play('sent');
        toast(c.to === 'team' ? 'Отправлено в чат команды' : `Отправлено — ${accFirst(c.to)}`, {action: {label: 'Открыть', fn: () => this.show(c.to === 'team' ? 'team' : 'dm', c.to === 'team' ? null : ch)}});
        c.sent = true;
        b.disabled = true;
        b.textContent = 'Отправлено';
        Adam.save();
      }
    }
  },
  /* потоковый ответ: обновляем один пузырь, а не весь список */
  paintTurn(turn) {
    const i = Adam.hist.indexOf(turn);
    const el = i >= 0 ? $(`#chatList [data-turn="${i}"] .adam-t`) : null;
    if (!el) return;
    const box = $('#chatList');
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    el.innerHTML = adamFormat(Adam.cards(turn.t).text || turn.t);
    if (near) box.scrollTop = box.scrollHeight;
  },
  submit() {
    const inp = $('#chatInput');
    const text = inp.value.trim();
    if (!text || inp.disabled) return;
    if (this.tab === 'adam') { inp.value = ''; inp.dispatchEvent(new Event('input')); Adam.ask(text); return; }
    const ch = this.chan();
    if (!ch) return;
    if (Msgs.send(ch, text)) {
      inp.value = '';
      inp.dispatchEvent(new Event('input'));
      Sound.play('sent');
      this.renderList(true);
    }
  },
};
