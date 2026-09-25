/* Константы CRM: роли и права, разделы, воронки по умолчанию, каналы,
   источники, типы оплат, анкета Eva Space и схема таблицы клиентов.
   Воронки, сегменты, теги, шаблоны и ставки — редактируемые: значения
   здесь — только начальные, живые лежат в cfg/* и правятся в «Настройках». */

const APP = {name: 'Eva CRM', sub: 'работа с клиентами'};

/* ── роли ── */
const ROLES = {
  owner:   {name: 'Руководитель',     tone: 'gold',   about: 'видит и меняет всё: настройки, деньги, выплаты, команду'},
  lead:    {name: 'Старший менеджер', tone: 'violet', about: 'все клиенты и воронки, распределение, рассылки, отчёты'},
  manager: {name: 'Менеджер',         tone: 'rose',   about: 'свои клиенты и свободные заявки: переписка, звонки, задачи'},
  curator: {name: 'Куратор',          tone: 'good',   about: 'эксперты, партнёры и реферальная программа'},
  viewer:  {name: 'Наблюдатель',      tone: '',       about: 'только смотрит дашборд и отчёты'},
};
const roleOf = r => (ROLES[r] ? r : 'manager');
const PERMS = {
  'clients.view':     ['owner', 'lead', 'manager', 'curator', 'viewer'],
  'clients.all':      ['owner', 'lead', 'curator', 'viewer'],   // видеть чужих клиентов
  'clients.edit':     ['owner', 'lead', 'manager', 'curator'],
  'clients.assign':   ['owner', 'lead'],
  'clients.delete':   ['owner', 'lead'],
  'inbox.view':       ['owner', 'lead', 'manager', 'curator'],
  'campaigns.view':   ['owner', 'lead', 'manager', 'curator', 'viewer'],
  'campaigns.send':   ['owner', 'lead'],
  'experts.view':     ['owner', 'lead', 'curator', 'viewer', 'manager'],
  'experts.edit':     ['owner', 'lead', 'curator'],
  'partners.view':    ['owner', 'lead', 'curator', 'viewer', 'manager'],
  'partners.edit':    ['owner', 'lead', 'curator'],
  'referrals.view':   ['owner', 'lead', 'curator', 'viewer'],
  'payouts.manage':   ['owner', 'curator'],
  'money.view':       ['owner', 'lead', 'curator', 'viewer'],
  'reports.view':     ['owner', 'lead', 'curator', 'viewer', 'manager'],
  'export':           ['owner', 'lead'],
  'settings.view':    ['owner', 'lead'],
  'settings.edit':    ['owner'],
  'funnels.edit':     ['owner', 'lead'],
  'team.manage':      ['owner'],
};

/* ── разделы ── */
const NAV = [
  {id: 'home',      name: 'Дашборд',   icon: 'home'},
  {id: 'clients',   name: 'Клиенты',   icon: 'table',  perm: 'clients.view'},
  {id: 'funnels',   name: 'Воронки',   icon: 'funnel', perm: 'clients.view'},
  {id: 'inbox',     name: 'Сообщения', icon: 'inbox',  perm: 'inbox.view'},
  {id: 'campaigns', name: 'Касания',   icon: 'send',   perm: 'campaigns.view'},
  {id: 'experts',   name: 'Эксперты',  icon: 'cam',    perm: 'experts.view'},
  {id: 'partners',  name: 'Партнёры',  icon: 'store',  perm: 'partners.view'},
  {id: 'referrals', name: 'Рефералы',  icon: 'gift',   perm: 'referrals.view'},
  {id: 'reports',   name: 'Отчёты',    icon: 'chart',  perm: 'reports.view'},
  {id: 'settings',  name: 'Настройки', icon: 'gear',   perm: 'settings.view'},
];

/* ── воронки по умолчанию. about — критерий входа в этап: что должно
   случиться, чтобы карточку можно было сюда перенести ── */
