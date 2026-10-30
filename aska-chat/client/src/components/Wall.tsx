// Стены: «Стена АСЬКИ» (все стены в одной ленте — на чьей стене и кто оставил), «Моя», «Лучшее» и стена человека.
// На стену шлют текст, фото, открытки и магниты. 🌼 — цветочек записи (+1 аськоин автору), вечером — «Пост дня».
// Магниты собираются у хозяина стены на холодильнике. Стена не шифруется: её видят все в АСЬКЕ.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent, ReactNode } from 'react';
import { useStore } from '../useStore.ts';
import { openDm, seenWall, setHidden, setCoins } from '../lib/store.ts';
import {
  wallFeed, wallOf, postToWall, photoToWall, giveFlower, addComment, deletePost, wallPhotoUrl, onWall, saveImage, blobOf,
  reactTo, tipPost, CARDS, magnetPrice, MAGNET_COUNT, REACTIONS, TIP_AMOUNTS, STICKERS, stickerOf,
} from '../lib/wall.ts';
import type { WallPost, WallInfo } from '../lib/wall.ts';
import { ApiError } from '../lib/api.ts';
import { userFlower, flower } from '../lib/aska.ts';
import { photoSize, ImageViewer } from './EncryptedImage.tsx';
import { Ico, Dialog } from './Win.tsx';
import { UserPlate, Gold } from './Plate.tsx';

export type WallView = { kind: 'feed' } | { kind: 'top' } | { kind: 'user'; userId: number };

const card = (id: string) => window.AskaArt?.postcardSvg(id) ?? '';
const magnet = (code: string, size = 56) => window.AskaArt?.magnetSvg(code, size) ?? '';
const country = (code: string) => window.AskaArt?.COUNTRIES.find((c) => c.code === code);
const cardName = (id?: string) => CARDS.find((c) => c.id === id)?.name || 'открытка';

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  if (m < 60 * 24) return `${Math.round(m / 60)} ч`;
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function WallPhoto({ photo, onOpen }: { photo: NonNullable<WallPost['photo']>; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    wallPhotoUrl(photo.id).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [photo.id]);
  const size = photo.w && photo.h ? photoSize(photo.w, photo.h, 280, 320) : { width: 240, height: 180 };
  return (
    <span className="aska-photo" style={size} onClick={() => url && onOpen(url)}>
      {url && <img src={url} alt="" draggable={false} />}
      {!url && !failed && <span className="spin" />}
      {failed && <span className="fail">Не удалось загрузить фото</span>}
    </span>
  );
}

// Живая гифка-мем: эмодзи двигается, вокруг эффект (дождь, конфетти, искры, ноты, вспышка), подпись как у мема
export function Sticker({ id, size = 'm' }: { id: string; size?: 's' | 'm' | 'l' }) {
  const st = stickerOf(id);
  if (!st) return null;
  const fx = st.fx ? Array.from({ length: st.fx === 'flash' ? 1 : 7 }, (_, i) => i) : [];
  const fxChar = st.fx === 'rain' ? '💧' : st.fx === 'confetti' ? ['🎊', '✨', '🎉'] : st.fx === 'sparkle' ? '✨' : st.fx === 'notes' ? ['🎵', '🎶'] : '';
  return (
    <span className={`aska-sticker ${size} an-${st.anim}${st.fx ? ` fx-${st.fx}` : ''}`} style={{ background: `linear-gradient(135deg, ${st.bg[0]}, ${st.bg[1]})` }} title={st.cap}>
      {fx.map((i) => <i key={i} className="st-fx" style={{ left: `${8 + i * 13}%`, animationDelay: `${(i * 0.37) % 1.6}s` }}>{Array.isArray(fxChar) ? fxChar[i % fxChar.length] : fxChar}</i>)}
      <span className="st-e">{st.e}</span>
      <b className="st-cap">{st.cap}</b>
    </span>
  );
}

// «Полёт» награды над записью: цветочки, монетки, реакции
type Burst = { id: number; ch: string; n: number };
let burstId = 0;

