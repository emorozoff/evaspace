import { useEffect, useState } from 'react';
import { useStore } from './useStore.ts';
import { onIncoming, onFriendOnline, activeChatId, unreadIn, store, openDm, dismissWelcomePlate, twinOf } from './lib/store.ts';
import type { Msg } from './lib/store.ts';
import { previewText } from './lib/protocol.ts';
import { play, envelope, flower } from './lib/aska.ts';
import { sfxOf, playSfx } from './lib/sfx.ts';
import { Welcome, SuperLinkInApp, superFromUrl } from './components/Welcome.tsx';
import { Contacts } from './components/Contacts.tsx';
import { ChatView } from './components/ChatView.tsx';
import { Aux } from './components/Aux.tsx';
import type { AuxKind } from './components/Aux.tsx';
import { Svg, Dialog } from './components/Win.tsx';
import { Profile, CircleInfo } from './components/Profile.tsx';
import { Plate } from './components/Plate.tsx';

// Значки нижних вкладок: в Зумере — тонкие линии, в Миллениале — эмодзи (лишнее прячет стиль)
const TAB_ICONS: Record<string, string> = {
  chats: '<path d="M4 6.5A3.5 3.5 0 0 1 7.5 3h9A3.5 3.5 0 0 1 20 6.5v6a3.5 3.5 0 0 1-3.5 3.5H11l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A3.5 3.5 0 0 1 4 12.5z"/>',
  circles: '<circle cx="9" cy="10" r="5.2"/><circle cx="15" cy="10" r="5.2"/><circle cx="12" cy="15" r="5.2"/>',
  plates: '<rect x="2.5" y="7" width="19" height="10" rx="2.2"/><path d="M6 10.2v3.6M9 10.2h2.4v3.6H9M15.5 10.2v3.6M18 10.2v3.6"/>',
  myai: '<path d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9z"/><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
};
const TabIcon = ({ name, emoji }: { name: string; emoji: string }) => (
  <>
    <i className="tb-emo">{emoji}</i>
    <svg className="tb-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" dangerouslySetInnerHTML={{ __html: TAB_ICONS[name] }} />
  </>
);