const DEFAULT_FUNNELS = {
  sales: {
    name: 'Продажи', entity: 'clients', order: 1,
    about: 'Клиентки Eva Space: от первого касания до первой оплаты. Войти в воронку можно с любого этапа — купленная база начинается с «База загружена», заявка с сайта — с «Заявка получена».',
    stages: [
      {id: 'warm1',   name: 'Прогрев 1',             about: 'Контакт появился: подписка на канал или бота, лид-магнит, регистрация на эфир. Идёт серия прогрева № 1 — знакомство с Евой.'},
      {id: 'warm2',   name: 'Прогрев 2',             about: 'Проявила интерес: открыла письма, пришла на эфир или мастер-класс, ответила боту. Серия № 2 — отзывы, результаты, предложение.'},
      {id: 'base',    name: 'База загружена',        about: 'Контакт в базе целиком: телефон или мессенджер, согласие на обработку данных и на рассылку, назначен менеджер.'},
      {id: 'lead',    name: 'Заявка получена',       about: 'Сама оставила заявку: форма, сообщение, звонок, заявка от партнёра. Ответить — в течение 15 минут в рабочее время.'},
      {id: 'qual',    name: 'Квалификация пройдена', about: 'Состоялся разговор: понятна цель, сегмент и бюджет, подходит тариф. Записано в карточке.'},
      {id: 'invoice', name: 'Счёт выставлен',        about: 'Отправлена ссылка на оплату или счёт. Если нет оплаты 3 дня — напоминание и звонок.'},
      {id: 'paid',    name: 'Оплата получена',       about: 'Первая оплата прошла. Дальше клиентка живёт в подписке: продления, курсы, рефералы.', won: true},
    ],
  },
  experts: {
    name: 'Эксперты', entity: 'experts', order: 2,
    about: 'Эксперты платформы: от списка кандидатов до первых выплат с продаж их мастер-классов.',
    stages: [
      {id: 'list',   name: 'Список загружен',    about: 'Эксперт в списке кандидатов: направление, соцсети, охват.'},
      {id: 'call1',  name: 'Созвон назначен',    about: 'Договорились о дате и времени первого созвона.'},
      {id: 'call2',  name: 'Созвон проведён',    about: 'Рассказали о платформе и условиях, эксперт думает.'},
      {id: 'agreed', name: 'Согласовано',        about: 'Условия согласованы, договор отправлен или подписан, дата съёмки выбрана.'},
      {id: 'shot',   name: 'Съёмки проведены',   about: 'Мастер-классы сняты, материал у монтажа.'},
      {id: 'live',   name: 'Контент загружен',   about: 'Мастер-классы опубликованы на платформе и видны клиенткам.'},
      {id: 'paying', name: 'Оплаты пошли',       about: 'Есть продажи с контента эксперта, начисляется доля.', won: true},
    ],
  },
  partners: {
    name: 'Партнёры', entity: 'partners', order: 3,
    about: 'Салоны, студии и сервисы, которые приводят клиенток или дают спецпредложения участницам Евы.',
    stages: [
      {id: 'base',     name: 'База загружена',      about: 'Партнёр в списке: категория, город, контакты.'},
      {id: 'contact',  name: 'Первый контакт',      about: 'Дозвонились или получили ответ, есть контактное лицо.'},
      {id: 'meeting',  name: 'Встреча проведена',   about: 'Показали Еву, обсудили формат: комиссия, взаимный промо или бартер.'},
      {id: 'terms',    name: 'Условия согласованы', about: 'Согласованы условия и спецпредложение, готовится договор.'},
      {id: 'contract', name: 'Договор подписан',    about: 'Договор подписан, выдан промокод и материалы.'},
      {id: 'active',   name: 'Партнёр активен',     about: 'Партнёр приводит клиенток или участницы пользуются предложением.', won: true},
    ],
  },
};
const LOST = {id: 'lost', name: 'Отказ'};
const LOST_REASONS = ['Дорого', 'Нет времени', 'Не целевая', 'Выбрала другое', 'Не выходит на связь', 'Отложила решение', 'Другое'];

