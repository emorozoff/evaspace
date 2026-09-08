/* Выборки и правила доступа. Всё, что решает «видно или нет», живёт здесь. */

import { EVENTS, COMMUNITIES, SERVICES, REQUESTS } from '../data/life.js';
import { RESIDENTS } from '../data/people.js';
import { VAULT } from '../data/canon.js';
import { REGIONS } from '../data/regions.js';
import { dayShift } from './format.js';

/* Доступ: у объекта может быть минимальная степень. Уровень членства на старте один,
   поэтому решает степень — она зарабатывается внутри сообщества. */
export const canSee = (me, minDegree = 1) => (me.degree || 0) >= (minDegree || 1);

export const visibleResidents = () => RESIDENTS;

export function visibleOnly(me, ids) {
  return ids.map((id) => RESIDENTS.find((r) => r.id === id)).filter(Boolean);
}

/* ——— регионы ——— */
export const residentsIn = (key) => RESIDENTS.filter((r) => r.city === key);
export const eventsIn = (key) => EVENTS.filter((e) => e.region === key);
export const communitiesIn = (key) => COMMUNITIES.filter((c) => c.region === key);
export const servicesIn = (key) => SERVICES.filter((s) => s.region === key || s.region === 'global');
export const requestsIn = (key) => REQUESTS.filter((r) => r.region === key);

/* ——— мероприятия ——— */
export function eventsSorted() {
  return [...EVENTS].sort((a, b) => a.inDays - b.inDays);
}

export function eventDate(e) {
  const d = dayShift(e.inDays);
  const [h, m] = e.time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export function upcoming(me, limit = 99) {
  return eventsSorted()
    .filter((e) => e.inDays >= 0 && canSee(me, e.minDegree))
    .slice(0, limit);
}

/** Что происходит в регионе: своё плюс общие эфиры и большие слёты. */
export function agendaFor(me, regionKey, limit = 99) {
  return upcoming(me).filter((e) => e.region === regionKey || e.region === 'global').slice(0, limit);
}

/* ——— сообщества ——— */
export function communitiesFor(me) {
  return COMMUNITIES.map((c) => ({ ...c, locked: !canSee(me, c.minDegree) }));
}

export function myCommunities(me, joined = []) {
  return communitiesFor(me).filter((c) => joined.includes(c.id));
}

/* ——— знания ——— */
export function vaultFor(me) {
  return VAULT.map((v) => ({ ...v, locked: (me.degree || 0) < v.degree }));
}

/* ——— подбор знакомств ——— */
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
  return RESIDENTS.filter((r) => r.id !== me.id)
    .map((r) => ({ r, score: matchScore(me, r) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}

/* Компании резидентов в регионе — считаем по профилям, а не по справочнику. */
export function companiesIn(key) {
  return [...new Set(residentsIn(key).map((r) => r.company).filter(Boolean))];
}

export const regionStats = (key) => {
  const r = REGIONS[key];
  return { residents: r.residents, companies: r.companies, communities: r.communities, events: eventsIn(key).filter((e) => e.inDays >= 0).length };
};
