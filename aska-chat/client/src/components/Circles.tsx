// Круги — общие беседы по интересам: мои, все открытые и «создать свой».
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useStore } from '../useStore.ts';
import { listCircles, joinCircle, createCircle } from '../lib/store.ts';
import type { CircleInfo } from '../lib/store.ts';
import { flower } from '../lib/aska.ts';
import { plural } from '../lib/format.ts';
import { Ico } from './Win.tsx';

const EMOJI = ['⭕', '🏡', '⚽', '🎮', '📚', '🐶', '🍕', '🎉', '💼', '🎸', '🌿', '🚗'];

export function Circles({ onOpen }: { onOpen: (chatId: string) => void }) {
  const s = useStore();
  const [list, setList] = useState<CircleInfo[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // рабочие чаты («Бизнес») живут в своих разделах, не среди кругов
  const load = () => listCircles().then((l) => setList(l.filter((c) => !c.biz))).catch(() => setError('Не получилось загрузить круги. Проверь интернет.'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function join(c: CircleInfo) {
    setBusy(c.id);
    setError('');
    try { onOpen(await joinCircle(c.id)); } catch { setError('Не получилось вступить. Попробуй ещё раз.'); } finally { setBusy(null); }
  }

  if (creating) return <CreateCircle onDone={(id) => { setCreating(false); if (id) onOpen(id); else load(); }} />;

  const mine = (list || []).filter((c) => c.member || s.chats[c.id]);
  const others = (list || []).filter((c) => !c.member && !s.chats[c.id]);
  const row = (c: CircleInfo, action: 'open' | 'join') => (
    <div key={c.id} className="citem aska-circle" onClick={() => (action === 'open' ? onOpen(c.id) : join(c))}>
      <span className="aska-circle-emoji">{c.emoji}</span>
      <span className="cmeta">
        <span className="nick">{c.title}</span>
        <span className="sub">{c.about}</span>
        <span className="sub aska-circle-meta">
          <Ico html={flower(c.online ? 'online' : 'offline', 10)} />{c.count} {plural(c.count, 'участник', 'участника', 'участников')}, в сети {c.online}
        </span>
      </span>
      {action === 'join' && <button className="btn" disabled={busy === c.id} onClick={(e) => { e.stopPropagation(); join(c); }}>{busy === c.id ? '…' : 'Вступить'}</button>}
    </div>
  );

  return (
    <>
      <div className="hint aska-lead">Круги — беседы по интересам. Вступай в любой или создай свой и позови друзей.</div>
      {error && <div className="err">{error}</div>}
      {!list && !error && <div className="hint">Загружаю…</div>}
      {list && (
        <>
          <div className="groupbox">
            <div className="legend">Мои круги ({mine.length})</div>
            <div className="clist aska-circles">{mine.map((c) => row(c, 'open'))}</div>
          </div>
          {others.length > 0 && (
            <div className="groupbox">
              <div className="legend">Можно вступить ({others.length})</div>
              <div className="clist aska-circles">{others.map((c) => row(c, 'join'))}</div>
            </div>
          )}
        </>
      )}
      <div className="right mt"><button className="btn primary" onClick={() => setCreating(true)}>+ Создать круг</button></div>
    </>
  );
}

function CreateCircle({ onDone }: { onDone: (chatId: string | null) => void }) {
  const s = useStore();
  const me = s.me!.userId;
  const [title, setTitle] = useState('');
  const [about, setAbout] = useState('');
  const [emoji, setEmoji] = useState('⭕');
  const [isPublic, setPublic] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const people = Object.values(s.users).filter((u) => u.id !== me && (u.kind || 'human') === 'human')
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError('Придумай название.');
    setBusy(true);
    setError('');
    try {
      onDone(await createCircle({ title: title.trim(), about: about.trim(), emoji, memberIds: picked, isPublic }));
    } catch {
      setError('Не получилось создать круг. Попробуй ещё раз.');
      setBusy(false);
    }
  }

  return (
    <form className="col" onSubmit={submit}>
      <div className="groupbox">
        <div className="legend">Новый круг</div>
        <div className="chips aska-emoji-pick">
          {EMOJI.map((x) => <button type="button" key={x} className={`chip${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>)}
        </div>
        <label className="aska-field"><span className="lbl">Название</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Например, «Дача»" autoFocus />
        </label>
        <label className="aska-field"><span className="lbl">О чём он</span>
          <input className="field" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} placeholder="Необязательно" />
        </label>
        <label className="row aska-check">
          <input type="checkbox" checked={isPublic} onChange={(e) => setPublic(e.target.checked)} />
          <span>Открытый — вступить может любой в АСЬКЕ</span>
        </label>
      </div>
      <div className="groupbox">
        <div className="legend">Позвать ({picked.length})</div>
        {!people.length && <div className="hint">Пока некого — позови друзей в АСЬКУ.</div>}
        <div className="aska-pick-list">
          {people.map((u) => (
            <label key={u.id} className="row aska-check">
              <input type="checkbox" checked={picked.includes(u.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, u.id] : p.filter((x) => x !== u.id)))} />
              <span>{u.displayName}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <div className="err">{error}</div>}
      <div className="row mt">
        <button type="button" className="btn" onClick={() => onDone(null)} disabled={busy}>Отмена</button>
        <span className="sp" />
        <button className="btn primary" disabled={busy}>{busy ? 'Создаю…' : 'Создать'}</button>
      </div>
    </form>
  );
}