/* ── каналы связи ── */
const CHANNELS = {
  tg:    {name: 'Telegram',  short: 'TG',    color: '#2A9FD8', msg: true,  mass: true},
  wa:    {name: 'WhatsApp',  short: 'WA',    color: '#1FA855', msg: true,  mass: true},
  max:   {name: 'MAX',       short: 'MAX',   color: '#6A4BE0', msg: true,  mass: true},
  email: {name: 'Почта',     short: 'Email', color: '#8F6B27', msg: true,  mass: true},
  sms:   {name: 'SMS',       short: 'SMS',   color: '#7B7987', msg: true,  mass: true},
  push:  {name: 'Пуш',       short: 'Пуш',   color: '#AD4C74', msg: false, mass: true},
  call:  {name: 'Звонок',    short: 'Звонок', color: '#23734F', msg: false, mass: false},
  group: {name: 'Групповой чат', short: 'Чат', color: '#4F46B8', msg: false, mass: false},
  app:   {name: 'Приложение', short: 'App',  color: '#5E2F66', msg: false, mass: false},
};
const MSG_CH = ['tg', 'wa', 'max', 'email', 'sms'];
const MASS_CH = ['email', 'push', 'tg', 'wa', 'max', 'sms'];

/* ── откуда пришла клиентка ── */
const SOURCES = {
  tg:         'Telegram',
  vk:         'ВКонтакте',
  blogger:    'Блогеры и посевы',
  ads:        'Таргет и Директ',
  referral:   'Подруга по ссылке',
  ambassador: 'Амбассадор',
  partner:    'Партнёр или студия',
  expert:     'Аудитория эксперта',
  conf:       'Конференция UNICONF',
  event:      'Мероприятия Eva Events',
  site:       'Сайт и поиск',
  import:     'Загруженная база',
};

/* ── типы и способы оплаты ── */
const PAY_TYPES = {
  sub:     {name: 'Подписка на месяц',   color: '#5A50C0', sub: 30},
  year:    {name: 'Подписка на год',     color: '#3D6FA8', sub: 365},
  course:  {name: 'Курс',                color: '#AD4C74'},
  consult: {name: 'Консультация',        color: '#8A4FA0'},
  event:   {name: 'Мероприятие',         color: '#4F7A7A'},
  club:    {name: 'Платный клуб',        color: '#B0573A'},
  market:  {name: 'Маркет',              color: '#2C7753'},
  topup:   {name: 'Пополнение баланса',  color: '#8F6B27'},
  refund:  {name: 'Возврат',             color: '#A23A4A'},
};
const PAY_METHODS = {card: 'Карта', sbp: 'СБП', balance: 'Баланс Евы', invoice: 'Счёт юрлицу'};
const PAY_STATUS = {ok: {name: 'Оплачено', tone: 'good'}, pending: {name: 'Ждёт оплаты', tone: 'warn'}, fail: {name: 'Не прошла', tone: 'bad'}};

/* ── анкета при регистрации в Eva Space — как во второй версии приложения ── */
const QUIZ = {
  goal:     {name: 'Что важнее всего', multi: true, opts: {confidence: 'Уверенность в себе', calm: 'Спокойствие', energy: 'Энергия и силы', love: 'Отношения', money: 'Деньги и своё дело', body: 'Контакт с телом'}},
  level:    {name: 'Опыт практик',     opts: {new: 'Совсем новичок', tried: 'Пробовала, но бросала', regular: 'Практикует регулярно'}},
  time:     {name: 'Время в день',     opts: {t10: '5–10 минут', t20: '15–20 минут', t40: '30 минут и больше'}},
  rel:      {name: 'Отношения',        opts: {free: 'Свободна', partner: 'Партнёр, живём отдельно', married: 'Замужем', divorce: 'В разводе', crisis: 'Кризис в отношениях'}},
  stage:    {name: 'Этап жизни',       health: true, opts: {pregnant: 'Беременность', baby: 'Мама малыша до 3 лет', school: 'Мама школьника', grown: 'Дети взрослые', career: 'Карьера', search: 'Ищет своё направление'}},
  interest: {name: 'Интересы',         multi: true, opts: {meditation: 'Медитации', yoga: 'Йога и тело', breath: 'Дыхание', psy: 'Психология', cycle: 'Женское здоровье', voice: 'Голос и публичность', beauty: 'Красота и ритуалы', money: 'Деньги', love: 'Отношения', mom: 'Материнство', food: 'Питание', biz: 'Своё дело'}},
};
const quizText = (k, v) => { const q = QUIZ[k]; if (!q || v === undefined || v === null || v === '') return ''; return (Array.isArray(v) ? v : [v]).map(x => q.opts[x] || x).join(', '); };

