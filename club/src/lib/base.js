/* База знаний и новости: материалы, закреп, словарь и три главные
   новости на сегодня — то, ради чего стоит открыть приложение. */
import { DAY, plural, weekKey } from './time.js';
import { userById } from './club.js';
import { visibleEvents, rsvpOf, eventMeta, summitVisible, summitEvent } from './schedule.js';
import { feedPosts } from './points.js';
import { meetsFor } from './meet.js';
import { chatKey } from './chats.js';

/* ---------- база знаний ---------- */

export function materialsFor(state, user) {
  return state.materials
    .filter((m) => m.seasonId === state.season.id || user?.archive)
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

/** Сколько материалов можно держать в закрепе. */
export const MAX_PINNED = 5;

/** Материал считается новинкой первую неделю — так его видно без объяснений. */
export const isNew = (material, now = Date.now()) => now - material.publishedAt < 7 * DAY;

export const isPinned = (state, id) => (state.pinned || []).includes(id);

/**
 * Порядок в базе: сначала закреплённое в заданном порядке, потом новинки,
 * потом всё остальное по дате. Словарь клуба живёт третьим закрепом и
 * приходит сюда отдельной строкой, потому что это не видео.
 */
export function baseOrder(list, state, now = Date.now()) {
  const pinned = (state.pinned || []).slice(0, MAX_PINNED);
  const inPin = list.filter((m) => pinned.includes(m.id)).sort((a, b) => pinned.indexOf(a.id) - pinned.indexOf(b.id));
  const rest = list.filter((m) => !pinned.includes(m.id));
  const fresh = rest.filter((m) => isNew(m, now));
  const old = rest.filter((m) => !isNew(m, now));
  return { pinned: inPin, fresh, rest: old };
}
/* ---------- словарь клуба ---------- */

/** Свои слова участников идут вместе с базовыми — источник виден по флагу. */
export function termsOf(state) {
  return [...(state.terms || [])];
}
/* ---------- новости ---------- */

/**
 * Три главные новости на сегодня. Собираются из того, что уже есть
 * в клубе: свежая запись, ближайшее событие, знакомства, лента.
 * Порядок — по важности, а не по времени: сверху то, из-за чего
 * стоит открыть приложение прямо сейчас.
 */
export function newsFor(state, user, now = Date.now()) {
  const out = [];
  const fresh = materialsFor(state, user).filter((m) => now - m.publishedAt < 12 * DAY);
  const material = fresh.find((m) => !isViewed(state, m.id, user.id)) || fresh[0];
  if (material) {
    out.push({
      id: `mat-${material.id}`,
      tag: material.type === 'гайд' ? 'новый гайд' : 'новое видео',
      tone: 'accent',
      icon: material.type === 'гайд' ? 'book' : 'play',
      title: material.title,
      sub: `${material.topic} · ${dayLabel(material.publishedAt, now)}`,
      to: `/material/${material.id}`,
    });
  }

  const soon = visibleEvents(state, user, { from: now, to: now + 8 * DAY })[0];
  if (soon && !rsvpOf(state, soon.id, user.id)) {
    out.push({
      id: `ev-${soon.id}`,
      tag: 'событие',
      tone: 'violet',
      icon: 'calendar',
      title: soon.title,
      sub: `${eventMeta(soon).offline ? soon.place || 'офлайн' : 'онлайн'} · ещё не отметились`,
      to: `/event/${soon.id}`,
    });
  }

  const week = weekKey(now);
  const meets = meetsFor(state, user.id, week);
  const match = meets.filter((m) => m.status === 'matched');
  const waiting = meets.filter((m) => m.status === 'new').length;
  if (match.length) {
    const other = userById(state, match[0].a === user.id ? match[0].b : match[0].a);
    out.push({
      id: `match-${match[0].id}`,
      tag: 'метч недели',
      tone: 'warm',
      icon: 'handshake',
      title: `${other?.name} тоже за знакомство`,
      sub: `Совпадение ${match[0].percent}% · чат уже открыт`,
      to: `/chat/${encodeURIComponent(chatKey('dm', [match[0].a, match[0].b]))}`,
    });
  } else if (waiting) {
    out.push({
      id: 'meets',
      tag: 'знакомства',
      tone: 'warm',
      icon: 'spark',
      title: `${waiting} ${plural(waiting, 'человек ждёт', 'человека ждут', 'человек ждут')} ответа`,
      sub: 'Предложения этой недели',
      to: '/meet',
    });
  }

  const post = feedPosts(state).find((p) => p.userId !== user.id);
  if (post) {
    const author = userById(state, post.userId);
    out.push({
      id: `post-${post.id}`,
      tag: 'в ленте',
      tone: undefined,
      icon: post.photo ? 'camera' : 'message',
      title: post.text,
      sub: `${author?.name} · ${dayLabel(post.at, now)}`,
      to: '/feed',
    });
  }

  const summit = summitVisible(state, now) ? summitEvent(state) : null;
  if (summit) {
    out.push({
      id: 'summit',
      tag: 'слёт',
      tone: 'violet',
      icon: 'star',
      title: 'Большой слёт сезона',
      sub: `${summit.place} · финал трёх месяцев`,
      to: '/summit',
    });
  }

  return out.slice(0, 3);
}

/** «сегодня / вчера / 3 дня назад» — короче, чем полная дата. */
function dayLabel(at, now) {
  const days = Math.floor((now - at) / DAY);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
}

export function isViewed(state, materialId, userId) {
  return Boolean(state.views[`${materialId}:${userId}`]);
}

export function archiveCount(state) {
  return state.materials.filter((m) => m.seasonId < state.season.id).length;
}
