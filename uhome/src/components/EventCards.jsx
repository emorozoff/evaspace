import { go } from '../lib/router.jsx';
import { KINDS } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { dayShift, monthShort, weekday, plural } from '../lib/format.js';
import { goingCount } from '../lib/select.js';
import { usefulAt } from '../lib/intro.js';
import { eventStart, eventTz } from '../lib/calendar.js';
import { localParts, hhmm } from '../lib/time.js';
import { EventCover } from './Covers.jsx';
import { AvaStack } from './Art.jsx';
import Icon from './Icons.jsx';
import Flag from './Flag.jsx';

/* Событие в списке и карточкой: дата плиткой, название, время и место.
   Одна метка справа — ваш статус, если он есть, иначе цена. */

export function KindTag({ kind }) {
  const k = KINDS[kind];
  return <span className={`tag${kind === 'closed' ? ' tag--violet' : kind === 'online' ? ' tag--blue' : ''}`}>{k.name}</span>;
}

export const placeOf = (e) => (e.kind === 'online' ? 'Zoom' : <><Flag cc={REGIONS[e.region]?.cc} size={13} /> {REGIONS[e.region]?.name}</>);

/** «у вас 00:00 (+1 день)» — когда пояс события не совпадает с вашим. */
export function myTime(e, region) {
  const tz = eventTz(e);
  const mine = REGIONS[region]?.tz;
  if (!mine || mine === tz) return null;
  const start = eventStart(e);
  const t = localParts(mine, new Date(start));
  const wall = new Date(start + t.offset * 60000);
  const day = dayShift(e.inDays);
  const diff = Math.round((Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) - Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())) / 86400000);
  const hm = hhmm(t);
  if (hm === e.time && diff === 0) return null;
  return `у вас ${hm}${diff > 0 ? ' (+1 день)' : diff < 0 ? ' (−1 день)' : ''}`;
}

/** Время в строке списка — в вашем поясе: «у вас 00:00 (+1 день)», иначе «19:00». */
export function timeLine(e, region) {
  return myTime(e, region) || e.time;
}

/* Дата плиткой: число крупно, месяц мелко. Сегодня — золотая линия. */
export function DateTile({ days }) {
  const d = dayShift(days);
  return (
    <span className={`s-date${days === 0 ? ' s-date--today' : ''}`} aria-label={`${d.getDate()} ${monthShort(d)}`}>
      <span className="s-date__w">{weekday(d)}</span>
      <span className="s-date__d">{d.getDate()}</span>
      <span className="s-date__m">{monthShort(d)}</span>
    </span>
  );
}

const durShort = (dur) => String(dur || '').replace(/\s*час(а|ов)?$/, ' ч');

/* Карточка ближайшего события: обложка, дата, название, кто идёт. */
export function EventCard({ app, event: e, height = 140 }) {
  const mine = app.going[e.id];
  const people = e.going.map(byId).filter(Boolean);
  const useful = usefulAt(app, e);
  const n = goingCount(app, e);
  return (
    <button className="s-ev tap" onClick={() => go(`/event/${e.id}`)}>
      <EventCover event={e} height={height} radius={0}>
        <div className="scene__top">
          <span className="glass">{placeOf(e)}</span>
          {mine ? <span className="glass sea"><Icon name="check" size={12} width={2} /> вы идёте</span> : e.kind !== 'club' ? <span className="glass">{KINDS[e.kind].name}</span> : null}
        </div>
      </EventCover>
      <span className="s-ev__body">
        <DateTile days={e.inDays} />
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="s-ev__t">{e.title}</span>
          <span className="s-ev__m">{timeLine(e, app.me.region)} · {durShort(e.dur)} · {e.price}</span>
        </span>
      </span>
      <span className="s-ev__foot">
        <AvaStack people={people} size={22} max={4} />
        <span>{n} {plural(n, 'идёт', 'идут', 'идут')}</span>
        {useful > 0 && <span className="gold" style={{ marginLeft: 'auto' }}>{useful} {plural(useful, 'полезное знакомство', 'полезных знакомства', 'полезных знакомств')}</span>}
      </span>
    </button>
  );
}

/* Строка события в списке. */
export function EventRow({ app, event: e }) {
  const mine = app.going[e.id];
  const asked = app.asked[e.id];
  return (
    <button className="item" onClick={() => go(`/event/${e.id}`)}>
      <DateTile days={e.inDays} />
      <span className="item__body">
        <span className="item__t">{e.title}</span>
        <span className="item__s">{timeLine(e, app.me.region)} · {placeOf(e)}</span>
      </span>
      <span className="item__meta">
        {mine ? <span className="tag tag--sea">иду</span> : asked ? <span className="tag tag--violet">заявка</span> : <span>{e.price}</span>}
      </span>
    </button>
  );
}
