// «Личное» и «Бизнес»: в стиле «Бизнес» — только рабочие переписки (Команда, Работа, Бизнес, Партнёры),
// в остальных стилях — личные. Разделять или показывать всё везде — настройка (по умолчанию разделять).
import { useSyncExternalStore } from 'react';
import { getDesign, onDesign } from './aska.ts';
import type { Design } from './aska.ts';
import type { Group, State, User, Chat } from './store.ts';

export type BizKey = 'team' | 'work' | 'biz' | 'partners';
export const BIZ_SECTIONS: { key: BizKey; label: string; emoji: string; empty: string }[] = [
  { key: 'team', label: 'Команда', emoji: '👥', empty: 'Коллеги, с кем делаешь общее дело' },
  { key: 'work', label: 'Работа', emoji: '💼', empty: 'Начальник, отдел, рабочие вопросы' },
  { key: 'biz', label: 'Бизнес', emoji: '📈', empty: 'Клиенты, сделки, заказы' },
  { key: 'partners', label: 'Партнёры', emoji: '🤝', empty: 'Подрядчики, поставщики, инвесторы' },
];
export const isBizGroup = (g?: Group | string): g is BizKey => g === 'team' || g === 'work' || g === 'biz' || g === 'partners';
export const bizOf = (key?: string) => BIZ_SECTIONS.find((x) => x.key === key);

const SPLIT_KEY = 'aska-biz-split';
const splitListeners = new Set<() => void>();
export function getSplit() {
  try { return localStorage.getItem(SPLIT_KEY) !== '0'; } catch { return true; }
}
export function setSplit(on: boolean) {
  try { localStorage.setItem(SPLIT_KEY, on ? '1' : '0'); } catch { /* приватный режим */ }
  splitListeners.forEach((l) => l());
}

export const useDesign = (): Design => useSyncExternalStore(onDesign, getDesign);
export const useSplit = (): boolean => useSyncExternalStore((l) => { splitListeners.add(l); return () => { splitListeners.delete(l); }; }, getSplit);

// Чьё это: человек или беседа — в «Бизнесе» или в «Личном»
export const groupOf = (s: State, userId: number): Group => s.groups[userId] || 'meet';
export const userIsBiz = (s: State, u: User) => isBizGroup(groupOf(s, u.id));
export function chatIsBiz(s: State, c: Chat): boolean {
  if (c.biz) return true;
  if (c.kind !== 'dm') return false;
  const other = c.members.find((m) => m.userId !== s.me?.userId);
  const u = other && s.users[other.userId];
  return !!u && (u.kind || 'human') === 'human' && userIsBiz(s, u);
}
