import { useMemo, useId } from 'react';
import { guillochePath, wavePath, qrMatrix, seeded, coverFrom } from '../lib/art.js';
import { initials } from '../lib/format.js';

/* ---------- аватар ------------------------------------------------------- */
export function Avatar({ person, size = 44, ring = null, dot = false, style }) {
  const tone = person?.tone || '#8E7BF5';
  const id = useId().replace(/:/g, '');
  return (
    <div className="ava" style={{ width: size, height: size, fontSize: size * 0.34, ...style }}>
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={`av${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0b0d14" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#av${id})`} />
        <circle cx="72" cy="26" r="30" fill="#fff" opacity="0.09" />
      </svg>
      <span style={{ position: 'relative' }}>{initials(person?.name)}</span>
      {ring && <i className="ava__ring" style={{ borderColor: ring }} />}
      {dot && <i className="ava__dot" />}
    </div>
  );
}

/* ---------- генеративная обложка ----------------------------------------- */
export function Cover({ art, seed = 'x', height = 132, radius = 16, children, style }) {
  const id = useId().replace(/:/g, '');
  const [c1, c2] = art && art.length === 2 ? art : coverFrom(seed);
  const pattern = useMemo(() => {
    const rnd = seeded(seed);
    const kind = Math.floor(rnd() * 4);
    const items = [];
    if (kind === 0) {
      for (let i = 0; i < 7; i++) items.push(<circle key={i} cx={40 + rnd() * 240} cy={30 + rnd() * 90} r={18 + rnd() * 54} fill="none" stroke="#fff" strokeOpacity={0.11} strokeWidth="1" />);
    } else if (kind === 1) {
      for (let i = 0; i < 16; i++) { const x = i * 26 - 40; items.push(<line key={i} x1={x} y1="0" x2={x + 90} y2="160" stroke="#fff" strokeOpacity={0.08} strokeWidth="1" />); }
    } else if (kind === 2) {
      for (let i = 0; i < 5; i++) items.push(<path key={i} d={wavePath({ w: 320, h: 160, y0: 24 + i * 26, amp: 7 + rnd() * 7, freq: 1.6 + rnd() * 1.6 })} fill="none" stroke="#fff" strokeOpacity={0.1} strokeWidth="1" />);
    } else {
      for (let i = 0; i < 46; i++) items.push(<circle key={i} cx={rnd() * 320} cy={rnd() * 160} r={1 + rnd() * 2.2} fill="#fff" fillOpacity={0.13} />);
    }
    return items;
  }, [seed]);

  return (
    <div style={{ position: 'relative', height, borderRadius: radius, overflow: 'hidden', ...style }}>
      <svg viewBox="0 0 320 160" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={`cv${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
        <rect width="320" height="160" fill={`url(#cv${id})`} />
        {pattern}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(6,7,11,.34) 0%, rgba(6,7,11,.06) 32%, rgba(6,7,11,.72) 100%)',
        }}
      />
      {children}
    </div>
  );
}

/* ---------- гильош ------------------------------------------------------- */
export function Guilloche({ color = '#D7B06A', opacity = 0.3, seed = 1, size = 220 }) {
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

/* ---------- печать клуба -------------------------------------------------- */
export function Seal({ size = 96, color = '#D7B06A', motto = 'EX UMBRA IN ·····', onClick, glow = false }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', filter: glow ? `drop-shadow(0 0 14px ${color}66)` : 'none' }}>
      <defs>
        <path id={`mp${id}`} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
        <linearGradient id={`sg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#7a5c26" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="0.8" />
      <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="0.8" />
      <text fontSize="7.4" fill={color} fillOpacity="0.85" letterSpacing="3.4" fontFamily="Manrope, sans-serif" fontWeight="700">
        <textPath href={`#mp${id}`} startOffset="50%" textAnchor="middle">{motto}</textPath>
      </text>
      <circle cx="60" cy="60" r="34" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="0.6" />
      <path d="M60 30 L86 75 L34 75 Z" fill="none" stroke={`url(#sg${id})`} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M60 44 L74 69 L46 69 Z" fill={color} fillOpacity="0.12" stroke={color} strokeOpacity="0.5" strokeWidth="0.7" />
      <circle cx="60" cy="60" r="4.2" fill={color} />
      <path d="M60 18v6M60 96v6M18 60h6M96 60h6" stroke={color} strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- псевдо-QR ----------------------------------------------------- */
export function QR({ value, size = 92, color = '#0b0d14', bg = '#fff', pad = 4 }) {
  const n = 25;
  const grid = useMemo(() => qrMatrix(value, n), [value]);
  const cell = (size - pad * 2) / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
      <rect width={size} height={size} rx="6" fill={bg} />
      {grid.map((row, y) =>
        row.map((v, x) =>
          v ? <rect key={`${x}-${y}`} x={pad + x * cell} y={pad + y * cell} width={cell} height={cell} fill={color} /> : null
        )
      )}
    </svg>
  );
}

/* ---------- кольцевой показатель ----------------------------------------- */
export function Ring({ value, size = 108, stroke = 9, color = '#D7B06A', track = 'rgba(255,255,255,.09)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

/* ---------- график ------------------------------------------------------- */
export function Spark({ data, w = 300, h = 74, color = '#D7B06A', fill = true, dots = false }) {
  const id = useId().replace(/:/g, '');
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 14)]);
  const line = pts.map(([x, y], i) => (i ? `L${x.toFixed(1)} ${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}`)).join('');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${line}L${w} ${h}L0 ${h}Z`} fill={`url(#sp${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {dots && pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill={color} />)}
    </svg>
  );
}
