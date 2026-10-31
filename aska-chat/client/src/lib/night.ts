// 🌙 Ночь: комнаты-форумы, НФТ-аватары, пропуска по часам (server/src/night.js)
import { api } from './api.ts';

export type RankKey = 'president' | 'advisor' | 'keeper' | 'jedi' | 'samurai';
export interface NightRoom { key: string; title: string; emoji: string; theme: string; about: string; online?: number; last?: { nick: string; text: string; at: number } | null; president?: { id: number | null; nick: string; away?: boolean } | null }
export interface NightOverview {
  rooms: NightRoom[]; avatar: { id: number; nick: string; block: number | null } | null; canWrite: boolean; tier: string;
  prices: { nft: number; nftFull: number; hour: number }; ranks: { key: RankKey; name: string; emoji: string; seats: number | null }[];
}
export interface NightMsg { id: number; room: string; avatar: { id: number; nick: string; rank: RankKey; posts: number; rep: number }; text: string; at: number; thanks: number }
export interface Pass { until: number | null; unlimited: boolean; freeLeft: boolean }
export interface RoomView {
  room: NightRoom; messages: NightMsg[]; canWrite: boolean; pass: Pass | null;
  council: { president: { id: number | null; nick: string; away?: boolean } | null; advisors: { id: number; nick: string; rep: number }[]; keepers: { id: number; nick: string; rep: number }[]; jedi: { id: number; nick: string; rep: number }[]; samurai: number };
}
export const RANK_NAME: Record<RankKey, { name: string; emoji: string }> = {
  president: { name: 'Президент', emoji: '👑' }, advisor: { name: 'Советник', emoji: '🎩' }, keeper: { name: 'Хранитель', emoji: '🗝' },
  jedi: { name: 'Джедай', emoji: '⚔️' }, samurai: { name: 'Самурай', emoji: '🗡' },
};

export const nightOverview = () => api.get<NightOverview>('/night');
export const nightCollection = () => api.get<{ avatars: { id: number; taken: boolean }[] }>('/night/collection').then((r) => r.avatars);
export const mintAvatar = (id: number, nick: string) => api.post<{ avatar: { id: number; nick: string; block: number } }>('/night/avatar', { id, nick });
export const roomView = (key: string) => api.get<RoomView>(`/night/rooms/${key}`);
export const enterRoom = (key: string) => api.post<{ pass: Pass; free?: boolean }>(`/night/rooms/${key}/enter`, {});
export const payRoom = (key: string) => api.post<{ pass: Pass }>(`/night/rooms/${key}/pay`, {});
export const postNight = (key: string, text: string) => api.post<{ message: NightMsg }>(`/night/rooms/${key}/messages`, { text });
export const thankNight = (id: number) => api.post<{ thanks: number }>(`/night/messages/${id}/thanks`, {});
export const setPresident = (room: string, userId: number | null) => api.post<{ ok: true }>(`/admin/night/${room}/president`, { userId });

// живые сообщения комнат (WebSocket → store → сюда)
const listeners = new Set<(m: NightMsg) => void>();
export function onNight(l: (m: NightMsg) => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function emitNight(m: NightMsg) { listeners.forEach((l) => l(m)); }
