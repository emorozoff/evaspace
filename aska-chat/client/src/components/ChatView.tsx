// Окно беседы в стиле «Аськи»: шапка, история (пузыри в «Зумере», строчки в «Миллениале»), поле ввода, смайлы.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { useStore } from '../useStore.ts';
import { sendText, sendImage, sendVideo, setActiveChat, retrySend, discardFailed, sendTyping, typingIn, openTwinChat } from '../lib/store.ts';
import type { Msg } from '../lib/store.ts';
import { chatTitle, dmPeer, dayKey, plural, timeShort } from '../lib/format.ts';
import { previewText } from '../lib/protocol.ts';
import { isTouch } from '../lib/platform.ts';
import { flower, smiles, smileSvg, splitSmiles, play, playSmile, userFlower } from '../lib/aska.ts';
import { SFX, sfxOf, playSfx, isEmojiOnly, SUPER, superOf, playSuper } from '../lib/sfx.ts';
import { SuperSmile, SymbolGrid } from './SuperSmile.tsx';
import { statusLine } from '../lib/statuses.ts';
import { EncryptedImage, ImageViewer, load as loadImage } from './EncryptedImage.tsx';
import { ToWallDialog } from './Wall.tsx';
import { saveImage } from '../lib/wall.ts';
import { Win, Svg, Ico, Dialog } from './Win.tsx';
import { Gold } from './Plate.tsx';
import { VideoSquare, VideoRecorder, canRecordVideo } from './Video.tsx';
import { CallButton, CallBanner } from './Call.tsx';

const drafts = new Map<string, string>();
const GROUP_GAP = 5 * 60 * 1000;
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

function renderText(t: string): ReactNode[] {
  const out: ReactNode[] = [];
  t.split(URL_RE).forEach((part, i) => {
    if (i % 2) {
      out.push(<a key={`u${i}`} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{part}</a>);
      return;
    }
    splitSmiles(part).forEach((p, j) => {
      if ('text' in p) out.push(p.text);
      else {
        out.push(
          <span key={`s${i}-${j}`} className="sm" data-sm={p.smile} title={p.code}
            onClick={(e) => { e.stopPropagation(); playSmile(p.smile); }}
            dangerouslySetInnerHTML={{ __html: smileSvg(p.smile, 18) }} />,
        );
      }
    });
  });
  return out;
}

