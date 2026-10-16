// Текст уведомления. Отдельно от sw.ts, чтобы проверять в тестах.
import { decodePreview } from './lib/protocol.ts';
import { fromB64 } from './lib/crypto.ts';
import type { Keys, LocalUser, LocalChat } from './lib/db.ts';

export interface PushData { t?: string; c?: string; s?: number; i?: number; pn?: string; pc?: string; b?: number }
export interface LocalView {
  keys?: Keys;
  users?: Record<number, LocalUser>;
  chats?: Record<string, LocalChat>;
}

export function buildNotification(data: PushData, view: LocalView): { title: string; body: string } {
  const sender = data.s !== undefined ? view.users?.[data.s] : undefined;
  const chat = data.c ? view.chats?.[data.c] : undefined;
  const isDm = chat ? chat.kind === 'dm' : Boolean(data.c?.startsWith('dm:'));
  const senderName = sender?.displayName || 'Кто-то';

  let text: string | null = null;
  if (data.pn && data.pc && sender && view.keys) {
    try { text = decodePreview(data.pn, data.pc, fromB64(sender.pk), fromB64(view.keys.sk)); } catch { text = null; }
  }

  if (isDm) return { title: senderName, body: text || 'Новое сообщение' };
  return { title: chat?.title || 'Общий чат', body: `${senderName}: ${text || 'новое сообщение'}` };
}
