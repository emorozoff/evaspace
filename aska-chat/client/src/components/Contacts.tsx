// Главная: карточка «я» (номер, статус, аськоины) и группы контактов — ИИ-друзья (Аська, Батя, личные ИИ друзей),
// Ближний круг, Знакомства, Работа, потом мои круги. Нажал — открылась беседа, удержал — карточка человека.
import { useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { useStore } from '../useStore.ts';
import { enablePush, openDm, unreadIn, typingIn, askaOf, aiFriendsOf } from '../lib/store.ts';
import type { Chat, Group, Msg, State, User } from '../lib/store.ts';
import { previewText } from '../lib/protocol.ts';
import { isIOS, isStandalone } from '../lib/platform.ts';
import { flower, envelope, logoFlower, userFlower } from '../lib/aska.ts';
import { statusLine } from '../lib/statuses.ts';
import { timeShort } from '../lib/format.ts';
import { Win, Svg, Ico } from './Win.tsx';
import { UserPlate, Gold } from './Plate.tsx';
import { StatusPicker } from './Status.tsx';

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

// Время последнего сообщения: сегодня — часы, раньше — дата
function when(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeShort(ts);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function PushPanel() {
  const s = useStore();
  const [error, setError] = useState('');
  if (s.pushState === 'subscribed') return null;
  let body;
  if (s.pushState === 'unsupported') {
    if (!isIOS || isStandalone) return null;
    body = <span className="t hint">🔔 Уведомления придут, только если открыть АСЬКУ с экрана «Домой».</span>;
  } else if (s.pushState === 'denied') {
    body = <span className="t hint">🔕 Уведомления выключены: «Настройки» iPhone → «Уведомления» → «АСЬКА».</span>;
  } else {
    body = (
      <>
        <span className="t">🔔 Включи уведомления, чтобы не пропускать «о-оу».{error && <span className="err"> {error}</span>}</span>
        <button className="btn" onClick={() => enablePush().catch(() => setError('Не получилось.'))}>Включить</button>
      </>
    );
  }
  return <div className="me-panel aska-push">{body}</div>;
}

type AuxTarget = 'circles' | 'myai' | 'settings' | 'plates' | 'admin' | 'wall';
interface Props {
  activeChat: string | null;
  onOpen: (chatId: string) => void;
  onProfile: (userId: number) => void;
  onSettings: () => void;
  onInvite: () => void;
  onAux: (k: AuxTarget) => void;
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

// Строка списка: цветочек-статус (у голд — золотой), имя, последнее сообщение или статус, время и счётчик
function Item({ active, off, icon, gold, blink, nick, sub, badge, at, onClick, onLong, title }: {
  active?: boolean; off?: boolean; icon: string; gold?: boolean; blink?: boolean; nick: ReactNode; sub: ReactNode; badge?: number; at?: string;
  onClick: () => void; onLong?: () => void; title?: string;
}) {
  const lp = useLongPress(onLong || (() => {}));
  return (
    <div className={`citem${active ? ' sel' : ''}${off ? ' off' : ''}${badge ? ' unread' : ''}`} title={title}
      onClick={() => { if (!lp.fired.current) onClick(); lp.fired.current = false; }} {...(onLong ? lp.handlers : {})}>
      <Ico className={`ico${blink ? ' blink' : ''}${gold ? ' gold' : ''}`} html={icon} />
      <span className="cmeta">
        <span className="nick">{nick}</span>
        <span className="sub">{sub}</span>
      </span>
      <span className="aska-side">
        {at && <span className="at">{at}</span>}
        {badge ? <span className="badge">{badge}</span> : null}
      </span>
    </div>
  );
}

const GROUPS: { key: Group; label: string; empty: string }[] = [
  { key: 'close', label: '💛 Ближний круг', empty: 'Тут самые близкие. Удержи контакт → «Группа» → «Ближний круг».' },
  { key: 'meet', label: '👋 Знакомства', empty: 'Новые люди появятся здесь.' },
  { key: 'work', label: '💼 Работа', empty: 'Коллеги и дела. Удержи контакт → «Группа» → «Работа».' },
];

export function Contacts({ activeChat, onOpen, onProfile, onSettings, onInvite, onAux }: Props) {
  const s = useStore();
  const me = s.me!.userId;
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const myself = s.users[me];
  const aska = askaOf(s);
  const friendsAi = aiFriendsOf(s);
  const lastTime = (u: User) => lastOf(s, dmWith(s, u.id)?.id)?.createdAt ?? 0;
  const people = Object.values(s.users).filter((u) => u.id !== me && (u.kind || 'human') === 'human' && !u.blocked && !s.hidden.includes(u.id));
  const sortPeople = (list: User[]) => [...list].sort((a, b) => Number(s.pins.includes(b.id)) - Number(s.pins.includes(a.id))
    || Number(!!s.presence[b.id]) - Number(!!s.presence[a.id]) || lastTime(b) - lastTime(a) || a.displayName.localeCompare(b.displayName, 'ru'));
  const groupOf = (u: User): Group => s.groups[u.id] || 'meet';
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
  const group = (key: string, label: string, count: ReactNode) => (
    <div className="cgroup" onClick={() => toggle(key)}>
      <span className="box">{closed[key] ? '+' : '−'}</span>{label} <span className="cnt">({count})</span>
    </div>
  );

  const subOf = (chat: Chat | undefined, u: User, fallback: string) => {
    if (chat && typingIn(chat.id, s).includes(u.id)) return <i className="aska-typing-sub">печатает…</i>;
    const last = lastOf(s, chat?.id);
    const st = statusLine(u.status);
    const unread = chat ? unreadIn(chat.id, s) : 0;
    if (last && (unread || !st)) return preview(s, last, false);
    return st || preview(s, last, false) || fallback;
  };

  const personItem = (u: User) => {
    const chat = dmWith(s, u.id);
    const unread = chat ? unreadIn(chat.id, s) : 0;
    const isOn = !!s.presence[u.id];
    return (
      <Item key={u.id} active={!!chat && chat.id === activeChat} off={!isOn} blink={!!unread}
        icon={unread ? envelope(16) : userFlower(u, isOn, 16)} gold={u.gold}
        nick={<>{u.displayName}<Gold user={u} />{s.pins.includes(u.id) ? <span className="aska-pin">📌</span> : null}{u.keyChanged ? ' ⚠' : ''}{s.guesses[u.id] === 'ai' ? ' 🤖' : ''}{u.status && <span className="aska-st-emo">{u.status.emoji}</span>}</>}
        sub={subOf(chat, u, isOn ? 'в сети' : 'не в сети')} badge={unread} at={when(lastOf(s, chat?.id)?.createdAt)}
        onClick={() => openFriend(u)} onLong={() => onProfile(u.id)} title={u.displayName} />
    );
  };

  // ИИ-друзья: Аська, Батя и беседы с личными ИИ друзей
  const aiItem = (u: User, fallback: string) => {
    const chat = dmWith(s, u.id);
    const unread = chat ? unreadIn(chat.id, s) : 0;
    const isOn = u.kind === 'aska' || !!s.presence[u.id];
    return (
      <Item key={u.id} active={!!chat && chat.id === activeChat} blink={!!unread}
        icon={unread ? envelope(16) : u.kind === 'aska' ? logoFlower(16) : '<span class="aska-ico-emo">👨</span>'}
        nick={<>{u.displayName} <span className="aska-tag">ИИ</span>{u.status && u.kind !== 'aska' && <span className="aska-st-emo">{u.status.emoji}</span>}</>}
        sub={subOf(chat, u, fallback)} badge={unread} at={when(lastOf(s, chat?.id)?.createdAt)}
        onClick={() => openFriend(u)} onLong={() => onProfile(u.id)} />
    );
  };
  const aiCount = (aska ? 1 : 0) + friendsAi.length + twinChats.length;

  const brainOff = s.profile?.isAdmin && s.brain && (!s.brain.key || !s.brain.people);

  return (
    <Win id="cwin" className="contacts" title="АСЬКА" icon={logoFlower(16)}
      extra={<button className="tbtn" onClick={onSettings} title="Настройки" aria-label="Настройки">☰</button>}>
      <div className={`me-panel aska-me${myself?.gold ? ' gold' : ''}`} onClick={() => onProfile(me)}>
        <Ico className={`ico${myself?.gold ? ' gold' : ''}`} html={userFlower(myself, s.connected, 16)} />
        <span className="aska-me-id">
          <span className="nick">{myself?.displayName || s.me?.username}<Gold user={myself} /></span>
          <button className="aska-me-status" onClick={(e) => { e.stopPropagation(); setStatusOpen(true); }}>
            {myself?.status ? statusLine(myself.status) : '＋ статус'}
          </button>
        </span>
        <span className="aska-me-plate" onClick={(e) => { e.stopPropagation(); onAux('plates'); }} title="Мои номера">
          <UserPlate user={myself} size="m" />
        </span>
      </div>
      {brainOff && (
        <button className="me-panel aska-brain-note" onClick={() => onAux('admin')}>
          <span>🧠</span>
          <span className="t"><b>{s.brain!.key ? 'ИИ-люди выключены' : 'Мозг ИИ не подключён'}</b>
            {s.brain!.key ? 'Включи их в «Управлении АСЬКОЙ» — и новые персонажи появятся.' : 'Без ключа Claude ИИ-люди спят, а Аська и Батя говорят по шпаргалке.'}</span>
          <span className="go">›</span>
        </button>
      )}
      <PushPanel />
      {/* на компьютере нижних вкладок нет — те же разделы кнопками */}
      <div className="aska-desk-nav">
        <button className="btn" onClick={() => onAux('wall')}><i>📌</i><span>Стена</span></button>
        <button className="btn" onClick={() => onAux('circles')}><i>⭕</i><span>Круги</span></button>
        <button className="btn" onClick={() => onAux('plates')}><i>🚗</i><span>Номера</span></button>
        <button className="btn" onClick={() => onAux('myai')}><i>🤖</i><span>Мой ИИ</span></button>
        <button className="btn" onClick={() => onAux('settings')}><i>☰</i><span>Ещё</span></button>
      </div>
      {error && <div className="err aska-warn">{error}</div>}
      <div className="clist inset">
        {aiCount > 0 && (
          <>
            {group('ai', '✨ ИИ-друзья', aiCount)}
            {!closed.ai && (
              <>
                {aska && aiItem(aska, 'спроси меня о чём угодно')}
                {friendsAi.map((u) => aiItem(u, u.about || 'ИИ-друг'))}
                {twinChats.map((c) => {
                  const twin = c.twin ? s.users[c.twin.twinId] : undefined;
                  const unread = unreadIn(c.id, s);
                  return (
                    <Item key={c.id} active={c.id === activeChat} blink={!!unread}
                      icon={unread ? envelope(16) : flower('chat', 16)}
                      nick={<>{twin?.displayName || 'ИИ друга'}{c.twin?.anon ? ' 🕶' : ''}</>}
                      sub={preview(s, lastOf(s, c.id), false) ?? (c.twin?.anon ? 'анонимно' : 'открыто')} badge={unread} at={when(lastOf(s, c.id)?.createdAt)}
                      onClick={() => onOpen(c.id)} />
                  );
                })}
              </>
            )}
          </>
        )}
        {GROUPS.map((g) => {
          const list = sortPeople(people.filter((u) => groupOf(u) === g.key));
          const on = list.filter((u) => s.presence[u.id]).length;
          return (
            <div key={g.key} className={`aska-grp g-${g.key}`}>
              {group(g.key, g.label, list.length ? `${on}/${list.length}` : 0)}
              {!closed[g.key] && list.map(personItem)}
              {!closed[g.key] && !list.length && <div className="aska-grp-empty">{g.empty}</div>}
            </div>
          );
        })}
        {circles.length > 0 && (
          <>
            {group('circles', '⭕ Мои круги', circles.length)}
            {!closed.circles && circles.map((c) => {
              const unread = unreadIn(c.id, s);
              const emoji = c.emoji || (c.kind === 'general' ? '🌼' : '⭕');
              return (
                <Item key={c.id} active={c.id === activeChat} blink={!!unread}
                  icon={unread ? envelope(16) : flower('chat', 16)}
                  nick={<><span className="aska-emoji">{emoji}</span> {c.title || 'Общий чат'}</>}
                  sub={preview(s, lastOf(s, c.id), true) ?? (c.about || 'здесь пока тихо')} badge={unread} at={when(lastOf(s, c.id)?.createdAt)}
                  onClick={() => onOpen(c.id)} />
              );
            })}
          </>
        )}
        {!people.length && <div className="empty-note">Пока здесь только ты и ИИ-друзья. Позови своих — кнопка «+» вверху.</div>}
      </div>
      <div className="bottom-bar">
        <button className="btn status-btn" onClick={() => setStatusOpen(true)}>
          <Svg html={userFlower(myself, s.connected, 16)} />
          <span className="lab">{!s.connected ? 'Подключение…' : myself?.status ? statusLine(myself.status) : 'В сети'}</span>
          <span className="sp" />
          <span>▾</span>
        </button>
        <button className="btn icon" onClick={onInvite} title="Позвать друга" aria-label="Позвать друга">+</button>
      </div>
      <div className="statusbar">
        <div className="cell">Людей: {people.length}, в сети: {people.filter((u) => s.presence[u.id]).length}</div>
        <div className="cell fit"><Svg html={flower(status, 12)} /> {s.connected ? 'в сети' : 'нет связи'}</div>
      </div>
      {statusOpen && <StatusPicker onClose={() => setStatusOpen(false)} />}
    </Win>
  );
}
