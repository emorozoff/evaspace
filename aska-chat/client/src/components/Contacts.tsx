// Окно контактов: Аська сверху, закреплённые, «в сети» и «не в сети», мои круги и беседы с ИИ друзей.
// Нажал — открылась беседа, удержал — карточка человека.
import { useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useStore } from '../useStore.ts';
import { enablePush, openDm, unreadIn, typingIn, askaOf } from '../lib/store.ts';
import type { Chat, Msg, State, User } from '../lib/store.ts';
import { previewText } from '../lib/protocol.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { flower, envelope, logoFlower } from '../lib/aska.ts';
import { Win, Svg, Ico } from './Win.tsx';
import { UserPlate, Gold } from './Plate.tsx';

function lastOf(s: State, chatId?: string): Msg | undefined {
  if (!chatId) return undefined;
  const list = s.messages[chatId];
  return list?.[list.length - 1];
}

function dmWith(s: State, userId: number): Chat | undefined {
  return Object.values(s.chats).find((c) => c.kind === 'dm' && c.members.some((m) => m.userId === userId));
}

function preview(s: State, m: Msg | undefined, group: boolean): string | null {
  if (!m) return null;
  const text = m.body ? previewText(m.body) : '🔒 не удалось расшифровать';
  if (m.senderId === s.me?.userId) return `Ты: ${text}`;
  return group ? `${s.users[m.senderId]?.displayName || '?'}: ${text}` : text;
}

function PushPanel() {
  const s = useStore();
  const [error, setError] = useState('');
  if (s.pushState === 'subscribed') return null;
  let body;
  if (s.pushState === 'unsupported') {
    if (!isIOS || isStandalone) return null;
    body = <span className="t hint">Уведомления придут, только если открыть АСЬКУ с экрана «Домой».</span>;
  } else if (s.pushState === 'denied') {
    body = <span className="t hint">Уведомления выключены: «Настройки» iPhone → «Уведомления» → «АСЬКА».</span>;
  } else {
    body = (
      <>
        <span className="t">Включи уведомления, чтобы не пропускать «о-оу».{error && <span className="err"> {error}</span>}</span>
        <button className="btn" onClick={() => enablePush().catch(() => setError('Не получилось.'))}>Включить</button>
      </>
    );
  }
  return <div className="me-panel aska-push">{body}</div>;
}

interface Props {
  activeChat: string | null;
  onOpen: (chatId: string) => void;
  onProfile: (userId: number) => void;
  onSettings: () => void;
  onInvite: () => void;
  onAux: (k: 'circles' | 'myai' | 'settings' | 'plates') => void;
}

// Долгое нажатие на телефоне / правая кнопка на компьютере
function useLongPress(onLong: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const cancel = () => clearTimeout(timer.current);
  return {
    fired,
    handlers: {
      onTouchStart: () => { fired.current = false; timer.current = window.setTimeout(() => { fired.current = true; navigator.vibrate?.(10); onLong(); }, 500); },
      onTouchMove: cancel,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
      onContextMenu: (e: MouseEvent) => { e.preventDefault(); onLong(); },
    },
  };
}

function Item({ active, off, icon, blink, nick, sub, badge, onClick, onLong, title, extra }: {
  active?: boolean; off?: boolean; icon: string; blink?: boolean; nick: ReactNode; sub: ReactNode; badge?: number;
  onClick: () => void; onLong?: () => void; title?: string; extra?: ReactNode;
}) {
  const lp = useLongPress(onLong || (() => {}));
  return (
    <div className={`citem${active ? ' sel' : ''}${off ? ' off' : ''}`} title={title}
      onClick={() => { if (!lp.fired.current) onClick(); lp.fired.current = false; }} {...(onLong ? lp.handlers : {})}>
      <Ico className={`ico${blink ? ' blink' : ''}`} html={icon} />
      <span className="cmeta">
        <span className="nick">{nick}</span>
        <span className="sub">{sub}</span>
      </span>
      {extra}
      {badge ? <span className="badge">{badge}</span> : null}
    </div>
  );
}

