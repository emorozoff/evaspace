// Окно контактов: я, общий чат, друзья «в сети» и «не в сети». Нажал на друга — открылась беседа.
import { useState } from 'react';
import { useStore } from '../useStore.ts';
import { enablePush, openDm, unreadIn } from '../lib/store.ts';
import type { Chat, Msg, State, User } from '../lib/store.ts';
import { previewText } from '../lib/protocol.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { flower, envelope, logoFlower } from '../lib/aska.ts';
import { Win, Svg, Ico } from './Win.tsx';

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
  onSettings: () => void;
  onInvite: () => void;
}

export function Contacts({ activeChat, onOpen, onSettings, onInvite }: Props) {
  const s = useStore();
  const me = s.me!.userId;
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const myself = s.users[me];
  const general = Object.values(s.chats).find((c) => c.kind === 'general');
  const lastTime = (u: User) => lastOf(s, dmWith(s, u.id)?.id)?.createdAt ?? 0;
  const friends = Object.values(s.users).filter((u) => u.id !== me)
    .sort((a, b) => lastTime(b) - lastTime(a) || a.displayName.localeCompare(b.displayName, 'ru'));
  const online = friends.filter((u) => s.presence[u.id]);
  const offline = friends.filter((u) => !s.presence[u.id]);
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

  const friendItem = (u: User, isOn: boolean) => {
    const chat = dmWith(s, u.id);
    const unread = chat ? unreadIn(chat.id, s) : 0;
    const sub = preview(s, lastOf(s, chat?.id), false) ?? (isOn ? 'в сети' : 'не в сети');
    return (
      <div key={u.id} className={`citem${chat && chat.id === activeChat ? ' sel' : ''}${isOn ? '' : ' off'}`}
        onClick={() => openFriend(u)} title={`${u.displayName} · @${u.username}`}>
        <Ico className={`ico${unread ? ' blink' : ''}`} html={unread ? envelope(16) : flower(isOn ? 'online' : 'offline', 16)} />
        <span className="cmeta">
          <span className="nick">{u.displayName}{u.keyChanged ? ' ⚠' : ''}</span>
          <span className="sub">{sub}</span>
        </span>
        {unread > 0 && <span className="badge">{unread}</span>}
      </div>
    );
  };

  const generalUnread = general ? unreadIn(general.id, s) : 0;

  return (
    <Win id="cwin" className="contacts" title="АСЬКА" icon={logoFlower(14)}
      extra={<button className="tbtn" onClick={onSettings} title="Настройки" aria-label="Настройки">☰</button>}>
      <div className="me-panel">
        <Ico html={flower(status, 16)} />
        <span className="nick">{myself?.displayName || s.me?.username}</span>
        <span className="sp" />
        <span className="uin">@{s.me?.username}</span>
      </div>
      <PushPanel />
      {error && <div className="err aska-warn">{error}</div>}
      <div className="clist inset">
        {general && (
          <>
            {group('general', 'Общий чат', 1)}
            {!closed.general && (
              <div className={`citem${general.id === activeChat ? ' sel' : ''}`} onClick={() => onOpen(general.id)}>
                <Ico className={`ico${generalUnread ? ' blink' : ''}`} html={generalUnread ? envelope(16) : flower('chat', 16)} />
                <span className="cmeta">
                  <span className="nick">{general.title || 'Общий чат'}</span>
                  <span className="sub">{preview(s, lastOf(s, general.id), true) ?? 'здесь все, кого пригласили'}</span>
                </span>
                {generalUnread > 0 && <span className="badge">{generalUnread}</span>}
              </div>
            )}
          </>
        )}
        {group('on', 'в сети', online.length)}
        {!closed.on && online.map((u) => friendItem(u, true))}
        {group('off', 'не в сети', offline.length)}
        {!closed.off && offline.map((u) => friendItem(u, false))}
        {!friends.length && <div className="empty-note">Пока здесь только ты. Позови друзей — кнопка «+» внизу.</div>}
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
        <div className="cell">Друзей: {friends.length}, в сети: {online.length}</div>
        <div className="cell fit"><Svg html={flower(status, 12)} /> {s.connected ? 'в сети' : 'нет связи'}</div>
      </div>
    </Win>
  );
}
