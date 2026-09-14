/* Правила расписания: кто какое событие видит, кто идёт, что за формат
   и когда открывается подключение. Сама генерация серий — в events.js. */
import { DAY, HOUR, MINUTE } from './time.js';
import { hasPackage, cityById, userById } from './club.js';

/* ---------- события ---------- */

export function canSeeEvent(state, user, event) {
  if (!user) return false;
  if (!hasPackage(user, event.minPackage)) return false;
  if (event.type === 'offline') return event.cityId === user.cityId;
  if (event.type === 'team') return state.members.some((m) => m.teamId === event.teamId && m.userId === user.id);
  return true;
}

export function visibleEvents(state, user, { from = 0, to = Infinity } = {}) {
  return state.events
    .filter((e) => !e.canceled && e.startsAt >= from && e.startsAt <= to && canSeeEvent(state, user, e))
    .sort((a, b) => a.startsAt - b.startsAt);
}

export function nextEvent(state, user, now = Date.now()) {
  return visibleEvents(state, user, { from: now - 2 * HOUR })[0] || null;
}

export function rsvpOf(state, eventId, userId) {
  return state.rsvp[`${eventId}:${userId}`] || null;
}

export function goingIds(state, eventId) {
  const prefix = eventId + ':';
  return Object.keys(state.rsvp)
    .filter((k) => k.startsWith(prefix) && state.rsvp[k] === 'going')
    .map((k) => k.slice(prefix.length));
}

export function goingUsers(state, eventId) {
  return goingIds(state, eventId)
    .map((id) => userById(state, id))
    .filter(Boolean);
}

/** Кто отказался. Видно только куратору — участникам это знать незачем. */
export function notGoingUsers(state, eventId) {
  const prefix = eventId + ':';
  return Object.keys(state.rsvp)
    .filter((k) => k.startsWith(prefix) && state.rsvp[k] === 'not_going')
    .map((k) => userById(state, k.slice(prefix.length)))
    .filter(Boolean);
}

/** Свод по событию для админки: кто идёт, кто отказался, кто молчит. */
export function eventTally(state, event) {
  const invited = state.users.filter((u) => u.active !== false && canSeeEvent(state, u, event));
  const going = goingIds(state, event.id);
  const no = notGoingUsers(state, event.id).map((u) => u.id);
  return {
    invited: invited.length,
    going: going.length,
    no: no.length,
    silent: Math.max(0, invited.length - going.length - no.length),
    share: invited.length ? Math.round((going.length / invited.length) * 100) : 0,
  };
}

/** Кнопка «Подключиться» оживает за 15 минут до начала и гаснет после конца. */
export function canJoin(event, now = Date.now()) {
  if (!event.joinUrl) return false;
  return now >= event.startsAt - 15 * MINUTE && now <= event.startsAt + event.duration * MINUTE;
}

/**
 * Формат и аудитория события — короткими словами, одинаково на всех экранах.
 * Раньше это приходилось выводить в каждом компоненте заново.
 */
export function eventMeta(event) {
  const offline = event.type === 'offline' || event.type === 'summit';
  const audience =
    event.type === 'team' ? 'для команды' : event.minPackage === 'pro' ? 'для PRO' : event.minPackage === 'club' ? 'для клуба' : 'для всех';
  return {
    offline,
    format: offline ? 'офлайн' : 'онлайн',
    audience,
    paid: (event.price || 0) > 0,
  };
}

export function eventCity(state, event) {
  return event.cityId ? cityById(state, event.cityId) : null;
}

/** Ближайшая пятница в городе участника. */
export function nextFridayEvent(state, cityId, now = Date.now()) {
  return state.events
    .filter((e) => e.cityId === cityId && e.type === 'offline' && !e.canceled && e.startsAt > now - 3 * HOUR)
    .sort((a, b) => a.startsAt - b.startsAt)[0] || null;
}
/* ---------- слёт ---------- */

export function summitEvent(state) {
  return state.events.find((e) => e.type === 'summit') || null;
}

export function summitVisible(state, now = Date.now()) {
  const summit = summitEvent(state);
  return Boolean(summit) && summit.startsAt - now < 45 * DAY;
}
