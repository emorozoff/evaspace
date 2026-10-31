// Web3 АСЬКИ (тестовые механизмы UPASS): гифки по ТЗ, НФТ-галерея, биржа и копия цепочки блоков на этом телефоне.
// Списки гифок — те же, что в server/src/gifs.js (держать одинаковыми).
import { api } from './api.ts';
import { blobUrl } from './wall.ts';
import { kvGet, kvSet } from './db.ts';

// ---------- гифки ----------
export * from './gifspec.ts';
import type { GifSpec } from './gifspec.ts';
export const makeGif = (brief: string) => api.post<{ spec: GifSpec; title: string; by: 'ai' | 'rules' }>('/gifs/make', { brief });

// ---------- НФТ ----------
export type NftKind = 'gif' | 'photo' | 'video' | 'music';
export const NFT_KINDS: Record<NftKind, { icon: string; name: string }> = {
  gif: { icon: '🎞', name: 'Гифки' }, photo: { icon: '📷', name: 'Фото' }, video: { icon: '🎬', name: 'Видео' }, music: { icon: '🎵', name: 'Музыка' },
};
export const PHYSICAL: Record<string, string> = { ring: '💍 Кольцо', necklace: '📿 Ожерелье', bracelet: '⌚ Браслет', other: '🎁 Вещь' };
export interface NftRight { userId: number; name: string; share: number; role: 'author' | 'coauthor' }
export interface Nft {
  id: number; token: string; kind: NftKind; title: string; about: string; spec: GifSpec | null; brief: string; media: string | null; mime: string | null; mediaHash: string | null;
  w: number | null; h: number | null; dur: number | null; authorId: number; authorName: string; ownerId: number; ownerName: string; price: number; forSale: boolean;
  createdAt: number; block: number | null; rights: NftRight[]; physical: { kind: string; label: string; serial: string; note: string } | null;
  mine: boolean; iAmAuthor: boolean; trades: number;
}
export interface NftBlock { block: number; kind: string; ref: string; actorId: number | null; data: Record<string, unknown>; prevHash: string; hash: string; at: number }
export interface NftFull extends Nft {
  tradeList: { sellerId: number; sellerName: string; buyerId: number; buyerName: string; price: number; at: number; block: number }[];
  blocks: NftBlock[];
}
export interface MintBody {
  kind: NftKind; title: string; about?: string; media?: string; spec?: GifSpec; brief?: string; price?: number; forSale?: boolean;
  coauthors?: { userId: number; share: number }[]; physical?: { kind: string; serial: string; note?: string } | null; w?: number; h?: number; dur?: number;
}
export const nftList = (q: { kind?: string; mine?: boolean; authored?: boolean; sale?: boolean; before?: number }) => {
  const p = new URLSearchParams();
  if (q.kind) p.set('kind', q.kind);
  if (q.mine) p.set('mine', '1');
  if (q.authored) p.set('authored', '1');
  if (q.sale) p.set('sale', '1');
  if (q.before) p.set('before', String(q.before));
  return api.get<{ items: Nft[] }>(`/nft?${p}`).then((r) => r.items);
};
export const nftGet = (id: number) => api.get<{ nft: NftFull }>(`/nft/${id}`).then((r) => r.nft);
export const nftMint = (b: MintBody) => api.post<{ nft: Nft }>('/nft', b).then((r) => r.nft);
export const nftBuy = (id: number) => api.post<{ nft: Nft; payouts: { userId: number; coins: number }[] }>(`/nft/${id}/buy`);
export const nftPrice = (id: number, price: number, forSale: boolean) => api.post<{ nft: Nft }>(`/nft/${id}/price`, { price, forSale }).then((r) => r.nft);
export const nftPhysical = (id: number, p: { kind: string; serial: string; note?: string }) => api.post<{ nft: Nft }>(`/nft/${id}/physical`, p).then((r) => r.nft);
export const nftRemove = (id: number) => api.del<{ ok: boolean }>(`/nft/${id}`);
export async function nftUpload(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return api.uploadRaw<{ id: string; mime: string; kind: NftKind; hash: string; size: number }>('/nft/media', bytes, file.type || 'application/octet-stream');
}
const mediaUrls = new Map<string, Promise<string>>();
export function nftMediaUrl(id: string): Promise<string> {
  let p = mediaUrls.get(id);
  if (!p) {
    p = api.fetchBlob(`/nft/media/${id}`).then(blobUrl);
    p.catch(() => mediaUrls.delete(id));
    mediaUrls.set(id, p);
  }
  return p;
}

