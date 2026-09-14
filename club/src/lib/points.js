/* Баллы за активность и лента клуба: и то и другое считает,
   насколько человек в клубе живой. */
import { userById } from './club.js';

/* ---------- баллы за активность ---------- */

export const POINTS = {
  message: 2,
  rsvp: 3,
  attend: 10,
  match: 15,
  post: 20,
  meetPhoto: 25,
  revenue: 10,
};

export const POINT_LABELS = {
  message: 'Сообщение в чате',
  rsvp: 'Записался на встречу',
  attend: 'Пришёл на встречу',
  match: 'Метч на знакомстве',
  post: 'Пост в ленте',
  meetPhoto: 'Фото со встречи',
  revenue: 'Запись о выручке',
};

export function pointsOf(state, userId) {
  return userById(state, userId)?.points || 0;
}

/** Место в клубе по баллам — простая мерка активности. */
export function pointsRank(state, userId) {
  const sorted = [...state.users].filter((u) => u.active !== false).sort((a, b) => (b.points || 0) - (a.points || 0));
  return sorted.findIndex((u) => u.id === userId) + 1;
}
/* ---------- лента ---------- */

export const POST_TAGS = [
  { id: 'встреча', label: 'Встреча', icon: 'people', tone: 'accent' },
  { id: 'результат', label: 'Результат', icon: 'chart', tone: 'warm' },
  { id: 'команда', label: 'Команда', icon: 'team', tone: 'violet' },
  { id: 'вопрос', label: 'Вопрос', icon: 'bulb', tone: 'blue' },
];

/** Ответы под постом — тред, как в тредсах: первым сам пост, дальше разговор. */
export function repliesOf(state, postId) {
  return (state.postReplies || []).filter((r) => r.postId === postId).sort((a, b) => a.at - b.at);
}

export function feedPosts(state) {
  return [...state.posts].sort((a, b) => b.at - a.at);
}

export function tagOf(id) {
  return POST_TAGS.find((t) => t.id === id) || POST_TAGS[0];
}
