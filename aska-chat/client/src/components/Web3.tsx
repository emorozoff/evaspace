// 🔗 Мои данные (Web3): твой телефон — узел цепочки АСЬКИ. Он хранит копию блоков и сам проверяет каждый хеш;
// проверенный конец цепочки он сообщает серверу — так видно, сколько телефонов-свидетелей подтверждают одну и ту же цепочку.
// Здесь же честно: что лежит на телефоне, что видит сервер и что читает ИИ.
import { useEffect, useState } from 'react';
import { useStore } from '../useStore.ts';
import { allMessages } from '../lib/db.ts';
import type { ChainCopy } from '../lib/web3.ts';
import { syncChain, chainCopy, chainNetwork } from '../lib/web3.ts';

const short = (h?: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—');
const dt = (ts: number) => (ts ? new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export function Web3({ onCharter }: { onCharter: () => void }) {
  const s = useStore();
  const [copy, setCopy] = useState<ChainCopy | null>(null);
  const [net, setNet] = useState<{ witnesses: number; atHead: number; blocks: number } | null>(null);
  const [msgs, setMsgs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const check = async () => {
    setBusy(true); setError('');
    try { const r = await syncChain(); setCopy(r); if (r.network) setNet(r.network); else chainNetwork().then(setNet).catch(() => {}); } catch { setError('Нет связи — проверю, когда появится.'); } finally { setBusy(false); }
  };
  useEffect(() => {
    chainCopy().then((c) => c && setCopy(c));
    allMessages().then((m) => setMsgs(m.length)).catch(() => {});
    check();
  }, []);
  function download() {
    const blob = new Blob([JSON.stringify({ app: 'АСЬКА', what: 'копия цепочки блоков', savedAt: new Date().toISOString(), ...copy }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aska-chain-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const head = copy?.blocks[copy.blocks.length - 1];
  const chats = Object.keys(s.chats).length;
  return (
    <div className="aska-web3">
      <div className={`w3-node${copy && !copy.ok ? ' bad' : ''}`}>
        <div className="w3-ico" aria-hidden="true">⛓</div>
        <div>
          <b>{copy && !copy.ok ? '⚠️ Цепочка не сошлась' : 'Твой телефон — узел сети АСЬКИ'}</b>
          <small>{copy && !copy.ok
            ? `Блок №${copy.brokenAt || copy.tamperedAt} не совпал с копией на телефоне — кто-то пытался переписать прошлое. Сообщи администрации.`
            : `Хранит ${copy?.blocks.length ?? 0} блоков и сам проверяет каждый хеш.`}</small>
        </div>
      </div>
      <div className="fx-stats w3-stats">
        <div><b>{copy?.blocks.length ?? 0}</b><small>блоков на телефоне</small></div>
        <div><b>{net?.witnesses ?? '—'}</b><small>телефонов-свидетелей</small></div>
        <div><b>{net?.atHead ?? '—'}</b><small>подтвердили последний блок</small></div>
        <div><b>{dt(copy?.verifiedAt || 0)}</b><small>проверено</small></div>
      </div>
      <div className="row aska-kv"><span>Последний блок</span><b className="mono">№{head?.id ?? 0} · {short(head?.hash)}</b></div>
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={check}>{busy ? 'Проверяю…' : '🔍 Проверить цепочку'}</button>
        <button className="btn" disabled={!copy?.blocks.length} onClick={download}>⬇ Скачать копию</button>
      </div>
      {error && <div className="err">{error}</div>}

      <div className="groupbox">
        <div className="legend">📱 На твоём телефоне</div>
        <ul className="w3-list">
          <li>🔑 Секретный ключ шифрования — только здесь (на сервере лишь копия, запертая твоим паролем)</li>
          <li>💬 Переписка: {msgs ?? '…'} сообщений в {chats} беседах — расшифрованы только на этом телефоне</li>
          <li>⛓ Копия цепочки блоков: {copy?.blocks.length ?? 0} блоков</li>
          <li>🎨 Стиль, черновики, настройки</li>
        </ul>
      </div>
      <div className="groupbox">
        <div className="legend">🖥 Что видит сервер</div>
        <ul className="w3-list">
          <li>🔒 Шифр сообщений и кто, кому и когда писал — не текст</li>
          <li>🌐 Открытое всем в АСЬКЕ: имя, номер, стены, НФТ-галерея, ночные комнаты, общий чат</li>
          <li>🪙 Аськоины и НФТ — записи в цепочке блоков</li>
          <li>🤖 Переписку с ИИ (Аська, Батя, личные ИИ) читает нейросеть — это исключение, оно написано в правилах</li>
        </ul>
      </div>
      <div className="hint">Тестовые механизмы UPASS: сеть АСЬКИ — сервер и телефоны участников, публичного блокчейна пока нет. Функционал принадлежит другой компании и лицензируется.</div>
      <button className="btn" onClick={onCharter}>📜 Правила и цели</button>
    </div>
  );
}
