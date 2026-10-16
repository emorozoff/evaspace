import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { useStore } from '../useStore.ts';
import { sendText, sendImage, setActiveChat, retrySend, discardFailed, unreadIn } from '../lib/store.ts';
import type { Msg } from '../lib/store.ts';
import { chatTitle, dmPeer, dayKey, dayLabel, plural, timeShort } from '../lib/format.ts';
import { previewText } from '../lib/protocol.ts';
import { isTouch } from '../lib/platform.ts';
import { Avatar } from './Avatar.tsx';
import { EncryptedImage, ImageViewer } from './EncryptedImage.tsx';
import { Sheet } from './Sheet.tsx';
import type { SheetAction } from './Sheet.tsx';
import {
  BackIcon, PhotoIcon, SendIcon, CloseIcon, ReplyIcon, CheckIcon, DoubleCheckIcon, ClockIcon, DownIcon, LockIcon,
} from './Icons.tsx';

const drafts = new Map<string, string>();
const GROUP_GAP = 5 * 60 * 1000;
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

function linkify(t: string): ReactNode[] {
  return t.split(URL_RE).map((part, i) => (i % 2
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{part}</a>
    : part));
}

function msgPreview(m?: Msg) {
  if (!m) return 'Сообщение недоступно';
  return m.body ? previewText(m.body) : '🔒 Не удалось расшифровать';
}

interface BubbleProps {
  m: Msg;
  out: boolean;
  first: boolean;
  last: boolean;
  name?: string;
  quote?: { name: string; text: string } | null;
  read: boolean;
  flash: boolean;
  onMenu: (m: Msg) => void;
  onImage: (url: string) => void;
  onQuote: () => void;
}

function Bubble({ m, out, first, last, name, quote, read, flash, onMenu, onImage, onQuote }: BubbleProps) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const body = m.body;
  const isPhoto = body?.kind === 'image' && !!body.image;
  const photoOnly = isPhoto && !body?.text && !quote && !name;

  const cancel = () => { clearTimeout(timer.current); start.current = null; };
  const handlers = {
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onMenu(m); },
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      timer.current = window.setTimeout(() => { navigator.vibrate?.(10); onMenu(m); }, 450);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (start.current && Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > 10) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClick: () => { if (m.status === 'failed') onMenu(m); },
  };

  let status: ReactNode = null;
  if (out) {
    if (m.status === 'sending') status = <ClockIcon />;
    else if (m.status === 'failed') status = <span className="failed-mark">!</span>;
    else status = read ? <DoubleCheckIcon /> : <CheckIcon />;
  }

  return (
    <div id={`m-${m.id}`} className={`msg ${out ? 'out' : 'in'}${first ? ' first' : ''}${last ? ' last' : ''}${flash ? ' flash' : ''}`}>
      <div className={`bubble${photoOnly ? ' photo-only' : ''}${isPhoto ? ' has-photo' : ''}${m.status === 'failed' ? ' is-failed' : ''}`} {...handlers}>
        {name && <div className="sender">{name}</div>}
        {quote && (
          <div className="quote" onClick={(e) => { e.stopPropagation(); onQuote(); }}>
            <b>{quote.name}</b>
            <span>{quote.text}</span>
          </div>
        )}
        {!body && <span className="text muted">🔒 Не удалось расшифровать</span>}
        {isPhoto && <EncryptedImage image={body!.image!} local={m.localImage} onOpen={onImage} />}
        {body?.text && <span className="text">{linkify(body.text)}</span>}
        {!photoOnly && <span className={`meta-spacer${out ? ' out' : ''}`} />}
        <span className="meta">{timeShort(m.createdAt)}{status}</span>
      </div>
    </div>
  );
}

