// Формат сообщений внутри шифра. Его видят только участники чата.
import { boxFor, openFrom, utf8, fromUtf8, fromB64 } from './crypto.ts';
import type { Bytes } from './crypto.ts';

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

// Видео-квадратик (до 20 секунд): файл зашифрован так же, как фото
export interface VideoRef {
  blob: string;
  key: string;
  nonce: string;
  hash: string;
  mime: string;
  dur: number;       // длительность, секунды
  thumb?: string;    // первый кадр (data URL), пока видео не скачалось
}

export interface Body {
  kind: 'text' | 'image' | 'video';
  text?: string;
  reply?: number;    // id сообщения, на которое отвечаем
  image?: ImageRef;
  video?: VideoRef;
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
  if (body.kind === 'video') return '🎬 Видео-квадратик';
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
    const body: Body = { kind: inner.kind === 'image' || inner.kind === 'video' ? inner.kind : 'text' };
    if (typeof inner.text === 'string') body.text = inner.text.slice(0, 20000);
    if (Number.isInteger(inner.reply)) body.reply = inner.reply;
    if (body.kind === 'image' && inner.image && typeof inner.image.blob === 'string') body.image = inner.image;
    if (body.kind === 'video') {
      const v = inner.video;
      if (!v || typeof v.blob !== 'string' || typeof v.mime !== 'string' || !/^video\/[\w.+-]+(;.*)?$/.test(v.mime)) return { kind: 'text', text: '🎬 Видео-квадратик (не открылось)' };
      body.video = { blob: v.blob, key: String(v.key), nonce: String(v.nonce), hash: String(v.hash), mime: v.mime, dur: Math.max(0, Math.min(30, Number(v.dur) || 0)),
        thumb: typeof v.thumb === 'string' && v.thumb.startsWith('data:image/') ? v.thumb : undefined };
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