function dayLabel(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function msgPreview(m?: Msg) {
  if (!m) return 'сообщение недоступно';
  return m.body ? previewText(m.body) : '🔒 не удалось расшифровать';
}

interface LineProps {
  m: Msg;
  out: boolean;
  grp: boolean;
  isNew: boolean;
  name: string;
  gold: boolean;
  quote: { name: string; text: string } | null;
  read: boolean;
  flash: boolean;
  onMenu: (m: Msg) => void;
  onImage: (url: string) => void;
  onQuote: () => void;
}

function Line({ m, out, grp, isNew, name, gold, quote, read, flash, onMenu, onImage, onQuote }: LineProps) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const body = m.body;
  const cancel = () => { clearTimeout(timer.current); start.current = null; };
  // одни эмодзи — крупно и без пузыря; звуковой смайл звучит по нажатию
  const big = body?.kind === 'text' && !body.reply && isEmojiOnly(body.text);
  const sfx = big ? sfxOf(body?.text) : undefined;
  const sup = big ? superOf(body?.text) : undefined;

  let tick: ReactNode = null;
  if (out) {
    if (m.status === 'sending') tick = <span className="aska-tick" title="отправляется">…</span>;
    else if (m.status === 'failed') tick = <span className="aska-tick fail" title="не отправлено">!</span>;
    else tick = <span className="aska-tick" title={read ? 'прочитано' : 'доставлено'}>{read ? '✓✓' : '✓'}</span>;
  }

  return (
    <div
      id={`m-${m.id}`}
      className={`msg ${out ? 'me' : 'them'}${grp ? ' grp' : ''}${isNew ? ' new' : ''}${flash ? ' aska-flash' : ''}${m.status === 'failed' ? ' aska-failed' : ''}${big ? ' aska-big' : ''}${sfx ? ' aska-sfx' : ''}${sup ? ' aska-supermsg' : ''}${body?.kind === 'video' ? ' aska-vmsg' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); onMenu(m); }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY };
        timer.current = window.setTimeout(() => { navigator.vibrate?.(10); onMenu(m); }, 450);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (start.current && Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > 10) cancel();
      }}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
      onClick={() => { if (m.status === 'failed') onMenu(m); else if (sfx) playSfx(sfx.e); }}
    >
      <span className="hdr">
        <span className="nk">{name}{gold && <span className="aska-gold sm" title="Голд">★</span>}</span>{' '}
        <span className="time"><i>(</i>{timeShort(m.createdAt)}<i>)</i></span>
        {tick}
        <span className="cl">:</span>
      </span>{' '}
      <span className="txt">
        {quote && (
          <span className="aska-quote" onClick={(e) => { e.stopPropagation(); onQuote(); }}>
            <b>{quote.name}</b>{quote.text}
          </span>
        )}
        {!body && <i className="muted">🔒 не удалось расшифровать</i>}
        {body?.kind === 'image' && body.image && <EncryptedImage image={body.image} local={m.localImage} onOpen={onImage} />}
        {body?.kind === 'video' && body.video && <VideoSquare video={body.video} local={m.localImage} />}
        {body?.text && body.kind !== 'video' && (sup ? <SuperSmile e={sup.e} size="l" /> : big ? body.text : renderText(body.text))}
        {sfx && <span className="aska-sfx-ico" aria-label="звуковой смайл">🔊</span>}
      </span>
    </div>
  );
}

const GIFTS: { id: string; emoji: string; name: string }[] = [
  { id: 'flowers', emoji: '💐', name: 'Цветы' }, { id: 'coffee', emoji: '☕', name: 'Кофе' }, { id: 'cake', emoji: '🍰', name: 'Тортик' },
  { id: 'hug', emoji: '🤗', name: 'Обнимашки' }, { id: 'star', emoji: '⭐', name: 'Звёздочка' }, { id: 'heart', emoji: '💛', name: 'Сердечко' },
];
type Act = 'compliment' | 'question' | null;

interface ChatProps {
  chatId: string;
  onBack: () => void;
  onProfile: (userId: number) => void;
  onCircleInfo: (chatId: string) => void;
  onOpen: (chatId: string) => void;
}

export function ChatView({ chatId, onBack, onProfile, onCircleInfo, onOpen }: ChatProps) {
  const s = useStore();
  const chat = s.chats[chatId];
  const list = s.messages[chatId] || [];
  const me = s.me!.userId;

  const [text, setText] = useState(drafts.get(chatId) || '');
  const [reply, setReply] = useState<Msg | null>(null);
  const [menu, setMenu] = useState<Msg | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [toWall, setToWall] = useState<string | null>(null);
  const [smilesOpen, setSmilesOpen] = useState(false);
  const [smileTab, setSmileTab] = useState<'super' | 'sfx' | 'icq' | 'sym'>('super');
  const [flash, setFlash] = useState<number | null>(null);
  const [act, setAct] = useState<Act>(null);
  const [gifts, setGifts] = useState(false);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const near = useRef(true);
  const lastCount = useRef(0);
  const seenAtOpen = useRef<Set<string> | null>(null);
  if (!seenAtOpen.current) seenAtOpen.current = new Set(list.map((m) => `${m.senderId}:${m.uuid}`));

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

  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list]);
  if (!chat) return null;

  const others = chat.members.filter((m) => m.userId !== me);
  const peer = chat.kind === 'dm' ? dmPeer(chat, s) : chat.kind === 'twin' && chat.twin ? s.users[chat.twin.twinId] : undefined;
  const title = chatTitle(chat, s);
  const peerOnline = peer ? !!s.presence[peer.id] : false;
  const onlineCount = others.filter((m) => s.presence[m.userId]).length;
  const isAi = peer?.kind === 'aska' || peer?.kind === 'twin' || peer?.kind === 'friend';
  const icon = chat.kind === 'dm' && !isAi ? userFlower(peer, peerOnline, 14) : flower('chat', 14);
  const changed = chat.members.map((m) => s.users[m.userId]).filter((u) => u?.keyChanged);
  const typers = typingIn(chatId, s).filter((id) => id !== me);
  const twinOwner = peer?.kind === 'twin' && peer.ownerId ? s.users[peer.ownerId] : undefined;
  const friendTwin = chat.kind === 'twin' && twinOwner; // пишу личному ИИ друга
  const ownTwin = chat.kind === 'dm' && peer?.kind === 'twin' && peer.ownerId === me;
  const statusHint = !s.connected ? 'нет связи, переподключаюсь…'
    : typers.length ? (chat.kind === 'dm' || chat.kind === 'twin' ? 'печатает…' : `${typers.map((id) => s.users[id]?.displayName || '?').join(', ')} печата${typers.length > 1 ? 'ют' : 'ет'}…`)
      : peer?.kind === 'aska' ? 'ИИ · всегда на связи'
        : peer?.kind === 'friend' ? ['ИИ-друг', statusLine(peer.status)].filter(Boolean).join(' · ')
          : peer?.kind === 'twin' ? (chat.twin?.anon ? 'личный ИИ · анонимно' : 'личный ИИ')
            : chat.kind === 'dm' ? [peerOnline ? 'в сети' : 'не в сети', statusLine(peer?.status)].filter(Boolean).join(' · ')
            : `${chat.members.length} ${plural(chat.members.length, 'участник', 'участника', 'участников')}, в сети ${onlineCount}`;
  const nameOf = (id: number) => (id === me ? (s.users[me]?.displayName || 'Я') : s.users[id]?.displayName || '?');
  const openHead = () => {
    if (chat.kind === 'circle' || chat.kind === 'general') onCircleInfo(chatId);
    else if (chat.kind === 'twin' && twinOwner) onProfile(twinOwner.id);
    else if (peer) onProfile(peer.id);
  };

  function onScroll() {
    const el = scrollRef.current!;
    near.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  function submit() {
    const t = text.trim();
    if (!t) return;
    setText('');
    setSmilesOpen(false);
    const r = reply?.id;
    setReply(null);
    near.current = true;
    inputRef.current?.focus();
    play('sent');
    if (friendTwin && act) {
      sendText(chatId, `${act === 'compliment' ? '💐' : '❓'} ${t}`, r, { act });
      setAct(null);
    } else sendText(chatId, t, r);
  }

  function sendGift(g: { id: string; emoji: string; name: string }) {
    const t = text.trim();
    setGifts(false);
    setText('');
    near.current = true;
    play('sent');
    sendText(chatId, `${g.emoji} ${g.name}${t ? ` — ${t}` : ''}`, undefined, { act: 'gift', gift: g.id });
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
      try { await sendImage(chatId, f, r); play('sent'); } catch (err) { console.error(err); }
    }
  }

  function onVideo(blob: Blob, dur: number, thumb?: string) {
    const r = reply?.id;
    setReply(null);
    near.current = true;
    sendVideo(chatId, blob, dur, thumb, r).then(() => play('sent')).catch((err) => console.error(err));
  }

  // Звуковой смайл уходит сразу, как стикер
  function sendSfx(e: string) {
    playSfx(e);
    setSmilesOpen(false);
    near.current = true;
    sendText(chatId, e);
  }

  // Супер-смайл тоже уходит сразу: у друга он большой, с движением и звуком на 2 секунды
  function sendSuper(e: string) {
    playSuper(e);
    setSmilesOpen(false);
    near.current = true;
    sendText(chatId, e);
  }

  function addSymbol(sym: string) {
    setText((t) => (t && !/\s$/.test(t) ? `${t} ${sym} ` : `${t}${sym} `));
    inputRef.current?.focus();
  }

  function addSmile(code: string, id: string) {
    playSmile(id);
    setText((t) => (t && !/\s$/.test(t) ? `${t} ${code} ` : `${t}${code} `));
    inputRef.current?.focus();
  }

  function jumpTo(id: number) {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlash(id);
    setTimeout(() => setFlash(null), 1200);
  }

  const items: ReactNode[] = [];
  let prevDay = 0;
  list.forEach((m, i) => {
    const day = dayKey(m.createdAt);
    if (day !== prevDay) {
      items.push(<div className="day" key={`d${day}`}>{dayLabel(m.createdAt)}</div>);
      prevDay = day;
    }
    const prev = list[i - 1];
    const grp = !!prev && prev.senderId === m.senderId && m.createdAt - prev.createdAt <= GROUP_GAP && dayKey(prev.createdAt) === day;
    const out = m.senderId === me;
    const replyId = m.body?.reply;
    const quoted = replyId ? byId.get(replyId) : undefined;
    const key = `${m.senderId}:${m.uuid}`;
    items.push(
      <Line
        key={key}
        m={m}
        out={out}
        grp={grp}
        isNew={!seenAtOpen.current!.has(key)}
        name={nameOf(m.senderId)}
        gold={!!s.users[m.senderId]?.gold}
        quote={replyId ? { name: quoted ? nameOf(quoted.senderId) : '', text: msgPreview(quoted) } : null}
        read={out && !m.status && others.some((o) => o.readUpTo >= m.id)}
        flash={flash === m.id}
        onMenu={setMenu}
        onImage={setViewer}
        onQuote={() => replyId && jumpTo(replyId)}
      />,
    );
  });

  const menuButtons: ReactNode[] = [];
  if (menu) {
    const close = () => setMenu(null);
    if (menu.status === 'failed') {
      menuButtons.push(<button key="r" className="btn primary" onClick={() => { close(); retrySend(menu.uuid); }}>Отправить ещё раз</button>);
      menuButtons.push(<button key="d" className="btn" onClick={() => { close(); discardFailed(menu.uuid, chatId); }}>Удалить</button>);
    } else if (!menu.status) {
      menuButtons.push(<button key="a" className="btn primary" onClick={() => { close(); setReply(menu); inputRef.current?.focus(); }}>Ответить</button>);
    }
    const img = menu.body?.kind === 'image' && menu.body.image?.blob ? menu.body.image : null;
    if (img) {
      menuButtons.push(<button key="sv" className="btn" onClick={() => { close(); loadImage(img).then((u) => saveImage(u)).catch(() => {}); }}>⬇ Сохранить фото</button>);
      menuButtons.push(<button key="tw" className="btn" onClick={() => { close(); loadImage(img).then(setToWall).catch(() => {}); }}>📌 На мою стену</button>);
    }
    const t = menu.body?.text;
    if (t) menuButtons.push(<button key="c" className="btn" onClick={() => { close(); navigator.clipboard?.writeText(t).catch(() => {}); }}>Скопировать</button>);
    menuButtons.push(<button key="x" className="btn" onClick={close}>Отмена</button>);
  }

  return (
    <Win id="chatwin" className="chat" title={<>{title} <small>— беседа</small></>} icon={icon}
      onBack={onBack} onClose={onBack} closeClass="close-chat">
      <div className="chat-head aska-head" onClick={openHead} role="button" title="Подробнее">
        <Ico className={`ico${peer?.gold && chat.kind === 'dm' ? ' gold' : ''}`} html={icon.replace('width="14" height="14"', 'width="16" height="16"')} />
        <span className="nick">{title}{chat.kind === 'dm' && <Gold user={peer} />}</span>
        {(peer?.kind === 'aska' || peer?.kind === 'friend') && <span className="aska-tag">ИИ</span>}
        <span className="sp" />
        <span className={`hint${typers.length ? ' aska-typing' : ''}`}>{statusHint}</span>
        <CallButton chatId={chatId} />
      </div>
      <CallBanner chatId={chatId} />
      {friendTwin && (
        <div className="aska-twin-bar">
          <span>{chat.twin?.anon ? `🕶 Анонимно: ${twinOwner.displayName} не узнает, кто пишет.` : `🙂 Открыто: ${twinOwner.displayName} увидит, что это ты.`}</span>
          <button className="link aska-linkbtn" onClick={async () => { try { onOpen(await openTwinChat(chat.twin!.twinId, !chat.twin!.anon)); } catch { /* аноним выключен */ } }}>
            {chat.twin?.anon ? 'писать открыто' : 'писать анонимно'}
          </button>
        </div>
      )}
      {changed.length > 0 && (
        <div className="err aska-warn">
          ⚠ Ключ шифрования у {changed.map((u) => u!.displayName).join(', ')} изменился — возможно, кто-то пытается подменить переписку.
          Сверь коды безопасности в настройках. Пока сообщения шифруются старым ключом.
        </div>
      )}
      <div className="history inset" ref={scrollRef} onScroll={onScroll}>
        {!list.length && (
          <div className="msg aska-sys"><span className="sys">{
            friendTwin ? `Это личный ИИ человека «${twinOwner.displayName}». Задай вопрос, передай комплимент или подарок — кнопки внизу. Его ответы пишет нейросеть.`
              : ownTwin ? 'Это твой личный ИИ. Расскажи ему о себе — он будет отвечать друзьям. Сюда же приходит то, что тебе передают.'
                : peer?.kind === 'aska' ? 'Аська — ИИ и душа АСЬКИ. Спроси её о чём угодно 🌼'
                  : peer?.kind === 'friend' ? 'Батя — ИИ-друг. Расскажи, как ты, — выслушает и подскажет по-отцовски 👨'
                  : chat.biz ? 'Рабочий чат — для команды, работы и партнёров. Сообщения шифруются на телефоне: их видят только участники. Позвать ещё людей — нажми на шапку.'
                  : chat.kind === 'circle' ? 'Это круг — общая беседа. В кругах бывают и ИИ, так что секреты лучше писать лично.'
                    : 'Сообщения шифруются на телефоне: их видят только участники беседы.'
          }</span></div>
        )}
        {items}
      </div>
      <div className="compose">
        {friendTwin && (
          <div className="aska-acts">
            <button className={`chip${act === 'compliment' ? ' on' : ''}`} onClick={() => { setGifts(false); setAct(act === 'compliment' ? null : 'compliment'); inputRef.current?.focus(); }}>💐 Комплимент</button>
            <button className={`chip${gifts ? ' on' : ''}`} onClick={() => { setAct(null); setGifts((v) => !v); }}>🎁 Подарок</button>
            <button className={`chip${act === 'question' ? ' on' : ''}`} onClick={() => { setGifts(false); setAct(act === 'question' ? null : 'question'); inputRef.current?.focus(); }}>❓ Вопрос</button>
          </div>
        )}
        {gifts && (
          <div className="aska-gifts">
            {GIFTS.map((g) => <button key={g.id} className="btn" onClick={() => sendGift(g)}><span>{g.emoji}</span><small>{g.name}</small></button>)}
            <div className="hint">Можно сначала написать пару слов в поле — они уйдут вместе с подарком.</div>
          </div>
        )}
        {reply && (
          <div className="aska-reply">
            <span className="t"><b>Ответ: {nameOf(reply.senderId)}</b><span>{msgPreview(reply)}</span></span>
            <button className="tbtn" onClick={() => setReply(null)} aria-label="Отменить ответ">×</button>
          </div>
        )}
        <textarea
          ref={inputRef}
          className="field"
          rows={2}
          maxLength={20000}
          value={text}
          onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) sendTyping(chatId); }}
          onKeyDown={onKeyDown}
          placeholder={act === 'compliment' ? `Комплимент — ${twinOwner?.displayName} увидит${chat.twin?.anon ? ', но не узнает от кого' : ''}`
            : act === 'question' ? `Вопрос — ${twinOwner?.displayName} ответит`
              : isTouch ? 'Напиши что-нибудь…' : 'Напиши что-нибудь… Enter — отправить'}
        />
        <div className="send-row">
          <button className="btn icon" onClick={() => setSmilesOpen((v) => !v)} title="Смайлы" aria-label="Смайлы">
            <Svg html={smileSvg('smile', 18) || '☺'} />
          </button>
          <button className="btn icon" onClick={() => fileRef.current?.click()} title="Фото" aria-label="Фото">📷</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
          {canRecordVideo() && <button className="btn icon aska-vbtn" onClick={() => { setSmilesOpen(false); setRecording(true); }} title="Видео-квадратик" aria-label="Видео-квадратик">🎬</button>}
          <span className="hint">{!s.connected ? 'нет связи' : ''}</span>
          <button className="btn primary" disabled={!text.trim()} onMouseDown={(e) => e.preventDefault()} onClick={submit}>Отправить</button>
        </div>
      </div>
      {smilesOpen && (
        <div className={`smiles aska-smiles t-${smileTab}`}>
          <div className="aska-smile-tabs">
            <button className={smileTab === 'super' ? 'on' : ''} onClick={() => setSmileTab('super')}>🤩 Супер</button>
            <button className={smileTab === 'sfx' ? 'on' : ''} onClick={() => setSmileTab('sfx')}>🔊 Звуки</button>
            <button className={smileTab === 'icq' ? 'on' : ''} onClick={() => setSmileTab('icq')}>☺ Аськи</button>
            <button className={smileTab === 'sym' ? 'on' : ''} onClick={() => setSmileTab('sym')}>✨ Символы</button>
          </div>
          {smileTab === 'super' ? (
            <>
              {SUPER.map((x) => (
                <button key={x.e} className="aska-super-btn" title={x.name} style={{ ['--glow' as string]: x.glow }}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => sendSuper(x.e)}>
                  <i className={`ss-${x.anim}`}>{x.e}</i><small>{x.name}</small>
                </button>
              ))}
              <div className="cap">нажми — у друга смайл оживёт и прозвучит 🔊</div>
            </>
          ) : smileTab === 'sfx' ? (
            <>
              {SFX.map((x) => (
                <button key={x.e} className="aska-sfx-btn" title={x.name} onMouseDown={(e) => e.preventDefault()} onClick={() => sendSfx(x.e)}>
                  <i>{x.e}</i><small>{x.name}</small>
                </button>
              ))}
              <div className="cap">нажми — смайл улетит и прозвучит у друга 🔊</div>
            </>
          ) : smileTab === 'icq' ? (
            <>
              {smiles().slice(0, 24).map((sm) => (
                <button key={sm.id} title={`${sm.codes[0]} — ${sm.name}`} onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addSmile(sm.codes[0], sm.id)} dangerouslySetInnerHTML={{ __html: smileSvg(sm.id, 20) }} />
              ))}
              <div className="cap">нажми — смайл вставится и скажет своё</div>
            </>
          ) : (
            <SymbolGrid onPick={addSymbol} />
          )}
        </div>
      )}
      {menu && (
        <Dialog title="Сообщение" onClose={() => setMenu(null)} buttons={<div className="aska-menu">{menuButtons}</div>}>
          <div className="aska-menu-preview">{msgPreview(menu)}</div>
        </Dialog>
      )}
      {viewer && (
        <ImageViewer url={viewer} onClose={() => setViewer(null)} actions={<>
          <button className="btn" onClick={() => saveImage(viewer).catch(() => {})}>⬇ Сохранить</button>
          <button className="btn" onClick={() => { setToWall(viewer); setViewer(null); }}>📌 На мою стену</button>
        </>} />
      )}
      {toWall && <ToWallDialog url={toWall} onClose={() => setToWall(null)} />}
      {recording && <VideoRecorder onSend={onVideo} onClose={() => setRecording(false)} />}
    </Win>
  );
}