export function ChatView({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const s = useStore();
  const chat = s.chats[chatId];
  const list = s.messages[chatId] || [];
  const me = s.me!.userId;

  const [text, setText] = useState(drafts.get(chatId) || '');
  const [reply, setReply] = useState<Msg | null>(null);
  const [menu, setMenu] = useState<Msg | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [showDown, setShowDown] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const near = useRef(true);
  const lastCount = useRef(0);

  useEffect(() => {
    setActiveChat(chatId);
    return () => setActiveChat(null);
  }, [chatId]);
  useEffect(() => { drafts.set(chatId, text); }, [chatId, text]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = list.length > lastCount.current;
    const mineLast = list[list.length - 1]?.senderId === me;
    if (lastCount.current === 0 || (grew && (near.current || mineLast))) el.scrollTop = el.scrollHeight;
    lastCount.current = list.length;
  }, [list.length, me]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (near.current) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const t = inputRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
  }, [text]);

  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);

  if (!chat) {
    return (
      <div className="screen">
        <header className="header"><div className="header-row">
          <button className="icon-btn" onClick={onBack} aria-label="Назад"><BackIcon /></button>
          <div className="header-title">Чат</div><div className="icon-btn" />
        </div></header>
        <div className="scroll"><p className="empty-hint">Чат не найден.</p></div>
      </div>
    );
  }

  const others = chat.members.filter((m) => m.userId !== me);
  const peer = chat.kind === 'dm' ? dmPeer(chat, s) : undefined;
  const changed = chat.members.map((m) => s.users[m.userId]).filter((u) => u?.keyChanged);
  const subtitle = chat.kind === 'dm'
    ? (peer ? `@${peer.username}` : '')
    : `${chat.members.length} ${plural(chat.members.length, 'участник', 'участника', 'участников')}`;
  const otherUnread = Object.keys(s.chats).filter((id) => id !== chatId).reduce((n, id) => n + unreadIn(id, s), 0);

  function onScroll() {
    const el = scrollRef.current!;
    const isNear = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    near.current = isNear;
    setShowDown(!isNear);
  }

  function submit() {
    const t = text.trim();
    if (!t) return;
    setText('');
    const r = reply?.id;
    setReply(null);
    near.current = true;
    inputRef.current?.focus();
    sendText(chatId, t, r);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isTouch && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const r = reply?.id;
    setReply(null);
    near.current = true;
    for (const f of files) {
      try { await sendImage(chatId, f, r); } catch (err) { console.error(err); }
    }
  }

  function jumpTo(id: number) {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlash(id);
    setTimeout(() => setFlash(null), 1200);
  }

  const nameOf = (id: number) => (id === me ? 'Вы' : s.users[id]?.displayName || '?');

  const items: ReactNode[] = [];
  let prevDay = 0;
  list.forEach((m, i) => {
    const day = dayKey(m.createdAt);
    if (day !== prevDay) {
      items.push(<div className="day" key={`d${day}`}><span>{dayLabel(m.createdAt)}</span></div>);
      prevDay = day;
    }
    const prev = list[i - 1];
    const next = list[i + 1];
    const first = !prev || prev.senderId !== m.senderId || m.createdAt - prev.createdAt > GROUP_GAP || dayKey(prev.createdAt) !== day;
    const last = !next || next.senderId !== m.senderId || next.createdAt - m.createdAt > GROUP_GAP || dayKey(next.createdAt) !== day;
    const out = m.senderId === me;
    const replyId = m.body?.reply;
    const quoted = replyId ? byId.get(replyId) : undefined;
    items.push(
      <Bubble
        key={`${m.senderId}:${m.uuid}`}
        m={m}
        out={out}
        first={first}
        last={last}
        name={chat.kind !== 'dm' && !out && first ? s.users[m.senderId]?.displayName || '?' : undefined}
        quote={replyId ? { name: quoted ? nameOf(quoted.senderId) : '', text: msgPreview(quoted) } : null}
        read={out && !m.status && others.some((o) => o.readUpTo >= m.id)}
        flash={flash === m.id}
        onMenu={setMenu}
        onImage={setViewer}
        onQuote={() => replyId && jumpTo(replyId)}
      />,
    );
  });

  const actions: SheetAction[] = [];
  if (menu) {
    if (menu.status === 'failed') {
      actions.push({ label: 'Отправить ещё раз', run: () => retrySend(menu.uuid) });
      actions.push({ label: 'Удалить', danger: true, run: () => discardFailed(menu.uuid, chatId) });
    } else if (!menu.status) {
      actions.push({ label: 'Ответить', run: () => { setReply(menu); inputRef.current?.focus(); } });
    }
    const t = menu.body?.text;
    if (t) actions.push({ label: 'Скопировать текст', run: () => { navigator.clipboard?.writeText(t).catch(() => {}); } });
  }

  return (
    <div className="screen chat-screen">
      <header className="header">
        <div className="header-row">
          <button className="icon-btn back-btn" onClick={onBack} aria-label="Назад">
            <BackIcon />
            {otherUnread > 0 && <span className="back-badge">{otherUnread}</span>}
          </button>
          <div className="header-center">
            <div className="header-title">{chatTitle(chat, s)}</div>
            <div className="header-sub">{s.online ? subtitle : 'Подключение…'}</div>
          </div>
          <div className="header-avatar">
            {chat.kind === 'dm' ? <Avatar name={peer?.displayName} id={peer?.id} size={36} /> : <Avatar group size={36} />}
          </div>
        </div>
      </header>

      {changed.length > 0 && (
        <div className="warn">
          Ключ шифрования у {changed.map((u) => u!.displayName).join(', ')} изменился. Возможно, кто-то пытается подменить переписку.
          Сверь коды безопасности в настройках. Пока сообщения шифруются старым ключом.
        </div>
      )}

      <div className="scroll messages" ref={scrollRef} onScroll={onScroll}>
        {!list.length && (
          <div className="chat-empty">
            <LockIcon size={22} />
            <p>Сообщения защищены сквозным шифрованием. Их видят только участники чата.</p>
          </div>
        )}
        {items}
      </div>

      {showDown && (
        <button className="down-btn" onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })} aria-label="Вниз">
          <DownIcon />
        </button>
      )}

      {reply && (
        <div className="reply-bar">
          <ReplyIcon />
          <div className="reply-bar-main">
            <b>{nameOf(reply.senderId)}</b>
            <span>{msgPreview(reply)}</span>
          </div>
          <button className="icon-btn small" onClick={() => setReply(null)} aria-label="Отменить ответ"><CloseIcon size={18} /></button>
        </div>
      )}
      <div className="composer">
        <button className="icon-btn attach" onClick={() => fileRef.current?.click()} aria-label="Фото"><PhotoIcon /></button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Сообщение"
          enterKeyHint={isTouch ? 'enter' : 'send'}
        />
        <button className="send-btn" disabled={!text.trim()} onMouseDown={(e) => e.preventDefault()} onClick={submit} aria-label="Отправить">
          <SendIcon />
        </button>
      </div>

      {menu && (
        <Sheet title={<span className="sheet-quote">{msgPreview(menu)}</span>} actions={actions} onClose={() => setMenu(null)} />
      )}
      {viewer && <ImageViewer url={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