// ---------- биржа ----------
export interface FxInfo {
  date: string | null; source: 'cbr' | 'fallback'; rates: Record<string, number>; prev: Record<string, number> | null; approx: string[];
  ask: { usd: number; rub: number }; currencies: Record<string, { name: string; flag: string; sign: string }>;
  history: { date: string; rates: Record<string, number> }[];
  market: { trades24h: number; volume24h: number; tradesAll: number; volumeAll: number; nfts: number; forSale: number; last: { token: string; title: string; price: number; at: number; buyerName: string }[] };
  coins: { total: number; people: number };
}
export const getFx = () => api.get<FxInfo>('/fx');
// рублей за единицу; ASK — аськоин
export function rubPer(fx: FxInfo, code: string) {
  if (code === 'ASK') return fx.ask.rub;
  if (code === 'RUB') return 1;
  return fx.rates[code] || 0;
}
export const convert = (fx: FxInfo, amount: number, from: string, to: string) => {
  const r = rubPer(fx, to);
  return r ? (amount * rubPer(fx, from)) / r : 0;
};

// ---------- копия цепочки на телефоне ----------
export interface ChainBlock { id: number; kind: string; ref: string; actor: number | null; data: string; prev: string; hash: string; at: number }
export interface ChainCopy { blocks: ChainBlock[]; verifiedAt: number; ok: boolean; brokenAt?: number; tamperedAt?: number }
export const GENESIS = '0'.repeat(64);
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
// тот же хеш, что на сервере (server/src/ledger.js)
export async function blockHash(b: ChainBlock) {
  const s = `${b.prev}|${b.id}|${b.kind}|${b.ref}|${b.actor ?? ''}|${b.data}|${b.at}`;
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

// Скачать новые блоки, проверить каждый (ссылка на предыдущий и хеш), сверить свой старый блок с сервером,
// сохранить копию на телефоне и сообщить серверу, до какого блока проверено (телефон — «свидетель»).
export async function syncChain(): Promise<ChainCopy & { network?: { witnesses: number; atHead: number; blocks: number } }> {
  const copy: ChainCopy = (await kvGet('chain')) || { blocks: [], verifiedAt: 0, ok: true };
  let blocks = copy.blocks;
  const last = blocks[blocks.length - 1];
  // сверка: мой старый блок у сервера тот же? Если нет — кто-то переписал прошлое
  const probe = blocks.length ? blocks[Math.floor(Math.random() * blocks.length)] : null;
  type Page = { blocks: ChainBlock[]; head: { block: number; hash: string }; check: { block: number; hash: string } | null };
  let page = await api.get<Page>(`/ledger/chain?after=${last?.id || 0}${probe ? `&check=${probe.id}` : ''}`);
  if (probe && page.check && page.check.hash !== probe.hash) {
    const res = { ...copy, ok: false, tamperedAt: probe.id, verifiedAt: Date.now() };
    await kvSet('chain', res);
    return res;
  }
  let prev = last?.hash || GENESIS;
  let expected = (last?.id || 0) + 1;
  for (;;) {
    for (const b of page.blocks) {
      if (b.id !== expected || b.prev !== prev || (await blockHash(b)) !== b.hash) {
        const res = { blocks, ok: false, brokenAt: b.id, verifiedAt: Date.now() };
        await kvSet('chain', res);
        return res;
      }
      blocks = [...blocks, b];
      prev = b.hash;
      expected++;
    }
    if (page.blocks.length < 500) break;
    page = await api.get<Page>(`/ledger/chain?after=${expected - 1}`);
  }
  const res: ChainCopy = { blocks, ok: true, verifiedAt: Date.now() };
  await kvSet('chain', res);
  const head = blocks[blocks.length - 1];
  let network;
  if (head) {
    try { network = await api.post<{ witnesses: number; atHead: number; blocks: number }>('/ledger/witness', { block: head.id, hash: head.hash }); } catch { /* сеть */ }
  }
  return { ...res, network };
}
export const chainCopy = async (): Promise<ChainCopy | null> => (await kvGet('chain')) || null;
export const chainNetwork = () => api.get<{ witnesses: number; atHead: number; blocks: number; head: string }>('/ledger/network');
