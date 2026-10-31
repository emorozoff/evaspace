// Формат сообщений внутри шифра. Его видят только участники чата.
import { boxFor, openFrom, utf8, fromUtf8, fromB64 } from './crypto.ts';
import type { Bytes } from './crypto.ts';
import { cleanGif } from './gifspec.ts';
import type { GifSpec } from './gifspec.ts';

export interface ImageRef {
  blob: string;      // id зашифрованного файла на сервере
  key: string;       // ключ файла
  nonce: string;
  hash: string;      // SHA-256 расшифрованного файла — проверка, что файл не подменили
  w: number;
  h: number;
  mime: string;
  thumb?: string;    // крошечное превью (data URL), показываем, пока грузится фото
}

// Видеоквадратик (до 20 секунд, у Голд и Блэк — до 40) или видео из галереи: файл зашифрован так же, как фото
export interface VideoRef {
  blob: string;
  key: string;
  nonce: string;
  hash: string;
  mime: string;
  dur: number;       // длительность, секунды
  thumb?: string;    // первый кадр (data URL), пока видео не скачалось
  w?: number; h?: number; // у видео из галереи — размеры (квадратик рисуется квадратом)
  sq?: boolean;      // true — видеоквадратик с камеры, false — обычное видео
}
// Музыка или звук из файлов телефона
export interface AudioRef { blob: string; key: string; nonce: string; hash: string; mime: string; dur: number; name?: string }
// Видеоквадратик от Аськи-ассистента: рисуется в приложении (Аська говорит по строчкам, с субтитрами и голосом)
export interface ClipRef { lines: string[]; mood?: string }

export interface Body {
  kind: 'text' | 'image' | 'video' | 'audio';
  text?: string;
  reply?: number;    // id сообщения, на которое отвечаем
  image?: ImageRef;
  video?: VideoRef;
  audio?: AudioRef;
  gif?: GifSpec;     // живая гифка (из «живых гифок» или своя по ТЗ); в text — подпись для старых приложений
  clip?: ClipRef;
  act?: 'compliment' | 'question' | 'gift'; // просьба к личному ИИ друга: передать комплимент, вопрос или подарок
  gift?: string;
}

interface Inner extends Body {
  v: 1;
  chat: string;
  uuid: string;
}

export interface OutBox { to: number; n: string; c: string; pn?: string; pc?: string }
export interface Member { id: number; pk: Bytes }

export interface ServerRow {
  id: number;
  chatId: string;
  senderId: number;
  uuid: string;
  createdAt: number;
  n: string;
  c: string;
}

export function previewText(body: Body): string {
  if (body.kind === 'image') return body.text ? `📷 ${body.text}` : '📷 Фото';
  if (body.kind === 'video') return body.video?.sq === false ? '🎬 Видео' : '🎬 Видеоквадратик';
  if (body.kind === 'audio') return `🎵 ${body.audio?.name || 'Музыка'}`;
  if (body.clip) return '🎬 Видеоквадратик от Аськи';
  if (body.gif) return `🎞 ${body.gif.cap || 'Гифка'}`;
  const t = (body.text || '').replace(/\s+/g, ' ').trim();
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

export function encodeOutgoing(chatId: string, uuid: string, body: Body, members: Member[], myId: number, mySk: Bytes): OutBox[] {
  const inner: Inner = { v: 1, chat: chatId, uuid, ...body };
  const plain = utf8(JSON.stringify(inner));
  const preview = utf8(JSON.stringify({ t: previewText(body) }));
  return members.map((m) => {
    const box = boxFor(plain, m.pk, mySk);
    if (m.id === myId) return { to: m.id, ...box };
    const p = boxFor(preview, m.pk, mySk);
    return { to: m.id, n: box.n, c: box.c, pn: p.n, pc: p.c };
  });
}

export function decodeIncoming(row: ServerRow, senderPk: Bytes, mySk: Bytes): Body | null {
  const plain = openFrom({ n: row.n, c: row.c }, senderPk, mySk);
  if (!plain) return null;
  try {
    const inner = JSON.parse(fromUtf8(plain)) as Inner;
    // Сервер не может перенести сообщение в другой чат: чат и id записаны внутри шифра.
    if (inner.v !== 1 || inner.chat !== row.chatId || inner.uuid !== row.uuid) return null;
    const body: Body = { kind: inner.kind === 'image' || inner.kind === 'video' || inner.kind === 'audio' ? inner.kind : 'text' };
    if (typeof inner.text === 'string') body.text = inner.text.slice(0, 20000);
    if (Number.isInteger(inner.reply)) body.reply = inner.reply;
    if (body.kind === 'image' && inner.image && typeof inner.image.blob === 'string') body.image = inner.image;
    if (body.kind === 'video') {
      const v = inner.video;
      if (!v || typeof v.blob !== 'string' || typeof v.mime !== 'string' || !/^video\/[\w.+-]+(;.*)?$/.test(v.mime)) return { kind: 'text', text: '🎬 Видеоквадратик (не открылся)' };
      body.video = { blob: v.blob, key: String(v.key), nonce: String(v.nonce), hash: String(v.hash), mime: v.mime, dur: Math.max(0, Math.min(3600, Number(v.dur) || 0)),
        thumb: typeof v.thumb === 'string' && v.thumb.startsWith('data:image/') ? v.thumb : undefined,
        ...(v.sq === false ? { sq: false, w: Math.max(0, Math.min(10000, Number(v.w) || 0)), h: Math.max(0, Math.min(10000, Number(v.h) || 0)) } : {}) };
    }
    if (body.kind === 'audio') {
      const a = inner.audio;
      if (!a || typeof a.blob !== 'string' || typeof a.mime !== 'string' || !/^audio\/[\w.+-]+(;.*)?$/.test(a.mime)) return { kind: 'text', text: '🎵 Музыка (не открылась)' };
      body.audio = { blob: a.blob, key: String(a.key), nonce: String(a.nonce), hash: String(a.hash), mime: a.mime, dur: Math.max(0, Math.min(36000, Number(a.dur) || 0)),
        name: typeof a.name === 'string' ? a.name.slice(0, 80) : undefined };
    }
    if (inner.gif) { const g = cleanGif(inner.gif); if (g) body.gif = g; }
    if (inner.clip && Array.isArray(inner.clip.lines)) {
      const lines = inner.clip.lines.filter((l): l is string => typeof l === 'string').map((l) => l.slice(0, 220)).slice(0, 8);
      if (lines.length) body.clip = { lines, mood: typeof inner.clip.mood === 'string' ? inner.clip.mood.slice(0, 20) : undefined };
    }
    return body;
  } catch {
    return null;
  }
}

export function decodePreview(pn: string, pc: string, senderPk: Bytes, mySk: Bytes): string | null {
  const plain = openFrom({ n: pn, c: pc }, senderPk, mySk);
  if (!plain) return null;
  try {
    const t = JSON.parse(fromUtf8(plain)).t;
    return typeof t === 'string' ? t : null;
  } catch {
    return null;
  }
}

export { fromB64 };