export function Contacts({ activeChat, onOpen, onProfile, onSettings, onInvite, onAux }: Props) {
  const s = useStore();
  const me = s.me!.userId;
  const [closed, setClosed] = useState<Record<string, boolean>>({ twins: false });
  const [error, setError] = useState('');
  const myself = s.users[me];
  const aska = askaOf(s);
  const lastTime = (u: User) => lastOf(s, dmWith(s, u.id)?.id)?.createdAt ?? 0;
  const people = Object.values(s.users).filter((u) => u.id !== me && (u.kind || 'human') === 'human' && !u.blocked)
    .sort((a, b) => lastTime(b) - lastTime(a) || a.displayName.localeCompare(b.displayName, 'ru'));
  const pinned = people.filter((u) => s.pins.includes(u.id));
  const rest = people.filter((u) => !s.pins.includes(u.id));
  const online = rest.filter((u) => s.presence[u.id]);
  const offline = rest.filter((u) => !s.presence[u.id]);
  const circles = Object.values(s.chats).filter((c) => c.kind === 'general' || c.kind === 'circle')
    .sort((a, b) => (a.kind === 'general' ? -1 : b.kind === 'general' ? 1 : (lastOf(s, b.id)?.createdAt ?? 0) - (lastOf(s, a.id)?.createdAt ?? 0)));
  const twinChats = Object.values(s.chats).filter((c) => c.kind === 'twin')
    .sort((a, b) => (lastOf(s, b.id)?.createdAt ?? 0) - (lastOf(s, a.id)?.createdAt ?? 0));
  const status = s.connected ? 'online' : 'offline';

  async function openFriend(u: User) {
    setError('');
    try { onOpen(await openDm(u.id)); } catch { setError('Не получилось открыть беседу. Проверь интернет.'); }
  }

  const toggle = (key: string) => setClosed((c) => ({ ...c, [key]: !c[key] }));
  const group = (key: string, label: string, count: number) => (
    <div className="cgroup" onClick={() => toggle(key)}>
      <span className="box">{closed[key] ? '+' : '−'}</span>{label} <span className="cnt">({count})</span>
    </div>
  );

  const personItem = (u: User) => {
    const chat = dmWith(s, u.id);
    const unread = chat ? unreadIn(chat.id, s) : 0;
    const isOn = !!s.presence[u.id];
    const typing = chat && typingIn(chat.id, s).includes(u.id);
    const sub = typing ? <i className="aska-typing-sub">печатает…</i> : preview(s, lastOf(s, chat?.id), false) ?? (isOn ? 'в сети' : 'не в сети');
    return (
      <Item key={u.id} active={!!chat && chat.id === activeChat} off={!isOn} blink={!!unread}
        icon={unread ? envelope(16) : flower(isOn ? 'online' : 'offline', 16)}
        nick={<>{u.displayName}<Gold user={u} />{u.keyChanged ? ' ⚠' : ''}{s.guesses[u.id] === 'ai' ? ' 🤖' : ''}</>}
        sub={sub} badge={unread} onClick={() => openFriend(u)} onLong={() => onProfile(u.id)} title={u.displayName} />
    );
  };

  const askaChat = aska ? dmWith(s, aska.id) : undefined;
  const askaUnread = askaChat ? unreadIn(askaChat.id, s) : 0;

  return (
    <Win id="cwin" className="contacts" title="АСЬКА" icon={logoFlower(14)}
      extra={<button className="tbtn" onClick={onSettings} title="Настройки" aria-label="Настройки">☰</button>}>
      <div className="me-panel aska-me" onClick={() => onProfile(me)}>
        <Ico html={flower(status, 16)} />
        <span className="nick">{myself?.displayName || s.me?.username}<Gold user={myself} /></span>
        <span className="sp" />
        <UserPlate user={myself} size="s" />
      </div>
      <PushPanel />
      {/* на компьютере нижних вкладок нет — те же разделы кнопками */}
      <div className="aska-desk-nav">
        <button className="btn" onClick={() => onAux('circles')}>⭕ Круги</button>
        <button className="btn" onClick={() => onAux('plates')}>🚗 Номера</button>
        <button className="btn" onClick={() => onAux('myai')}>🤖 Мой ИИ</button>
        <button className="btn" onClick={() => onAux('settings')}>☰ Ещё</button>
      </div>
      {error && <div className="err aska-warn">{error}</div>}
      <div className="clist inset">
        {aska && (
          <Item active={!!askaChat && askaChat.id === activeChat} blink={!!askaUnread}
            icon={askaUnread ? envelope(16) : flower('chat', 16)}
            nick={<>Аська <span className="aska-tag">ИИ</span></>}
            sub={(askaChat && typingIn(askaChat.id, s).includes(aska.id)) ? <i className="aska-typing-sub">печатает…</i> : preview(s, lastOf(s, askaChat?.id), false) ?? 'спроси меня о чём угодно'}
            badge={askaUnread} onClick={() => openFriend(aska)} onLong={() => onProfile(aska.id)} />
        )}
        {pinned.length > 0 && (
          <>
            {group('pin', '📌 закреплённые', pinned.length)}
            {!closed.pin && pinned.map(personItem)}
          </>
        )}
        {group('on', 'в сети', online.length)}
        {!closed.on && online.map(personItem)}
        {group('off', 'не в сети', offline.length)}
        {!closed.off && offline.map(personItem)}
        {circles.length > 0 && (
          <>
            {group('circles', 'мои круги', circles.length)}
            {!closed.circles && circles.map((c) => {
              const unread = unreadIn(c.id, s);
              return (
                <Item key={c.id} active={c.id === activeChat} blink={!!unread}
                  icon={unread ? envelope(16) : flower('chat', 16)}
                  nick={<><span className="aska-emoji">{c.emoji || (c.kind === 'general' ? '🌼' : '⭕')}</span> {c.title || 'Общий чат'}</>}
                  sub={preview(s, lastOf(s, c.id), true) ?? (c.about || 'здесь пока тихо')} badge={unread} onClick={() => onOpen(c.id)} />
              );
            })}
          </>
        )}
        {twinChats.length > 0 && (
          <>
            {group('twins', 'ИИ друзей', twinChats.length)}
            {!closed.twins && twinChats.map((c) => {
              const twin = c.twin ? s.users[c.twin.twinId] : undefined;
              const unread = unreadIn(c.id, s);
              return (
                <Item key={c.id} active={c.id === activeChat} blink={!!unread}
                  icon={unread ? envelope(16) : flower('chat', 16)}
                  nick={<>{twin?.displayName || 'ИИ друга'}{c.twin?.anon ? ' 🕶' : ''}</>}
                  sub={preview(s, lastOf(s, c.id), false) ?? (c.twin?.anon ? 'анонимно' : 'открыто')} badge={unread} onClick={() => onOpen(c.id)} />
              );
            })}
          </>
        )}
        {!people.length && <div className="empty-note">Пока здесь только ты. Позови друзей — кнопка «+» внизу.</div>}
      </div>
      <div className="bottom-bar">
        <button className="btn status-btn" onClick={onSettings}>
          <Svg html={flower(status, 16)} />
          <span className="lab">{s.connected ? 'В сети' : 'Подключение…'}</span>
          <span className="sp" />
          <span>▾</span>
        </button>
        <button className="btn icon" onClick={onInvite} title="Позвать друга" aria-label="Позвать друга">+</button>
      </div>
      <div className="statusbar">
        <div className="cell">Людей: {people.length}, в сети: {people.filter((u) => s.presence[u.id]).length}</div>
        <div className="cell fit"><Svg html={flower(status, 12)} /> {s.connected ? 'в сети' : 'нет связи'}</div>
      </div>
    </Win>
  );
}
