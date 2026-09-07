/* Выборки, общие для нескольких экранов. Правила видимости живут здесь. */

import { EVENTS, CIRCLES, SERVICES } from '../data/life.js';
import { RESIDENTS } from '../data/people.js';
import { LOCATIONS } from '../data/places.js';
import { VAULT } from '../data/canon.js';
import { SPEND } from '../data/capital.js';
import { dayShift } from './format.js';

/* Правило видимости: объект с минимальным уровнем N виден участнику с уровнем не ниже N.
   Верхние видят нижних полностью, нижние верхних не видят нигде. */
export const canSee = (me, minTier = 1, minDegree = 1) =>
  (me.tier || 0) >= minTier && (me.degree || 0) >= minDegree;

export function eventsSorted() {
  return [...EVENTS].sort((a, b) => a.inDays - b.inDays);
}

export function upcoming(me, limit = 99) {
  return eventsSorted()
    .filter((e) => e.inDays >= 0)
    .filter((e) => canSee(me, e.minTier, e.minDegree))
    .slice(0, limit);
}

export function eventDate(e) {
  const d = dayShift(e.inDays);
  const [h, m] = e.time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function visibleResidents(me) {
  // резидент виден, если его уровень членства не выше вашего
  return RESIDENTS.filter((r) => r.tier <= Math.max(1, me.tier || 1));
}

/* То же правило для любого списка людей: имён выше своего уровня участник
   не видит нигде — ни в городе, ни в списках участников событий. */
export function visibleOnly(me, ids) {
  const max = Math.max(1, me.tier || 1);
  return ids
    .map((id) => RESIDENTS.find((r) => r.id === id))
    .filter((r) => r && r.tier <= max);
}

export function nearby(me, limit = 99) {
  return visibleResidents(me).filter((r) => r.city === me.city).slice(0, limit);
}

export function partnersOf(city) {
  return SERVICES.filter((s) => s.city === city);
}

export function circlesFor(me) {
  return CIRCLES.map((c) => ({ ...c, locked: !canSee(me, c.minTier, c.minDegree) }));
}

export function vaultFor(me) {
  return VAULT.map((v) => ({ ...v, locked: (me.degree || 0) < v.degree }));
}

export function openLocations() {
  return LOCATIONS.filter((l) => l.status === 'open');
}

export function spendTotals(extra = []) {
  const rows = [...SPEND];
  for (const e of extra) {
    const found = rows.find((r) => r.cat === e.cat);
    if (found) {
      found.inside += e.inside || 0;
      found.outside += e.outside || 0;
    } else rows.push({ cat: e.cat, inside: e.inside || 0, outside: e.outside || 0 });
  }
  const inside = rows.reduce((s, r) => s + r.inside, 0);
  const outside = rows.reduce((s, r) => s + r.outside, 0);
  return { rows, inside, outside, total: inside + outside, share: inside / Math.max(1, inside + outside) };
}

/* Совпадение по интересам: чем больше общих навыков и целей, тем выше */
export function matchScore(me, r) {
  const mine = new Set(me.skills || []);
  let s = 0;
  for (const k of r.skills) if (mine.has(k)) s += 3;
  if (r.city === me.city) s += 4;
  if (r.online) s += 1;
  if ((me.role || '') === r.role) s += 1;
  return s;
}

export function suggestions(me, limit = 3) {
  return visibleResidents(me)
    .map((r) => ({ r, score: matchScore(me, r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}
