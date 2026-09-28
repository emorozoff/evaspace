import { go } from '../../lib/router.jsx';
import { EXCHANGE } from '../../data/people.js';
import { REGIONS } from '../../data/regions.js';
import { Avatar } from '../Art.jsx';
import { Item } from '../UI.jsx';
import Flag from '../Flag.jsx';

/* Общие детали области «Люди»: строка резидента, число пользы и строка
   обмена «Даёт / Ищет». Совпадения с вами — первыми и подсвечены. */

export const Pct = ({ v }) => <span className="p-num">{v}%</span>;

export function PersonRow({ app, p, pct, sub, meta, onClick }) {
  const inCircle = app.circle.includes(p.id);
  return (
    <Item
      lead={<Avatar person={p} size={44} dot={p.online} ring={inCircle ? 'var(--hair-2)' : null} />}
      title={p.name}
      sub={sub || <><Flag cc={REGIONS[p.region].cc} size={12} /> {p.city} · {p.company}</>}
      meta={meta !== undefined ? meta : <Pct v={pct} />}
      onClick={onClick || (() => go(`/p/${p.id}`))}
    />
  );
}

export function Exchange({ k, items = [], on = [], wrap = false }) {
  const sorted = [...items].sort((a, b) => on.includes(b) - on.includes(a));
  return (
    <div className={`p-x${wrap ? ' p-x--wrap' : ''}`}>
      <span className="p-x__k">{k}</span>
      <div className="p-x__v">
        {sorted.map((g) => <span key={g} className={`chip${on.includes(g) ? ' chip--on' : ''}`}>{EXCHANGE[g]?.name || g}</span>)}
      </div>
    </div>
  );
}
