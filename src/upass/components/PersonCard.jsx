import { go } from '../lib/router.jsx';
import { Avatar } from './Art.jsx';
import Icon from './Icons.jsx';
import { REGIONS } from '../data/regions.js';
import { toneOf } from '../data/people.js';

/* Карточка резидента для горизонтальной ленты: аватар, имя, роль цветом роли
   и одна строка о том, чем человек полезен. Больше, чем аватарка в ряд,
   но меньше, чем строка списка — по такой карточке уже понятно, писать или нет. */
export default function PersonCard({ p, score, width = 156 }) {
  const c = REGIONS[p.city];
  const tone = toneOf(p);
  return (
    <button className="pcard" style={{ width }} onClick={() => go(`/p/${p.id}`)}>
      <div className="pcard__top">
        <Avatar person={p} size={44} dot={p.online} />
        {score >= 7 && <span className="tag tag--gold">{Math.min(99, 55 + score * 4)}%</span>}
      </div>
      <div className="pcard__name ell">
        {p.name.split(' ')[0]} {p.name.split(' ')[1]?.[0]}.
        {p.verified && <Icon name="seal" size={11} color="var(--gold)" style={{ verticalAlign: '-1px', marginLeft: 3 }} />}
      </div>
      <div className="pcard__role" style={{ color: tone }}>{p.role}</div>
      <div className="pcard__line">{p.gives || p.title}</div>
      <div className="pcard__foot">{c.flag} {c.name}</div>
    </button>
  );
}
