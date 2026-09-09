/* Даты и время. Всё живёт в миллисекундах, показываем по-русски. */

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const DAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const DAYS_SHORT = ['вс','пн','вт','ср','чт','пт','сб'];

export function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Понедельник той недели, в которую попадает t. */
export function startOfWeek(t) {
  const d = new Date(startOfDay(t));
  const shift = (d.getDay() + 6) % 7;
  return d.getTime() - shift * DAY;
}

/** Ключ недели вида 2026-W37 — им помечаем рандом-кофе и отчёты команд. */
export function weekKey(t) {
  const d = new Date(startOfWeek(t) + 3 * DAY); // четверг этой недели
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1).getTime();
  const num = Math.floor((d.getTime() - startOfWeek(jan1)) / WEEK) + 1;
  return `${year}-W${String(num).padStart(2, '0')}`;
}

/** Ближайшая пятница 19:30 начиная с указанного дня. */
export function nextFriday(from, hour = 19, minute = 30) {
  const d = new Date(startOfDay(from));
  const shift = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + shift);
  d.setHours(hour, minute, 0, 0);
  return d.getTime() < from ? d.getTime() + WEEK : d.getTime();
}

export function addMonths(t, n) {
  const d = new Date(t);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

export function sameDay(a, b) {
  return startOfDay(a) === startOfDay(b);
}

export function timeOf(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dateShort(t) {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Короткая дата для узких плашек: «11.09» */
export function dateTiny(t) {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthName(t) {
  return MONTHS_NOM[new Date(t).getMonth()];
}

export function dayName(t) {
  return DAYS[new Date(t).getDay()];
}

export function dayShort(t) {
  return DAYS_SHORT[new Date(t).getDay()];
}

/** «Сегодня, 19:30» / «Завтра, 12:00» / «пт, 12 сентября, 19:30» */
export function whenLabel(t, now = Date.now()) {
  const days = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  const time = timeOf(t);
  if (days === 0) return `Сегодня, ${time}`;
  if (days === 1) return `Завтра, ${time}`;
  if (days === -1) return `Вчера, ${time}`;
  return `${dayShort(t)}, ${dateShort(t)}, ${time}`;
}

/** «через 2 дня», «через 40 минут», «идёт сейчас», «3 дня назад» */
export function relative(t, now = Date.now()) {
  const diff = t - now;
  const abs = Math.abs(diff);
  if (abs < 2 * MINUTE) return 'прямо сейчас';
  const value = abs < HOUR ? [Math.round(abs / MINUTE), 'минуту', 'минуты', 'минут']
    : abs < DAY ? [Math.round(abs / HOUR), 'час', 'часа', 'часов']
    : [Math.round(abs / DAY), 'день', 'дня', 'дней'];
  const word = plural(value[0], value[1], value[2], value[3]);
  return diff > 0 ? `через ${value[0]} ${word}` : `${value[0]} ${word} назад`;
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** Заголовок недели в расписании: «Эта неделя», «Следующая неделя», «15–21 сентября» */
export function weekTitle(weekStart, now = Date.now()) {
  const diff = Math.round((weekStart - startOfWeek(now)) / WEEK);
  if (diff === 0) return 'Эта неделя';
  if (diff === 1) return 'Следующая неделя';
  const end = weekStart + 6 * DAY;
  const a = new Date(weekStart);
  const b = new Date(end);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} — ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

export function isoDate(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Значение для <input type="datetime-local"> */
export function inputValue(t) {
  return `${isoDate(t)}T${timeOf(t)}`;
}
