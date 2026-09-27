import { useId, useMemo } from 'react';
import { LANDMARKS } from '../data/landmarks.js';
import { REGIONS } from '../data/regions.js';
import { KINDS } from '../data/events.js';
import { catById } from '../data/services.js';
import { seeded } from '../lib/art.js';
import Icon from './Icons.jsx';
import { Mark } from './Art.jsx';

/* Обложки рисуются вектором: у региона — ночное небо и силуэт города,
   у эфира — волны сигнала, у компании — монограмма на тоне категории.
   Ни одной картинки из сети: грузится мгновенно и работает офлайн. */

function Landmark({ region, x, y, scale, stroke = 1.7 }) {
  const lm = LANDMARKS[region];
  if (!lm) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {lm.parts.map((p, i) =>
        p.c ? (
          <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill={p.fill ? '#D9B26B' : 'none'} fillOpacity={p.fill ? 0.25 : 1} stroke="#D9B26B" strokeWidth={stroke} />
        ) : (
          <path key={i} d={p.d} fill={p.fill ? '#D9B26B' : 'none'} fillOpacity={p.fill ? 0.2 : 1} stroke="#D9B26B" strokeWidth={p.thin ? stroke * 0.55 : stroke} strokeOpacity={p.thin ? 0.7 : 1} strokeLinecap="round" strokeLinejoin="round" />
        )
      )}
    </g>
  );
}