/* ── уровни клиентки в приложении (баллы за практики) ── */
const LEVELS = [
  {id: 'student', name: 'Ученица',    from: 0},
  {id: 'expert',  name: 'Практикующая', from: 1000},   // в приложении пока «Эксперт» — переименовать, чтобы не путать с экспертами
  {id: 'mentor',  name: 'Наставница', from: 3500},
];
const levelOf = pts => LEVELS.slice().reverse().find(l => (pts || 0) >= l.from) || LEVELS[0];

/* ── сферы: ниша клиентки или партнёра (используется в сегментах) ── */
const NICHES = ['Салон красоты', 'Студия пилатеса', 'Йога-студия', 'Фитнес-клуб', 'Косметология', 'Психология и коучинг', 'Своё дело', 'Работа в найме', 'Декрет', 'Студентка', 'Медицина', 'Образование'];
const PARTNER_CATS = ['Салон красоты', 'Студия пилатеса', 'Йога-студия', 'Фитнес-клуб', 'Косметология', 'SPA и массаж', 'Здоровое питание', 'Психологический центр', 'Пространство для встреч', 'Бренд для маркета', 'Организатор мероприятий', 'Спонсор', 'Медиа и блогеры', 'Другое'];
const PARTNER_MODELS = {
  commission: 'Комиссия с оплат приведённых клиенток',
  cross:      'Взаимный промо: мы — им, они — нам',
  barter:     'Бартер: зал, продукция, услуги',
  sponsor:    'Спонсорство событий',
  corporate:  'Корпоративная подписка для сотрудниц',
  market:     'Товары в маркете Евы',
};
const EXPERT_DIRS = ['Психология', 'Йога и тело', 'Медитация и дыхание', 'Женское здоровье', 'Красота и уход', 'Деньги и карьера', 'Голос и публичность', 'Материнство', 'Питание', 'Отношения'];
const EXPERT_EXP = ['до года', '1–3 года', '3–5 лет', '5–10 лет', 'больше 10 лет'];
const EXPERT_FORMATS = ['Практики и медитации', 'Мастер-классы', 'Курс', 'Личные консультации', 'Встречи офлайн'];
const CONTENT_STATUS = {plan: {name: 'В плане', tone: ''}, shot: {name: 'Снят', tone: 'violet'}, edit: {name: 'Монтаж', tone: 'gold'}, live: {name: 'Опубликован', tone: 'good'}};

/* ── виды событий в истории карточки ── */
const EV_KINDS = {
  msg:   {name: 'Сообщение'},
  call:  {name: 'Звонок'},
  camp:  {name: 'Рассылка'},
  pay:   {name: 'Оплата'},
  note:  {name: 'Заметка'},
  task:  {name: 'Задача'},
  stage: {name: 'Этап'},
  meet:  {name: 'Встреча'},
  sys:   {name: 'Приложение'},
  group: {name: 'Групповой чат'},
};
const CALL_RESULTS = {ok: 'Поговорили', noanswer: 'Не ответила', busy: 'Занято', later: 'Просила перезвонить', wrong: 'Неверный номер'};
const CAMP_STATUS = {queued: 'В очереди', sent: 'Отправлено', delivered: 'Доставлено', opened: 'Открыто', clicked: 'Переход', replied: 'Ответ', unsub: 'Отписка', failed: 'Не доставлено'};
const CAMP_RANK = {queued: 0, failed: 0, sent: 1, delivered: 2, opened: 3, clicked: 4, replied: 5, unsub: 1};