// Панель наград: выезжает снизу, как кошелёк. Цветочек, лайк, аськоины, реакции, гифки, а ещё «удалить» и «убрать для себя»
function RewardSheet({ p, me, isGold, onClose, onDone }: {
  p: WallPost; me: number; isGold: boolean; onClose: () => void;
  onDone: (what: { flower?: boolean; react?: string | null; tip?: number; sticker?: string; deleted?: boolean; hidden?: boolean }) => void;
}) {
  const s = useStore();
  const [money, setMoney] = useState(false);
  const [gifs, setGifs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const author = s.users[p.authorId];
  const own = p.authorId === me;
  const coins = s.profile?.coins ?? 0;
  const canDelete = own || p.wallId === me || isGold;
  const canHide = !own && author && (author.kind || 'human') === 'human';

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) {
      setError(e instanceof ApiError && e.code === 'no_coins' ? 'Не хватает аськоинов 🪙' : 'Не получилось. Проверь интернет.');
    } finally { setBusy(false); }
  }

  // поверх всего экрана, включая нижние вкладки
  return createPortal(
    <div className="aska-reward-ov" onClick={onClose}>
      <div className="aska-reward" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Наградить запись">
        <div className="rw-grip" />
        <div className="rw-head">
          <span>Наградить запись{author ? <> · <b>{own ? 'твою' : author.displayName}</b></> : null}</span>
          <span className="rw-wallet">🪙 {coins}</span>
        </div>
        <div className="rw-main">
          <button className="rw-tile" disabled={busy || own || p.mine} onClick={() => run(async () => {
            const r = await giveFlower(p.id); onDone({ flower: true }); void r;
          })}>
            <i>🌼</i><b>Цветочек</b><small>{own ? 'своей нельзя' : p.mine ? 'уже подарен' : '+1 🪙 автору'}</small>
          </button>
          <button className={`rw-tile${p.myReaction === '👍' ? ' on' : ''}`} disabled={busy} onClick={() => run(async () => {
            await reactTo(p.id, '👍'); onDone({ react: p.myReaction === '👍' ? null : '👍' });
          })}>
            <i>👍</i><b>Лайк</b><small>{p.myReaction === '👍' ? 'убрать' : 'нравится'}</small>
          </button>
          <button className={`rw-tile money${money ? ' on' : ''}`} disabled={busy || own} onClick={() => { setGifs(false); setMoney((v) => !v); }}>
            <i>🪙</i><b>Деньги</b><small>{own ? 'себе нельзя' : 'аськоины автору'}</small>
          </button>
        </div>
        {money && (
          <div className="rw-amounts">
            {TIP_AMOUNTS.map((a) => (
              <button key={a} disabled={busy || a > coins} onClick={() => run(async () => {
                const r = await tipPost(p.id, a); setCoins(r.coins); onDone({ tip: a });
              })}><b>{a}</b><small>🪙</small></button>
            ))}
            <div className="rw-note">Перевод автору записи — из твоих аськоинов</div>
          </div>
        )}
        <div className="rw-reacts">
          {REACTIONS.filter((r) => r !== '👍').map((r) => (
            <button key={r} className={p.myReaction === r ? 'on' : ''} disabled={busy} onClick={() => run(async () => {
              await reactTo(p.id, r); onDone({ react: p.myReaction === r ? null : r });
            })}>{r}</button>
          ))}
        </div>
        <button className={`rw-row${gifs ? ' on' : ''}`} onClick={() => { setMoney(false); setGifs((v) => !v); }}>🎞 <b>Гифка в ответ</b><span>живые мемы</span><em>{gifs ? '▴' : '▾'}</em></button>
        {gifs && (
          <div className="rw-gifs">
            {STICKERS.map((st) => (
              <button key={st.id} disabled={busy} onClick={() => run(async () => {
                await addComment(p.id, '', st.id); onDone({ sticker: st.id });
              })}><Sticker id={st.id} size="s" /></button>
            ))}
          </div>
        )}
        {(canDelete || canHide) && (
          <div className="rw-danger">
            {canDelete && <button disabled={busy} onClick={() => { if (confirm('Удалить запись?')) run(async () => { await deletePost(p.id); onDone({ deleted: true }); }); }}>🗑 Удалить запись</button>}
            {canHide && <button disabled={busy} onClick={() => { if (confirm(`Убрать ${author!.displayName} для себя? Его записи и комментарии пропадут у тебя со стен, а сам он — из списка. Вернуть можно в «Ещё».`)) run(async () => { await setHidden(author!.id, true); onDone({ hidden: true }); }); }}>🚫 Убрать для себя: {author!.displayName}</button>}
          </div>
        )}
        {error && <div className="err">{error}</div>}
      </div>
    </div>,
    document.body,
  );
}

