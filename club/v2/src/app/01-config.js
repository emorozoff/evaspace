/* Константы штаба: роли и права, направления, сценарии квартала, статьи. */

const Q = {
  name: 'IV квартал 2026',
  start: '2026-10-01',
  end: '2026-12-31',
  months: ['2026-10', '2026-11', '2026-12'],
};
/* отчёты и Cash Flow — до Нового года; сентябрь — подготовительный месяц */
const CF_MONTHS = ['2026-09', '2026-10', '2026-11', '2026-12'];

/* ── роли ── */
const ROLES = {
  owner:    {name: 'Основатель',   tone: 'gold',   about: 'видит и меняет всё: стратегию, деньги, доступы'},
  lead:     {name: 'Руководитель', tone: 'violet', about: 'ведёт задачи команды, принимает работу, вносит деньги'},
  member:   {name: 'Команда',      tone: 'rose',   about: 'свои задачи, цифры продаж, стратегия и материалы'},
  investor: {name: 'Инвестор',     tone: 'good',   about: 'только смотрит: главная, стратегия, отчёты, материалы'},
};
const roleOf = r => (ROLES[r] ? r : 'member'); // старые роли (эксперт и т. п.) считаем командой

const PERMS = {
  'tasks.view':     ['owner', 'lead', 'member'],
  'tasks.edit':     ['owner', 'lead', 'member'],
  'tasks.manage':   ['owner', 'lead'],            // принимать, возвращать, править любые
  'money.view':     ['owner', 'lead', 'investor'],
  'money.edit':     ['owner', 'lead'],
  'payroll.view':   ['owner'],                    // зарплаты по людям
  'sales.edit':     ['owner', 'lead', 'member'],
  'cf.view':        ['owner', 'lead', 'investor'],
  'strategy.edit':  ['owner'],
  'strategy.check': ['owner', 'lead'],            // отмечать пункты целей
  'settings.edit':  ['owner'],
  'team.manage':    ['owner'],
  'materials.team': ['owner', 'lead', 'member'],
};

/* ── разделы ── */
const NAV = [
  {id: 'home',     name: 'Главная',   icon: 'home'},
  {id: 'strategy', name: 'Стратегия', icon: 'target'},
  {id: 'tasks',    name: 'Задачи',    icon: 'check', perm: 'tasks.view'},
  {id: 'calendar', name: 'Календарь', icon: 'cal', perm: 'tasks.view'},
  {id: 'money',    name: 'Деньги',    icon: 'wallet', perm: 'money.view'},
  {id: 'reports',  name: 'Отчёты',    icon: 'chart'},
  {id: 'metrics',  name: 'Метрики',   icon: 'funnel'},
  {id: 'team',     name: 'Команда',   icon: 'users', perm: 'tasks.view'},
];

/* ── три кита и управление ── */
const DIRS = {
  product:  {name: 'Продукт',    color: '#5A50C0', metric: 'регистрация → оплата',          about: 'платформа, подбор программы, оплаты, обновления'},
  content:  {name: 'Контент',    color: '#AD4C74', metric: 'снято и опубликовано',          about: 'мастер-классы, съёмки, редакция, блог о запуске'},
  audience: {name: 'Аудитория',  color: '#2C7753', metric: 'охват → регистрации → продажи', about: 'эксперты, партнёры, амбассадоры, сообщество'},
  ops:      {name: 'Управление', color: '#8F6B27', metric: 'компания, деньги, документы',   about: 'юрлицо, финансы, штаб, инвесторы'},
};
const dirName = d => (DIRS[d] ? DIRS[d].name : 'Без направления');

/* ── задачи ── */
const STATUSES = {
  todo:   {name: 'К работе',    tone: ''},
  doing:  {name: 'В работе',    tone: 'violet'},
  review: {name: 'На проверке', tone: 'gold'},
  done:   {name: 'Готово',      tone: 'good'},
};

/* ── сценарии квартала (план «Квартал команды Eva»): продажа = первая оплата ── */
const SCENARIOS = {
  min:  {name: 'Минимум', total: 100,  sales: {'2026-10': 15,  '2026-11': 30,  '2026-12': 55},
         about: 'если оплата подключится позже и трафик только органический'},
  goal: {name: 'Цель',    total: 500,  sales: {'2026-10': 75,  '2026-11': 150, '2026-12': 275},
         about: 'оплата с октября, амбассадоры и блогеры с ноября'},
  max:  {name: 'Прорыв',  total: 1000, sales: {'2026-10': 150, '2026-11': 300, '2026-12': 550},
         about: 'конверсия выше 5% и хотя бы один вирусный запуск'},
};

/* ── статьи денег ── */
const OUT_CATS = {
  payroll:   'Оплата труда',
  office:    'Штаб и офис',
  content:   'Контент и съёмки',
  infra:     'Сервисы и платформа',
  marketing: 'Маркетинг и трафик',
  referral:  'Реферальные выплаты',
  legal:     'Юристы и документы',
  acquiring: 'Эквайринг',
  tax:       'Налоги',
  other:     'Прочие расходы',
};
const IN_CATS = {
  courses:  'Курсы и маркет',
  partners: 'Партнёрства',
  other:    'Прочие приходы',
};
const INVEST_CATS = {
  founder:  'Вложение основателя',
  investor: 'Инвестиции',
  loan:     'Займ',
};
const KINDS = {
  out:    {name: 'Расход',   cats: OUT_CATS,    tone: 'bad'},
  in:     {name: 'Приход',   cats: IN_CATS,     tone: 'good'},
  invest: {name: 'Вложение', cats: INVEST_CATS, tone: 'violet'},
};
const PLAN_GROUPS = {
  payroll: 'Оплата труда',
  regular: 'Регулярные платежи',
  once:    'Разовые платежи',
};

/* ── настройки по умолчанию (основатель меняет в «Отчётах» и «Деньгах») ── */
const DEFAULT_SETTINGS = {
  scenario: 'goal',
  price: 2900,          // месячная подписка, ₽
  convPay: 0.05,        // регистрация → оплата
  convReg: 0.02,        // охват → регистрация (= просмотр × переход × регистрация)
  retention: 0.5,       // продлевают в следующем месяце
  funnel: {view: 0.4, click: 0.1},  // охват → просмотр, просмотр → переход; шаг «переход → регистрация» выводится из convReg
  reachPlan: null,      // план охвата по месяцам из «Метрик» {'2026-10': 750000}
  referral: 0.3,        // амбассадорам и «приведи подругу»
  acquiring: 0.029,     // комиссия эквайринга
  taxRate: 0.01,        // минимальный налог УСН 15% при убытке
  insurance: 0.076,     // взносы IT-компании
  premium: 0.3,         // премия команды от чистого дохода квартала
  premiumMin: 60,       // меньше 60 продаж — премии нет
  expertsGoal: 50,      // цель квартала: 50+ экспертов
  mkGoal: 150,          // и 150+ мастер-классов
  cashStart: 0,         // деньги на счёте на дату cashDate
  cashDate: '2026-09-01',
  invest: {},           // план вложений по месяцам {'2026-11': 1500000}
  plans: null,          // свои цифры сценариев, если основатель поменяет
};