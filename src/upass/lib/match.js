/* Совместимость двух резидентов. Считается встречно: сильнее всего весит
   то, что нужно мне и есть у него. Общие направления и один регион только
   добавляют, но сами по себе метча не делают. */

import { EXCHANGE } from '../data/people.js';
import { offer } from '../data/exchange.js';

export const wantsOf = (p) => (p?.id === 'me' ? p.wants : EXCHANGE[p?.id]?.wants) || [];
export const offersOf = (p) => (p?.id === 'me' ? p.offers : EXCHANGE[p?.id]?.offers) || [];

/** Что совпало: чем он закрывает мой запрос и чем я закрываю его. */
export function matchPair(me, r) {
  const mine = wantsOf(me);
  const theirs = offersOf(r);
  return {
    forMe: mine.filter((t) => theirs.includes(t)),
    forThem: offersOf(me).filter((t) => wantsOf(r).includes(t)),
  };
}

export function matchScore(me, r) {
  if (!me || !r) return 0;
  const { forMe, forThem } = matchPair(me, r);
  let s = forMe.length * 9 + forThem.length * 7;
  s += (r.skills || []).filter((k) => (me.skills || []).includes(k)).length * 2;
  if (r.city === me.city) s += 4;
  if (r.online) s += 1;
  return s;
}

/** Процент для карточки. Ноль совпадений — 38 %, взаимный обмен — под сотню. */
export const matchPct = (me, r) => Math.min(99, 38 + Math.round(matchScore(me, r) * 3.4));

/** Почему совпало — человеческими словами, не больше двух строк. */
export function matchReasons(me, r) {
  const { forMe, forThem } = matchPair(me, r);
  const out = [];
  for (const t of forMe.slice(0, 2)) out.push(`Вы ищете «${offer(t)?.short}» — это его сторона`);
  for (const t of forThem.slice(0, 2 - out.length)) out.push(`Ему нужно «${offer(t)?.short}» — это ваша сторона`);
  return out;
}

/** Лучшие совпадения среди резидентов. */
export function bestMatches(me, list, limit = 30) {
  return list
    .filter((r) => r.id !== me.id)
    .map((r) => ({ p: r, score: matchScore(me, r), pct: matchPct(me, r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
