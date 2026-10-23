// Выбор статуса: готовые («медитирую», «сплю», «смотрю кинч», «вджобываю»…) или свой — эмодзи и пара слов.
import { useState } from 'react';
import { useStore } from '../useStore.ts';
import { setStatus } from '../lib/store.ts';
import { STATUSES } from '../lib/statuses.ts';
import { Dialog } from './Win.tsx';

export function StatusPicker({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const cur = s.me ? s.users[s.me.userId]?.status : null;
  const [emoji, setEmoji] = useState('✨');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(st: Parameters<typeof setStatus>[0]) {
    setBusy(true);
    setError('');
    try { await setStatus(st); onClose(); } catch { setError('Не получилось. Проверь интернет.'); } finally { setBusy(false); }
  }

  return (
    <Dialog title="Мой статус" onClose={onClose}>
      <div className="aska-status-now">
        {cur ? <>Сейчас: <b>{cur.emoji} {cur.text}</b></> : 'Статуса нет — друзья видят просто «в сети».'}
      </div>
      <div className="aska-status-grid">
        {STATUSES.map((x) => (
          <button key={x.key} className={`btn${cur && cur.emoji === x.emoji && cur.text === x.text ? ' on' : ''}`} disabled={busy} onClick={() => pick({ key: x.key })}>
            <i>{x.emoji}</i><span>{x.text}</span>
          </button>
        ))}
      </div>
      <div className="legend-line">Свой статус</div>
      <div className="row aska-status-own">
        <input className="field emo" value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} aria-label="Эмодзи" />
        <input className="field" value={text} maxLength={40} placeholder="например: пишу диплом" onChange={(e) => setText(e.target.value)} />
        <button className="btn primary" disabled={busy || !text.trim()} onClick={() => {
          if (emoji.trim() && !/\p{Extended_Pictographic}/u.test(emoji)) return setError('В первом поле — только эмодзи 🙂');
          pick({ emoji: emoji.trim(), text: text.trim() });
        }}>Ок</button>
      </div>
      {error && <div className="err">{error}</div>}
      {cur && <button className="btn aska-status-clear" disabled={busy} onClick={() => pick(null)}>Снять статус</button>}
    </Dialog>
  );
}
