/* Форматирование чисел, дат и слов. */

export const nf = (n, d = 0) =>
  Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const count = (n, one, few, many) => `${nf(n)} ${plural(n, one, few, many)}`;

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEK = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WEEK_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export const DAY = 86400000;

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Дата через n дней от сегодняшней полуночи. */
export function dayShift(days) {
  const d = today();
  d.setDate(d.getDate() + days);
  return d;
}

export const dateLong = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const dateShort = (d) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
export const weekday = (d) => WEEK[d.getDay()];
export const weekdayLong = (d) => WEEK_LONG[d.getDay()];
export const monthShort = (d) => MONTHS_SHORT[d.getMonth()];

export function relDay(days) {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days === 2) return 'послезавтра';
  if (days === -1) return 'вчера';
  if (days < 0) return `${-days} ${plural(-days, 'день', 'дня', 'дней')} назад`;
  if (days < 7) return weekdayLong(dayShift(days));
  return dateLong(dayShift(days));
}

/** «Сегодня, 19:00», «пятница, 19:00», «12 октября, 19:00». */
export const whenLabel = (days, time) => {
  const r = relDay(days);
  return `${r[0].toUpperCase()}${r.slice(1)}${time ? `, ${time}` : ''}`;
};

export function ago(days) {
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  return dateLong(dayShift(-days));
}

export const initials = (name) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const firstName = (name) => (name || '').split(' ')[0];

/* Карта резидента заполняется латиницей, как проездной документ. */
export const translit = (s) => {
  const map = { а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'E', ж: 'ZH', з: 'Z', и: 'I', й: 'I', к: 'K', л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U', ф: 'F', х: 'KH', ц: 'TS', ч: 'CH', ш: 'SH', щ: 'SCH', ъ: '', ы: 'Y', ь: '', э: 'E', ю: 'IU', я: 'IA' };
  return (s || '')
    .toLowerCase()
    .split('')
    .map((ch) => (map[ch] !== undefined ? map[ch] : /[a-z0-9]/.test(ch) ? ch.toUpperCase() : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
};

export const usd = (n) => '$' + nf(n);
