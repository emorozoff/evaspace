import { THREADS } from '../data/chats.js';
import { EVENTS } from '../data/events.js';
import { PEOPLE, byId } from '../data/people.js';
import { COMMUNITIES } from '../data/communities.js';
import { COMPANIES } from '../data/services.js';

/* Выборки поверх данных и стора. Экраны только показывают результат —
   правила порядка и видимости живут здесь. */

const OPENED = Date.now();
const at = (mins) => OPENED - mins * 60000;

/** Все сообщения чата: заготовка из данных плюс отправленное в приложении. */
export function messagesOf(app, chat) {
  const seed = THREADS.find((t) => t.with === chat);
  const community = COMMUNITIES.find((c) => c.id === chat);
  const base = seed
    ? seed.messages.map((m) => ({ ...m, at: at(m.mins) }))
    : community
      ? community.chat.map((m) => ({ from: 'them', who: m.who, text: m.text, at: at(m.mins) })).reverse()
      : [];
  return [...base, ...(app.sent[chat] || [])].sort((a, b) => a.at - b.at);
}

export function unreadOf(app, chat) {
  if (app.read[chat]) return 0;
  return THREADS.find((t) => t.with === chat)?.unread || 0;
}

export function totalUnread(app) {
  return THREADS.reduce((n, t) => n + unreadOf(app, t.with), 0);
}

/** Последнее сообщение и его время — для списков и порядка. */
export function lastOf(app, chat) {
  const list = messagesOf(app, chat);
  return list[list.length - 1] || null;
}

/* Ближний круг: первой — команда клуба, дальше люди. Кто написал и ещё
   не прочитан — поднимается в самое начало, свежие выше. */
export function circleOrder(app) {
  const ids = ['team', ...app.circle.filter((id) => byId(id))];
  const items = ids.map((id, i) => {
    const last = lastOf(app, id);
    return { id, person: byId(id), unread: unreadOf(app, id), lastAt: last?.at || 0, order: i };
  });
  const fresh = items.filter((x) => x.unread > 0).sort((a, b) => b.lastAt - a.lastAt);
  const rest = items.filter((x) => x.unread === 0).sort((a, b) => {
    if (a.id === 'team') return -1;
    if (b.id === 'team') return 1;
    return b.lastAt - a.lastAt || a.order - b.order;
  });
  return [...fresh, ...rest];
}

/** Все разговоры для списка сообщений: личные и сообщества, где вы участник. */
export function chatList(app) {
  const dms = THREADS.map((t) => t.with)
    .concat(Object.keys(app.sent).filter((k) => byId(k)))
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((id) => ({ id, kind: 'dm', person: byId(id), unread: unreadOf(app, id), last: lastOf(app, id) }));
  const groups = COMMUNITIES.filter((c) => app.joined.includes(c.id)).map((c) => ({
    id: c.id, kind: 'group', community: c, unread: 0, last: lastOf(app, c.id),
  }));
  return [...dms, ...groups].sort((a, b) => (b.unread > 0) - (a.unread > 0) || (b.last?.at || 0) - (a.last?.at || 0));
}

/* ——— события ——— */

const byTime = (a, b) => a.inDays - b.inDays || a.time.localeCompare(b.time);

export function eventsFiltered({ region = 'all', type = 'all' } = {}) {
  return EVENTS.filter((e) => {
    if (region === 'online' && e.kind !== 'online') return false;
    if (region !== 'all' && region !== 'online' && e.region !== region) return false;
    if (type !== 'all' && e.kind !== type) return false;
    return true;
  }).sort(byTime);
}

/** На главную: свой регион и эфиры, ближайшие первыми. */
export function upcomingFor(app, n = 3) {
  return EVENTS.filter((e) => e.region === app.me.region || e.kind === 'online').sort(byTime).slice(0, n);
}

export function goingPeople(app, e) {
  return e.going.map(byId).filter(Boolean);
}

export function goingCount(app, e) {
  return e.going.length + (app.going[e.id] ? 1 : 0);
}

/* ——— люди и услуги ——— */

export function newResidents(n = 8) {
  return [...PEOPLE].sort((a, b) => a.joined - b.joined).slice(0, n);
}

export function peopleIn(region) {
  return PEOPLE.filter((p) => p.region === region);
}

/** Услуги: в своём регионе — выше, остальные следом. */
export function companiesFor(app, { cat = 'all', region = 'mine', q = '' } = {}) {
  const r = region === 'mine' ? app.me.region : region;
  const query = q.trim().toLowerCase();
  return COMPANIES.filter((c) => {
    if (cat !== 'all' && c.cat !== cat) return false;
    if (r !== 'all' && !c.regions.includes(r)) return false;
    if (query && !`${c.name} ${c.tagline} ${c.about} ${c.offers.map((o) => o.name).join(' ')}`.toLowerCase().includes(query)) return false;
    return true;
  }).sort((a, b) => b.regions.includes(app.me.region) - a.regions.includes(app.me.region) || !!b.featured - !!a.featured || b.rating - a.rating);
}
