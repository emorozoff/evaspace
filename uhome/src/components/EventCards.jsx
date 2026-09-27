import { go } from '../lib/router.jsx';
import { KINDS } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { byId } from '../data/people.js';
import { dayShift, monthShort, whenLabel } from '../lib/format.js';
import { goingCount } from '../lib/select.js';
import { EventCover } from './Covers.jsx';
import { AvaStack } from './Art.jsx';
import Icon from './Icons.jsx';

/* Метка типа события: цвет и слово, без лишних деталей. */
export function KindTag({ kind }) {
  const k = KINDS[kind];
  return (
    <span className="tag" style={{ background: `${k.tone}22`, color: k.tone }}>
      {kind === 'closed' && <Icon name="lock" size={11} />}
      {kind === 'online' && <Icon name="video" size={11} />}
      {k.name}
    </span>
  );
}

export const placeOf = (e) => (e.kind === 'online' ? 'Zoom' : `${REGIONS[e.region]?.flag} ${REGIONS[e.region]?.name}`);

/* Большая карточка: ближайшее событие с обложкой, датой и кто идёт. */
export function EventCard({ app, event: e, height = 150 }) {
  const mine = app.going[e.id];
  const people = e.going.map(byId).filter(Boolean);
  return (
    <button className="evcard" onClick={() => go(`/event/${e.id}`)}>
      <EventCover event={e} height={height} radius={0}>
        <div className="scene__top">
          <span className="glass">{placeOf(e)}</span>
          {mine ? <span className="glass" style={{ color: 'var(--sea)' }}><Icon name="check" size={12} /> вы идёте</span> : <span className="glass">{e.price}</span>}
        </div>
      </EventCover>
      <div className="evcard__body">
        <div className="row" style={{ gap: 6 }}>
          <KindTag kind={e.kind} />
          <span className="t-xs dim-2">{whenLabel(e.inDays, e.time)}</span>
        </div>
        <div className="t-lg" style={{ marginTop: 4 }}>{e.title}</div>
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <AvaStack people={people} size={24} max={5} />
          <span className="t-xs dim-2">{goingCount(app, e)} идут · мест {e.cap}</span>
        </div>
      </div>
    </button>
  );
}

/* Строка события: дата плиткой слева, как в календаре. */
export function EventRow({ app, event: e }) {
  const d = dayShift(e.inDays);
  const mine = app.going[e.id];
  const asked = app.asked[e.id];
  return (
    <button className="item" onClick={() => go(`/event/${e.id}`)}>
      <div className={`evdate${e.inDays === 0 ? ' evdate--today' : ''}`}>
        <span className="evdate__d">{d.getDate()}</span>
        <span className="evdate__m">{monthShort(d)}</span>
      </div>
      <div className="item__body">
        <div className="item__t">{e.title}</div>
        <div className="item__s">{whenLabel(e.inDays, e.time)} · {placeOf(e)}</div>
      </div>
      <div className="item__meta">
        {mine ? <span className="tag tag--sea"><Icon name="check" size={11} />иду</span> : asked ? <span className="tag tag--violet">заявка</span> : <KindTag kind={e.kind} />}
        <span>{e.price}</span>
      </div>
    </button>
  );
}
