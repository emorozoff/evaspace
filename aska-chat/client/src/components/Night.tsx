// 🎴 Пиксельный НФТ-аватар для комнат — по желанию: в комнатах можно писать и под своим именем.
// Сами комнаты (сообщества по интересам и ночные) — в Rooms.tsx.
import { useEffect, useState } from 'react';
import { refreshState } from '../lib/store.ts';
import { nightCollection, mintAvatar } from '../lib/night.ts';
import { ApiError } from '../lib/api.ts';
import { Dialog } from './Win.tsx';
import { NftArt, traitsOf, rarityName } from './NftArt.tsx';

// Выбор НФТ-аватара: 96 пиксельных, занятые — серые; выбрал, придумал ник — купил
export function NftPicker({ price, onClose, onDone }: { price: number; onClose: () => void; onDone: () => void }) {
  const [list, setList] = useState<{ id: number; taken: boolean }[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { nightCollection().then(setList).catch(() => setError('Не получилось загрузить коллекцию.')); }, []);
  async function buy() {
    if (!sel) return;
    setBusy(true);
    setError('');
    try { await mintAvatar(sel, nick.trim()); await refreshState(); onDone(); } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(code === 'taken' ? 'Этот аватар или ник уже заняты.' : code === 'bad_nick' ? 'Ник — от 3 до 20 знаков: буквы, цифры, _ и -.' : code === 'no_coins' ? `Не хватает аськоинов: нужно ${price} 🪙.` : 'Не получилось.');
      setBusy(false);
    }
  }
  const t = sel ? traitsOf(sel) : null;
  return (
    <Dialog title="🎴 Пиксельный аватар" onClose={onClose}>
      <div className="hint">По желанию: в комнатах можно писать и под своим именем. Пиксельная коллекция из 96 штук, каждый — один на всю АСЬКУ, выпускается в цепочку блоков. С ним ты пишешь во всех комнатах под своим ником.</div>
      {sel && t && (
        <div className="aska-nft-sel">
          <NftArt id={sel} size={88} />
          <span className="t">
            <b>НФТ #{String(sel).padStart(2, '0')}</b>
            <span>{t.speciesName} · {rarityName(t.rare)}</span>
            <input className="field" value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder="ник, например Пиксель_99" />
            <button className="btn primary" disabled={busy || nick.trim().length < 3} onClick={buy}>Купить за {price} 🪙</button>
          </span>
        </div>
      )}
      {error && <div className="err">{error}</div>}
      <div className="aska-nft-grid">
        {(list || []).map((a) => (
          <button key={a.id} className={`aska-nft-cell${sel === a.id ? ' on' : ''}`} disabled={a.taken} onClick={() => setSel(a.id)} title={a.taken ? 'уже у кого-то' : `#${a.id}`}>
            <NftArt id={a.id} size={40} />
            <small>{a.taken ? 'занят' : `#${a.id}`}</small>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
