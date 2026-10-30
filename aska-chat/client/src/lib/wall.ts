// Стены: моя, друзей и «Стена АСЬКИ» — все стены в одной ленте. Стена не шифруется: её видят все в АСЬКЕ.
import { api } from './api.ts';
import { prepareImage } from './images.ts';

export interface WallComment { id: number; authorId: number; text: string; createdAt: number; sticker?: string }
export interface WallPost {
  id: number; wallId: number; authorId: number; kind: 'text' | 'photo' | 'card' | 'magnet' | 'sticker'; text: string; createdAt: number;
  flowers: number; mine: boolean; comments: WallComment[]; card?: string; magnet?: string; photo?: { id: string; w: number; h: number }; best?: string;
  reactions: Record<string, number>; myReaction?: string; tips: number; sticker?: string;
}

// те же, что на сервере (server/src/wall.js)
export const REACTIONS = ['👍', '❤️', '😂', '🔥', '😍', '😮', '😢', '👏', '💯', '💀'];
export const TIP_AMOUNTS = [5, 10, 25, 50];
// «Живые гифки» — анимированные мемы: эмодзи, подпись, фон, движение и эффект
export interface StickerDef { id: string; e: string; cap: string; bg: [string, string]; anim: string; fx?: 'rain' | 'confetti' | 'sparkle' | 'notes' | 'flash' }
export const STICKERS: StickerDef[] = [
  { id: 'oru', e: '😂', cap: 'ОРУ', bg: ['#ff9a3c', '#ff3d3d'], anim: 'shake' },
  { id: 'kringe', e: '😬', cap: 'КРИНЖ', bg: ['#c6f24a', '#5dbb2f'], anim: 'wobble' },
  { id: 'baza', e: '🗿', cap: 'ЭТО БАЗА', bg: ['#8a95a5', '#3b4250'], anim: 'zoom' },
  { id: 'fiasko', e: '😩', cap: 'ЭТО ФИАСКО, БРАТАН', bg: ['#5b8cff', '#3a2fb8'], anim: 'drop' },
  { id: 'zhiza', e: '💯', cap: 'ЖИЗА', bg: ['#ff6b8b', '#d4145a'], anim: 'pulse' },
  { id: 'imba', e: '🔥', cap: 'ИМБА', bg: ['#ffd23f', '#ff5e1a'], anim: 'flicker', fx: 'sparkle' },
  { id: 'vibe', e: '😎', cap: 'ВАЙБ', bg: ['#b06cff', '#ff5fb7'], anim: 'bob', fx: 'notes' },
  { id: 'redflag', e: '🚩', cap: 'РЕД ФЛАГ', bg: ['#ff5252', '#8e0000'], anim: 'wave' },
  { id: 'sigma', e: '🐺', cap: 'СИГМА', bg: ['#3a3f4b', '#0f1115'], anim: 'zoom' },
  { id: 'nuvse', e: '💀', cap: 'НУ ВСЁ, Я ВСЁ', bg: ['#4b2a6b', '#0d0d16'], anim: 'shake' },
  { id: 'lois', e: '👍', cap: 'ЛОЙС', bg: ['#4fc3ff', '#1565ff'], anim: 'bounce' },
  { id: 'shok', e: '😱', cap: 'ШОК КОНТЕНТ', bg: ['#fff04a', '#ff9500'], anim: 'zoomfast', fx: 'flash' },
  { id: 'kaif', e: '😌', cap: 'КАЙФ', bg: ['#2fd5b8', '#178a6a'], anim: 'float', fx: 'sparkle' },
  { id: 'plak', e: '😭', cap: 'ПЛАК-ПЛАК', bg: ['#7ec8ff', '#2867c9'], anim: 'sway', fx: 'rain' },
  { id: 'tusa', e: '🎉', cap: 'ТУСА', bg: ['#ff6fd8', '#ffd84a'], anim: 'spin', fx: 'confetti' },
  { id: 'ponyal', e: '🤝', cap: 'ПОНЯЛ, ПРИНЯЛ', bg: ['#4cd97b', '#14936b'], anim: 'bounce' },
  { id: 'kotik', e: '🐱', cap: 'КОТИК ОДОБРЯЕТ', bg: ['#ffcfa8', '#ff8fa3'], anim: 'nod' },
  { id: 'lyublyu', e: '💘', cap: 'ЛЮБЛЮ', bg: ['#ff8fb8', '#e8174f'], anim: 'beat', fx: 'sparkle' },
  { id: 'tancy', e: '🕺', cap: 'ТАНЦУЮТ ВСЕ', bg: ['#8c5cff', '#2f6bff'], anim: 'dance', fx: 'notes' },
  { id: 'hm', e: '🤔', cap: 'ХМ…', bg: ['#ffe0a8', '#e8a24c'], anim: 'tilt' },
  { id: 'mozg', e: '🤯', cap: 'МОЗГ ВСЁ', bg: ['#ff9e3d', '#7b2ff7'], anim: 'boom', fx: 'flash' },
  { id: 'gg', e: '🎮', cap: 'GG', bg: ['#1b2a6b', '#00c2ff'], anim: 'bounce' },
  { id: 'cvetok', e: '🌼', cap: 'ЦВЕТОЧЕК ТЕБЕ', bg: ['#7be08a', '#2fb36a'], anim: 'spinslow', fx: 'sparkle' },
  { id: 'pushka', e: '💣', cap: 'ПУШКА', bg: ['#3b0d0d', '#ff3b1f'], anim: 'shake', fx: 'flash' },
];
export const stickerOf = (id?: string) => STICKERS.find((x) => x.id === id);
export interface WallInfo { owner: number; posts: WallPost[]; fridge: { code: string; n: number }[]; stats: { posts: number; flowers: number } }

