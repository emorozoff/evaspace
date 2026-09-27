/* Регионы клуба. Регион — главная привязка резидента: где он сейчас живёт.
   От него зависят карта резидента, афиша по умолчанию, порядок услуг,
   своё локальное сообщество и то, кого показывают «рядом».
   Меняется одним нажатием — на главной, в профиле или на карте. */

export const REGIONS = {
  moscow: {
    name: 'Москва', en: 'MOSCOW', country: 'Россия', flag: '🇷🇺', tz: 'Europe/Moscow',
    lat: 55.75, lon: 37.62, loc: 'в Москве', plate: '#2d2750',
    about: 'Домашняя база клуба: здесь больше всего резидентов, бизнес-завтраки и закрытые ужины.',
  },
  bali: {
    name: 'Бали', en: 'BALI', country: 'Индонезия', flag: '🇮🇩', tz: 'Asia/Makassar',
    lat: -8.65, lon: 115.13, loc: 'на Бали', plate: '#193d34',
    about: 'Самая большая зимовка клуба: серф по утрам, работа днём, общий стол вечером.',
  },
  dubai: {
    name: 'Дубай', en: 'DUBAI', country: 'ОАЭ', flag: '🇦🇪', tz: 'Asia/Dubai',
    lat: 25.2, lon: 55.27, loc: 'в Дубае', plate: '#41341d',
    about: 'Деловая столица клуба: компании, счета, резидентские визы и сделки.',
  },
  miami: {
    name: 'Майами', en: 'MIAMI', country: 'США', flag: '🇺🇸', tz: 'America/New_York',
    lat: 25.76, lon: -80.19, loc: 'в Майами', plate: '#3d2236',
    about: 'Новый регион клуба: Майами, Нью-Йорк и Лос-Анджелес. Собираемся раз в две недели.',
  },
  europe: {
    name: 'Европа', en: 'EUROPE', country: 'Лиссабон · Барселона · Берлин', flag: '🇪🇺', tz: 'Europe/Berlin',
    lat: 44.5, lon: 4.5, loc: 'в Европе', plate: '#1f2a4b',
    about: 'Резиденты в Лиссабоне, Барселоне, Берлине и на Кипре. Встречи — по городам, эфиры — вместе.',
  },
};

export const REGION_KEYS = Object.keys(REGIONS);
export const regionName = (key) => REGIONS[key]?.name ?? '';
export const regionFlag = (key) => REGIONS[key]?.flag ?? '';

/* Города для часов на главной. Время считается браузером по поясу IANA,
   поэтому летнее время в Майами и Европе переключается само. */
export const CITIES = {
  moscow: { name: 'Москва', flag: '🇷🇺', tz: 'Europe/Moscow' },
  bali: { name: 'Бали', flag: '🇮🇩', tz: 'Asia/Makassar' },
  dubai: { name: 'Дубай', flag: '🇦🇪', tz: 'Asia/Dubai' },
  miami: { name: 'Майами', flag: '🇺🇸', tz: 'America/New_York' },
  newyork: { name: 'Нью-Йорк', flag: '🇺🇸', tz: 'America/New_York' },
  la: { name: 'Лос-Анджелес', flag: '🇺🇸', tz: 'America/Los_Angeles' },
  london: { name: 'Лондон', flag: '🇬🇧', tz: 'Europe/London' },
  lisbon: { name: 'Лиссабон', flag: '🇵🇹', tz: 'Europe/Lisbon' },
  barcelona: { name: 'Барселона', flag: '🇪🇸', tz: 'Europe/Madrid' },
  berlin: { name: 'Берлин', flag: '🇩🇪', tz: 'Europe/Berlin' },
  limassol: { name: 'Лимасол', flag: '🇨🇾', tz: 'Asia/Nicosia' },
  istanbul: { name: 'Стамбул', flag: '🇹🇷', tz: 'Europe/Istanbul' },
  tbilisi: { name: 'Тбилиси', flag: '🇬🇪', tz: 'Asia/Tbilisi' },
  yerevan: { name: 'Ереван', flag: '🇦🇲', tz: 'Asia/Yerevan' },
  almaty: { name: 'Алматы', flag: '🇰🇿', tz: 'Asia/Almaty' },
  phuket: { name: 'Пхукет', flag: '🇹🇭', tz: 'Asia/Bangkok' },
  singapore: { name: 'Сингапур', flag: '🇸🇬', tz: 'Asia/Singapore' },
  tokyo: { name: 'Токио', flag: '🇯🇵', tz: 'Asia/Tokyo' },
};

export const DEFAULT_CLOCKS = ['moscow', 'bali', 'dubai'];

/* Город часов, который соответствует региону резидента, — его отмечаем «вы здесь». */
export const REGION_CITY = { moscow: 'moscow', bali: 'bali', dubai: 'dubai', miami: 'miami', europe: 'berlin' };
