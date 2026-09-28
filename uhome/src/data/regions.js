/* Регионы клуба. Регион — главная привязка резидента: где он сейчас живёт.
   От него зависят карта резидента, афиша по умолчанию, порядок услуг,
   своё локальное сообщество и то, кого показывают «рядом».
   Меняется одним нажатием — на главной, в профиле или на карте.
   cc — код страны для векторного флага (components/Flag.jsx): эмодзи-флаги
   на Windows превращаются в буквы, поэтому их нигде не печатаем. */

export const REGIONS = {
  moscow: {
    name: 'Москва', en: 'MOSCOW', country: 'Россия', cc: 'ru', tz: 'Europe/Moscow',
    lat: 55.75, lon: 37.62, loc: 'в Москве', plate: '#2a2536',
    about: 'Домашняя база клуба: здесь больше всего резидентов, бизнес-завтраки и закрытые ужины.',
  },
  bali: {
    name: 'Бали', en: 'BALI', country: 'Индонезия', cc: 'id', tz: 'Asia/Makassar',
    lat: -8.65, lon: 115.13, loc: 'на Бали', plate: '#1d302a',
    about: 'Самая большая зимовка клуба: серф по утрам, работа днём, общий стол вечером.',
  },
  dubai: {
    name: 'Дубай', en: 'DUBAI', country: 'ОАЭ', cc: 'ae', tz: 'Asia/Dubai',
    lat: 25.2, lon: 55.27, loc: 'в Дубае', plate: '#3a3020',
    about: 'Деловая столица клуба: компании, счета, резидентские визы и сделки.',
  },
  miami: {
    name: 'Майами', en: 'MIAMI', country: 'США', cc: 'us', tz: 'America/New_York',
    lat: 25.76, lon: -80.19, loc: 'в Майами', plate: '#33232d',
    about: 'Новый регион клуба: Майами, Нью-Йорк и Лос-Анджелес. Собираемся раз в две недели.',
  },
  europe: {
    name: 'Европа', en: 'EUROPE', country: 'Лиссабон · Барселона · Берлин', cc: 'eu', tz: 'Europe/Berlin',
    lat: 44.5, lon: 4.5, loc: 'в Европе', plate: '#222838',
    about: 'Резиденты в Лиссабоне, Барселоне, Берлине и на Кипре. Встречи — по городам, эфиры — вместе.',
  },
};

export const REGION_KEYS = Object.keys(REGIONS);
export const regionName = (key) => REGIONS[key]?.name ?? '';

/* Города для часов на главной. Время считается браузером по поясу IANA,
   поэтому летнее время в Майами и Европе переключается само. */
export const CITIES = {
  moscow: { name: 'Москва', cc: 'ru', tz: 'Europe/Moscow' },
  bali: { name: 'Бали', cc: 'id', tz: 'Asia/Makassar' },
  dubai: { name: 'Дубай', cc: 'ae', tz: 'Asia/Dubai' },
  miami: { name: 'Майами', cc: 'us', tz: 'America/New_York' },
  newyork: { name: 'Нью-Йорк', cc: 'us', tz: 'America/New_York' },
  la: { name: 'Лос-Анджелес', cc: 'us', tz: 'America/Los_Angeles' },
  london: { name: 'Лондон', cc: 'gb', tz: 'Europe/London' },
  lisbon: { name: 'Лиссабон', cc: 'pt', tz: 'Europe/Lisbon' },
  barcelona: { name: 'Барселона', cc: 'es', tz: 'Europe/Madrid' },
  berlin: { name: 'Берлин', cc: 'de', tz: 'Europe/Berlin' },
  limassol: { name: 'Лимасол', cc: 'cy', tz: 'Asia/Nicosia' },
  istanbul: { name: 'Стамбул', cc: 'tr', tz: 'Europe/Istanbul' },
  tbilisi: { name: 'Тбилиси', cc: 'ge', tz: 'Asia/Tbilisi' },
  yerevan: { name: 'Ереван', cc: 'am', tz: 'Asia/Yerevan' },
  almaty: { name: 'Алматы', cc: 'kz', tz: 'Asia/Almaty' },
  phuket: { name: 'Пхукет', cc: 'th', tz: 'Asia/Bangkok' },
  singapore: { name: 'Сингапур', cc: 'sg', tz: 'Asia/Singapore' },
  tokyo: { name: 'Токио', cc: 'jp', tz: 'Asia/Tokyo' },
};

export const DEFAULT_CLOCKS = ['moscow', 'bali', 'dubai'];

/* Город часов, который соответствует региону резидента, — его отмечаем «вы здесь». */
export const REGION_CITY = { moscow: 'moscow', bali: 'bali', dubai: 'dubai', miami: 'miami', europe: 'berlin' };
