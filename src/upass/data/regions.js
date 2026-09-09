/* Регионы присутствия. Регион — это место, куда резидент летит жить и работать:
   сколько там своих, какие сообщества, сколько стоит месяц жизни и перелёт.
   Цены — ориентир в долларах на 2026 год для одного человека и длинной аренды,
   а не оферта. Проверялись по объявлениям и отчётам резидентов. */

export const TIERS_REGION = {
  core: { name: 'Основной', tone: '#D9B26B', hint: 'Постоянная база сообщества' },
  active: { name: 'Активный', tone: '#58D68D', hint: 'Регулярные встречи и эфиры' },
  new: { name: 'Растёт', tone: '#5B8CFF', hint: 'Сообщество собирается' },
};

/* rent: apt и villa — за месяц, hotel — за ночь. Пара [от, средне].
   budget: [экономно, комфортно] — месяц жизни одному со всем.
   price: множитель к цене билета относительно расстояния.
   en и iso — латиница и код страны для паспорта.
   loc — предложный падеж с предлогом, для автотекста запросов.
   check — средний ужин на одного, temp — средняя дневная в прохладный и тёплый сезон,
   visaFree — сколько дней пускают без визы (0 — оформляется заранее, -1 — домашний регион). */
export const REGIONS = {
  dubai: {
    en: 'Dubai', iso: 'ARE', name: 'Дубай', country: 'ОАЭ', flag: '🇦🇪', lat: 25.2, lon: 55.27, tz: 'GMT+4', currency: 'AED',
    tier: 'core', residents: 148, companies: 64, communities: 9, price: 1.15, internet: 250,
    visa: 'Виза по прилёте, 90 дней. Резидентская — за 12 рабочих дней',
    loc: 'в Дубае', check: 45, temp: [24, 41], visaFree: 90,
    rent: { apt: [1900, 3200], villa: [6000, 11000], hotel: [110, 240] }, budget: [3400, 6000],
    about: 'Деловая столица сообщества: банки, лицензии, встречи. Сюда прилетают закрывать сделки и оформлять резидентство.',
    best: 'Октябрь — апрель, летом +45°',
  },
  bali: {
    en: 'Bali', iso: 'IDN', name: 'Бали', country: 'Индонезия', flag: '🇮🇩', lat: -8.65, lon: 115.13, tz: 'GMT+8', currency: 'IDR',
    tier: 'core', residents: 132, companies: 51, communities: 8, price: 1.0, internet: 60,
    visa: 'B211 на 60 дней с продлением до 180',
    loc: 'на Бали', check: 15, temp: [27, 29], visaFree: 30,
    rent: { apt: [700, 1300], villa: [1800, 3800], hotel: [45, 110] }, budget: [1600, 2900],
    about: 'Самая большая зимовка круга. Вода утром, работа днём, общий стол вечером — и половина сообщества рядом.',
    best: 'Апрель — октябрь, сухой сезон',
  },
  moscow: {
    en: 'Moscow', iso: 'RUS', name: 'Москва', country: 'Россия', flag: '🇷🇺', lat: 55.75, lon: 37.62, tz: 'GMT+3', currency: 'RUB',
    tier: 'core', residents: 214, companies: 96, communities: 11, price: 0.9, internet: 200,
    visa: 'Внутренний регион для большинства резидентов',
    loc: 'в Москве', check: 28, temp: [-7, 23], visaFree: -1,
    rent: { apt: [900, 1700], villa: [3000, 5500], hotel: [60, 130] }, budget: [1800, 3200],
    about: 'Домашняя база: отсюда начиналось сообщество, здесь больше всего резидентов и компаний.',
    best: 'Круглый год, пик встреч — сентябрь и май',
  },
  phuket: {
    en: 'Phuket', iso: 'THA', name: 'Пхукет', country: 'Таиланд', flag: '🇹🇭', lat: 7.89, lon: 98.3, tz: 'GMT+7', currency: 'THB',
    tier: 'core', residents: 86, companies: 29, communities: 6, price: 1.05, internet: 120,
    visa: '60 дней без визы, продление на месте',
    loc: 'на Пхукете', check: 16, temp: [28, 30], visaFree: 60,
    rent: { apt: [600, 1100], villa: [1900, 3600], hotel: [45, 100] }, budget: [1500, 2600],
    about: 'Семейный регион: школы, врачи, спокойный ритм. Сюда переезжают с детьми на сезон.',
    best: 'Ноябрь — апрель',
  },
  istanbul: {
    en: 'Istanbul', iso: 'TUR', name: 'Стамбул', country: 'Турция', flag: '🇹🇷', lat: 41.01, lon: 28.98, tz: 'GMT+3', currency: 'TRY',
    tier: 'active', residents: 74, companies: 26, communities: 5, price: 0.95, internet: 90,
    visa: '90 дней без визы',
    loc: 'в Стамбуле', check: 20, temp: [8, 27], visaFree: 90,
    rent: { apt: [750, 1400], villa: [2400, 4500], hotel: [55, 120] }, budget: [1600, 2800],
    about: 'Пересадочный узел между Европой и Заливом. Удобно для коротких встреч и переговоров.',
    best: 'Апрель — июнь, сентябрь — ноябрь',
  },
  tbilisi: {
    en: 'Tbilisi', iso: 'GEO', name: 'Тбилиси', country: 'Грузия', flag: '🇬🇪', lat: 41.72, lon: 44.78, tz: 'GMT+4', currency: 'GEL',
    tier: 'active', residents: 58, companies: 21, communities: 4, price: 0.9, internet: 80,
    visa: '365 дней без визы',
    loc: 'в Тбилиси', check: 16, temp: [4, 27], visaFree: 365,
    rent: { apt: [550, 1000], villa: [1500, 2900], hotel: [40, 85] }, budget: [1200, 2100],
    about: 'Самый лёгкий вход для тех, кто впервые живёт между странами: год без визы и дешёвый старт.',
    best: 'Май — июнь, сентябрь — октябрь',
  },
  yerevan: {
    en: 'Yerevan', iso: 'ARM', name: 'Ереван', country: 'Армения', flag: '🇦🇲', lat: 40.18, lon: 44.51, tz: 'GMT+4', currency: 'AMD',
    tier: 'active', residents: 41, companies: 14, communities: 3, price: 0.9, internet: 70,
    visa: '180 дней без визы',
    loc: 'в Ереване', check: 15, temp: [1, 28], visaFree: 180,
    rent: { apt: [500, 950], villa: [1400, 2600], hotel: [38, 80] }, budget: [1150, 2000],
    about: 'Тихий регион с сильным ИТ-кругом и простыми расчётами для распределённых команд.',
    best: 'Май — октябрь',
  },
  almaty: {
    en: 'Almaty', iso: 'KAZ', name: 'Алматы', country: 'Казахстан', flag: '🇰🇿', lat: 43.24, lon: 76.89, tz: 'GMT+5', currency: 'KZT',
    tier: 'active', residents: 47, companies: 17, communities: 3, price: 0.9, internet: 90,
    visa: '90 дней без визы',
    loc: 'в Алматы', check: 15, temp: [-4, 27], visaFree: 90,
    rent: { apt: [450, 900], villa: [1300, 2400], hotel: [40, 85] }, budget: [1100, 1950],
    about: 'Горы в двадцати минутах от города и логистический узел между Китаем, СНГ и Заливом.',
    best: 'Апрель — октябрь, зимой — лыжи',
  },
  belgrade: {
    en: 'Belgrade', iso: 'SRB', name: 'Белград', country: 'Сербия', flag: '🇷🇸', lat: 44.79, lon: 20.45, tz: 'GMT+2', currency: 'RSD',
    tier: 'active', residents: 63, companies: 22, communities: 4, price: 0.95, internet: 100,
    visa: '30 дней без визы, продление выездом',
    loc: 'в Белграде', check: 18, temp: [3, 26], visaFree: 30,
    rent: { apt: [650, 1200], villa: [1900, 3400], hotel: [50, 105] }, budget: [1400, 2400],
    about: 'Европейская база сообщества: короткие перелёты, спокойный ритм, живой круг онбординга.',
    best: 'Май — сентябрь',
  },
  lisbon: {
    en: 'Lisbon', iso: 'PRT', name: 'Лиссабон', country: 'Португалия', flag: '🇵🇹', lat: 38.72, lon: -9.14, tz: 'GMT+1', currency: 'EUR',
    tier: 'active', residents: 52, companies: 19, communities: 4, price: 1.1, internet: 180,
    visa: 'Шенген или D7 для долгого пребывания',
    loc: 'в Лиссабоне', check: 25, temp: [12, 25], visaFree: 0,
    rent: { apt: [1200, 2000], villa: [3200, 6000], hotel: [90, 180] }, budget: [2200, 3700],
    about: 'Точка входа в Европу для инженерных и продуктовых команд. Океан в получасе.',
    best: 'Март — июнь, сентябрь — октябрь',
  },
  barcelona: {
    en: 'Barcelona', iso: 'ESP', name: 'Барселона', country: 'Испания', flag: '🇪🇸', lat: 41.39, lon: 2.17, tz: 'GMT+2', currency: 'EUR',
    tier: 'new', residents: 39, companies: 13, communities: 3, price: 1.1, internet: 200,
    visa: 'Шенген, для долгого — виза цифрового кочевника',
    loc: 'в Барселоне', check: 28, temp: [11, 27], visaFree: 0,
    rent: { apt: [1300, 2200], villa: [3500, 6500], hotel: [100, 200] }, budget: [2400, 4000],
    about: 'Дизайнерский и медийный круг сообщества. Много совместных проектов внутри.',
    best: 'Апрель — июнь, сентябрь',
  },
  london: {
    en: 'London', iso: 'GBR', name: 'Лондон', country: 'Британия', flag: '🇬🇧', lat: 51.51, lon: -0.13, tz: 'GMT+1', currency: 'GBP',
    tier: 'new', residents: 44, companies: 18, communities: 3, price: 1.2, internet: 150,
    visa: 'Виза оформляется заранее',
    loc: 'в Лондоне', check: 42, temp: [6, 22], visaFree: 0,
    rent: { apt: [2200, 3600], villa: [6500, 12000], hotel: [150, 300] }, budget: [3800, 6500],
    about: 'Юридический и инвестиционный круг. Дорого для жизни, полезно для встреч.',
    best: 'Май — сентябрь',
  },
  newyork: {
    en: 'New York', iso: 'USA', name: 'Нью-Йорк', country: 'США', flag: '🇺🇸', lat: 40.71, lon: -74.01, tz: 'GMT-4', currency: 'USD',
    tier: 'new', residents: 37, companies: 16, communities: 3, price: 1.25, internet: 200,
    visa: 'B1/B2, оформляется заранее',
    loc: 'в Нью-Йорке', check: 48, temp: [1, 26], visaFree: 0,
    rent: { apt: [3000, 4600], villa: [8000, 15000], hotel: [180, 380] }, budget: [4800, 8000],
    about: 'Круг фаундеров и медиа. Сюда летят на конференции и за первыми клиентами в США.',
    best: 'Май — июнь, сентябрь — октябрь',
  },
  miami: {
    en: 'Miami', iso: 'USA', name: 'Майами', country: 'США', flag: '🇺🇸', lat: 25.76, lon: -80.19, tz: 'GMT-4', currency: 'USD',
    tier: 'new', residents: 28, companies: 11, communities: 2, price: 1.25, internet: 250,
    visa: 'B1/B2, оформляется заранее',
    loc: 'в Майами', check: 42, temp: [21, 31], visaFree: 0,
    rent: { apt: [2200, 3600], villa: [6000, 11000], hotel: [150, 320] }, budget: [3800, 6300],
    about: 'Зимняя база американского круга: океан, спорт и много встреч на воздухе.',
    best: 'Ноябрь — апрель',
  },
  mexico: {
    en: 'Mexico City', iso: 'MEX', name: 'Мехико', country: 'Мексика', flag: '🇲🇽', lat: 19.43, lon: -99.13, tz: 'GMT-6', currency: 'MXN',
    tier: 'new', residents: 19, companies: 7, communities: 2, price: 1.15, internet: 90,
    visa: '180 дней без визы',
    loc: 'в Мехико', check: 20, temp: [15, 22], visaFree: 180,
    rent: { apt: [800, 1500], villa: [2200, 4200], hotel: [60, 130] }, budget: [1700, 3000],
    about: 'Дешёвая жизнь, сильная культура и удобный часовой пояс для работы с США.',
    best: 'Ноябрь — апрель',
  },
  saopaulo: {
    en: 'Sao Paulo', iso: 'BRA', name: 'Сан-Паулу', country: 'Бразилия', flag: '🇧🇷', lat: -23.55, lon: -46.63, tz: 'GMT-3', currency: 'BRL',
    tier: 'new', residents: 14, companies: 5, communities: 1, price: 1.2, internet: 120,
    visa: '90 дней без визы',
    loc: 'в Сан-Паулу', check: 22, temp: [21, 26], visaFree: 90,
    rent: { apt: [700, 1300], villa: [2000, 3800], hotel: [55, 120] }, budget: [1600, 2800],
    about: 'Самый молодой регион сообщества. Нужен куратор на месте — вакансия открыта.',
    best: 'Март — май, сентябрь — ноябрь',
  },
  capetown: {
    en: 'Cape Town', iso: 'ZAF', name: 'Кейптаун', country: 'ЮАР', flag: '🇿🇦', lat: -33.92, lon: 18.42, tz: 'GMT+2', currency: 'ZAR',
    tier: 'new', residents: 16, companies: 6, communities: 2, price: 1.15, internet: 60,
    visa: '90 дней без визы',
    loc: 'в Кейптауне', check: 20, temp: [16, 26], visaFree: 90,
    rent: { apt: [700, 1300], villa: [2200, 4200], hotel: [55, 120] }, budget: [1600, 2800],
    about: 'Океан, горы и один из самых красивых регионов для долгой зимовки.',
    best: 'Ноябрь — март',
  },
  bangkok: {
    en: 'Bangkok', iso: 'THA', name: 'Бангкок', country: 'Таиланд', flag: '🇹🇭', lat: 13.76, lon: 100.5, tz: 'GMT+7', currency: 'THB',
    tier: 'active', residents: 61, companies: 20, communities: 4, price: 1.0, internet: 200,
    visa: '60 дней без визы',
    loc: 'в Бангкоке', check: 14, temp: [27, 33], visaFree: 60,
    rent: { apt: [650, 1200], villa: [2000, 3800], hotel: [45, 100] }, budget: [1500, 2700],
    about: 'Пересадочный узел Азии: между Пхукетом, Бали и Заливом все летят через Бангкок.',
    best: 'Ноябрь — февраль',
  },
  singapore: {
    en: 'Singapore', iso: 'SGP', name: 'Сингапур', country: 'Сингапур', flag: '🇸🇬', lat: 1.35, lon: 103.82, tz: 'GMT+8', currency: 'SGD',
    tier: 'new', residents: 33, companies: 15, communities: 3, price: 1.15, internet: 300,
    visa: '30 дней без визы',
    loc: 'в Сингапуре', check: 35, temp: [30, 31], visaFree: 30,
    rent: { apt: [2600, 4200], villa: [7500, 14000], hotel: [140, 300] }, budget: [4300, 7000],
    about: 'Деловая точка Азии: банки, фонды, производство. Дорого, но за неделю решается многое.',
    best: 'Круглый год',
  },
  tokyo: {
    en: 'Tokyo', iso: 'JPN', name: 'Токио', country: 'Япония', flag: '🇯🇵', lat: 35.68, lon: 139.65, tz: 'GMT+9', currency: 'JPY',
    tier: 'new', residents: 21, companies: 8, communities: 2, price: 1.2, internet: 250,
    visa: 'Виза оформляется заранее',
    loc: 'в Токио', check: 30, temp: [6, 29], visaFree: 0,
    rent: { apt: [1400, 2400], villa: [4500, 8000], hotel: [95, 200] }, budget: [2700, 4500],
    about: 'Технологический круг и дизайн. Сложный вход, но самый благодарный регион для долгих проектов.',
    best: 'Март — май, октябрь — ноябрь',
  },
};

