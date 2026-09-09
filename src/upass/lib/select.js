/* Выборки и правила доступа. Всё, что решает «видно или нет», живёт здесь. */

import { EVENTS, COMMUNITIES, SERVICES, REQUESTS, TRIPS } from '../data/life.js';
import { RESIDENTS } from '../data/people.js';
import { VAULT } from '../data/canon.js';
import { REGIONS } from '../data/regions.js';
import { dayShift } from './format.js';
import { bestMatches } from './match.js';

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

/* ——— поездки резидентов ——— */
export const tripsOf = (id) => TRIPS.filter((t) => t.who === id).sort((a, b) => a.inDays - b.inDays);
export const arrivalsIn = (key) => TRIPS.filter((t) => t.region === key).sort((a, b) => a.inDays - b.inDays);

/** Куда человек собирается и на какие события идёт — чтобы понять, где пересечься. */
export function whereToMeet(me, id, limit = 2) {
  const out = [];
  for (const t of tripsOf(id).slice(0, 1)) out.push({ kind: 'trip', region: t.region, inDays: t.inDays, days: t.days });
  for (const e of upcoming(me).filter((e) => (e.going || []).includes(id)).slice(0, 2)) out.push({ kind: 'event', event: e });
  return out.sort((a, b) => (a.inDays ?? a.event.inDays) - (b.inDays ?? b.event.inDays)).slice(0, limit);
}

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
/* Сам счёт живёт в lib/match.js: он считает встречное совпадение запросов
   и предложений, а не просто общие интересы. */
export function suggestions(me, limit = 3) {
  return bestMatches(me, RESIDENTS, limit).map((x) => x.p);
}

/* Компании резидентов в регионе — считаем по профилям, а не по справочнику. */
export function companiesIn(key) {
  return [...new Set(residentsIn(key).map((r) => r.company).filter(Boolean))];
}

export const regionStats = (key) => {
  const r = REGIONS[key];
  return { residents: r.residents, companies: r.companies, communities: r.communities, events: eventsIn(key).filter((e) => e.inDays >= 0).length };
};