/* ── теги по умолчанию: группа помогает не плодить похожие ── */
const DEFAULT_TAGS = {
  vip:        {name: 'VIP',                 group: 'Статус',    color: '#8F6B27'},
  ambassador: {name: 'Амбассадор',          group: 'Статус',    color: '#AD4C74'},
  beta:       {name: 'Бета-тестер',         group: 'Статус',    color: '#5A50C0'},
  hot:        {name: 'Горячая',             group: 'Интерес',   color: '#A23A4A'},
  course:     {name: 'Интерес к курсам',    group: 'Интерес',   color: '#3D6FA8'},
  yearplan:   {name: 'Хочет годовой',       group: 'Интерес',   color: '#2C7753'},
  webinar:    {name: 'Была на эфире',       group: 'Поведение', color: '#8A4FA0'},
  silent:     {name: 'Молчит 2 недели',     group: 'Поведение', color: '#7B7987'},
  conf:       {name: 'UNICONF',             group: 'Событие',   color: '#4F7A7A'},
  mom:        {name: 'Мама',                group: 'Жизнь',     color: '#B0573A'},
  business:   {name: 'Предпринимательница', group: 'Жизнь',     color: '#4F46B8'},
};

/* ── сегменты по умолчанию: условия проверяются по полям клиентки ── */
const DEFAULT_SEGMENTS = {
  beauty:  {name: 'Салоны красоты',        color: '#AD4C74', order: 1, match: 'any', rules: [{f: 'niche', op: 'eq', v: 'Салон красоты'}, {f: 'niche', op: 'eq', v: 'Косметология'}],
            offer: 'Корпоративная подписка для мастеров салона −20%, мастер-класс «Ритуалы красоты» для клиенток салона.'},
  pilates: {name: 'Пилатес, йога, фитнес', color: '#2C7753', order: 2, match: 'any', rules: [{f: 'niche', op: 'eq', v: 'Студия пилатеса'}, {f: 'niche', op: 'eq', v: 'Йога-студия'}, {f: 'niche', op: 'eq', v: 'Фитнес-клуб'}],
            offer: 'Взаимный промо: практики Евы в подарок к абонементу студии, 10% студии с оплат приведённых клиенток.'},
  moms:    {name: 'Мамы и беременные',     color: '#B0573A', order: 3, match: 'any', rules: [{f: 'q_stage', op: 'in', v: ['pregnant', 'baby', 'school']}, {f: 'tags', op: 'has', v: 'mom'}],
            offer: 'Короткие практики «5 минут для мамы», месяц за 1 ₽ по промокоду MAMA.'},
  biz:     {name: 'Своё дело и карьера',   color: '#4F46B8', order: 4, match: 'any', rules: [{f: 'q_stage', op: 'eq', v: 'career'}, {f: 'niche', op: 'eq', v: 'Своё дело'}],
            offer: 'Мастер-классы «Деньги в женских руках» и «Голос, который слышат», годовой тариф со скидкой.'},
  vip:     {name: 'VIP: LTV от 15 000 ₽',  color: '#8F6B27', order: 5, match: 'all', rules: [{f: 'ltv', op: 'gte', v: 15000}],
            offer: 'Личный менеджер, ранний доступ к курсам, приглашение в закрытый клуб.'},
};

/* ── шаблоны сообщений: {имя}, {менеджер}, {промокод}, {ссылка} подставляются сами ── */
const DEFAULT_TEMPLATES = {
  hello:   {name: 'Первое сообщение',       ch: 'tg',    text: 'Здравствуйте, {имя}! Я {менеджер} из Eva Space. Вы оставляли заявку — подскажу, с чего начать и какая программа подойдёт именно вам. Удобно сейчас пару минут?'},
  pay:     {name: 'Ссылка на оплату',       ch: 'tg',    text: '{имя}, отправляю ссылку на оплату подписки Eva Space: {ссылка}. Программа на первую неделю соберётся сразу после оплаты.'},
  remind:  {name: 'Напоминание об оплате',  ch: 'wa',    text: '{имя}, добрый день! Счёт на подписку ещё ждёт вас: {ссылка}. Если остались вопросы — ответьте на это сообщение.'},
  renew:   {name: 'Подписка заканчивается', ch: 'tg',    text: '{имя}, ваша подписка Eva Space заканчивается через 3 дня. Продлите, чтобы не потерять звёзды и программу: {ссылка}'},
  friend:  {name: 'Приведи подругу',        ch: 'email', text: '{имя}, делитесь Евой с подругами: по вашему промокоду {промокод} им скидка на первый месяц, а вам — процент с их оплат каждый месяц.'},
  after:   {name: 'После звонка',           ch: 'wa',    text: '{имя}, спасибо за разговор! Как договорились, отправляю материалы: {ссылка}'},
};