/* Регион: плита своего цвета, звёзды, луна и силуэт у правого края. */
export function Scene({ region, height = 160, radius, children, style }) {
  const id = useId().replace(/:/g, '');
  const plate = REGIONS[region]?.plate || '#1f2430';
  const stars = useMemo(() => {
    const rnd = seeded('scene-' + region);
    return Array.from({ length: 24 }, () => [rnd() * 320, rnd() * 80, 0.5 + rnd() * 1.1, 0.25 + rnd() * 0.55]);
  }, [region]);
  const W = 320, H = 160, scale = 1.25;
  const lx = W - 100 * scale - 22;
  const ly = H - 100 * scale + 22;
  return (
    <div className="scene" style={{ height, borderRadius: radius, background: plate, ...style }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`sg${id}`} cx="20%" cy="0%" r="90%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <pattern id={`dt${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.55" fill="#fff" fillOpacity="0.06" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={plate} />
        <rect width={W} height={H} fill={`url(#sg${id})`} />
        <rect width={W} height={H} fill={`url(#dt${id})`} />
        {stars.map(([x, y, r, o], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" fillOpacity={o} />)}
        <circle cx={W - 54} cy={34} r={17} fill="#D9B26B" fillOpacity="0.14" />
        <circle cx={W - 54} cy={34} r={9} fill="#D9B26B" fillOpacity="0.55" />
        <line x1="0" y1={ly + 84 * scale} x2={W} y2={ly + 84 * scale} stroke="#D9B26B" strokeOpacity="0.35" />
        <rect x="0" y={ly + 84 * scale} width={W} height={H} fill="#000" fillOpacity="0.2" />
        <Landmark region={region} x={lx} y={ly} scale={scale} />
      </svg>
      <div className="scene__shade" />
      {children}
    </div>
  );
}

/* Эфир в Zoom: орбита, волны сигнала и точка «в эфире». */
export function Live({ seed = 'x', tone = '#5B8CFF', height = 160, radius, children }) {
  const id = useId().replace(/:/g, '');
  const W = 320, H = 160;
  const waves = useMemo(() => {
    const rnd = seeded('live' + seed);
    return [0, 1, 2, 3].map((i) => {
      const amp = 8 + rnd() * 14;
      const freq = 1.4 + rnd() * 1.8;
      const y = 44 + i * 24;
      let d = '';
      for (let x = 0; x <= 40; x++) {
        const px = (x / 40) * W;
        const py = y + Math.sin((x / 40) * Math.PI * 2 * freq + i) * amp;
        d += (x ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
      }
      return { d, o: 0.55 - i * 0.1 };
    });
  }, [seed]);
  return (
    <div className="scene" style={{ height, borderRadius: radius, background: '#0f121b' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`lg${id}`} cx="74%" cy="30%" r="70%">
            <stop offset="0%" stopColor={tone} stopOpacity="0.5" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`lw${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={tone} stopOpacity="0" />
            <stop offset="40%" stopColor={tone} stopOpacity="0.95" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#0f121b" />
        <rect width={W} height={H} fill={`url(#lg${id})`} />
        {waves.map((w, i) => <path key={i} d={w.d} fill="none" stroke={`url(#lw${id})`} strokeWidth={i === 0 ? 1.8 : 1} strokeOpacity={w.o} />)}
        <circle cx="238" cy="54" r="36" fill="none" stroke={tone} strokeOpacity="0.3" />
        <circle cx="238" cy="54" r="22" fill="none" stroke={tone} strokeOpacity="0.5" />
        <circle cx="238" cy="54" r="6" fill={tone} />
      </svg>
      <div className="scene__shade" />
      {children}
    </div>
  );
}

export function EventCover({ event, height = 160, radius, children }) {
  if (event.kind === 'online' || !REGIONS[event.region]) {
    return <Live seed={event.id} tone={KINDS.online.tone} height={height} radius={radius}>{children}</Live>;
  }
  return <Scene region={event.region} height={height} radius={radius}>{children}</Scene>;
}

/* Квадратная миниатюра для строк: плита и силуэт или волна эфира. */
export function Thumb({ region, online, size = 48, radius = 13 }) {
  if (online || !REGIONS[region]) {
    return (
      <div style={{ width: size, height: size, flex: 'none', borderRadius: radius, background: 'linear-gradient(145deg, #22325e, #0f121b)', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' }}>
        <Icon name="video" size={size * 0.44} color="#8fb0ff" />
      </div>
    );
  }
  const lm = LANDMARKS[region];
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: radius, background: REGIONS[region].plate, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      {lm && (
        <svg viewBox="8 6 84 84" width={size * 0.82} height={size * 0.82}>
          <Landmark region={region} x={0} y={0} scale={1} stroke={2.8} />
        </svg>
      )}
    </div>
  );
}

/* Обложка компании: тон категории, мягкая сетка и монограмма. */
export function Brand({ company, height = 150, radius, children, size }) {
  const id = useId().replace(/:/g, '');
  const cat = catById(company.cat);
  const tone = cat?.tone || '#D9B26B';
  const W = 320, H = 160;
  const rings = useMemo(() => {
    const rnd = seeded('brand' + company.id);
    return Array.from({ length: 6 }, (_, i) => ({ cx: 60 + rnd() * 220, cy: 20 + rnd() * 110, r: 20 + rnd() * 70, o: 0.06 + i * 0.012 }));
  }, [company.id]);

  if (size) {
    return (
      <div style={{ width: size, height: size, flex: 'none', borderRadius: radius ?? size * 0.3, background: `linear-gradient(145deg, ${tone}55, #12141b 80%)`, boxShadow: `inset 0 0 0 1px ${tone}40`, display: 'grid', placeItems: 'center' }}>
        <span className="display" style={{ fontSize: size * 0.46, color: '#fff', lineHeight: 1 }}>{company.name[0]}</span>
      </div>
    );
  }

  return (
    <div className="scene" style={{ height, borderRadius: radius, background: '#12141b' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.55" />
            <stop offset="70%" stopColor="#12141b" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#bg${id})`} />
        {rings.map((r, i) => <circle key={i} cx={r.cx} cy={r.cy} r={r.r} fill="none" stroke="#fff" strokeOpacity={r.o} />)}
        <g transform={`translate(${W - 118} 26)`}>
          <circle cx="46" cy="46" r="46" fill="#000" fillOpacity="0.18" stroke="#fff" strokeOpacity="0.14" />
          <text x="46" y="62" textAnchor="middle" fontSize="46" fontFamily="Cormorant Garamond, Georgia, serif" fontWeight="600" fill="#fff" fillOpacity="0.92">
            {company.name[0]}
          </text>
        </g>
      </svg>
      <div className="scene__shade" />
      {children}
    </div>
  );
}

/* Обложка материала базы: запись эфира или гайд. */
export function MaterialCover({ material, height = 64, radius = 14, big = false, children }) {
  const zoom = material.kind === 'zoom';
  const tone = zoom ? '#5B8CFF' : '#D9B26B';
  return (
    <div className="scene" style={{ height, borderRadius: radius, background: zoom ? 'linear-gradient(145deg, #1d2a52, #0e1119)' : 'linear-gradient(145deg, #3a2f18, #0e1119)' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <circle cx="78" cy="22" r="30" fill="none" stroke={tone} strokeOpacity="0.25" />
        <circle cx="78" cy="22" r="18" fill="none" stroke={tone} strokeOpacity="0.35" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        {zoom ? (
          <span style={{ width: big ? 58 : 30, height: big ? 58 : 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(6px)' }}>
            <Icon name="play" size={big ? 24 : 13} color="#fff" fill="#fff" />
          </span>
        ) : (
          <Mark size={big ? 54 : 26} />
        )}
      </div>
      {children}
    </div>
  );
}
