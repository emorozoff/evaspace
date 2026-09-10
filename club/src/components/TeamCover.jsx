import { useId } from 'react';
import { hash } from '../lib/format.js';
import { teamTone } from './TeamAvatar.jsx';

/* Обложка команды: четыре рисунка на выбор, все — вектор.
   Капитан может сменить её в один тап. */

export const COVERS = ['Сеть', 'Волны', 'Восход', 'Сетка'];

export default function TeamCover({ team, height = 132, children }) {
  const id = useId().replace(/:/g, '');
  const tone = teamTone(team);
  const kind = team?.cover ?? hash(team?.id || 'x') % COVERS.length;
  const seed = hash(team?.id || 'x');

  return (
    <div className="tcover" style={{ height }}>
      <svg viewBox="0 0 320 132" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`tc${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0e1119" />
          </linearGradient>
        </defs>
        <rect width="320" height="132" fill={`url(#tc${id})`} />
        <g fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="1">
          {kind === 0 && Array.from({ length: 8 }, (_, i) => {
            const x = 20 + ((seed >> i) % 280);
            const y = 16 + ((seed >> (i + 3)) % 100);
            return <g key={i}><circle cx={x} cy={y} r="3" fill="#fff" fillOpacity="0.5" /><line x1={x} y1={y} x2={160} y2={66} /></g>;
          })}
          {kind === 1 && [0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M-10 ${26 + i * 22} C 70 ${6 + i * 24}, 190 ${58 + i * 18}, 330 ${18 + i * 22}`} />
          ))}
          {kind === 2 && (
            <>
              {[0, 1, 2, 3].map((i) => <circle key={i} cx="230" cy="120" r={30 + i * 26} />)}
              <path d="M0 104h320" strokeOpacity="0.3" />
            </>
          )}
          {kind === 3 && (
            <>
              {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="132" strokeOpacity="0.1" />)}
              {Array.from({ length: 5 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 33} x2="320" y2={i * 33} strokeOpacity="0.1" />)}
              <circle cx="200" cy="66" r="34" strokeOpacity="0.35" />
            </>
          )}
        </g>
      </svg>
      <div className="tcover__shade" />
      {children}
    </div>
  );
}
