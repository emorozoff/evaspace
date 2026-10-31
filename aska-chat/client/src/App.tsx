import { CallLayer } from './components/Call.tsx';
import { useEffect, useState } from 'react';
import { useStore } from './useStore.ts';
import { onIncoming, onFriendOnline, activeChatId, unreadIn, store, openDm, dismissWelcomePlate, twinOf } from './lib/store.ts';
import type { Msg } from './lib/store.ts';
import { previewText } from './lib/protocol.ts';
import { play, envelope, flower } from './lib/aska.ts';
import { sfxOf, playSfx, superOf, playSuper } from './lib/sfx.ts';
import { Welcome, SuperLinkInApp, superFromUrl } from './components/Welcome.tsx';
import { Contacts } from './components/Contacts.tsx';
import { ChatView } from './components/ChatView.tsx';
import { Aux } from './components/Aux.tsx';
import type { AuxKind } from './components/Aux.tsx';
import { Svg, Dialog } from './components/Win.tsx';
import { Profile, CircleInfo } from './components/Profile.tsx';
import type { WallView } from './components/Wall.tsx';
import { Plate } from './components/Plate.tsx';
import { useDesign, useSplit, chatIsBiz } from './lib/space.ts';
import { VipPicker } from './components/Levels.tsx';

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
  const [wallView, setWallView] = useState<WallView>({ kind: 'feed' });
  const design = useDesign();
  const business = design === 'business';
  const night = design === 'night';
  const split = useSplit();
  const [vipAsk, setVipAsk] = useState(false);
  // в Ночь — сразу к комнатам
  useEffect(() => { if (night) { setChat(null); setAux('night'); } }, [night]);
  // Голд или Блэк без VIP-региона — один раз спросить: 777 или 888
  const tierNow = s.profile?.tier;
  useEffect(() => {
    if (s.phase !== 'ready' || !tierNow || tierNow === 'guest' || s.profile?.vipRegion) return;
    try { if (localStorage.getItem('aska-vip-asked') === '1') return; localStorage.setItem('aska-vip-asked', '1'); } catch { /* приватный режим */ }
    setVipAsk(true);
  }, [s.phase, tierNow, s.profile?.vipRegion]);

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
      // звуковой и супер-смайл звучат сами вместо «о-оу»
      const msgText = m.body?.kind === 'text' ? m.body.text : undefined;
      const sup = superOf(msgText);
      const sfx = sfxOf(msgText);
      if (sup) playSuper(sup.e); else if (sfx) playSfx(sfx.e); else play('incoming');
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
  // на вкладке «Чаты» — непрочитанное своего места (Личное или Бизнес), если они разделены
  const inSpace = (id: string) => !split || chatIsBiz(s, s.chats[id]) === business;
  const unread = unreadOf((id) => !isTwinChat(id) && inSpace(id));
  const twinUnread = unreadOf(isTwinChat);
  const chatOpen = chat && s.chats[chat] ? chat : null;
  const cls = ['desktop', chatOpen && 'mode-chat', aux && 'mode-aux', aux && 'focus-aux'].filter(Boolean).join(' ');
  const tab = (k: AuxKind | null) => { setAux(k); if (k) setChat(null); };

  return (
    <div className={cls}>
      <div className="wins">
        <Contacts activeChat={chatOpen} onOpen={openChat} onProfile={setProfile} onSettings={() => setAux('settings')} onInvite={() => setAux('invite')} onAux={setAux} />
        {aux && <Aux kind={aux} onBack={() => setAux(['admin', 'invite', 'levels', 'network', 'rules', 'history', 'book'].includes(aux) ? 'settings' : aux === 'ledger' ? 'music' : null)} onOpen={openChat} onAux={setAux}
          wallView={wallView} onWallView={setWallView} onProfile={setProfile} />}
        {chatOpen && <ChatView key={chatOpen} chatId={chatOpen} onBack={() => setChat(null)} onProfile={setProfile} onCircleInfo={setCircleInfo} onOpen={openChat} />}
      </div>
      {profile !== null && <Profile userId={profile} onClose={() => setProfile(null)} onOpenChat={openChat}
        onWall={(id) => { setProfile(null); setChat(null); setWallView({ kind: 'user', userId: id }); setAux('wall'); }} />}
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
      {vipAsk && <VipPicker first onClose={() => setVipAsk(false)} />}
      <CallLayer onOpenChat={openChat} />
      {night ? (
        <nav className="tabbar aska-night-tabs">
          <button className={aux === 'night' ? 'on' : ''} onClick={() => tab('night')}><i>🚪</i><span>Комнаты</span></button>
          <button className={aux === 'music' || aux === 'ledger' ? 'on' : ''} onClick={() => tab('music')}><i>🎵</i><span>Музыка</span></button>
          <button className={aux === 'films' ? 'on' : ''} onClick={() => tab('films')}><i>🎬</i><span>Кино</span></button>
          <button className={aux === 'books' ? 'on' : ''} onClick={() => tab('books')}><i>📚</i><span>Книги</span></button>
          <button className={!aux ? 'on' : ''} onClick={() => { setAux(null); setChat(null); }}>
            <i>💬</i><span>Чаты</span>{unread > 0 && <b className="tb-badge">{unread}</b>}
          </button>
          <button className={['settings', 'invite', 'admin', 'levels', 'network', 'rules'].includes(aux || '') ? 'on' : ''} onClick={() => tab('settings')}><i>☰</i><span>Ещё</span></button>
        </nav>
      ) : business ? (
        <nav className="tabbar aska-biz-tabs">
          <button className={!aux ? 'on' : ''} onClick={() => { setAux(null); setChat(null); }}>
            <i>💬</i><span>Чаты</span>{unread > 0 && <b className="tb-badge">{unread}</b>}
          </button>
          <button className={aux === 'biz' ? 'on' : ''} onClick={() => tab('biz')}>
            <i>📇</i><span>Контакты</span>
          </button>
          <button className={aux === 'myai' ? 'on' : ''} onClick={() => tab('myai')}>
            <i>🤖</i><span>Мой ИИ</span>{twinUnread > 0 && <b className="tb-badge">{twinUnread}</b>}
          </button>
          <button className={aux === 'settings' || aux === 'invite' || aux === 'admin' ? 'on' : ''} onClick={() => tab('settings')}>
            <i>☰</i><span>Ещё</span>
          </button>
        </nav>
      ) : (
      <nav className="tabbar">
        <button className={!aux ? 'on' : ''} onClick={() => { setAux(null); setChat(null); }}>
          <i>💬</i><span>Чаты</span>{unread > 0 && <b className="tb-badge">{unread}</b>}
        </button>
        <button className={aux === 'wall' ? 'on' : ''} onClick={() => { if (aux !== 'wall') setWallView({ kind: 'feed' }); tab('wall'); }}>
          <i>📌</i><span>Стена</span>{s.wallNew > 0 && <b className="tb-badge">{s.wallNew}</b>}
        </button>
        <button className={aux === 'circles' ? 'on' : ''} onClick={() => tab('circles')}>
          <i>⭕</i><span>Круги</span>
        </button>
        <button className={aux === 'plates' ? 'on' : ''} onClick={() => tab('plates')}>
          <i>🚗</i><span>Номера</span>
        </button>
        <button className={aux === 'myai' ? 'on' : ''} onClick={() => tab('myai')}>
          <i>🤖</i><span>Мой ИИ</span>{twinUnread > 0 && <b className="tb-badge">{twinUnread}</b>}
        </button>
        <button className={aux === 'settings' || aux === 'invite' || aux === 'admin' ? 'on' : ''} onClick={() => tab('settings')}>
          <i>☰</i><span>Ещё</span>
        </button>
      </nav>
      )}
    </div>
  );
}
