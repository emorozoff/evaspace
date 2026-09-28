import { REGIONS } from '../data/regions.js';
import { dayShift } from './format.js';
import { localParts, hhmm } from './time.js';

/* Время события: задано местным для региона (у эфира — своим поясом),
   отсюда считаем настоящий момент и показываем его в поясе резидента. */

export const eventTz = (e) => e.tz || REGIONS[e.region]?.tz || 'Europe/Moscow';

/** Момент начала события (UTC, мс). */
export function eventStart(e) {
  const d = dayShift(e.inDays);
  const [h, m] = e.time.split(':').map(Number);
  const wall = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  const offset = localParts(eventTz(e), new Date(wall)).offset;
  return wall - offset * 60000;
}

/* Время события в поясе резидента, когда пояса расходятся.
   { time: '00:00', dayShift: 1, label: '00:00, +1 день' } — dayShift показывает,
   что у вас это уже следующий (или ещё предыдущий) день. null — пояса совпадают. */
export function timeForMeParts(e, myRegion) {
  const tz = eventTz(e);
  const mine = REGIONS[myRegion]?.tz;
  if (!mine || mine === tz) return null;
  const start = eventStart(e);
  const t = localParts(mine, new Date(start));
  const wall = dayShift(e.inDays);
  const shift = Math.round((Date.UTC(t.y, t.mo, t.d) - Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate())) / 86400000);
  const time = hhmm(t);
  if (time === e.time && shift === 0) return null;
  const marker = shift === 0 ? '' : shift === 1 ? ', +1 день' : shift === -1 ? ', −1 день' : `, ${shift > 0 ? '+' : '−'}${Math.abs(shift)} дня`;
  return { time, dayShift: shift, label: `${time}${marker}` };
}

/** «у вас 00:00, +1 день» — строка для подписи; null, если пояса совпадают. */
export function timeForMe(e, myRegion) {
  const p = timeForMeParts(e, myRegion);
  return p ? `у вас ${p.label}` : null;
}

const DUR_H = (e) => {
  const n = parseFloat(String(e.dur).replace(',', '.'));
  return Number.isFinite(n) ? n : 2;
};

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);

/** Файл .ics — событие ложится в календарь телефона одним нажатием. */
export function downloadIcs(e) {
  const start = eventStart(e);
  const end = start + DUR_H(e) * 3600000;
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UHOME CLUB//RU', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.id}-${start}@uhome.club`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.place)}`,
    `DESCRIPTION:${esc(e.about)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `uhome-${e.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
