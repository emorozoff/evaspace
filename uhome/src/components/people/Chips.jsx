import { EXCHANGE } from '../../data/people.js';

/* Строка «Даёт / Ищет» в одну линию: совпадения с вами — первыми
   и подсвечены (даёт нужное вам — золото, ищет то, чем сильны вы — бирюза).
   Не влезло — строка мягко тает справа, без переноса. */
export function ChipLine({ k, items = [], on = [], tone = 'gold', wrap = false }) {
  const sorted = [...items].sort((a, b) => on.includes(b) - on.includes(a));
  return (
    <div className={`pcl${wrap ? ' pcl--wrap' : ''}`}>
      <span className="pcl__k">{k}</span>
      <div className="pcl__v">
        {sorted.map((g) => (
          <span key={g} className={`pcl__c${on.includes(g) ? ` pcl__c--${tone}` : ''}`}>{EXCHANGE[g]?.name || g}</span>
        ))}
      </div>
    </div>
  );
}