/* ── ставки и правила по умолчанию (руководитель меняет в «Настройках»).
   Цифры — из приложения Eva Space V2 и положения об амбассадорах ── */
const DEFAULT_SETTINGS = {
  price: 2900,            // подписка на месяц, ₽
  priceYear: 24900,       // подписка на год, ₽
  trialDays: 3,           // пробный доступ
  /* «Приведи подругу»: доля с покупок приглашённой по уровню пригласившей,
     без учёта списанных бонусов, в течение года; один уровень — без «сетки» */
  refRates: {student: 0.1, expert: 0.2, mentor: 0.3},
  refMonths: 12,
  refMin: 3000,           // вывод на карту — от 3 000 ₽ раз в месяц, меньше — копится
  friendBonus: 300,       // подруге — 300 бонусов на первый заказ
  /* амбассадоры — только по приглашению, только с подписок, от чистого поступления */
  ambRate: 0.3,
  ambKeyRate: 0.5,        // ключевым — на первый год
  ambMin: 5000,
  netFactor: 0.91,        // платёж − эквайринг ≈3% − налог 6%
  refundPause: 0.15,      // возвратов больше 15% — начисления на паузу
  refHoldDays: 14,        // оплата засчитывается через 14 дней — окно возврата
  refPayDay: 10,          // выплата до 10 числа за прошлый месяц
  refBalanceBonus: 0.1,   // предложение: +10%, если оставить деньги на балансе Евы
  partnerRate: 0.1,       // комиссия партнёра по умолчанию
  expertShare: 0.7,       // эксперту 70%, платформе 30% — одна ставка, пока экспертов меньше 20
  replyMinutes: 15,       // норма ответа на заявку
  staleDays: 7,           // «без касания» — сколько дней
  pushPerWeek: 2,         // пушей не чаще двух в неделю — как в приложении
  plan: {name: 'IV квартал 2026', start: '2026-10-01', end: '2026-12-31', target: 500, min: 100, max: 1000},
};

/* ── схема таблицы клиентов: единый источник для таблицы, фильтров,
   условий сегментов, импорта CSV и страницы «Схема базы» ──
   type: text | phone | email | tg | date | select | multi | number | money | tags | stage | person | partner | client | quiz | bool
   calc — поле считается из истории, руками не правится */
