import { THREADS } from '../data/chats.js';
import { EVENTS } from '../data/events.js';
import { PEOPLE, byId } from '../data/people.js';
import { COMMUNITIES } from '../data/communities.js';
import { COMPANIES } from '../data/services.js';
import { groupsOf, groupThread, GROUP_UNREAD } from './groups.js';

/* Выборки поверх данных и стора. Экраны только показывают результат —
   правила порядка и видимости живут здесь. */

const OPENED = Date.now();
const at = (mins) => OPENED - mins * 60000;

/* Заготовки переписок — только у демо-резидента (app.demo !== false).
   У кандидата, подавшего заявку, своих чатов ещё нет: он видит лишь то,
   что пришло в приложении (sent), плюс чаты сообществ и группы. */
const isDemo = (app) => app.demo !== false;
const seedThreads = (app) => (isDemo(app) ? THREADS : []);

/** Все сообщения чата: заготовка из данных плюс отправленное в приложении. */
export function messagesOf(app, chat) {
  const seed = seedThreads(app).find((t) => t.with === chat);
  const community = COMMUNITIES.find((c) => c.id === chat);
  const group = chat === 'g-mm' ? groupsOf(app.me).find((g) => g.id === chat) : null;
  const base = seed
    ? seed.messages.map((m) => ({ ...m, at: at(m.mins) }))
    : community
      ? community.chat.map((m) => ({ from: 'them', who: m.who, text: m.text, at: at(m.mins) }))
      : group
        ? groupThread(app.me, group).map((m) => ({ ...m, at: at(m.mins) }))
        : [];
  return [...base, ...(app.sent[chat] || [])].sort((a, b) => a.at - b.at);
}

/* Непрочитанное: заготовка из данных, пока чат не открывали, плюс всё,
   что пришло после последнего открытия. У ассистента непрочитанное —
   одно приглашение, пока с ним ни разу не разговаривали; после «забыть чат»
   (ai.seen) счётчик не возвращается. */
export function unreadOf(app, chat) {
  if (chat === 'ai') return app.ai?.messages?.length || app.ai?.seen || app.ai?.count > 0 ? 0 : 1;
  const last = app.read[chat] || 0;
  const seed = last || !isDemo(app) ? 0 : seedThreads(app).find((t) => t.with === chat)?.unread || GROUP_UNREAD[chat] || 0;
  const fresh = (app.sent[chat] || []).filter((m) => m.from === 'them' && m.at > last).length;
  return seed + fresh;
}

/** Личные — красным, группы — белым, как в телеграме. */
export const isGroupChat = (id) => id === 'g-mm' || COMMUNITIES.some((c) => c.id === id);

export function totalUnread(app) {
  const ids = new Set([...seedThreads(app).map((t) => t.with), ...Object.keys(app.sent), ...app.joined, 'g-mm', 'ai']);
  return [...ids].reduce((n, id) => n + unreadOf(app, id), 0);
}

/** Последнее сообщение и его время — для списков и порядка. */
export function lastOf(app, chat) {
  if (chat === 'ai') {
    const m = app.ai?.messages || [];
    return m[m.length - 1] || null;
  }
  const list = messagesOf(app, chat);
  return list[list.length - 1] || null;
}

/* Ближний круг: команда клуба, мастер-группа, ассистент, дальше люди.
   Кто написал и ещё не прочитан — поднимается в самое начало. */
const PINNED = ['team', 'g-mm', 'ai'];
export function circleOrder(app) {
  const ids = [...PINNED, ...app.circle.filter((id) => id !== 'team' && byId(id))];
  const items = ids.map((id, i) => {
    const last = lastOf(app, id);
    return { id, person: byId(id), unread: unreadOf(app, id), lastAt: last?.at || 0, order: i, group: id.startsWith('g-') };
  });
  const fresh = items.filter((x) => x.unread > 0).sort((a, b) => b.lastAt - a.lastAt);
  const rest = items.filter((x) => x.unread === 0).sort((a, b) => {
    const pa = PINNED.indexOf(a.id), pb = PINNED.indexOf(b.id);
    if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return b.lastAt - a.lastAt || a.order - b.order;
  });
  return [...fresh, ...rest];
}

/** Все разговоры: личные, группы и сообщества, где вы участник. */
export function chatList(app) {
  const dms = seedThreads(app).map((t) => t.with)
    .concat(Object.keys(app.sent).filter((k) => byId(k)))
    .filter((v, i, a) => a.indexOf(v) === i)
    .map((id) => ({ id, kind: 'dm', person: byId(id), unread: unreadOf(app, id), last: lastOf(app, id) }));
  const mine = groupsOf(app.me).map((g) => ({ id: g.id, kind: 'squad', group: g, unread: unreadOf(app, g.id), last: lastOf(app, g.id) }));
  const groups = COMMUNITIES.filter((c) => app.joined.includes(c.id)).map((c) => ({
    id: c.id, kind: 'group', community: c, unread: unreadOf(app, c.id), last: lastOf(app, c.id),
  }));
  return [...dms, ...mine, ...groups].sort((a, b) => (b.unread > 0) - (a.unread > 0) || (b.last?.at || 0) - (a.last?.at || 0));
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

/** События сообщества: у локального — его регион, у сообщества по интересам — только отмеченные его темой. */
export function eventsForCommunity(c) {
  if (!c) return [];
  return EVENTS.filter((e) => (c.kind === 'local' ? e.region === c.region : (e.communities || []).includes(c.id))).sort(byTime);
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
