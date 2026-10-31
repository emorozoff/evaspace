// 🏠 Комнаты — сообщества по интересам, как группы ВКонтакте: обложка, аватар, описание, «Вступить», участники и лента.
// Вход и посты бесплатные: пишешь под своим именем (или под пиксельным НФТ-ником, если он есть).
// Здесь же вкладка «💬 Чаты-круги» — групповые беседы по интересам (Circles.tsx). Комнаты не шифруются — они открыты всем в АСЬКЕ.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../useStore.ts';
import { ApiError } from '../lib/api.ts';
import { userFlower } from '../lib/aska.ts';
import type { NightMsg, NightOverview, NightRoom, RoomView } from '../lib/night.ts';
import { nightOverview, roomView, joinRoom, leaveRoom, postNight, thankNight, onNight, RANK_NAME } from '../lib/night.ts';
import { NftArt } from './NftArt.tsx';
import { NftPicker } from './Night.tsx';
import { Circles } from './Circles.tsx';
import { Svg } from './Win.tsx';

const ago = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};
const people = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'участник' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'участника' : 'участников'}`;
const coverStyle = (r: NightRoom) => ({ background: `linear-gradient(135deg, ${r.cover?.[0] || '#5b8cff'}, ${r.cover?.[1] || '#7b2ff7'})` });

// Круглая аватарка комнаты: эмодзи на цвете обложки
function RoomAva({ r, size = 52 }: { r: NightRoom; size?: number }) {
  return <span className="rm-ava" style={{ ...coverStyle(r), width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">{r.emoji}</span>;
}

// Аватар автора: пиксельный НФТ, цветочек человека или постоялец
function Face({ a, size = 40 }: { a: { nick: string; userId?: number | null; nft?: number | null; id: number }; size?: number }) {
  const s = useStore();
  if (a.nft) return <NftArt id={a.nft} size={size} className="rm-face" />;
  if (a.userId) return <span className="rm-face fl" style={{ width: size, height: size }}><Svg html={userFlower(s.users[a.userId], true, Math.round(size * 0.8))} /></span>;
  return <NftArt id={a.id} size={size} className="rm-face" />;
}

export function Rooms({ onOpenChat, onLevels }: { onOpenChat: (id: string) => void; onLevels?: () => void }) {
  const [tab, setTab] = useState<'rooms' | 'circles'>('rooms');
  const [ov, setOv] = useState<NightOverview | null>(null);
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [nft, setNft] = useState(false);
  const load = () => nightOverview().then(setOv).catch(() => setError('Комнаты не загрузились — нет связи.'));
  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    if (!ov) return [];
    const t = q.trim().toLowerCase();
    return ov.rooms.filter((r) => (cat === 'all' || (cat === 'mine' ? r.joined : r.cat === cat))
      && (!t || `${r.title} ${r.short || ''} ${r.about}`.toLowerCase().includes(t)));
  }, [ov, cat, q]);

  async function toggle(r: NightRoom) {
    setBusy(r.key);
    try {
      const res = r.joined ? await leaveRoom(r.key) : await joinRoom(r.key);
      setOv((o) => (o ? { ...o, rooms: o.rooms.map((x) => (x.key === r.key ? { ...x, joined: res.joined, members: res.members } : x)) } : o));
    } catch { setError('Не получилось — проверь связь.'); } finally { setBusy(''); }
  }

  if (open) return <RoomPage roomKey={open} ov={ov} onBack={() => { setOpen(null); load(); }} onNft={() => setNft(true)} nftOpen={nft} onNftClose={() => setNft(false)} onNftDone={() => { setNft(false); load(); }} />;

  return (
    <div className="aska-rooms">
      <div className="rm-switch" role="tablist">
        <button role="tab" aria-selected={tab === 'rooms'} className={tab === 'rooms' ? 'on' : ''} onClick={() => setTab('rooms')}>🏠 Комнаты</button>
        <button role="tab" aria-selected={tab === 'circles'} className={tab === 'circles' ? 'on' : ''} onClick={() => setTab('circles')}>💬 Чаты-круги</button>
      </div>
      {tab === 'circles' ? <Circles onOpen={onOpenChat} /> : (
        <>
          <div className="rm-search">
            <span aria-hidden="true">🔍</span>
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти комнату: мото, бизнес, котики…" aria-label="Поиск комнат" />
          </div>
          <div className="rm-cats">
            {[{ key: 'all', name: 'Все', emoji: '✨' }, { key: 'mine', name: 'Мои', emoji: '⭐' }, ...(ov?.categories || [])].map((c) => (
              <button key={c.key} className={`chip${cat === c.key ? ' on' : ''}`} onClick={() => setCat(c.key)}>{c.emoji} {c.name}</button>
            ))}
          </div>
          {error && <div className="err">{error}</div>}
          {!ov ? <div className="hint">Загружаю комнаты…</div> : !list.length ? (
            <div className="hint rm-empty">{cat === 'mine' ? 'Ты пока ни в одной комнате. Загляни во «Все» и вступи — это бесплатно 🌼' : 'Ничего не нашлось.'}</div>
          ) : (
            <div className="rm-list">
              {list.map((r) => (
                <div key={r.key} className="rm-row" role="button" tabIndex={0} onClick={() => setOpen(r.key)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(r.key); }}>
                  <RoomAva r={r} />
                  <span className="rm-meta">
                    <b>{r.title}{r.cat === 'night' && <i className="rm-night"> 🌙</i>}</b>
                    <small>{ov.categories?.find((c) => c.key === r.cat)?.name || 'Комната'} · {people(r.members || 0)}{r.online ? <> · <span title="в сети">🟢 {r.online}</span></> : null}</small>
                    <span className="rm-short">{r.short || r.about}</span>
                  </span>
                  <button className={`btn${r.joined ? '' : ' primary'} rm-join`} disabled={busy === r.key}
                    onClick={(e) => { e.stopPropagation(); toggle(r); }} aria-label={r.joined ? `Выйти из «${r.title}»` : `Вступить в «${r.title}»`}>
                    {r.joined ? '✓' : 'Вступить'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="rm-foot">
            <span>Вход во все комнаты бесплатный. Пишешь под своим именем{ov?.avatar ? ` или под ником «${ov.avatar.nick}»` : ''}.</span>
            {!ov?.avatar && <button className="link aska-linkbtn" onClick={() => setNft(true)}>🎴 Пиксельный аватар — по желанию</button>}
            {onLevels && <button className="link aska-linkbtn" onClick={onLevels}>🎖 Уровни</button>}
          </div>
          {nft && ov && <NftPicker price={ov.prices.nft} onClose={() => setNft(false)} onDone={() => { setNft(false); load(); }} />}
        </>
      )}
    </div>
  );
}

// Страница комнаты, как сообщество ВК: обложка, аватар, название, «Вступить», участники, о комнате и лента (новое сверху)
function RoomPage({ roomKey, ov, onBack, onNft, nftOpen, onNftClose, onNftDone }: {
  roomKey: string; ov: NightOverview | null; onBack: () => void; onNft: () => void; nftOpen: boolean; onNftClose: () => void; onNftDone: () => void;
}) {
  const [v, setV] = useState<RoomView | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [about, setAbout] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const load = () => roomView(roomKey).then(setV).catch(() => setError('Комната не открылась — нет связи.'));
  useEffect(() => { load(); }, [roomKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => onNight((m: NightMsg) => {
    if (m.room !== roomKey) return;
    setV((x) => (x && !x.messages.some((y) => y.id === m.id) ? { ...x, messages: [...x.messages, m] } : x));
  }), [roomKey]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setBusy(true); setError('');
    try {
      const r = await postNight(roomKey, t);
      setText('');
      setV((x) => (x ? { ...x, joined: true, messages: x.messages.some((y) => y.id === r.message.id) ? x.messages : [...x.messages, r.message] } : x));
      load(); // обновить участников и лица
    } catch (e) { setError(e instanceof ApiError && e.code === 'too_many' ? 'Слишком часто — подожди минутку.' : 'Не отправилось — проверь связь.'); } finally { setBusy(false); }
  }
  async function toggleJoin() {
    if (!v) return;
    try { const r = v.joined ? await leaveRoom(roomKey) : await joinRoom(roomKey); setV({ ...v, joined: r.joined, members: r.members }); } catch { setError('Не получилось — проверь связь.'); }
  }
  async function thank(m: NightMsg) {
    try { const r = await thankNight(m.id); setV((x) => (x ? { ...x, messages: x.messages.map((y) => (y.id === m.id ? { ...y, thanks: r.thanks } : y)) } : x)); } catch { /* своё или уже */ }
  }

  if (!v) return <div className="aska-room-page"><button className="btn rm-back" onClick={onBack}>‹ Комнаты</button><div className="hint">{error || 'Открываю комнату…'}</div></div>;
  const r = { ...v.room, ...(ov?.rooms.find((x) => x.key === roomKey) || {}) };
  const c = v.council;
  const feed = [...v.messages].reverse(); // новое сверху, как в ленте сообщества
  return (
    <div className="aska-room-page">
      <div className="rm-cover" style={coverStyle(r)}>
        <button className="btn rm-back" onClick={onBack} aria-label="Назад к комнатам">‹ Комнаты</button>
        <span className="rm-cover-art" aria-hidden="true">{r.emoji}</span>
      </div>
      <div className="rm-head">
        <RoomAva r={r} size={84} />
        <div className="rm-title">
          <h2>{r.title}</h2>
          <span>{r.short || ''}</span>
        </div>
      </div>
      <div className="rm-stats">
        <span>👥 {people(v.members || 0)}</span>
        {r.online ? <span>🟢 {r.online} в сети</span> : null}
        {c.president && <span>👑 {c.president.nick}</span>}
      </div>
      <div className="rm-actions">
        <button className={`btn${v.joined ? '' : ' primary'}`} onClick={toggleJoin}>{v.joined ? '✓ Ты в комнате' : 'Вступить — бесплатно'}</button>
        <button className="btn" onClick={() => input.current?.focus()}>✍️ Написать</button>
        <button className="btn" onClick={() => setAbout((x) => !x)} aria-expanded={about}>ℹ️ О комнате</button>
      </div>
      {about && (
        <div className="rm-about">
          <p>{r.about}</p>
          <div className="rm-council">
            {c.president && <span>👑 Президент: <b>{c.president.nick}</b></span>}
            {c.advisors.length > 0 && <span>🎩 Советники: {c.advisors.map((x) => x.nick).join(', ')}</span>}
            {c.keepers.length > 0 && <span>🗝 Хранители: {c.keepers.map((x) => x.nick).join(', ')}</span>}
            {c.jedi.length > 0 && <span>⚔️ Джедаи: {c.jedi.map((x) => x.nick).join(', ')}</span>}
          </div>
          <div className="hint">Ранги — по репутации: пиши и получай «🙏 спасибо». Комната открыта всем в АСЬКЕ — не пиши сюда личное.</div>
        </div>
      )}
      {v.faces && v.faces.length > 0 && (
        <div className="rm-faces">
          <div className="legend-s">Участники</div>
          <div className="rm-faces-row">{v.faces.map((f) => <span key={f.id} className="rm-face-w" title={f.nick}><Face a={f} size={40} /><small>{f.nick}</small></span>)}</div>
        </div>
      )}
      <div className="rm-compose">
        <textarea ref={input} className="field" rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={v.joined ? 'Что нового? Напиши в комнату…' : 'Напиши — и ты в комнате (бесплатно)'} />
        <div className="row">
          <span className="hint">{ov?.avatar ? `Пишешь как «${ov.avatar.nick}»` : <>Пишешь под своим именем · <button className="link aska-linkbtn" onClick={onNft}>🎴 ник и пиксельный аватар</button></>}</span>
          <span className="sp" />
          <button className="btn primary" disabled={busy || !text.trim()} onClick={send}>Опубликовать</button>
        </div>
        {error && <div className="err">{error}</div>}
      </div>
      <div className="rm-feed">
        {feed.map((m) => (
          <article key={m.id} className="rm-post">
            <header>
              <Face a={m.avatar} size={42} />
              <span className="rm-who">
                <b>{m.avatar.nick}</b>
                <small>{RANK_NAME[m.avatar.rank].emoji} {RANK_NAME[m.avatar.rank].name} · {ago(m.at)}</small>
              </span>
            </header>
            <p>{m.text}</p>
            <footer>
              <button className={`rm-thx${m.thanks ? ' on' : ''}`} onClick={() => thank(m)} aria-label="Спасибо">🙏 {m.thanks || ''}</button>
              <button className="rm-reply" onClick={() => { setText((t) => `${m.avatar.nick}, ${t}`); input.current?.focus(); }}>Ответить</button>
            </footer>
          </article>
        ))}
      </div>
      {nftOpen && ov && <NftPicker price={ov.prices.nft} onClose={onNftClose} onDone={onNftDone} />}
    </div>
  );
}