const FIELD_GROUPS = ['Контакты', 'Воронка', 'Анкета Eva Space', 'Подписка и деньги', 'Согласия', 'Активность в приложении', 'Реферальная программа', 'Служебные'];
const CLIENT_FIELDS = [
  {k: 'name',      n: 'Имя и фамилия',       g: 'Контакты', type: 'text', col: true, req: true, csv: ['имя', 'фио', 'name', 'клиент']},
  {k: 'phone',     n: 'Телефон',             g: 'Контакты', type: 'phone', col: true, csv: ['телефон', 'phone', 'тел']},
  {k: 'email',     n: 'Почта',               g: 'Контакты', type: 'email', csv: ['почта', 'email', 'e-mail']},
  {k: 'tg',        n: 'Telegram',            g: 'Контакты', type: 'tg', csv: ['telegram', 'тг', 'tg', 'телеграм']},
  {k: 'wa',        n: 'WhatsApp',            g: 'Контакты', type: 'phone', about: 'если номер отличается от телефона', csv: ['whatsapp', 'ватсап', 'wa']},
  {k: 'city',      n: 'Город',               g: 'Контакты', type: 'text', col: true, csv: ['город', 'city']},
  {k: 'birth',     n: 'Дата рождения',       g: 'Контакты', type: 'date', csv: ['дата рождения', 'день рождения', 'birthday']},
  {k: 'niche',     n: 'Сфера / ниша',        g: 'Контакты', type: 'select', list: () => NICHES, col: true, csv: ['ниша', 'сфера', 'категория', 'niche']},
  {k: 'org',       n: 'Организация',         g: 'Контакты', type: 'text', about: 'для заявок от студий и салонов', csv: ['организация', 'компания', 'салон', 'студия']},
  {k: 'stage',     n: 'Этап воронки',        g: 'Воронка', type: 'stage', col: true},
  {k: 'lostReason',n: 'Причина отказа',      g: 'Воронка', type: 'select', list: () => LOST_REASONS},
  {k: 'segment',   n: 'Сегмент',             g: 'Воронка', type: 'segment', calc: true, col: true, about: 'первый сегмент, чьи условия выполнены'},
  {k: 'tags',      n: 'Теги',                g: 'Воронка', type: 'tags', col: true, csv: ['теги', 'tags', 'метки']},
  {k: 'manager',   n: 'Менеджер',            g: 'Воронка', type: 'person', col: true},
  {k: 'source',    n: 'Источник',            g: 'Воронка', type: 'select', list: () => Object.keys(SOURCES), label: v => SOURCES[v] || v, col: true, csv: ['источник', 'source', 'канал']},
  {k: 'utm',       n: 'Кампания (utm)',      g: 'Воронка', type: 'text', csv: ['utm', 'utm_campaign', 'кампания']},
  {k: 'partnerId', n: 'Привёл партнёр',      g: 'Воронка', type: 'partner'},
  {k: 'referrerId',n: 'Пригласила',          g: 'Воронка', type: 'client'},
  {k: 'created',   n: 'Дата появления',      g: 'Воронка', type: 'date', col: true},
  {k: 'nextAt',    n: 'Следующий шаг',       g: 'Воронка', type: 'date', calc: true, col: true, about: 'ближайшая открытая задача'},
  {k: 'lastTouch', n: 'Последнее касание',   g: 'Воронка', type: 'date', calc: true, col: true},
  {k: 'touches',   n: 'Касаний всего',       g: 'Воронка', type: 'number', calc: true},
  {k: 'q_goal',    n: QUIZ.goal.name,        g: 'Анкета Eva Space', type: 'quiz', q: 'goal'},
  {k: 'q_level',   n: QUIZ.level.name,       g: 'Анкета Eva Space', type: 'quiz', q: 'level'},
  {k: 'q_time',    n: QUIZ.time.name,        g: 'Анкета Eva Space', type: 'quiz', q: 'time'},
  {k: 'q_rel',     n: QUIZ.rel.name,         g: 'Анкета Eva Space', type: 'quiz', q: 'rel'},
  {k: 'q_stage',   n: QUIZ.stage.name,       g: 'Анкета Eva Space', type: 'quiz', q: 'stage', about: 'беременность — данные о здоровье: нужна отдельная галочка'},
  {k: 'q_interest',n: QUIZ.interest.name,    g: 'Анкета Eva Space', type: 'quiz', q: 'interest'},
  {k: 'sub',       n: 'Подписка',            g: 'Подписка и деньги', type: 'sub', calc: true, col: true, about: 'из истории оплат: пробная, активна, заканчивается, истекла'},
  {k: 'trialUntil',n: 'Пробный доступ до',   g: 'Подписка и деньги', type: 'date', about: '3 дня после регистрации, админ может продлить до 7'},
  {k: 'subUntil',  n: 'Оплачено до',         g: 'Подписка и деньги', type: 'date', calc: true},
  {k: 'ltv',       n: 'Принесла, LTV',       g: 'Подписка и деньги', type: 'money', calc: true, col: true, about: 'все оплаты минус возвраты'},
  {k: 'pays',      n: 'Оплат',               g: 'Подписка и деньги', type: 'number', calc: true},
  {k: 'balance',   n: 'Баланс Евы, ₽',       g: 'Подписка и деньги', type: 'money', about: 'пополнения и реферальные деньги, оставленные внутри'},
  {k: 'bonus',     n: 'Бонусы, ₽',           g: 'Подписка и деньги', type: 'money', about: 'приветственные 300 ₽, кешбэк 5%; закрывают до 30% заказа, живут 90 дней'},
  {k: 'points',    n: 'Баллы',               g: 'Активность в приложении', type: 'number', about: 'опыт за практики, не тратятся; раз в неделю 100 баллов = 50 ₽ бонусов'},
  {k: 'consentPD', n: 'Согласие на обработку данных', g: 'Согласия', type: 'date', about: 'отдельный документ с 01.09.2025; хранится дата, версия текста, устройство'},
  {k: 'consentHealth', n: 'Согласие на данные о здоровье', g: 'Согласия', type: 'date', about: 'цикл, беременность, сон, тревожность — отдельная галочка'},
  {k: 'consentAds',n: 'Согласие на рассылки', g: 'Согласия', type: 'date', about: 'без него рекламные рассылки не уходят (38-ФЗ «О рекламе»)'},
  {k: 'allowCh',   n: 'Разрешённые каналы',  g: 'Согласия', type: 'multi', list: () => MASS_CH, label: v => (CHANNELS[v] || {}).name || v},
  {k: 'lastSeen',  n: 'Была в приложении',   g: 'Активность в приложении', type: 'date'},
  {k: 'stars',     n: 'Звёзд за неделю',     g: 'Активность в приложении', type: 'number'},
  {k: 'practices', n: 'Практик пройдено',    g: 'Активность в приложении', type: 'number'},
  {k: 'level',     n: 'Уровень',             g: 'Активность в приложении', type: 'level', calc: true},
  {k: 'refCode',   n: 'Промокод-приглашение',g: 'Реферальная программа', type: 'text'},
  {k: 'invited',   n: 'Пригласила подруг',   g: 'Реферальная программа', type: 'number', calc: true},
  {k: 'refEarned', n: 'Заработала на рефералах', g: 'Реферальная программа', type: 'money', calc: true},
  {k: 'refProgram',n: 'Программа',           g: 'Реферальная программа', type: 'select', list: () => Object.keys(REF_PROGRAMS), label: v => (REF_PROGRAMS[v] || {}).name || v},
  {k: 'refMode',   n: 'Как получать',        g: 'Реферальная программа', type: 'select', list: () => ['card', 'balance'], label: v => ({card: 'Вывод на карту', balance: 'На баланс Евы'})[v] || v},
  {k: 'taxStatus', n: 'Налоговый статус',    g: 'Реферальная программа', type: 'select', list: () => ['npd', 'ip', 'none'], label: v => ({npd: 'Самозанятая', ip: 'ИП', none: 'Физлицо'})[v] || v, about: 'амбассадорам платим только самозанятым и ИП'},
  {k: 'id',        n: 'ID записи',           g: 'Служебные', type: 'text', calc: true},
  {k: 'appId',     n: 'ID в приложении',     g: 'Служебные', type: 'text', about: 'связь с аккаунтом Eva Space'},
  {k: 'demo',      n: 'Демо-запись',         g: 'Служебные', type: 'bool'},
];
const FIELD = byKey(CLIENT_FIELDS, 'k');

