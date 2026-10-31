// 🕸 Мой нетворк: все, кого ты позвал, и вся цепочка дальше от них. «Мы в ответе за тех, кого пригласили».
import { useEffect, useState } from 'react';
import { useStore } from '../useStore.ts';
import { getNetwork } from '../lib/levels.ts';
import type { Network as NetData, NetNode } from '../lib/levels.ts';
import { userFlower } from '../lib/aska.ts';
import { Ico } from './Win.tsx';
import { Plate } from './Plate.tsx';
import { TierBadge } from './Levels.tsx';

function Node({ n, onProfile }: { n: NetNode; onProfile: (id: number) => void }) {
  const s = useStore();
  const [open, setOpen] = useState(n.depth < 2);
  const u = s.users[n.id];
  return (
    <li className={`aska-net-node d${Math.min(n.depth, 4)}${n.blocked ? ' blocked' : ''}`}>
      <div className="row">
        {n.children.length > 0
          ? <button className="aska-net-tog" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Свернуть' : 'Развернуть'}>{open ? '−' : '+'}</button>
          : <span className="aska-net-tog leaf">•</span>}
        <Ico className={`ico${u?.gold ? ' gold' : ''}`} html={userFlower(u || { gold: n.tier !== 'guest', tier: n.tier }, !!s.presence[n.id], 16)} />
        <b className="link" onClick={() => onProfile(n.id)}>{n.name}</b>
        {n.tier !== 'guest' && <TierBadge tier={n.tier} />}
        {n.blocked && <span className="aska-net-bad">🚫 заблокирован(а)</span>}
        <span className="sp" />
        {n.size > 0 && <span className="aska-net-size" title="Сколько человек дальше по его цепочке">🕸 {n.size}</span>}
        {n.plate && <Plate plate={n.plate} country={u?.plateCountry || 'RU'} size="s" />}
      </div>
      {open && n.children.length > 0 && <ul>{n.children.map((c) => <Node key={c.id} n={c} onProfile={onProfile} />)}</ul>}
    </li>
  );
}

export function Network({ onProfile, onInvite }: { onProfile: (id: number) => void; onInvite: () => void }) {
  const [net, setNet] = useState<NetData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { getNetwork().then(setNet).catch(() => setError('Не получилось загрузить. Проверь интернет.')); }, []);
  if (!net) return <div className="hint">{error || 'Загружаю…'}</div>;
  const b = net.bonuses;
  return (
    <>
      <div className="aska-net-hero">
        <b>🕸 {net.netSize}</b>
        <span>{net.netSize === 1 ? 'человек' : 'человек'} в твоём нетворке</span>
        <span className="lines">{net.lines.slice(0, 3).map((n, i) => <i key={i}>{i + 1}-я линия: <b>{n}</b></i>)}</span>
        <span className="earn">заработано на нетворке: <b>🪙 {net.earned}</b></span>
      </div>
      <div className="aska-rule-card">
        <b>🤝 Мы в ответе за тех, кого пригласили</b>
        <span>Каждый, кого ты позвал(а), и все, кого позвали они, — твой нетворк. Растёт он — растут и аськоины:</span>
        <ul>
          <li>+{b.lines[0]} 🪙 — твой друг пришёл (1-я линия)</li>
          <li>+{b.lines[1]} 🪙 — друг твоего друга (2-я линия), +{b.lines[2]} 🪙 — 3-я линия</li>
          <li>+{b.gold} 🪙 — твой друг стал Голд</li>
          <li>{b.netGold} человек в нетворке — Голд навсегда ⭐</li>
          <li className="bad">−{b.penalty} 🪙 — если твоего приглашённого заблокируют за нарушения. Зови тех, за кого ручаешься.</li>
        </ul>
        <div className="aska-prog"><i style={{ width: `${Math.min(100, (net.netSize / b.netGold) * 100)}%` }} /><span>до Голд навсегда: {Math.min(net.netSize, b.netGold)} из {b.netGold}</span></div>
      </div>
      {net.invitedBy && <div className="hint">Тебя позвал(а): <b className="link" onClick={() => onProfile(net.invitedBy!.id)}>{net.invitedBy.name}</b> — вы в одной цепочке.</div>}
      <div className="groupbox">
        <div className="legend">Кого ты позвал(а) ({net.total})</div>
        {net.children.length ? <ul className="aska-net-tree">{net.children.map((n) => <Node key={n.id} n={n} onProfile={onProfile} />)}</ul>
          : <div className="hint">Пока никого. Позови первого друга — и нетворк начнётся с него.</div>}
      </div>
      <button className="btn primary aska-wide" onClick={onInvite}>➕ Позвать друга</button>
    </>
  );
}
