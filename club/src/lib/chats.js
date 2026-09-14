/* Разговоры клуба: команда, город, сообщества и личные. Здесь же —
   кто ведёт чат, правила и приветствие новым участникам. */
import { uid } from './format.js';
import { cityMembers } from './events.js';
import { userById, cityById } from './club.js';
import { teamOf } from './teams.js';
import { matchedWith } from './meet.js';
import { COMMUNITIES } from '../data/communities.js';

/* ---------- разговоры ---------- */

/** Ключ разговора: у команды и города он один на всех, у людей — общий на двоих. */
export function chatKey(kind, ids) {
  return kind === 'dm' ? `dm:${[...ids].sort().join('|')}` : `${kind}:${ids[0]}`;
}

/* Кто ведёт чат. В команде это капитан и его зам, в городе — хранитель
   (организатор пятниц) и админы клуба. У ведущих есть право закрепить
   сообщение: чат без хозяина быстро превращается в свалку. */

export const CHAT_TITLES = {
  captain: 'Капитан',
  mate: 'Зам капитана',
  keeper: 'Хранитель',
  admin: 'Админ клуба',
};

export function chatCrew(state, key) {
  const [kind, rest] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  const crew = [];
  const push = (userId, role) => {
    const user = userById(state, userId);
    if (user && !crew.some((c) => c.user.id === user.id)) crew.push({ user, role });
  };

  if (kind === 'team') {
    const team = state.teams.find((t) => t.id === rest);
    if (team) {
      push(team.captainId, 'captain');
      push(team.mateId, 'mate');
    }
  }
  if (kind === 'city') {
    const city = cityById(state, rest);
    if (city) push(city.organizerId, 'keeper');
  }
  if (kind === 'com') {
    // Хранитель сообщества — тот, кто вступил первым: он его и держит
    const first = (state.communityMembers || []).filter((m) => m.communityId === rest).sort((a, b) => a.at - b.at)[0];
    if (first) push(first.userId, 'keeper');
  }
  if (kind !== 'dm') state.users.filter((u) => u.admin).forEach((u) => push(u.id, 'admin'));
  return crew;
}

/** Ведущие чата могут закреплять сообщения и следят за правилами. */
export function canPin(state, key, userId) {
  return chatCrew(state, key).some((c) => c.user.id === userId);
}

export function pinnedMessage(state, key) {
  const id = state.pins?.[key];
  return id ? state.messages.find((m) => m.id === id) || null : null;
}

/** Правила общие для всех чатов — их же участник видит при входе. */
export const CHAT_RULES = [
  'Без ссылок и рекламы — ни в сообщениях, ни в личных.',
  'Без оскорблений и осуждения: спорить о деле можно, о человеке нельзя.',
  'Пишите по делу чата: команде — про команду, городу — про встречи.',
  'Нарушение — удаление из клуба без возврата взноса.',
];

export const WELCOME_TEXT =
  'добро пожаловать. Здесь без ссылок и рекламы, без оскорблений и осуждения — ' +
  'нарушение значит удаление из клуба без возврата взноса. В остальном как дома: спрашивайте и рассказывайте.';

/**
 * Приветствие новому участнику чата. Пишется один раз на человека и чат,
 * поэтому мы помним выданные пары в state.welcomed: перезаход в приложение
 * не должен снова здороваться со всеми.
 */
export function greetInChats(state, now = Date.now()) {
  const done = new Set(state.welcomed || []);
  const added = [];
  const marks = [];

  const greet = (key, user) => {
    const mark = `${key}|${user.id}`;
    if (done.has(mark)) return;
    done.add(mark);
    marks.push(mark);
    added.push({
      id: uid('ms'),
      chat: key,
      userId: 'system',
      text: `${user.name.split(' ')[0]}, ${WELCOME_TEXT}`,
      at: now,
    });
  };

  state.members.forEach((m) => {
    const user = userById(state, m.userId);
    if (user) greet(chatKey('team', [m.teamId]), user);
  });
  state.cities.forEach((city) => {
    if (cityMembers(state, city.id).length < 2) return;
    cityMembers(state, city.id).forEach((user) => greet(chatKey('city', [city.id]), user));
  });
  (state.communityMembers || []).forEach((m) => {
    const user = userById(state, m.userId);
    if (user) greet(communityChat(m.communityId), user);
  });

  if (!added.length) return state;
  return { ...state, messages: [...state.messages, ...added], welcomed: [...(state.welcomed || []), ...marks] };
}

