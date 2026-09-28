import { go } from '../lib/router.jsx';
import { KINDS } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { dayShift, monthShort, weekday, plural } from '../lib/format.js';
import { goingCount } from '../lib/select.js';
import { usefulAt } from '../lib/intro.js';
import { EventCover } from './Covers.jsx';
import { AvaStack } from './Art.jsx';
import Icon from './Icons.jsx';
import Flag from './Flag.jsx';

/* Метка типа события: моноширинная, цвет — тонкой кромкой и текстом. */
export function KindTag({ kind }) {
  const k = KINDS[kind];
  return (
    <span className="tag xkind" style={{ color: k.tone, '--k': k.tone }}>
      {kind === 'closed' && <Icon name="lock" size={11} />}
      {kind === 'online' && <Icon name="video" size={11} />}
      {k.name}
    </span>
  );
}

export const placeOf = (e) => (e.kind === 'online' ? 'Zoom' : <><Flag cc={REGIONS[e.region]?.cc} size={13} /> {REGIONS[e.region]?.name}</>);

/* Кольцо «польза»: делениями — шкала, золотой дугой — процент.
   Дуга прорисовывается при появлении, цифра — моноширинная. */
export function PctRing({ pct, size = 42, stroke = 1.6 }) {
  const r = size / 2 - stroke - 1.5;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const lvl = pct >= 75 ? 'hi' : pct >= 55 ? 'mid' : 'lo';
  const h = size / 2;
  return (
    <span className={`xring xring--${lvl}`} style={{ width: size, height: size, '--c': c, '--rs': `${size}px` }} role="img" aria-label={`Польза ${pct}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle className="xring__track" cx={h} cy={h} r={r + 2.6} strokeWidth="2" strokeDasharray={`0.8 ${(2 * Math.PI * (r + 2.6)) / 36 - 0.8}`} />
        <circle className="xring__base" cx={h} cy={h} r={r} strokeWidth={stroke} />
        <circle className="xring__arc" cx={h} cy={h} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${h} ${h})`} />
      </svg>
      <span className="xring__v">{pct}<i>%</i></span>
    </span>
  );
}

/* Дата плиткой, как на табло: день недели (или «сегодня»), число, месяц. */
export function DateTile({ days }) {
  const d = dayShift(days);
  const w = days === 0 ? 'сегодня' : days === 1 ? 'завтра' : weekday(d);
  return (
    <span className={`xdate${days === 0 ? ' xdate--today' : days === 1 ? ' xdate--soon' : ''}`}>
      <span className="xdate__w">{w}</span>
      <span className="xdate__d">{String(d.getDate()).padStart(2, '0')}</span>
      <span className="xdate__m">{monthShort(d)}</span>
    </span>
  );
}

const durShort = (dur) => String(dur || '').replace(/\s*час(а|ов)?$/, ' ч');

/* Большая карточка: ближайшее событие — сцена, дата плиткой, время,
   кто идёт и сколько там полезных знакомств. Нижняя кромка сцены —
   шкала заполненности зала. */
export function EventCard({ app, event: e, height = 150 }) {
  const mine = app.going[e.id];
  const people = e.going.map(byId).filter(Boolean);
  const special = e.kind === 'closed' || e.kind === 'partner';
  const useful = usefulAt(app, e);
  const n = goingCount(app, e);
  const fill = Math.min(1, n / e.cap);
  return (
    <button className="evcard xev" onClick={() => go(`/event/${e.id}`)}>
      <EventCover event={e} height={height} radius={0}>
        <div className="scene__top">
          <span className="cv-chip">{placeOf(e)}</span>
          {mine ? (
            <span className="cv-chip cv-chip--sea"><Icon name="check" size={12} width={2} /> вы идёте</span>
          ) : special ? (
            <span className="cv-chip" style={{ color: KINDS[e.kind].tone }}>{e.kind === 'closed' && <Icon name="lock" size={11} />}{KINDS[e.kind].name}</span>
          ) : null}
        </div>
        <i className="xev__cap" style={{ '--f': fill }} aria-hidden="true" />
      </EventCover>
      <span className="xev__body">
        <DateTile days={e.inDays} />
        <span className="xev__main">
          <span className="xev__t">{e.title}</span>
          <span className="xev__meta">
            <span>{e.time}</span><i />
            <span>{durShort(e.dur)}</span><i />
            <span>{e.price}</span>
          </span>
        </span>
      </span>
      <span className="xev__foot">
        <AvaStack people={people} size={22} max={4} />
        <span className="xev__n">{n} {plural(n, 'идёт', 'идут', 'идут')}</span>
        {useful > 0 && (
          <span className="xev__use">
            <Icon name="handshake" size={13} />
            {useful} {plural(useful, 'полезное знакомство', 'полезных знакомства', 'полезных знакомств')}
          </span>
        )}
      </span>
    </button>
  );
}

/* Строка события: дата плиткой, название, время моноширинным и одна
   метка справа — ваш статус, если он есть, иначе цена. */
export function EventRow({ app, event: e }) {
  const mine = app.going[e.id];
  const asked = app.asked[e.id];
  return (
    <button className="item xrow" onClick={() => go(`/event/${e.id}`)}>
      <DateTile days={e.inDays} />
      <span className="item__body">
        <span className="item__t" style={{ display: 'block' }}>
          {e.kind === 'closed' && <Icon name="lock" size={13} color="var(--violet)" style={{ marginRight: 5, verticalAlign: -1 }} />}
          {e.title}
        </span>
        <span className="item__s xrow__s" style={{ display: 'flex' }}>
          <span className="xrow__time">{e.time}</span>
          <span className="xrow__dot" />
          <span className="xrow__place">{placeOf(e)}</span>
        </span>
      </span>
      <span className="item__meta">
        {mine ? <span className="tag tag--sea"><Icon name="check" size={11} width={2.2} />иду</span> : asked ? <span className="tag tag--violet">заявка</span> : <span className="xprice">{e.price}</span>}
      </span>
    </button>
  );
}
