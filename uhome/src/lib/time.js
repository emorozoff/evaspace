/* Местное время в городах. Смещение не хранится руками — его отдаёт браузер
   по названию пояса, поэтому переходы на летнее время учитываются сами. */

const cache = {};
function fmt(tz) {
  if (!cache[tz]) {
    cache[tz] = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
  }
  return cache[tz];
}

/** Части местного времени: часы, минуты, смещение от UTC в минутах
    и местная дата (y, mo — с нуля, d) — чтобы понять, что там уже другой день. */
export function localParts(tz, now = new Date()) {
  try {
    const p = Object.fromEntries(fmt(tz).formatToParts(now).map((x) => [x.type, x.value]));
    const h = Number(p.hour) % 24;
    const m = Number(p.minute);
    const y = Number(p.year), mo = Number(p.month) - 1, d = Number(p.day);
    const asUtc = Date.UTC(y, mo, d, h, m);
    const offset = Math.round((asUtc - Math.floor(now.getTime() / 60000) * 60000) / 60000);
    return { h, m, offset, y, mo, d };
  } catch {
    return { h: now.getHours(), m: now.getMinutes(), offset: -now.getTimezoneOffset(), y: now.getFullYear(), mo: now.getMonth(), d: now.getDate() };
  }
}

export const hhmm = ({ h, m }) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** «+5 ч», «−1 ч 30 мин», «как у вас» — разница с поясом резидента. */
export function diffLabel(tz, baseTz, now = new Date()) {
  const d = localParts(tz, now).offset - localParts(baseTz, now).offset;
  if (d === 0) return 'как у вас';
  const sign = d > 0 ? '+' : '−';
  const a = Math.abs(d);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h ? `${h} ч` : ''}${m ? ` ${m} мин` : ''}`.trim();
}

/** Утро, день, вечер или ночь — чтобы не звонить человеку в три часа ночи. */
export function dayPart(h) {
  if (h >= 6 && h < 12) return 'утро';
  if (h >= 12 && h < 18) return 'день';
  if (h >= 18 && h < 23) return 'вечер';
  return 'ночь';
}
