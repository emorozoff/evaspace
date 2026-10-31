// Текст уведомления. Отдельно от sw.ts, чтобы проверять в тестах.
import { decodePreview } from './lib/protocol.ts';
import { fromB64 } from './lib/crypto.ts';
import type { Keys, LocalUser, LocalChat } from './lib/db.ts';

export interface PushData { t?: string; c?: string; s?: number; i?: number; pn?: string; pc?: string; b?: number; sn?: string; spk?: string; g?: number }
export interface LocalView {
  keys?: Keys;
  users?: Record<number, LocalUser>;
  chats?: Record<string, LocalChat>;
}

export function buildNotification(data: PushData, view: LocalView): { title: string; body: string } {
  const sender = data.s !== undefined ? view.users?.[data.s] : undefined;
  const chat = data.c ? view.chats?.[data.c] : undefined;
  const isDm = chat ? chat.kind === 'dm' || chat.kind === 'twin' : Boolean(data.c?.startsWith('dm:') || data.c?.startsWith('twin:'));
  // Аська и другие боты могут быть ещё не известны телефону — сервер присылает их имя и открытый ключ
  const senderName = sender?.displayName || data.sn || 'Кто-то';
  const senderPk = sender?.pk || data.spk;

  // 📞 звонок: текста нет — только кто звонит
  if (data.t === 'c') {
    if (!data.g) return { title: '📞 Звонок в АСЬКЕ', body: `${senderName} звонит тебе — открой, чтобы ответить` };
    const where = chat?.title ? ` в «${chat.title}»` : '';
    return { title: '📞 Групповой звонок', body: `${senderName} зовёт в звонок${where} — открой, чтобы присоединиться` };
  }

  let text: string | null = null;
  if (data.pn && data.pc && senderPk && view.keys) {
    try { text = decodePreview(data.pn, data.pc, fromB64(senderPk), fromB64(view.keys.sk)); } catch { text = null; }
  }

  if (isDm) return { title: senderName, body: text || 'Новое сообщение' };
  const title = chat?.kind === 'circle' ? `${chat.emoji || '⭕'} ${chat.title || 'Круг'}` : chat?.title || (data.c?.startsWith('circle:') ? 'Круг' : 'Общий чат');
  return { title, body: `${senderName}: ${text || 'новое сообщение'}` };
}
