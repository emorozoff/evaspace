import type { Chat, State, User } from './store.ts';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

export function dmPeer(chat: Chat, s: State): User | undefined {
  const other = chat.members.find((m) => m.userId !== s.me?.userId);
  return other ? s.users[other.userId] : undefined;
}

export function chatTitle(chat: Chat, s: State) {
  if (chat.kind === 'dm') return dmPeer(chat, s)?.displayName || 'Личный чат';
  return chat.title || 'Общий чат';
}

const pad = (n: number) => String(n).padStart(2, '0');
export const timeShort = (ts: number) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const startOfDay = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayKey = (ts: number) => startOfDay(ts);

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function listTime(ts: number) {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  if (day === today) return timeShort(ts);
  if (today - day <= 86_400_000 * 1.5) return 'вчера';
  if (today - day < 86_400_000 * 6.5) return WEEKDAYS[new Date(ts).getDay()];
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}

export function dayLabel(ts: number) {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  if (day === today) return 'Сегодня';
  if (today - day <= 86_400_000 * 1.5) return 'Вчера';
  const d = new Date(ts);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