export function chatMessages(state, key) {
  return state.messages.filter((m) => m.chat === key).sort((a, b) => a.at - b.at);
}

export function lastMessage(state, key) {
  const list = chatMessages(state, key);
  return list[list.length - 1] || null;
}

/* Отметка «прочитано» хранится на пару участник+чат: в демо можно войти
   под разными людьми, и общий ключ показывал бы чужие непрочитанные. */
export const seenKey = (userId, chat) => `${userId}|${chat}`;

export function unreadIn(state, key, userId) {
  const seen = state.seen?.[seenKey(userId, key)] || 0;
  return chatMessages(state, key).filter((m) => m.at > seen && m.userId !== userId).length;
}

/** Все разговоры участника: команда, город и личные — в одном списке. */
export function chatsOf(state, userId) {
  const list = [];
  const team = teamOf(state, userId);
  if (team) list.push({ key: chatKey('team', [team.id]), kind: 'team', title: `Команда «${team.name}»`, team });
  const city = cityById(state, userById(state, userId)?.cityId);
  if (city && cityMembers(state, city.id).length >= 2) list.push({ key: chatKey('city', [city.id]), kind: 'city', title: `${city.name} · город`, city });
  communitiesOf(state, userId).forEach((c) =>
    list.push({ key: communityChat(c.id), kind: 'com', title: c.name, community: c })
  );
  matchedWith(state, userId).forEach((u) => list.push({ key: chatKey('dm', [userId, u.id]), kind: 'dm', title: u.name, user: u }));
  return list
    .map((c) => ({ ...c, last: lastMessage(state, c.key), unread: unreadIn(state, c.key, userId) }))
    .sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0));
}
/* ---------- сообщества ---------- */

/**
 * Сообщество — это чат с описанием и составом. Клубное одно и включает
 * всех; в остальные вступают сами. Города живут отдельной механикой
 * (пятницы, организатор), поэтому сюда не попадают.
 */
export function communityById(id) {
  return COMMUNITIES.find((c) => c.id === id) || null;
}

export const communityChat = (id) => chatKey('com', [id]);

export function communityMembers(state, id) {
  const community = communityById(id);
  if (!community) return [];
  if (community.kind === 'club') return state.users.filter((u) => u.active !== false);
  const ids = new Set((state.communityMembers || []).filter((m) => m.communityId === id).map((m) => m.userId));
  return state.users.filter((u) => ids.has(u.id) && u.active !== false);
}

export function inCommunity(state, id, userId) {
  if (communityById(id)?.kind === 'club') return true;
  return (state.communityMembers || []).some((m) => m.communityId === id && m.userId === userId);
}

/** Сообщества участника: клубное всегда, дальше те, куда он вступил. */
export function communitiesOf(state, userId) {
  return COMMUNITIES.filter((c) => inCommunity(state, c.id, userId));
}

/** Подсказка «вам сюда»: по увлечениям и сфере из анкеты. */
const COMMUNITY_HINTS = {
  ai: ['Автоматизация', 'Программист', 'ИТ-продукты', 'Научиться ИИ'],
  sales: ['Продажи', 'Маркетолог', 'Услуги и агентство'],
  content: ['Блогер', 'Креатор', 'Контент и блогинг', 'Фото и видео'],
  money: ['Инвестор', 'Финансы', 'Торговля'],
  sport: ['Падл и теннис', 'Горы и походы', 'Зал и бег'],
  night: ['Вино и рестораны', 'Караоке', 'Клубы и вечеринки'],
};

export function suggestedCommunities(state, userId) {
  const user = userById(state, userId);
  const mine = new Set(Object.values(user?.facts || {}).flat());
  return COMMUNITIES.filter((c) => c.kind === 'interest' && !inCommunity(state, c.id, userId))
    .map((c) => ({ community: c, hits: (COMMUNITY_HINTS[c.id] || []).filter((h) => mine.has(h)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.community);
}
