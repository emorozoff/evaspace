import { go } from '../lib/router.jsx';
import { assistantOf } from '../lib/assistant.js';
import { unreadOf } from '../lib/select.js';
import { AvatarPortrait } from './AvatarArt.jsx';

/* Голограмма ассистента: портрет в двух встречных кольцах с делениями,
   по лицу иногда проходит линия сканера. Кольца — только transform,
   без движения (reduced motion) стоят на месте. */
export function HoloPortrait({ who = 'eva', size = 56, scan = false, still = false }) {
  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const r1 = 47, r2 = long ? 43.5 : 45.2;
    ticks.push(`M${(50 + Math.cos(a) * r1).toFixed(2)} ${(50 + Math.sin(a) * r1).toFixed(2)}L${(50 + Math.cos(a) * r2).toFixed(2)} ${(50 + Math.sin(a) * r2).toFixed(2)}`);
  }
  return (
    <span className={`xholo${still ? ' xholo--still' : ''}`} style={{ '--hs': `${size}px` }}>
      <span className="xholo__glow" aria-hidden="true" />
      <svg className="xholo__ring xholo__ring--a" viewBox="0 0 100 100" aria-hidden="true">
        <path d={ticks.join('')} stroke="currentColor" strokeWidth="0.55" />
        <circle cx="50" cy="50" r="49.3" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.4" strokeDasharray="0.6 2.4" />
      </svg>
      <svg className="xholo__ring xholo__ring--b" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 8 A42 42 0 0 1 88.5 33" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M50 92 A42 42 0 0 1 11.5 67" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <circle cx="88.5" cy="33" r="1.4" fill="currentColor" />
        <circle cx="11.5" cy="67" r="1.4" fill="currentColor" />
      </svg>
      <span className="xholo__face">
        <AvatarPortrait who={who} size={size} />
        {scan && <span className="xholo__scan" aria-hidden="true" />}
      </span>
    </span>
  );
}

/* Ассистент всегда под рукой: портрет над таб-баром на каждой вкладке. */
export default function AiFab({ app }) {
  const A = assistantOf(app);
  return (
    <button className="aifab" onClick={() => go('/ai')} aria-label={`Спросить ${A.acc}`}>
      <i className="aifab__orbit" aria-hidden="true" />
      <AvatarPortrait who={A.id} size={58} />
      {unreadOf(app, 'ai') > 0 && <i className="aifab__dot" />}
    </button>
  );
}
