import { useEffect, useState } from 'react';
import { useStore } from './useStore.ts';
import { onIncoming, onFriendOnline, activeChatId, unreadIn, store, openDm } from './lib/store.ts';
import type { Msg } from './lib/store.ts';
import { previewText } from './lib/protocol.ts';
import { play, envelope, flower } from './lib/aska.ts';
import { Welcome } from './components/Welcome.tsx';
import { Contacts } from './components/Contacts.tsx';
import { ChatView } from './components/ChatView.tsx';
import { Aux } from './components/Aux.tsx';
import type { AuxKind } from './components/Aux.tsx';
import { Svg } from './components/Win.tsx';

function chatFromHash(): string | null {
  const m = location.hash.match(/chat=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

interface Toast { chatId?: string; userId?: number; name: string; text: string; online?: boolean }

export default function App() {
  const s = useStore();
  const [chat, setChat] = useState<string | null>(chatFromHash);
  const [aux, setAux] = useState<AuxKind | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (location.hash.includes('chat=')) history.replaceState(null, '', location.pathname);
    // Нажали на уведомление, а приложение уже открыто.
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'open-chat' && typeof e.data.chatId === 'string') { setAux(null); setChat(e.data.chatId); }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (s.phase === 'ready' && location.hash.includes('invite=')) history.replaceState(null, '', location.pathname);
  }, [s.phase]);

  // «О-оу!» и всплывашка, когда пишут в другую беседу.
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const off = onIncoming((m: Msg) => {
      if (document.visibilityState !== 'visible') return;
      play('incoming');
      if (activeChatId() === m.chatId) return;
      const st = store.get();
      const c = st.chats[m.chatId];
      const sender = st.users[m.senderId]?.displayName || 'Кто-то';
      const text = m.body ? previewText(m.body) : 'новое сообщение';
      setToast({ chatId: m.chatId, name: c?.kind === 'dm' || !c ? sender : `${sender} · ${c.title || 'Общий чат'}`, text });
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setToast(null), 5000);
    });
    // Друг вошёл в сеть — как в ICQ: «User is online» и всплывашка.
    const offOnline = onFriendOnline((userId) => {
      if (document.visibilityState !== 'visible') return;
      play('online');
      const name = store.get().users[userId]?.displayName || 'Друг';
      setToast({ userId, name, text: 'в сети', online: true });
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setToast(null), 3500);
    });
    return () => { off(); offOnline(); clearTimeout(hideTimer); };
  }, []);

  if (s.phase === 'loading') return <div className="desktop" />;
  if (s.phase === 'welcome') return <Welcome />;

  const openChat = (id: string) => { setAux(null); setChat(id); setToast(null); };
  const onToast = async (t: Toast) => {
    setToast(null);
    if (t.chatId) openChat(t.chatId);
    else if (t.userId) { try { openChat(await openDm(t.userId)); } catch { /* нет связи */ } }
  };
  const unread = Object.keys(s.chats).reduce((n, id) => n + unreadIn(id, s), 0);
  const chatOpen = chat && s.chats[chat] ? chat : null;
  const cls = ['desktop', chatOpen && 'mode-chat', aux && 'mode-aux', aux && 'focus-aux'].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div className="wins">
        <Contacts activeChat={chatOpen} onOpen={openChat} onSettings={() => setAux('settings')} onInvite={() => setAux('invite')} />
        {aux && <Aux kind={aux} onBack={() => setAux(null)} />}
        {chatOpen && <ChatView key={chatOpen} chatId={chatOpen} onBack={() => setChat(null)} />}
      </div>
      {toast && (
        <div className="toast" onClick={() => onToast(toast)}>
          <Svg html={toast.online ? flower('online', 22) : envelope(22)} />
          <div className="t"><b>{toast.name}</b><div>{toast.text}</div></div>
        </div>
      )}
      <nav className="tabbar">
        <button className={!aux ? 'on' : ''} onClick={() => { setAux(null); setChat(null); }}>
          <i>💬</i><span>Чаты</span>{unread > 0 && <b className="tb-badge">{unread}</b>}
        </button>
        <button className={aux === 'invite' ? 'on' : ''} onClick={() => setAux('invite')}>
          <i>➕</i><span>Позвать</span>
        </button>
        <button className={aux === 'settings' ? 'on' : ''} onClick={() => setAux('settings')}>
          <i>☰</i><span>Ещё</span>
        </button>
      </nav>
    </div>
  );
}
