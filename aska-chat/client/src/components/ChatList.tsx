import { useState } from 'react';
import { useStore } from '../useStore.ts';
import { enablePush, unreadIn } from '../lib/store.ts';
import type { Chat, Msg, State } from '../lib/store.ts';
import { chatTitle, dmPeer, listTime } from '../lib/format.ts';
import { previewText } from '../lib/protocol.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { Avatar } from './Avatar.tsx';
import { GearIcon, ComposeIcon, BellIcon } from './Icons.tsx';

function lastOf(s: State, chatId: string): Msg | undefined {
  const list = s.messages[chatId];
  return list?.[list.length - 1];
}

function preview(s: State, chat: Chat, m?: Msg) {
  if (!m) return chat.kind === 'general' ? 'Здесь все, кого пригласили' : 'Нет сообщений';
  const text = m.body ? previewText(m.body) : '🔒 Не удалось расшифровать';
  if (m.senderId === s.me?.userId) return `Вы: ${text}`;
  if (chat.kind !== 'dm') return `${s.users[m.senderId]?.displayName || '?'}: ${text}`;
  return text;
}

export function PushBanner() {
  const s = useStore();
  const [error, setError] = useState('');
  if (s.pushState === 'subscribed') return null;
  if (s.pushState === 'unsupported') {
    if (!isIOS || isStandalone) return null;
    return (
      <div className="banner">
        <BellIcon />
        <div>Уведомления работают, только если открыть «АСЬКА» с экрана «Домой».</div>
      </div>
    );
  }
  if (s.pushState === 'denied') {
    return (
      <div className="banner">
        <BellIcon />
        <div>Уведомления выключены. Включи их в «Настройки» iPhone → «Уведомления» → «АСЬКА».</div>
      </div>
    );
  }
  return (
    <div className="banner">
      <BellIcon />
      <div className="banner-text">
        Включи уведомления, чтобы не пропускать сообщения.
        {error && <div className="error">{error}</div>}
      </div>
      <button className="pill" onClick={() => enablePush().catch(() => setError('Не получилось. Попробуй ещё раз.'))}>Включить</button>
    </div>
  );
}

export function ChatList({ onOpen, onSettings, onNew }: { onOpen: (id: string) => void; onSettings: () => void; onNew: () => void }) {
  const s = useStore();
  const chats = Object.values(s.chats).sort((a, b) => {
    const la = lastOf(s, a.id)?.createdAt ?? (a.kind === 'general' ? 1 : 0);
    const lb = lastOf(s, b.id)?.createdAt ?? (b.kind === 'general' ? 1 : 0);
    return lb - la;
  });

  return (
    <div className="screen">
      <header className="header">
        <div className="header-row">
          <button className="icon-btn" onClick={onSettings} aria-label="Настройки"><GearIcon /></button>
          <div className="header-title">{s.online ? 'Чаты' : <span className="connecting">Подключение…</span>}</div>
          <button className="icon-btn" onClick={onNew} aria-label="Новый чат"><ComposeIcon /></button>
        </div>
      </header>
      <div className="scroll list-bg">
        <PushBanner />
        {chats.map((chat) => {
          const last = lastOf(s, chat.id);
          const unread = unreadIn(chat.id, s);
          const peer = chat.kind === 'dm' ? dmPeer(chat, s) : undefined;
          return (
            <button key={chat.id} className="chat-row" onClick={() => onOpen(chat.id)}>
              {chat.kind === 'dm' ? <Avatar name={peer?.displayName} id={peer?.id} size={54} /> : <Avatar group size={54} />}
              <div className="chat-main">
                <div className="chat-top">
                  <span className="chat-name">{chatTitle(chat, s)}</span>
                  {last && <span className="chat-time">{listTime(last.createdAt)}</span>}
                </div>
                <div className="chat-bottom">
                  <span className="chat-preview">{preview(s, chat, last)}</span>
                  {unread > 0 && <span className="badge">{unread}</span>}
                </div>
              </div>
            </button>
          );
        })}
        {chats.length <= 1 && (
          <p className="empty-hint">Чтобы написать кому-то лично, нажми <ComposeIcon /> вверху справа.</p>
        )}
      </div>
    </div>
  );
}
