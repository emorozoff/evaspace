import { useId, useMemo } from 'react';
import { guillochePath, qrMatrix, seeded } from '../lib/art.js';
import { initials } from '../lib/format.js';
import { toneOf } from '../data/people.js';
import Icon from './Icons.jsx';

export const GOLD = '#C9A96E';

/* ---------- знак UHOME ---------------------------------------------------- */
/* Дом и буква U в одном контуре: крыша-шеврон над подковой, внутри точка —
   свет в окне. Одна линия, читается и в 17 пикселях, и на иконке. */
export function Mark({ size = 40, color = GOLD, ring = false, glow = false }) {
  return (
    <svg
      viewBox="0 0 100 100" width={size} height={size} aria-hidden="true"
      style={{ display: 'block', flex: 'none', filter: glow ? `drop-shadow(0 0 16px ${color}55)` : undefined }}
    >
      {ring && <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1.6" />}
      <path d="M22 47 50 24 78 47" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33 50v12a17 17 0 0 0 34 0V50" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="58" r="4.6" fill={color} />
    </svg>
  );
}

/* ---------- аватар -------------------------------------------------------- */
/* Сквиркл мягкого тона роли, инициалы тем же цветом — спокойно и читается
   даже в 24 пикселях. У команды клуба вместо инициалов знак UHOME. */
export function Avatar({ person, size = 44, ring = null, dot = false, style, radius = 0.32 }) {
  const team = person?.id === 'team';
  const tone = team ? GOLD : toneOf(person);
  const r = size * radius;
  return (
    <div
      className="ava"
      style={{
        width: size, height: size, fontSize: size * 0.36, borderRadius: r, color: tone,
        // крупный аватар (карточка знакомства, профиль) — тон насыщеннее
        background: size >= 72 ? `linear-gradient(${tone}40, ${tone}24), #141720` : `linear-gradient(${tone}2b, ${tone}1c), #141720`, ...style,
      }}
    >
      {team ? <Mark size={size * 0.6} /> : initials(person?.name)}
      {ring && <i className="ava__ring" style={{ borderColor: ring, borderRadius: r + 3 }} />}
      {dot && <i className="ava__dot" />}
    </div>
  );
}

/* Плитка с иконкой на мягком тоне: сообщества, темы базы, новости. */
export function Tile({ icon, tone = GOLD, size = 44, radius }) {
  return (
    <span
      style={{
        width: size, height: size, flex: 'none', borderRadius: radius ?? size * 0.3, display: 'grid', placeItems: 'center',
        color: tone, background: `linear-gradient(${tone}26, ${tone}14), #141720`,
      }}
    >
      <Icon name={icon} size={size * 0.46} />
    </span>
  );
}

/* Аватар группы: четыре участника в одном сквиркле — сразу видно, что это люди, а не канал. */
export function GroupAva({ members = [], size = 56, ring = null }) {
  const four = members.slice(0, 4);
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <div className="gava" style={{ width: size, height: size }}>
        {four.map((p) => {
          const tone = toneOf(p);
          return (
            <span key={p.id} style={{ color: tone, fontSize: size * 0.2, background: `linear-gradient(${tone}33, ${tone}1c), #141720` }}>
              {initials(p.name)}
            </span>
          );
        })}
      </div>
      {ring && <i className="ava__ring" style={{ borderColor: ring, borderRadius: size * 0.32 + 3 }} />}
    </div>
  );
}

export function AvaStack({ people, size = 26, max = 5 }) {
  const shown = people.slice(0, max);
  return (
    <div className="ava-stack">
      {shown.map((p) => <Avatar key={p.id} person={p} size={size} />)}
    </div>
  );
}

/* ---------- гильош -------------------------------------------------------- */
export function Guilloche({ color = GOLD, opacity = 0.3, seed = 1, size = 220 }) {
  const rings = useMemo(() => {
    const rnd = seeded('g' + seed);
    return [0, 1, 2].map((i) => ({
      d: guillochePath({ R: 100 - i * 16, r: 17 + Math.floor(rnd() * 9) + i, d: 52 - i * 9, turns: 17 + i * 4, steps: 620 }),
      o: opacity * (1 - i * 0.22),
    }));
  }, [seed, opacity]);
  return (
    <svg viewBox="-110 -110 220 220" width={size} height={size} aria-hidden="true">
      {rings.map((r, i) => (
        <path key={i} d={r.d} fill="none" stroke={color} strokeWidth="0.32" strokeOpacity={r.o} />
      ))}
    </svg>
  );
}

/* ---------- код на входе -------------------------------------------------- */
/* Тёмная плашка, светлые скруглённые модули и золотые угловые метки. */
export function QR({ value, size = 92, tone = GOLD, ink = '#EDE4D0', bg = '#0e1016', radius = 12 }) {
  const id = useId().replace(/:/g, '');
  const n = 25;
  const grid = useMemo(() => qrMatrix(value, n), [value]);
  const pad = Math.max(3, size * 0.085);
  const cell = (size - pad * 2) / n;

  const inEye = (x, y) => {
    const near = (ox, oy) => x >= ox - 1 && x <= ox + 7 && y >= oy - 1 && y <= oy + 7;
    return near(0, 0) || near(n - 7, 0) || near(0, n - 7);
  };

  const dots = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!grid[y][x] || inEye(x, y)) continue;
      dots.push(
        <rect key={`${x}-${y}`} x={pad + x * cell + cell * 0.1} y={pad + y * cell + cell * 0.1}
          width={cell * 0.8} height={cell * 0.8} rx={cell * 0.34} fill={ink} opacity={0.72 + ((x * 7 + y * 5) % 5) * 0.056} />
      );
    }
  }
  const eye = (ox, oy) => (
    <g key={`${ox}-${oy}`}>
      <rect x={pad + ox * cell + cell * 0.5} y={pad + oy * cell + cell * 0.5} width={cell * 6} height={cell * 6} rx={cell * 1.9} fill="none" stroke={tone} strokeWidth={cell} />
      <rect x={pad + (ox + 2) * cell} y={pad + (oy + 2) * cell} width={cell * 3} height={cell * 3} rx={cell * 0.95} fill={tone} />
    </g>
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flex: 'none' }}>
      <defs>
        <linearGradient id={`qr${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor="#04050a" />
        </linearGradient>
      </defs>
      <rect width={size} height={size} rx={radius} fill={`url(#qr${id})`} />
      <rect x="0.6" y="0.6" width={size - 1.2} height={size - 1.2} rx={radius - 0.6} fill="none" stroke={tone} strokeOpacity="0.32" strokeWidth="1.2" />
      {dots}
      {[eye(0, 0), eye(n - 7, 0), eye(0, n - 7)]}
    </svg>
  );
}
