// Супер-смайл: большой эмодзи с движением, свечением и эффектами вокруг; нажал — звучит его звук (2 секунды)
// и анимация вспыхивает ещё раз. Набор — SUPER в lib/sfx.ts.
import { useState } from 'react';
import { superOf, playSuper, KAOMOJI, SYMBOLS } from '../lib/sfx.ts';

export function SuperSmile({ e, size = 'm', onClick }: { e: string; size?: 's' | 'm' | 'l'; onClick?: () => void }) {
  const x = superOf(e);
  const [boost, setBoost] = useState(0);
  if (!x) return <>{e}</>;
  const fx = x.fx ? Array.from({ length: 6 }, (_, i) => x.fx![i % x.fx!.length]) : [];
  return (
    <span key={boost} className={`aska-super ${size} ss-${x.anim}${boost ? ' boost' : ''}`} title={x.name} role="img" aria-label={x.name}
      style={{ ['--glow' as string]: x.glow }}
      onClick={(ev) => { ev.stopPropagation(); playSuper(x.e); setBoost((b) => b + 1); onClick?.(); }}>
      <span className="ss-glow" />
      {fx.map((f, i) => <i key={i} className="ss-fx" style={{ left: `${6 + i * 16}%`, animationDelay: `${i * 0.28}s` }}>{f}</i>)}
      <span className="ss-e">{x.e}</span>
    </span>
  );
}

// Прикольные символы: каомодзи и значки — вставляются в текст
export function SymbolGrid({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="aska-symbols">
      <div className="aska-sym-row">
        {KAOMOJI.map((k) => <button key={k} className="aska-kao" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(k)}>{k}</button>)}
      </div>
      <div className="aska-sym-row">
        {SYMBOLS.map((k) => <button key={k} className="aska-sym" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(k)}>{k}</button>)}
      </div>
      <div className="cap">нажми — символ вставится в текст</div>
    </div>
  );
}