/* реферальные программы: у приглашённой ровно один пригласивший и одна
   ступень — начислений «с приглашённых приглашённых» нет (ст. 14.62 КоАП) */
const REF_PROGRAMS = {
  friend: {name: 'Приведи подругу', about: 'доля по уровню с покупок подруги в течение года, без учёта бонусов'},
  amb:    {name: 'Амбассадор',      about: 'по приглашению: 30% от чистого поступления по подпискам'},
  key:    {name: 'Ключевой амбассадор', about: '50% от чистого поступления по подпискам на первый год'},
};

/* операторы условий сегментов и фильтров */
const OPS = {
  eq:    {name: 'равно'},
  ne:    {name: 'не равно'},
  in:    {name: 'одно из'},
  has:   {name: 'содержит'},
  nhas:  {name: 'не содержит'},
  gte:   {name: 'не меньше'},
  lte:   {name: 'не больше'},
  set:   {name: 'заполнено', noValue: true},
  unset: {name: 'пусто', noValue: true},
  within:{name: 'за последние, дней'},
  older: {name: 'давнее, дней'},
};
const opsFor = type => ({
  number: ['gte', 'lte', 'eq', 'set', 'unset'], money: ['gte', 'lte', 'set', 'unset'],
  date: ['within', 'older', 'set', 'unset'],
  tags: ['has', 'nhas'], multi: ['has', 'nhas', 'set', 'unset'], quiz: ['has', 'nhas', 'eq', 'in', 'set', 'unset'],
})[type] || ['eq', 'ne', 'in', 'has', 'set', 'unset'];
