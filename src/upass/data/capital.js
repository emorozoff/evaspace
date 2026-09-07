/* Активы кооператива, расчёт NAV, токен UHT и общее управление.
   Все суммы — в долларах. Цифры демонстрационные, но связаны между собой:
   цена токена нигде не задана вручную, она считается из активов. */

export const ASSET_KINDS = {
  realty: 'Недвижимость',
  transport: 'Транспорт',
  equity: 'Доли в проектах',
};

export const ASSETS = [
  {
    id: 'a1', name: 'UHOME Dubai', kind: 'realty', loc: 'u-dubai', city: 'dubai',
    bought: '2024-03', cost: 6400000, value: 7350000, valuedAt: '2026-06', valuer: 'Knight Frank MENA',
    rentYear: 1180000, opexYear: 690000, note: 'Двадцать четыре номера и лаунж. Загрузка 82%.',
  },
  {
    id: 'a2', name: 'UHOME Canggu', kind: 'realty', loc: 'u-bali', city: 'bali',
    bought: '2024-08', cost: 3100000, value: 3850000, valuedAt: '2026-06', valuer: 'Colliers Indonesia',
    rentYear: 720000, opexYear: 395000, note: 'Двенадцать вилл. Самая высокая загрузка сети — 91%.',
  },
  {
    id: 'a3', name: 'UHOME Bang Tao', kind: 'realty', loc: 'u-phuket', city: 'phuket',
    bought: '2025-02', cost: 2600000, value: 2780000, valuedAt: '2026-06', valuer: 'CBRE Thailand',
    rentYear: 540000, opexYear: 330000, note: 'Девять вилл, семейный формат. Второй сезон работы.',
  },
  {
    id: 'a4', name: 'UHOME Bosphorus', kind: 'realty', loc: 'u-istanbul', city: 'istanbul',
    bought: '2025-05', cost: 2200000, value: 2340000, valuedAt: '2026-06', valuer: 'Cushman & Wakefield',
    rentYear: 430000, opexYear: 268000, note: 'Четырнадцать номеров в историческом здании.',
  },
  {
    id: 'a5', name: 'UHOME Lisboa', kind: 'realty', loc: 'u-lisbon', city: 'lisbon',
    bought: '2026-01', cost: 3400000, value: 3400000, valuedAt: '2026-06', valuer: 'JLL Portugal',
    rentYear: 0, opexYear: 84000, note: 'В ремонте. Открытие весной, до этого дохода не даёт.',
  },
  {
    id: 'a6', name: 'UHOME Bangkok', kind: 'realty', loc: 'u-bangkok', city: 'bangkok',
    bought: '2025-11', cost: 2900000, value: 2950000, valuedAt: '2026-06', valuer: 'CBRE Thailand',
    rentYear: 120000, opexYear: 160000, note: 'Открытие в этом году, работает часть номеров.',
  },
  {
    id: 'a7', name: 'Автопарк и байки', kind: 'transport', loc: null, city: 'bali',
    bought: '2024-09', cost: 1150000, value: 860000, valuedAt: '2026-06', valuer: 'График амортизации, 18% в год',
    rentYear: 410000, opexYear: 235000, note: '34 автомобиля и 120 байков на Бали и Пхукете.',
  },
  {
    id: 'a8', name: 'Доли в проектах резидентов', kind: 'equity', loc: null, city: null,
    bought: '2025-04', cost: 540000, value: 620000, valuedAt: '2026-06', valuer: 'Балансовая стоимость',
    rentYear: 96000, opexYear: 0, note: 'Nomad Motors — 15%, Concierge 24 — 20%, Bali Bike Club — 12%.',
  },
];

export const TREASURY = {
  cash: 1480000,          // денежные средства и эквиваленты
  liabilities: 940000,    // обязательства: подрядчики, депозиты, авансы
  supply: 2340000,        // токенов UHT в обращении
  buybackFund: 386000,    // фонд обратного выкупа
  buybackShare: 0.15,     // доля арендного потока, уходящая в резерв
  lockupMonths: 24,       // локап на выход
  quarterCapShare: 0.03,  // не более 3% обращения к выкупу за квартал
  quarterRedeemed: 0.011, // уже выкуплено в этом квартале
  queueTokens: 48000,     // заявок на выкуп в очереди
  holders: 618,
  nextValuation: '2026-12',
  valuationPeriod: 'раз в год, независимым оценщиком',
};

