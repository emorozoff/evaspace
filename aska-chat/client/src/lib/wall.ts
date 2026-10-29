// Стены: моя, друзей и «Стена АСЬКИ» — все стены в одной ленте. Стена не шифруется: её видят все в АСЬКЕ.
import { api } from './api.ts';
import { prepareImage } from './images.ts';

export interface WallComment { id: number; authorId: number; text: string; createdAt: number }
export interface WallPost {
  id: number; wallId: number; authorId: number; kind: 'text' | 'photo' | 'card' | 'magnet'; text: string; createdAt: number;
  flowers: number; mine: boolean; comments: WallComment[]; card?: string; magnet?: string; photo?: { id: string; w: number; h: number }; best?: string;
}
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
export const postToWall = (userId: number, body: { kind: WallPost['kind']; text?: string; card?: string; magnet?: string; photo?: { id: string; w: number; h: number } }) =>
  api.post<{ post: WallPost; coins: number }>(`/wall/${userId}`, body);
export const giveFlower = (postId: number) => api.post<{ flowers: number }>(`/wall/posts/${postId}/flower`);
export const addComment = (postId: number, text: string) => api.post<{ comment: WallComment }>(`/wall/posts/${postId}/comments`, { text });
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
  | { type: 'wall_del'; postId: number };
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