// те же, что на сервере (server/src/wall.js)
export const CARDS: { id: string; name: string }[] = [
  { id: 'flowers', name: 'Цветы' }, { id: 'sun', name: 'Доброе утро' }, { id: 'heart', name: 'Сердце' }, { id: 'star', name: 'Звёзды' },
  { id: 'cake', name: 'Тортик' }, { id: 'cat', name: 'Котик' }, { id: 'trip', name: 'Путешествие' }, { id: 'roses', name: 'Розы' },
  { id: 'candle', name: 'Свеча' }, { id: 'kiss', name: 'Поцелуй' }, { id: 'couple', name: 'Парочка' }, { id: 'tea', name: 'Чай' },
];
export const magnetPrice = (code: string) => (code === 'UR' ? 5 : code === 'AQ' || code === 'MOON' ? 50 : 10);
export const MAGNET_COUNT = 27;

export const wallFeed = (before = 0, top = false) => api.get<{ posts: WallPost[] }>(`/wall/feed?before=${before}${top ? '&top=1' : ''}`).then((r) => r.posts);
export const wallOf = (userId: number, before = 0) => api.get<WallInfo>(`/wall/${userId}?before=${before}`);
export const postToWall = (userId: number, body: { kind: WallPost['kind']; text?: string; card?: string; magnet?: string; sticker?: string; photo?: { id: string; w: number; h: number } }) =>
  api.post<{ post: WallPost; coins: number }>(`/wall/${userId}`, body);
export const giveFlower = (postId: number) => api.post<{ flowers: number }>(`/wall/posts/${postId}/flower`);
export const addComment = (postId: number, text: string, sticker?: string) => api.post<{ comment: WallComment }>(`/wall/posts/${postId}/comments`, { text, sticker });
export const reactTo = (postId: number, emoji: string | null) => api.post<{ reactions: Record<string, number>; myReaction: string | null }>(`/wall/posts/${postId}/react`, { emoji });
export const tipPost = (postId: number, amount: number) => api.post<{ tips: number; coins: number }>(`/wall/posts/${postId}/tip`, { amount });
export const deletePost = (postId: number) => api.del(`/wall/posts/${postId}`);

// Фото на стену: уменьшаем (и заодно убираем данные о месте съёмки) и загружаем
export async function photoToWall(userId: number, file: File | Blob, text = '') {
  const prep = await prepareImage(file instanceof File ? file : new File([file], 'photo.jpg', { type: file.type || 'image/jpeg' }));
  const { id } = await api.uploadWallPhoto(prep.bytes, prep.mime);
  return postToWall(userId, { kind: 'photo', text, photo: { id, w: prep.w, h: prep.h } });
}

// Картинки, уже лежащие в памяти (blob:-адрес → сама картинка): CSP не даёт читать blob: через fetch
const blobs = new Map<string, Blob>();
export function blobUrl(b: Blob) {
  const url = URL.createObjectURL(b);
  blobs.set(url, b);
  return url;
}
export const blobOf = async (url: string) => blobs.get(url) ?? (await fetch(url)).blob();

const photoUrls = new Map<string, Promise<string>>();
export function wallPhotoUrl(id: string): Promise<string> {
  let p = photoUrls.get(id);
  if (!p) {
    p = api.fetchBlob(`/wall/photo/${id}`).then(blobUrl);
    p.catch(() => photoUrls.delete(id));
    photoUrls.set(id, p);
  }
  return p;
}

// События стен с сервера (новая запись, цветочек, комментарий, удаление)
export type WallEvent =
  | { type: 'wall'; post: WallPost }
  | { type: 'wall_flower'; postId: number; flowers: number; by: number }
  | { type: 'wall_comment'; postId: number; comment: WallComment }
  | { type: 'wall_del'; postId: number }
  | { type: 'wall_react'; postId: number; reactions: Record<string, number>; by: number; emoji: string | null }
  | { type: 'wall_tip'; postId: number; tips: number; by: number; amount: number };
const listeners = new Set<(e: WallEvent) => void>();
export function onWall(l: (e: WallEvent) => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function emitWall(e: WallEvent) {
  for (const l of listeners) l(e);
}

// Сохранить картинку на телефон или компьютер: на iPhone — через «Поделиться» → «Сохранить изображение»
export async function saveImage(url: string, name = 'aska-photo.jpg') {
  const blob = await blobOf(url);
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file] }); return; } catch { /* отменили — сохраним файлом */ }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