/* История расчёта NAV: 14 месяцев. supply и nav реальные, цена считается делением. */
export const NAV_HISTORY = [
  { m: '2025-08', nav: 17420000, supply: 1905000 },
  { m: '2025-09', nav: 17960000, supply: 1948000 },
  { m: '2025-10', nav: 18510000, supply: 1992000 },
  { m: '2025-11', nav: 19740000, supply: 2088000 },
  { m: '2025-12', nav: 20180000, supply: 2118000 },
  { m: '2026-01', nav: 21360000, supply: 2196000 },
  { m: '2026-02', nav: 21790000, supply: 2214000 },
  { m: '2026-03', nav: 22140000, supply: 2229000 },
  { m: '2026-04', nav: 22880000, supply: 2262000 },
  { m: '2026-05', nav: 23310000, supply: 2281000 },
  { m: '2026-06', nav: 23960000, supply: 2303000 },
  { m: '2026-07', nav: 24280000, supply: 2316000 },
  { m: '2026-08', nav: 24520000, supply: 2329000 },
  { m: '2026-09', nav: 24700000, supply: 2340000 },
];

export const DISTRIBUTIONS = [
  { q: 'IV кв. 2025', base: 268000, perToken: 0.108, paid: true },
  { q: 'I кв. 2026', base: 291000, perToken: 0.115, paid: true },
  { q: 'II кв. 2026', base: 314000, perToken: 0.121, paid: true },
  { q: 'III кв. 2026', base: 336000, perToken: 0.128, paid: false },
];

export const PROPOSALS = [
  {
    id: 'p1', kind: 'choice', title: 'Следующая локация UHOME',
    about: 'Три города набрали условие открытия: десять активных услуг и три запланированных мероприятия. Бюджет позволяет открыть один в этом году. Лаунж в Лондоне — самая дорогая аренда, но там сосредоточен юридический и капитальный круг.',
    options: [
      { id: 'london', name: 'Лондон, Mayfair', votes: 412000 },
      { id: 'newyork', name: 'Нью-Йорк, NoHo', votes: 361000 },
      { id: 'capetown', name: 'Кейптаун, Camps Bay', votes: 289000 },
    ],
    quorum: 0.4, endsInDays: 6, author: 'r22', tags: ['Активы', 'Расширение'],
  },
  {
    id: 'p2', kind: 'yesno', title: 'Покупка дома в Кейптауне за $2.4M',
    about: 'Восемь спален с видом на океан. Финмодель: окупаемость эксплуатации с девятого месяца при загрузке 58%. Покупка без заёмных средств, из свободных денег кооператива. Оценка независимым оценщиком приложена.',
    yes: 726000, no: 214000, quorum: 0.5, endsInDays: 12, author: 'r15', tags: ['Активы', 'Покупка'],
  },
  {
    id: 'p3', kind: 'yesno', title: 'Ограничить право вето учредителя',
    about: 'Сейчас учредитель может заблокировать любое решение собрания. Предложение: оставить вето только на решения о продаже активов и изменении устава, снять его со всех остальных. Это тот самый вопрос, от ответа на который зависит, кооператив мы или клуб с единоличным управлением.',
    yes: 588000, no: 402000, quorum: 0.6, endsInDays: 19, author: 'r6', tags: ['Управление', 'Устав'],
  },
  {
    id: 'p4', kind: 'yesno', title: 'Раздел устава о наследовании доли',
    about: 'Доля и доступ переходят наследнику, назначенному в профиле. Степень не наследуется: её зарабатывают. Текст согласован юридическим кругом, замечания учтены.',
    yes: 843000, no: 96000, quorum: 0.5, endsInDays: 3, author: 'r14', tags: ['Устав', 'Наследование'],
  },
  {
    id: 'p5', kind: 'yesno', title: 'Поднять отчисление в фонд выкупа до 20%',
    about: 'Сейчас в резерв ликвидности уходит 15% арендного потока. Предложение поднять до 20%: это замедлит покупку новых объектов, но сократит очередь на выход с восьми месяцев до пяти.',
    yes: 331000, no: 505000, quorum: 0.5, endsInDays: -4, author: 'r2', tags: ['Ликвидность'], closed: true,
  },
];

/* Расходы резидента за 90 дней — для показателя «доля трат внутри кооператива» */
export const SPEND = [
  { cat: 'Жильё', inside: 3400, outside: 900 },
  { cat: 'Транспорт', inside: 640, outside: 210 },
  { cat: 'Рестораны', inside: 480, outside: 720 },
  { cat: 'Услуги и документы', inside: 900, outside: 150 },
  { cat: 'Здоровье', inside: 260, outside: 340 },
  { cat: 'Мероприятия', inside: 420, outside: 0 },
  { cat: 'Прочее', inside: 180, outside: 560 },
];

export const assetById = (id) => ASSETS.find((a) => a.id === id);
