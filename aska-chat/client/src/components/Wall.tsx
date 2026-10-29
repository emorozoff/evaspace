// Стены: «Стена АСЬКИ» (все стены в одной ленте — на чьей стене и кто оставил), «Моя», «Лучшее» и стена человека.
// На стену шлют текст, фото, открытки и магниты. 🌼 — цветочек записи (+1 аськоин автору), вечером — «Пост дня».
// Магниты собираются у хозяина стены на холодильнике. Стена не шифруется: её видят все в АСЬКЕ.
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useStore } from '../useStore.ts';
import { openDm, seenWall } from '../lib/store.ts';
import {
  wallFeed, wallOf, postToWall, photoToWall, giveFlower, addComment, deletePost, wallPhotoUrl, onWall, saveImage, blobOf,
  CARDS, magnetPrice, MAGNET_COUNT,
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

function Post({ p, me, feed, isGold, onProfile, onWallOf, onImage, patch, drop }: {
  p: WallPost; me: number; feed: boolean; isGold: boolean; onProfile: (id: number) => void; onWallOf: (id: number) => void;
  onImage: (url: string) => void; patch: (id: number, f: (p: WallPost) => WallPost) => void; drop: (id: number) => void;
}) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const name = (id: number) => (id === me ? 'Ты' : s.users[id]?.displayName || '…');
  const author = s.users[p.authorId];
  const canDelete = p.authorId === me || p.wallId === me || isGold;
  const ownPost = p.authorId === me;

  async function flowerIt() {
    if (p.mine || ownPost) return;
    patch(p.id, (x) => ({ ...x, mine: true, flowers: x.flowers + 1 }));
    try { const r = await giveFlower(p.id); patch(p.id, (x) => ({ ...x, flowers: r.flowers })); } catch { patch(p.id, (x) => ({ ...x, mine: false, flowers: x.flowers - 1 })); }
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
      {p.kind === 'photo' && p.photo && <WallPhoto photo={p.photo} onOpen={onImage} />}
      {p.text && <div className="txt">{p.text}</div>}
      <div className="row wall-actions">
        <button className={`btn like${p.mine ? ' on' : ''}`} disabled={ownPost && !p.mine} onClick={flowerIt}
          title={ownPost ? 'Своей записи цветочек не подаришь' : p.mine ? 'Ты уже подарил(а) цветочек' : 'Подарить цветочек: автору +1 🪙'}>
          🌼 {p.flowers || ''}
        </button>
        <button className="btn" onClick={() => setOpen((v) => !v)}>💬 {p.comments.length || ''}</button>
        <span className="sp" />
        {canDelete && <button className="btn" title="Удалить" onClick={async () => { if (confirm('Удалить запись?')) { await deletePost(p.id).catch(() => {}); drop(p.id); } }}>🗑</button>}
      </div>
      {(open || p.comments.length > 0) && (
        <div className="aska-comments">
          {(open ? p.comments : p.comments.slice(-2)).map((c) => (
            <div key={c.id} className="reply"><b className="link" onClick={() => onProfile(c.authorId)}>{name(c.authorId)}</b><span>{c.text}</span><span className="muted">{ago(c.createdAt)}</span></div>
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
    </div>
  );
}

// Написать на стену: текст, фото, открытка или магнит
function Composer({ wallId, onDone }: { wallId: number; onDone: (p: WallPost) => void }) {
  const s = useStore();
  const me = s.me!.userId;
  const [mode, setMode] = useState<'text' | 'card' | 'magnet'>('text');
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
        placeholder={mode === 'card' ? 'Подпись к открытке (можно без неё)' : mode === 'magnet' ? 'Пара слов к магниту (можно без них)' : 'Что нового?'} />
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
        {posts.map((p) => (
          <Post key={p.id} p={p} me={me} feed={view.kind !== 'user'} isGold={isGold} onProfile={onProfile}
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
