/* Форматирование чисел, денег и дат. */

export const nf = (n, d = 0) =>
  Number(n || 0).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

export function usd(n, d = 0) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000000) return '$' + nf(v / 1000000, 2) + ' млн';
  if (Math.abs(v) >= 10000) return '$' + nf(Math.round(v / 1000)) + ' тыс.';
  return '$' + nf(v, d);
}

export const usdExact = (n, d = 0) => '$' + nf(n, d);
export const pct = (x, d = 0) => nf((x || 0) * 100, d) + '%';

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEK = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const MONTH_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export function dayShift(days) {
  const d = today();
  d.setDate(d.getDate() + days);
  return d;
}

export const dateLong = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const dateShort = (d) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
export const weekday = (d) => WEEK[d.getDay()];

export function relDay(days) {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days === 2) return 'послезавтра';
  if (days === -1) return 'вчера';
  if (days < 0) return `${-days} ${plural(-days, 'день', 'дня', 'дней')} назад`;
  return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
}

export function agoHours(h) {
  if (h < 1) return 'только что';
  if (h < 24) return `${Math.round(h)} ч назад`;
  const d = Math.round(h / 24);
  return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`;
}

export const initials = (name) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