function chatFromHash(): string | null {
  const m = location.hash.match(/chat=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

interface Toast { chatId?: string; userId?: number; name: string; text: string; online?: boolean; aux?: AuxKind }

export default function App() {
  const s = useStore();
  const [chat, setChat] = useState<string | null>(chatFromHash);
  const [aux, setAux] = useState<AuxKind | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [profile, setProfile] = useState<number | null>(null);
  const [circleInfo, setCircleInfo] = useState<string | null>(null);
  const [superCode, setSuperCode] = useState('');

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

  // Ссылка супер-админа, открытая уже внутри АСЬКИ (до входа её разбирает экран входа)
  useEffect(() => {
    if (s.phase !== 'ready') return;
    const check = () => { const c = superFromUrl(); if (c) setSuperCode(c); };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, [s.phase]);

  // «О-оу!» и всплывашка, когда пишут в другую беседу.
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const off = onIncoming((m: Msg) => {
      if (document.visibilityState !== 'visible') return;
      // звуковой смайл звучит сам вместо «о-оу»
      const sfx = m.body?.kind === 'text' ? sfxOf(m.body.text) : undefined;
      if (sfx) playSfx(sfx.e); else play('incoming');
      if (activeChatId() === m.chatId) return;
      const st = store.get();
      const c = st.chats[m.chatId];
      const sender = st.users[m.senderId]?.displayName || 'Кто-то';
      const text = m.body ? previewText(m.body) : 'новое сообщение';
      setToast({ chatId: m.chatId, name: c?.kind === 'dm' || c?.kind === 'twin' || !c ? sender : `${sender} · ${c.title || 'Общий чат'}`, text });
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

  // Бонус за первый вход дня — всплывашкой
  const bonus = s.profile?.bonus || 0;
  useEffect(() => {
    if (!bonus) return;
    setToast({ name: 'Аськоины 🪙', text: `+${bonus} за вход сегодня. Номера — во вкладке «Номера»`, aux: 'plates' });
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [bonus]);

  if (s.phase === 'loading') return <div className="desktop" />;
  if (s.phase === 'welcome') return <Welcome />;

  const openChat = (id: string) => { setAux(null); setChat(id); setToast(null); };
  const onToast = async (t: Toast) => {
    setToast(null);
    if (t.aux) { setChat(null); setAux(t.aux); } else if (t.chatId) openChat(t.chatId);
    else if (t.userId) { try { openChat(await openDm(t.userId)); } catch { /* нет связи */ } }
  };
  const chatIds = Object.keys(s.chats);
  const unreadOf = (pred: (id: string) => boolean) => chatIds.filter(pred).reduce((n, id) => n + unreadIn(id, s), 0);
  const myTwin = twinOf(s.me!.userId, s);
  const isTwinChat = (id: string) => !!myTwin && s.chats[id]?.kind === 'dm' && s.chats[id].members.some((m) => m.userId === myTwin.id);
  const unread = unreadOf((id) => !isTwinChat(id));
  const twinUnread = unreadOf(isTwinChat);
  const chatOpen = chat && s.chats[chat] ? chat : null;
  const cls = ['desktop', chatOpen && 'mode-chat', aux && 'mode-aux', aux && 'focus-aux'].filter(Boolean).join(' ');
  const tab = (k: AuxKind | null) => { setAux(k); if (k) setChat(null); };

  return (
    <div className={cls}>
      <div className="wins">
        <Contacts activeChat={chatOpen} onOpen={openChat} onProfile={setProfile} onSettings={() => setAux('settings')} onInvite={() => setAux('invite')} onAux={setAux} />
        {aux && <Aux kind={aux} onBack={() => setAux(aux === 'admin' || aux === 'invite' ? 'settings' : null)} onOpen={openChat} onAux={setAux} />}
        {chatOpen && <ChatView key={chatOpen} chatId={chatOpen} onBack={() => setChat(null)} onProfile={setProfile} onCircleInfo={setCircleInfo} onOpen={openChat} />}
      </div>
      {profile !== null && <Profile userId={profile} onClose={() => setProfile(null)} onOpenChat={openChat} />}
      {circleInfo && <CircleInfo chatId={circleInfo} onClose={() => setCircleInfo(null)} onProfile={(id) => { setCircleInfo(null); setProfile(id); }} />}
      {superCode && s.me && <SuperLinkInApp code={superCode} me={s.me.username} onClose={() => setSuperCode('')} />}
      {s.welcomePlate && (
        <Dialog title="Добро пожаловать в АСЬКУ!" onClose={dismissWelcomePlate}
          buttons={<button className="btn primary" onClick={dismissWelcomePlate}>Поехали! 🚗</button>}>
          <div className="aska-plate-reveal">
            <div className="hint">Твой номер в АСЬКЕ:</div>
            <Plate plate={s.welcomePlate} country={s.users[s.me!.userId]?.plateCountry || 'RU'} size="l" />
            <div className="hint">Им можно входить вместо телефона и делиться с друзьями. Аська уже пишет тебе 🌼</div>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" onClick={() => onToast(toast)}>
          <Svg html={toast.online ? flower('online', 22) : envelope(22)} />
          <div className="t"><b>{toast.name}</b><div>{toast.text}</div></div>
        </div>
      )}
      <nav className="tabbar">
        <button className={!aux ? 'on' : ''} onClick={() => { setAux(null); setChat(null); }}>
          <TabIcon name="chats" emoji="💬" /><span>Чаты</span>{unread > 0 && <b className="tb-badge">{unread}</b>}
        </button>
        <button className={aux === 'circles' ? 'on' : ''} onClick={() => tab('circles')}>
          <TabIcon name="circles" emoji="⭕" /><span>Круги</span>
        </button>
        <button className={aux === 'plates' ? 'on' : ''} onClick={() => tab('plates')}>
          <TabIcon name="plates" emoji="🚗" /><span>Номера</span>
        </button>
        <button className={aux === 'myai' ? 'on' : ''} onClick={() => tab('myai')}>
          <TabIcon name="myai" emoji="🤖" /><span>Мой ИИ</span>{twinUnread > 0 && <b className="tb-badge">{twinUnread}</b>}
        </button>
        <button className={aux === 'settings' || aux === 'invite' || aux === 'admin' ? 'on' : ''} onClick={() => tab('settings')}>
          <TabIcon name="more" emoji="☰" /><span>Ещё</span>
        </button>
      </nav>
    </div>
  );
}
