import { useId } from 'react';
import { hash } from '../lib/format.js';

/* Аватар команды: узор из узлов и связей, устойчивый для каждой команды.
   Никаких картинок — рисуется вектором, как и всё остальное. */

const TONES = ['#8e7bf5', '#79d2bf', '#6d9bff', '#e9b872', '#f2789b', '#5fb8e0'];

export function teamTone(team) {
  return TONES[hash(team?.id || 'x') % TONES.length];
}

export default function TeamAvatar({ team, size = 48, radius = 0.3 }) {
  const id = useId().replace(/:/g, '');
  const tone = teamTone(team);
  const seed = hash(team?.id || 'x');

  const nodes = Array.from({ length: 5 }, (_, i) => {
    const a = ((seed >> (i * 3)) % 360) * (Math.PI / 180);
    const r = 18 + ((seed >> i) % 16);
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  });

  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: size * radius, overflow: 'hidden' }}>
      <svg viewBox="0 0 100 100" style={{ display: 'block', width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={`tm${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0b0d14" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#tm${id})`} />
        <g stroke="#fff" strokeOpacity="0.4" strokeWidth="1.2">
          {nodes.map(([x1, y1], i) => nodes.slice(i + 1).map(([x2, y2], j) => <line key={`${i}-${j}`} x1={x1} y1={y1} x2={x2} y2={y2} />))}
        </g>
        {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i ? 4 : 6} fill="#fff" fillOpacity={i ? 0.75 : 1} />)}
      </svg>
    </div>
  );
}
