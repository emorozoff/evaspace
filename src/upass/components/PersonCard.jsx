import { go } from '../lib/router.jsx';
import { Avatar } from './Art.jsx';
import Icon from './Icons.jsx';
import { REGIONS } from '../data/regions.js';
import { toneOf } from '../data/people.js';
import { matchPair } from '../lib/match.js';
import { offer } from '../data/exchange.js';

/* Карточка резидента для горизонтальной ленты: кто это, процент
   совместимости и одна строка о том, чем человек полезен именно вам. */
export default function PersonCard({ p, pct, me, width = 168 }) {
  const c = REGIONS[p.city];
  const tone = toneOf(p);
  const { forMe } = me ? matchPair(me, p) : { forMe: [] };
  const line = forMe.length ? offer(forMe[0])?.give : p.gives || p.title;

  return (
    <button className="pcard" style={{ width }} onClick={() => go(`/p/${p.id}`)}>
      <div className="pcard__top">
        <Avatar person={p} size={44} dot={p.online} />
        {pct >= 60 && <span className={`tag${pct >= 75 ? ' tag--gold' : ''}`}>{pct}%</span>}
      </div>
      <div className="pcard__name ell">
        {p.name.split(' ')[0]} {p.name.split(' ')[1]?.[0]}.
        {p.verified && <Icon name="seal" size={11} color="var(--gold)" style={{ verticalAlign: '-1px', marginLeft: 3 }} />}
      </div>
      <div className="pcard__role" style={{ color: tone }}>{p.role}</div>
      <div className="pcard__line">{line}</div>
      <div className="pcard__foot">{c.flag} {c.name}</div>
    </button>
  );
}
