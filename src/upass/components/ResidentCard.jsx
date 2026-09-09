import { go } from '../lib/router.jsx';
import { Avatar } from './Art.jsx';
import Icon from './Icons.jsx';
import { REGIONS } from '../data/regions.js';
import { toneOf } from '../data/people.js';
import { offer } from '../data/exchange.js';
import { offersOf, wantsOf, matchPct } from '../lib/match.js';

/* Карточка резидента во всю ширину: кто это, что даёт и что ищет.
   По ней видно, есть ли смысл писать, не открывая профиль. */
export default function ResidentCard({ p, me }) {
  const c = REGIONS[p.city];
  const gives = offersOf(p).slice(0, 3);
  const wants = wantsOf(p).slice(0, 2);
  const pct = me ? matchPct(me, p) : null;

  return (
    <button className="rcard" onClick={() => go(`/p/${p.id}`)}>
      <div className="row" style={{ gap: 12 }}>
        <Avatar person={p} size={50} dot={p.online} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="t-md ell">{p.name}</span>
            {p.verified && <Icon name="seal" size={13} color="var(--gold)" />}
          </div>
          <div className="t-xs ell" style={{ marginTop: 3, color: toneOf(p), fontWeight: 700 }}>
            {p.role} · {p.company}
          </div>
          <div className="t-xs dim-2 ell" style={{ marginTop: 2 }}>{c.flag} {c.name}</div>
        </div>
        {pct !== null && <span className={`tag${pct >= 75 ? ' tag--gold' : ''}`} style={{ flex: 'none' }}>{pct}%</span>}
      </div>

      <div className="rcard__row">
        <span className="rcard__k">Даёт</span>
        <span className="wrap" style={{ gap: 5 }}>
          {gives.length
            ? gives.map((t) => <span key={t} className="tag tag--plain">{offer(t)?.emoji} {offer(t)?.short}</span>)
            : <span className="t-xs dim-2">{p.gives}</span>}
        </span>
      </div>
      <div className="rcard__row">
        <span className="rcard__k">Ищет</span>
        <span className="wrap" style={{ gap: 5 }}>
          {wants.length
            ? wants.map((t) => <span key={t} className="tag tag--plain">{offer(t)?.emoji} {offer(t)?.short}</span>)
            : <span className="t-xs dim-2">пока ничего — смотрит</span>}
        </span>
      </div>
    </button>
  );
}