export const REGION_KEYS = Object.keys(REGIONS);
export const MAIN_REGIONS = ['dubai', 'bali', 'moscow', 'phuket'];

/* Смещение часового пояса из строки вида GMT+4 — чтобы часы на главной
   считались, а не хранились отдельным полем. */
export const tzOffset = (key) => {
  const m = /GMT([+-]\d+(?:\.\d+)?)/.exec(REGIONS[key]?.tz || '');
  return m ? Number(m[1]) : 0;
};

/** Местное время в регионе на переданный момент. */
export function timeIn(key, now = new Date()) {
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + tzOffset(key) * 3600000);
}

/** Коротко про визу — для справки в одну строку. */
export function visaShort(key) {
  const d = REGIONS[key]?.visaFree;
  if (d === -1) return 'Домашний регион';
  if (!d) return 'Виза заранее';
  if (d >= 180) return `Без визы · ${d} дней`;
  return `Без визы · ${d} дней`;
}

export const region = (key) => REGIONS[key];
export const regionName = (key) => REGIONS[key]?.name ?? key;
export const regionFlag = (key) => REGIONS[key]?.flag ?? '';

/* Всего по сообществу — считается, а не пишется руками */
export const TOTALS = REGION_KEYS.reduce(
  (a, k) => ({
    residents: a.residents + REGIONS[k].residents,
    companies: a.companies + REGIONS[k].companies,
    communities: a.communities + REGIONS[k].communities,
  }),
  { residents: 0, companies: 0, communities: 0 }
);
