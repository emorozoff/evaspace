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

/** «19:00 по Москве · у вас 00:00» — когда пояса расходятся. */
export function timeForMe(e, myRegion) {
  const tz = eventTz(e);
  const mine = REGIONS[myRegion]?.tz;
  if (!mine || mine === tz) return null;
  const t = localParts(mine, new Date(eventStart(e)));
  if (hhmm(t) === e.time) return null;
  return `у вас ${hhmm(t)}`;
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