function Post({ p, me, feed, isGold, onProfile, onWallOf, onImage, patch, drop }: {
  p: WallPost; me: number; feed: boolean; isGold: boolean; onProfile: (id: number) => void; onWallOf: (id: number) => void;
  onImage: (url: string) => void; patch: (id: number, f: (p: WallPost) => WallPost) => void; drop: (id: number) => void;
}) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const lastTap = useRef(0);
  const name = (id: number) => (id === me ? 'Ты' : s.users[id]?.displayName || '…');
  const author = s.users[p.authorId];

  function burst(ch: string, n = 7) {
    const b = { id: ++burstId, ch, n };
    setBursts((x) => [...x, b]);
    setTimeout(() => setBursts((x) => x.filter((y) => y.id !== b.id)), 1600);
  }
  async function react(emoji: string) {
    const off = p.myReaction === emoji;
    patch(p.id, (x) => {
      const r = { ...x.reactions };
      if (x.myReaction) { r[x.myReaction] = (r[x.myReaction] || 1) - 1; if (r[x.myReaction] <= 0) delete r[x.myReaction]; }
      if (!off) r[emoji] = (r[emoji] || 0) + 1;
      return { ...x, reactions: r, myReaction: off ? undefined : emoji };
    });
    if (!off) burst(emoji, 5);
    try { const r = await reactTo(p.id, off ? null : emoji); patch(p.id, (x) => ({ ...x, reactions: r.reactions, myReaction: r.myReaction || undefined })); } catch { /* нет связи */ }
  }
  async function send() {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      const { comment } = await addComment(p.id, t);
      setText('');
      patch(p.id, (x) => (x.comments.some((c) => c.id === comment.id) ? x : { ...x, comments: [...x.comments, comment] }));
    } catch { /* нет связи */ } finally { setBusy(false); }
  }
  // двойное нажатие на фото — ❤️
  const onPhotoTap = (url: string) => {
    const t = Date.now();
    if (t - lastTap.current < 320) { lastTap.current = 0; if (p.myReaction !== '❤️') react('❤️'); else burst('❤️', 5); return; }
    lastTap.current = t;
    setTimeout(() => { if (lastTap.current === t) onImage(url); }, 330);
  };
  const reacts = Object.entries(p.reactions || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className={`post aska-post${p.best ? ' best' : ''}`}>
      <div className="post-h">
        <Ico className={`ico${author?.gold ? ' gold' : ''}`} html={author && author.kind !== 'aska' ? userFlower(author, !!s.presence[author.id] || p.authorId === me, 14) : flower('chat', 14)} />
        <span className="aska-post-who">
          <b className="link" onClick={() => onProfile(p.authorId)}>{name(p.authorId)}</b><Gold user={author} />
          {feed && p.wallId !== p.authorId && <> <span className="muted">→ на стене у</span> <b className="link" onClick={() => onWallOf(p.wallId)}>{p.wallId === me ? 'тебя' : name(p.wallId)}</b></>}
          {feed && p.wallId === p.authorId && <span className="muted"> · у себя на стене</span>}
        </span>
        <span className="sp" />
        {p.best && <span className="aska-best" title="Запись с самым большим букетом за день">🏆 пост дня</span>}
        <span className="muted aska-post-t">{ago(p.createdAt)}</span>
      </div>
      {p.kind === 'card' && p.card && <div className="postcard" dangerouslySetInnerHTML={{ __html: card(p.card) }} title={cardName(p.card)} />}
      {p.kind === 'magnet' && p.magnet && (
        <div className="magnetcard">
          <span className="mg" dangerouslySetInnerHTML={{ __html: magnet(p.magnet, 56) }} />
          <span className="ti"><b>Магнит {country(p.magnet)?.flag || ''} {country(p.magnet)?.name || p.magnet}</b><br /><span className="muted">теперь на холодильнике у {p.wallId === me ? 'тебя' : name(p.wallId)}</span></span>
        </div>
      )}
      {p.kind === 'sticker' && p.sticker && <div className="aska-post-st"><Sticker id={p.sticker} size="l" /></div>}
      {p.kind === 'photo' && p.photo && <WallPhoto photo={p.photo} onOpen={onPhotoTap} />}
      {p.text && <div className="txt">{p.text}</div>}
      {reacts.length > 0 && (
        <div className="aska-reacts">
          {reacts.map(([e, n]) => (
            <button key={e} className={p.myReaction === e ? 'on' : ''} onClick={() => react(e)}>{e} <b>{n}</b></button>
          ))}
        </div>
      )}
      <div className="row wall-actions">
        <span className={`aska-stat${p.mine ? ' on' : ''}`} title="Цветочки">🌼 {p.flowers}</span>
        {p.tips > 0 && <span className="aska-stat coin" title="Аськоины в подарок автору">🪙 {p.tips}</span>}
        <button className="btn" onClick={() => setOpen((v) => !v)}>💬 {p.comments.length || ''}</button>
        <span className="sp" />
        <button className="btn aska-plus-btn" title="Наградить: цветочек, лайк, аськоины, реакция, гифка" onClick={() => setSheet(true)}>+</button>
      </div>
      {bursts.map((b) => (
        <span key={b.id} className="aska-burst" aria-hidden="true">
          {Array.from({ length: b.n }, (_, i) => <i key={i} style={{ left: `${30 + ((i * 37) % 45)}%`, animationDelay: `${i * 0.06}s` }}>{b.ch}</i>)}
        </span>
      ))}
      {(open || p.comments.length > 0) && (
        <div className="aska-comments">
          {(open ? p.comments : p.comments.slice(-2)).map((c) => (
            <div key={c.id} className={`reply${c.sticker ? ' st' : ''}`}>
              <b className="link" onClick={() => onProfile(c.authorId)}>{name(c.authorId)}</b>
              {c.sticker ? <Sticker id={c.sticker} size="s" /> : <span>{c.text}</span>}
              <span className="muted">{ago(c.createdAt)}</span>
            </div>
          ))}
          {!open && p.comments.length > 2 && <button className="link aska-linkbtn" onClick={() => setOpen(true)}>все комментарии ({p.comments.length})</button>}
          {open && (
            <div className="row reply-add">
              <input className="field" value={text} maxLength={300} placeholder="Комментарий…" onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
              <button className="btn" disabled={busy || !text.trim()} onClick={send}>Ок</button>
            </div>
          )}
        </div>
      )}
      {sheet && (
        <RewardSheet p={p} me={me} isGold={isGold} onClose={() => setSheet(false)} onDone={(w) => {
          setSheet(false);
          if (w.deleted || w.hidden) { drop(p.id); return; }
          if (w.flower) { patch(p.id, (x) => ({ ...x, mine: true, flowers: x.flowers + 1 })); burst('🌼', 9); }
          if (w.tip) { patch(p.id, (x) => ({ ...x, tips: x.tips + w.tip! })); burst('🪙', Math.min(12, 4 + w.tip / 5)); }
          if (w.react !== undefined) {
            patch(p.id, (x) => {
              const r = { ...x.reactions };
              if (x.myReaction) { r[x.myReaction] = (r[x.myReaction] || 1) - 1; if (r[x.myReaction] <= 0) delete r[x.myReaction]; }
              if (w.react) r[w.react] = (r[w.react] || 0) + 1;
              return { ...x, reactions: r, myReaction: w.react || undefined };
            });
            if (w.react) burst(w.react, 6);
          }
          if (w.sticker) { setOpen(true); burst(stickerOf(w.sticker)?.e || '🎞', 5); }
        }} />
      )}
    </div>
  );
}

