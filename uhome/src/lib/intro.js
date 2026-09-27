import { PEOPLE, TRIPS, EXCHANGE, byId, firstNameOf } from '../data/people.js';
import { EVENTS } from '../data/events.js';
import { REGIONS } from '../data/regions.js';
import { match } from './match.js';
import { whenLabel, relDay, plural } from './format.js';

/* Поводы познакомиться. Клуб каждый день даёт резиденту причину
   написать конкретному человеку: вы идёте на одно событие, он прилетает
   в ваш город, живёт рядом, закрывает ваш запрос или только что вступил.
   Польза знакомства — встречное совпадение из lib/match.js. */

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Одна фраза «почему полезно» — первая причина совпадения. */
export function whyText(m) {
  return m.reasons[0] ? cap(m.reasons[0]) + '.' : 'Близкие интересы и круг общения.';
}

export const KIND_LABEL = {
  event: 'На одном событии',
  arrival: 'Прилетает к вам',
  city: 'Рядом с вами',
  need: 'Закроет ваш запрос',
  fresh: 'Новый резидент',
};

export function reasons(app, limit = 8) {
  const me = app.me;
  const out = [];
  const seen = new Set(Object.keys(app.intros || {}));
  const push = (p, kind, text, extra = {}) => {
    if (!p || seen.has(p.id)) return;
    const m = match(me, p);
    if (m.pct < 50) return;
    seen.add(p.id);
    out.push({ id: `${kind}-${p.id}`, p, pct: m.pct, kind, label: KIND_LABEL[kind], text, why: whyText(m), ...extra });
  };

  // 1. на одном событии — самый сильный повод
  for (const e of EVENTS.filter((x) => app.going[x.id]).sort((a, b) => a.inDays - b.inDays)) {
    const best = e.going.map(byId).filter(Boolean).map((p) => ({ p, m: match(me, p) })).sort((a, b) => b.m.pct - a.m.pct);
    for (const { p } of best.slice(0, 2)) {
      push(p, 'event', `Вы оба идёте на «${e.title}» — ${whenLabel(e.inDays, e.time).toLowerCase()}.`, { eventId: e.id });
    }
  }
  // 2. прилетает в ваш регион
  for (const t of TRIPS.filter((x) => x.to === me.region).sort((a, b) => a.inDays - b.inDays)) {
    const p = byId(t.who);
    push(p, 'arrival', `${firstNameOf(p)} будет ${REGIONS[t.to].loc} ${relDay(t.inDays)} на ${t.days} ${plural(t.days, 'день', 'дня', 'дней')}.`);
  }
  // 3. закрывает ваш запрос
  const helpers = PEOPLE.map((p) => ({ p, m: match(me, p) })).filter((x) => x.m.toMe.length).sort((a, b) => b.m.pct - a.m.pct);
  for (const { p, m } of helpers.slice(0, 4)) {
    push(p, 'need', `${firstNameOf(p)} даёт то, что вы ищете: ${m.toMe.map((x) => EXCHANGE[x].name.toLowerCase()).join(', ')}.`);
  }
  // 4. рядом, в вашем регионе
  const near = PEOPLE.filter((p) => p.region === me.region).map((p) => ({ p, m: match(me, p) })).sort((a, b) => b.m.pct - a.m.pct);
  for (const { p } of near.slice(0, 3)) {
    push(p, 'city', `${firstNameOf(p)} тоже ${REGIONS[me.region].loc}, ${p.city}.`);
  }
  // 5. новые резиденты
  for (const p of PEOPLE.filter((x) => x.joined <= 30).sort((a, b) => a.joined - b.joined)) {
    push(p, 'fresh', `${firstNameOf(p)} в клубе ${p.joined <= 1 ? 'с сегодняшнего дня' : `${p.joined} ${plural(p.joined, 'день', 'дня', 'дней')}`} — хороший момент познакомиться, пока круг только складывается.`);
  }

  // вперемешку по видам: у каждого дня разные поводы, а не пять одинаковых
  const buckets = Object.keys(KIND_LABEL).map((k) => out.filter((x) => x.kind === k));
  const mixed = [];
  while (mixed.length < out.length) for (const bucket of buckets) if (bucket.length) mixed.push(bucket.shift());
  return mixed.slice(0, limit);
}

/** С кем познакомиться на событии: идущие, по пользе. */
export function eventIntros(app, e) {
  return e.going
    .map(byId)
    .filter(Boolean)
    .map((p) => ({ p, ...match(app.me, p) }))
    .filter((x) => x.pct >= 45)
    .sort((a, b) => b.pct - a.pct)
    .map((x) => ({ ...x, why: whyText(x) }));
}

/** Сколько полезных знакомств ждёт на событии — для карточки в афише. */
export const usefulAt = (app, e) => eventIntros(app, e).filter((x) => x.pct >= 60).length;
