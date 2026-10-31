// Уровни, нетворк, «где я», реестр и цепочка блоков — запросы к серверу (server/src/tiers.js, network.js, catalog.js, ledger.js)
import { api } from './api.ts';
import type { Tier } from './store.ts';

export interface TierInfo { key: Tier; name: string; emoji: string; daily: number; invites: number; discount: number; night: boolean; catalogAdd: boolean; nightFree: boolean; perks: string[] }
export interface Levels {
  tier: Tier; tierUntil: number | null; coins: number; netSize: number; tiers: TierInfo[];
  gold: { price: number; days: number; net: number }; vipRegion: string | null; vipRegions: string[]; upass: string | null; blackChat: string | null;
  blackInvites: { id: number; createdAt: number; fromName: string }[]; canInviteBlack: boolean; isAdmin: boolean;
}
export const getLevels = () => api.get<Levels>('/levels');
export const buyGold = () => api.post<Levels>('/levels/gold', {});
export const setVipRegion = (region: string) => api.post<{ vipRegion: string }>('/levels/vip-region', { region });
export const setPlace = (place: string) => api.post<{ place: string }>('/me/place', { place });
export const inviteBlack = (userId: number) => api.post<{ ok: true }>('/levels/black-invite', { userId });
export const acceptBlack = (inviteId: number) => api.post<Levels>('/levels/black-accept', { inviteId });
export const adminSetTier = (userId: number, tier: Tier, days?: number) => api.post<{ tier: Tier }>(`/admin/users/${userId}/tier`, { tier, days });

export interface NetNode { id: number; name: string; plate: string | null; tier: Tier; blocked: boolean; size: number; joinedAt: number; depth: number; children: NetNode[] }
export interface Network {
  children: NetNode[]; lines: number[]; total: number; earned: number; netSize: number; invitedBy: Omit<NetNode, 'children' | 'joinedAt' | 'depth'> | null;
  bonuses: { lines: number[]; gold: number; penalty: number; netGold: number };
}
export const getNetwork = () => api.get<Network>('/network');

export type CatalogKind = 'music' | 'film' | 'book';
export interface CatalogItem {
  id: number; token: string; kind: CatalogKind; title: string; author: string; year: number | null; link: string | null; note: string;
  addedBy: number | null; addedByName: string; createdAt: number; block: number; hash: string;
  rights: 'none' | 'claimed' | 'verified' | 'rejected'; rightsBy: number | null; rightsByName: string | null; rightsNote: string; rightsBlock: number | null; synth: string | null;
}
export const listCatalog = (kind: CatalogKind, q = '') => api.get<{ items: CatalogItem[] }>(`/catalog?kind=${kind}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then((r) => r.items);
export const addCatalog = (b: { kind: CatalogKind; title: string; author: string; year?: number | null; link?: string; note?: string; claim?: boolean }) => api.post<{ item: CatalogItem }>('/catalog', b);
export const claimCatalog = (id: number) => api.post<{ item: CatalogItem }>(`/catalog/${id}/claim`, {});
export const catalogClaims = () => api.get<{ claims: CatalogItem[] }>('/admin/catalog').then((r) => r.claims);
export const decideClaim = (id: number, ok: boolean, note?: string) => api.post<{ item: CatalogItem }>(`/admin/catalog/${id}`, { ok, note });

export interface Block { block: number; kind: string; ref: string; actorId: number | null; data: Record<string, unknown>; prevHash: string; hash: string; at: number }
export const getLedger = () => api.get<{ blocks: Block[]; check: { ok: boolean; blocks: number; brokenAt?: number } }>('/ledger');