// Написать на стену: текст, фото, открытка или магнит
function Composer({ wallId, onDone }: { wallId: number; onDone: (p: WallPost) => void }) {
  const s = useStore();
  const me = s.me!.userId;
  const [mode, setMode] = useState<'text' | 'card' | 'magnet' | 'sticker'>('text');
  const [text, setText] = useState('');
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const coins = s.profile?.coins ?? 0;
  const owner = s.users[wallId];
  const ownWall = wallId === me;
  const countries = (window.AskaArt?.COUNTRIES || []).filter((c) => magnetPrice(c.code) && c.code);

  async function run(fn: () => Promise<{ post: WallPost }>) {
    setBusy(true);
    setError('');
    try {
      const r = await fn();
      setText(''); setPick(''); setMode('text');
      onDone(r.post);
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'no_coins' ? 'Не хватает аськоинов 🪙' : e instanceof ApiError && e.status === 429 ? 'Слишком часто — передохни минутку' : 'Не получилось. Проверь интернет.');
    } finally { setBusy(false); }
  }
  const submit = () => {
    if (mode === 'card' && pick) return run(() => postToWall(wallId, { kind: 'card', card: pick, text: text.trim() }));
    if (mode === 'magnet' && pick) return run(() => postToWall(wallId, { kind: 'magnet', magnet: pick, text: text.trim() }));
    if (mode === 'sticker' && pick) return run(() => postToWall(wallId, { kind: 'sticker', sticker: pick, text: text.trim() }));
    if (text.trim()) return run(() => postToWall(wallId, { kind: 'text', text: text.trim() }));
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) run(() => photoToWall(wallId, f, text.trim()));
  };

  return (
    <div className="composer aska-composer">
      <div className="legend-line">{ownWall ? 'Написать на своей стене' : `Оставить на стене у ${owner?.displayName || '…'}`}</div>
      <textarea className="field" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={mode === 'card' ? 'Подпись к открытке (можно без неё)' : mode === 'magnet' ? 'Пара слов к магниту (можно без них)' : mode === 'sticker' ? 'Подпись к гифке (можно без неё)' : 'Что нового?'} />
      {mode === 'sticker' && (
        <div className="aska-gif-pick">
          {STICKERS.map((st) => (
            <button key={st.id} className={pick === st.id ? 'on' : ''} onClick={() => setPick(st.id)} title={st.cap}><Sticker id={st.id} size="s" /></button>
          ))}
        </div>
      )}
      {mode === 'card' && (
        <div className="aska-cards">
          {CARDS.map((c) => (
            <button key={c.id} className={`aska-card-pick${pick === c.id ? ' on' : ''}`} title={c.name} onClick={() => setPick(c.id)}>
              <span dangerouslySetInnerHTML={{ __html: card(c.id) }} /><small>{c.name}</small>
            </button>
          ))}
        </div>
      )}
      {mode === 'magnet' && (
        <>
          <div className="hint">Магнит повиснет на холодильнике у {ownWall ? 'тебя' : owner?.displayName}. {ownWall ? 'Себе — бесплатно.' : `У тебя ${coins} 🪙`}</div>
          <div className="magnet-grid">
            {countries.map((c) => {
              const price = ownWall ? 0 : magnetPrice(c.code);
              return (
                <button key={c.code} className={`${pick === c.code ? 'on' : ''}${price > coins ? ' locked' : ''}`} title={`${c.name} — ${price ? `${price} 🪙` : 'бесплатно'}`}
                  disabled={price > coins} onClick={() => setPick(c.code)}>
                  <span dangerouslySetInnerHTML={{ __html: magnet(c.code, 40) }} /><small>{price ? `${price}🪙` : c.name}</small>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="row aska-composer-row">
        <button className={`btn${mode === 'card' ? ' down' : ''}`} onClick={() => { setPick(''); setMode(mode === 'card' ? 'text' : 'card'); }}>💌 Открытка</button>
        <button className={`btn${mode === 'magnet' ? ' down' : ''}`} onClick={() => { setPick(''); setMode(mode === 'magnet' ? 'text' : 'magnet'); }}>🧲 Магнит</button>
        <button className={`btn${mode === 'sticker' ? ' down' : ''}`} onClick={() => { setPick(''); setMode(mode === 'sticker' ? 'text' : 'sticker'); }}>🎞 Гифка</button>
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>📷 Фото</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        <span className="sp" />
        <button className="btn primary" disabled={busy || (mode === 'text' ? !text.trim() : !pick)} onClick={submit}>{busy ? '…' : 'Отправить'}</button>
      </div>
      {error && <div className="err">{error}</div>}
    </div>
  );
}

export function Wall({ view, onView, onProfile, onOpenChat }: {
  view: WallView; onView: (v: WallView) => void; onProfile: (userId: number) => void; onOpenChat: (chatId: string) => void;
}) {
  const s = useStore();
  const me = s.me!.userId;
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [info, setInfo] = useState<WallInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [writing, setWriting] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const userId = view.kind === 'user' ? view.userId : null;
  const key = view.kind === 'user' ? `u${view.userId}` : view.kind;
  const owner = userId ? s.users[userId] : undefined;
  const isGold = !!s.profile?.isAdmin;

  async function load(before = 0) {
    setError('');
    try {
      if (view.kind === 'user') {
        const w = await wallOf(view.userId, before);
        setInfo(w);
        setPosts((old) => (before ? [...old, ...w.posts] : w.posts));
        setMore(w.posts.length >= 30);
      } else {
        const list = await wallFeed(before, view.kind === 'top');
        setPosts((old) => (before ? [...old, ...list] : list));
        setMore(view.kind === 'feed' && list.length >= 30);
      }
    } catch { setError('Не получилось загрузить стену. Проверь интернет.'); } finally { setLoading(false); }
  }

  useEffect(() => {
    setLoading(true); setPosts([]); setInfo(null); setWriting(false);
    load();
    if (view.kind !== 'user' || view.userId === me) seenWall();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // живые обновления: новые записи, цветочки, комментарии, удаления
  useEffect(() => onWall((e) => {
    if (e.type === 'wall') {
      const fits = view.kind === 'feed' || (view.kind === 'user' && e.post.wallId === view.userId);
      setPosts((old) => {
        if (old.some((p) => p.id === e.post.id)) return old.map((p) => (p.id === e.post.id ? { ...p, best: e.post.best } : p));
        return fits ? [e.post, ...old] : old;
      });
      if (view.kind === 'user' && e.post.wallId === view.userId && e.post.kind === 'magnet') load();
    } else if (e.type === 'wall_flower') {
      setPosts((old) => old.map((p) => (p.id === e.postId ? { ...p, flowers: e.flowers, mine: p.mine || e.by === me } : p)));
    } else if (e.type === 'wall_comment') {
      setPosts((old) => old.map((p) => (p.id === e.postId && !p.comments.some((c) => c.id === e.comment.id) ? { ...p, comments: [...p.comments, e.comment] } : p)));
    } else if (e.type === 'wall_del') {
      setPosts((old) => old.filter((p) => p.id !== e.postId));
    } else if (e.type === 'wall_react') {
      setPosts((old) => old.map((p) => (p.id === e.postId ? { ...p, reactions: e.reactions, ...(e.by === me ? { myReaction: e.emoji || undefined } : {}) } : p)));
    } else if (e.type === 'wall_tip') {
      setPosts((old) => old.map((p) => (p.id === e.postId ? { ...p, tips: e.tips } : p)));
    }
  }), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (id: number, f: (p: WallPost) => WallPost) => setPosts((old) => old.map((p) => (p.id === id ? f(p) : p)));
  const drop = (id: number) => setPosts((old) => old.filter((p) => p.id !== id));
  const added = (p: WallPost) => { setWriting(false); setPosts((old) => (old.some((x) => x.id === p.id) ? old : [p, ...old])); };
  const fridge = info?.fridge || [];
  const writeWall = view.kind === 'user' ? view.userId : me;

  let head: ReactNode = null;
  if (view.kind === 'user' && owner) {
    head = (
      <div className="wall-head">
        <Ico className={`ico${owner.gold ? ' gold' : ''}`} html={owner.kind === 'aska' ? flower('chat', 16) : userFlower(owner, !!s.presence[owner.id] || owner.id === me, 16)} />
        <span className="who">
          <b className="link" onClick={() => onProfile(owner.id)}>{owner.id === me ? 'Моя стена' : owner.displayName}</b><Gold user={owner} />
          <br /><span className="muted">записей {info?.stats.posts ?? '…'} · 🌼 собрал(а) {info?.stats.flowers ?? '…'}</span>
        </span>
        <UserPlate user={owner} size="s" />
        {owner.id !== me && (
          <button className="btn" onClick={async () => { try { onOpenChat(await openDm(owner.id)); } catch { /* нет связи */ } }}>💬</button>
        )}
      </div>
    );
  }

  return (
    <div className="aska-wall">
      <div className="tabs aska-wall-tabs">
        <button className={view.kind === 'feed' ? 'on' : ''} onClick={() => onView({ kind: 'feed' })}>🌐 Стена АСЬКИ</button>
        <button className={view.kind === 'user' && view.userId === me ? 'on' : ''} onClick={() => onView({ kind: 'user', userId: me })}>🏠 Моя</button>
        <button className={view.kind === 'top' ? 'on' : ''} onClick={() => onView({ kind: 'top' })}>🏆 Лучшее</button>
      </div>
      {head}
      {view.kind === 'user' && (fridge.length > 0 || view.userId === me) && (
        <div className="fridge aska-fridge" title="Магниты, которые прислали на стену">
          <div className="fridge-top" />
          <div className="fridge-door">
            <span className="aska-fridge-cnt">🧲 {fridge.length} из {MAGNET_COUNT}</span>
            {fridge.map((m) => (
              <span key={m.code} className="magnet" title={`${country(m.code)?.name || m.code}${m.n > 1 ? ` ×${m.n}` : ''}`} dangerouslySetInnerHTML={{ __html: magnet(m.code, 46) }} />
            ))}
            {!fridge.length && <span className="hint">Холодильник пуст. Магниты сюда присылают друзья — со всех стран мира 🌍</span>}
            <div className="fridge-handle" />
          </div>
        </div>
      )}
      {view.kind === 'feed' && (
        <div className="hint aska-wall-about">
          Все стены в одной ленте. 🌼 Дари цветочки — автору +1 🪙, а запись с самым большим букетом за день вечером становится «Постом дня» (+30 🪙).
        </div>
      )}
      {view.kind === 'top' && <div className="hint aska-wall-about">Самые цветущие записи за неделю 🌼</div>}
      {view.kind === 'user' ? (
        <Composer key={writeWall} wallId={writeWall} onDone={added} />
      ) : writing ? (
        <Composer wallId={me} onDone={added} />
      ) : (
        <button className="btn aska-wall-write" onClick={() => setWriting(true)}>✏️ Написать на своей стене</button>
      )}
      <div className="hint aska-wall-public">🔓 Стену видят все в АСЬКЕ — это не личка.</div>
      {error && <div className="err">{error}</div>}
      <div className="wall-posts aska-wall-posts">
        {loading && <div className="hint">Загружаю…</div>}
        {!loading && !posts.length && <div className="empty-note">{view.kind === 'user' ? 'Здесь пока пусто. Оставь первую запись!' : 'Пока ни одной записи. Будь первым(ой)!'}</div>}
        {posts.filter((p) => !s.hidden.includes(p.authorId)).map((p) => (
          <Post key={p.id} p={s.hidden.length ? { ...p, comments: p.comments.filter((c) => !s.hidden.includes(c.authorId)) } : p} me={me} feed={view.kind !== 'user'} isGold={isGold} onProfile={onProfile}
            onWallOf={(id) => onView({ kind: 'user', userId: id })} onImage={setViewer} patch={patch} drop={drop} />
        ))}
        {more && <button className="hist-more" onClick={() => load(posts[posts.length - 1]?.id || 0)}>показать ещё</button>}
      </div>
      {viewer && (
        <ImageViewer url={viewer} onClose={() => setViewer(null)}
          actions={<button className="btn" onClick={(e) => { e.stopPropagation(); saveImage(viewer).catch(() => {}); }}>⬇ Сохранить</button>} />
      )}
    </div>
  );
}

// Подтверждение: фото из лички — на свою стену
export function ToWallDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  async function go() {
    setBusy(true);
    setError('');
    try {
      const blob = await blobOf(url);
      await photoToWall(s.me!.userId, blob, text.trim());
      setDone(true);
    } catch { setError('Не получилось. Проверь интернет.'); } finally { setBusy(false); }
  }
  return (
    <Dialog title="📌 На мою стену" onClose={onClose}
      buttons={done ? <button className="btn primary" onClick={onClose}>Готово</button> : (
        <>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" disabled={busy} onClick={go}>{busy ? 'Вешаю…' : 'Повесить'}</button>
        </>
      )}>
      {done ? <div>Фото на твоей стене 🌼 Его видят все в АСЬКЕ.</div> : (
        <>
          <img className="aska-towall-img" src={url} alt="" />
          <input className="field" value={text} maxLength={500} placeholder="Подпись (можно без неё)" onChange={(e) => setText(e.target.value)} />
          <div className="hint">🔓 Фото со стены увидят все в АСЬКЕ — не только тот, кто его прислал.</div>
          {error && <div className="err">{error}</div>}
        </>
      )}
    </Dialog>
  );
}
