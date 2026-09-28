import { useId, useMemo } from 'react';
import { LANDMARKS } from '../data/landmarks.js';
import { REGIONS } from '../data/regions.js';
import { KINDS } from '../data/events.js';
import { catById } from '../data/services.js';
import { seeded } from '../lib/art.js';
import Icon from './Icons.jsx';
import { Mark } from './Art.jsx';

/* Обложки рисуются вектором, как экраны прибора: тёмное небо с лёгким
   тоном региона, сетка «пола» к горизонту, тонкий золотой силуэт города,
   который прорисовывается при появлении, и координаты моноширинным.
   У эфира — волны сигнала, у компании — монограмма в кольце-безеле.
   Ни одной картинки из сети: грузится мгновенно и работает офлайн. */

const GOLD = '#D9B26B';
const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

function Landmark({ region, x, y, scale, stroke = 1.2, draw = true, glow = true }) {
  const lm = LANDMARKS[region];
  if (!lm) return null;
  const shape = (p, i, extra = {}) =>
    p.c ? (
      <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} {...extra} />
    ) : (
      <path key={i} d={p.d} {...extra} />
    );
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
      {glow && (
        <g fill="none" stroke={GOLD} strokeOpacity="0.1" strokeWidth={stroke * 4}>
          {lm.parts.map((p, i) => shape(p, i))}
        </g>
      )}
      {lm.parts.map((p, i) =>
        shape(p, i, {
          className: draw ? 'cv-lm' : undefined,
          pathLength: draw ? 1 : undefined,
          style: draw ? { '--d': `${i * 60}ms` } : undefined,
          fill: p.fill ? GOLD : 'none',
          fillOpacity: p.fill ? 0.07 : undefined,
          stroke: GOLD,
          strokeWidth: p.thin ? stroke * 0.55 : stroke,
          strokeOpacity: p.thin ? 0.55 : 0.92,
        })
      )}
    </g>
  );
}

const coord = (v, pos, neg) => `${Math.abs(v).toFixed(2).padStart(5, '0')}°${v >= 0 ? pos : neg}`;

/* Регион: небо, горизонт, сетка к горизонту и силуэт у правого края. */
export function Scene({ region, height = 160, radius, children, style }) {
  const id = useId().replace(/:/g, '');
  const R = REGIONS[region];
  const plate = R?.plate || '#1f1d19';
  const W = 320, H = 160, HZ = 116, s = 1.02;
  const lx = W - 100 * s - 24;
  const ly = HZ - 84 * s;
  const vx = lx + 50 * s;
  const stars = useMemo(() => {
    const rnd = seeded('scene-' + region);
    return Array.from({ length: 16 }, () => [rnd() * 320, 6 + rnd() * 84, 0.35 + rnd() * 0.7, 0.18 + rnd() * 0.42]);
  }, [region]);
  const rays = [-8, -6, -4.5, -3, -2, -1, 0, 1, 2, 3, 4.5, 6, 8];
  const rows = [0.06, 0.16, 0.3, 0.5, 0.78];
  return (
    <div className="scene cv" style={{ height, borderRadius: radius, ...style }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`sk${id}`} cx="14%" cy="-10%" r="95%">
            <stop offset="0%" stopColor={plate} stopOpacity="1" />
            <stop offset="100%" stopColor={plate} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`hl${id}`} cx={vx / W} cy={HZ / H} r="46%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.16" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`hz${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
            <stop offset={`${(vx / W) * 100}%`} stopColor={GOLD} stopOpacity="0.7" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id={`fl${id}`} x1="0" y1={HZ} x2="0" y2={H} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id={`fm${id}`}>
            <rect x="0" y={HZ} width={W} height={H - HZ} fill={`url(#fl${id})`} />
          </mask>
        </defs>
        <rect width={W} height={H} fill="#090b10" />
        <rect width={W} height={H} fill={`url(#sk${id})`} opacity="0.95" />
        <rect width={W} height={H} fill={`url(#hl${id})`} />
        {stars.map(([x, y, r, o], i) => <circle key={i} cx={x} cy={y} r={r} fill="#EDE6D8" fillOpacity={o} />)}

        {/* светило-прицел */}
        <g opacity="0.8">
          <circle cx="146" cy="50" r="17" fill="none" stroke={GOLD} strokeOpacity="0.28" strokeDasharray="1.2 2.6" />
          <circle cx="146" cy="50" r="7.5" fill={GOLD} fillOpacity="0.1" stroke={GOLD} strokeOpacity="0.5" strokeWidth="0.8" />
          <circle cx="146" cy="50" r="1.6" fill={GOLD} />
          <path d="M146 27v5M146 68v5M123 50h5M164 50h5" stroke={GOLD} strokeOpacity="0.45" strokeWidth="0.8" />
        </g>

        {/* пол: сетка к точке схода под силуэтом */}
        <g mask={`url(#fm${id})`} stroke={GOLD} strokeOpacity="0.2" strokeWidth="0.6">
          {rays.map((k) => <line key={k} x1={vx} y1={HZ} x2={vx + k * 46} y2={H + 30} />)}
          {rows.map((k) => <line key={k} x1="0" y1={HZ + (H - HZ) * k} x2={W} y2={HZ + (H - HZ) * k} />)}
        </g>
        <rect x="0" y={HZ} width={W} height={H - HZ} fill="#05060a" fillOpacity="0.35" />
        <line x1="0" y1={HZ} x2={W} y2={HZ} stroke={`url(#hz${id})`} strokeWidth="0.9" />

        <Landmark region={region} x={lx} y={ly} scale={s} />

        {R && (
          <text x={W - 34} y={HZ + 12} textAnchor="end" fontFamily={MONO} fontSize="6.4" letterSpacing="0.9" fill={GOLD} fillOpacity="0.62">
            {coord(R.lat, 'N', 'S')} {coord(R.lon, 'E', 'W')}
          </text>
        )}
      </svg>
      <div className="scene__shade cv__shade" />
      {children}
    </div>
  );
}

/* Эфир в Zoom: волны сигнала, кольца-локатор и пульсирующая точка. */
export function Live({ seed = 'x', tone = '#86A9E0', height = 160, radius, children }) {
  const id = useId().replace(/:/g, '');
  const W = 320, H = 160;
  const waves = useMemo(() => {
    const rnd = seeded('live' + seed);
    return [0, 1, 2, 3, 4].map((i) => {
      const amp = 6 + rnd() * 13;
      const freq = 1.3 + rnd() * 1.9;
      const y = 50 + i * 19;
      let d = '';
      for (let x = 0; x <= 48; x++) {
        const px = (x / 48) * W;
        const py = y + Math.sin((x / 48) * Math.PI * 2 * freq + i) * amp * (0.4 + 0.6 * Math.sin((x / 48) * Math.PI));
        d += (x ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
      }
      return { d, o: 0.7 - i * 0.12 };
    });
  }, [seed]);
  return (
    <div className="scene cv" style={{ height, borderRadius: radius }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`lg${id}`} cx="74%" cy="34%" r="62%">
            <stop offset="0%" stopColor={tone} stopOpacity="0.3" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`lw${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={tone} stopOpacity="0" />
            <stop offset="45%" stopColor={tone} stopOpacity="0.95" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
          <pattern id={`lp${id}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="#EDE6D8" fillOpacity="0.09" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#090b10" />
        <rect width={W} height={H} fill={`url(#lg${id})`} />
        <rect width={W} height={H} fill={`url(#lp${id})`} />
        {waves.map((w, i) => <path key={i} d={w.d} fill="none" stroke={`url(#lw${id})`} strokeWidth={i === 0 ? 1.3 : 0.7} strokeOpacity={w.o} />)}
        <g transform="translate(236 56)">
          <circle r="40" fill="none" stroke={tone} strokeOpacity="0.22" strokeDasharray="1.2 3" />
          <circle r="26" fill="none" stroke={tone} strokeOpacity="0.4" strokeWidth="0.8" />
          <circle r="12" fill={tone} fillOpacity="0.12" stroke={tone} strokeOpacity="0.6" strokeWidth="0.8" />
          <circle className="cv-ping" r="12" fill="none" stroke={tone} strokeWidth="0.8" />
          <circle r="3.2" fill={tone} />
        </g>
        <text x={W - 34} y={H - 12} textAnchor="end" fontFamily={MONO} fontSize="6.4" letterSpacing="0.9" fill={tone} fillOpacity="0.75">
          ZOOM · ONLINE
        </text>
      </svg>
      <div className="scene__shade cv__shade" />
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

/* Квадратная миниатюра для строк: тон региона снизу и тонкий силуэт
   или знак эфира. */
export function Thumb({ region, online, size = 48, radius = 13 }) {
  if (online || !REGIONS[region]) {
    return (
      <div className="cv-thumb" style={{ width: size, height: size, borderRadius: radius, background: 'radial-gradient(90% 80% at 50% 20%, rgba(134,169,224,.24), #0b0d12 72%)', boxShadow: 'inset 0 0 0 1px rgba(134,169,224,.28)' }}>
        <Icon name="video" size={size * 0.42} color="#b3c5dd" />
      </div>
    );
  }
  const lm = LANDMARKS[region];
  return (
    <div
      className="cv-thumb"
      style={{
        width: size, height: size, borderRadius: radius,
        background: `radial-gradient(110% 80% at 50% 105%, ${REGIONS[region].plate}, #0b0d12 78%)`,
        boxShadow: 'inset 0 0 0 1px rgba(217,178,107,.22)',
      }}
    >
      {lm && (
        <svg viewBox="8 6 84 84" width={size * 0.8} height={size * 0.8}>
          <Landmark region={region} x={0} y={0} scale={1} stroke={2.4} draw={false} glow={false} />
        </svg>
      )}
    </div>
  );
}

/* Обложка компании: тёмная плата, свет тона из угла, сетка точек и
   монограмма в кольце с делениями — как безель прибора. */
export function Brand({ company, height = 150, radius, children, size }) {
  const id = useId().replace(/:/g, '');
  const cat = catById(company.cat);
  const tone = cat?.tone || '#C9A96E';
  const W = 320, H = 160;
  const cx = W - 70, cy = 66;
  const ticks = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    const r1 = 33, r2 = long ? 38 : 36;
    return [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, long];
  }), [cx, cy]);

  if (size) {
    return (
      <div
        className="cv-brand"
        style={{
          width: size, height: size, borderRadius: radius ?? size * 0.3,
          background: `radial-gradient(120% 120% at 0% 0%, ${tone}3d, transparent 62%), #0e1016`,
          boxShadow: `inset 0 0 0 1px ${tone}4d`,
        }}
      >
        <span style={{ fontSize: size * 0.42, color: '#EDE6D8', textShadow: `0 0 ${size * 0.3}px ${tone}` }}>{company.name[0]}</span>
      </div>
    );
  }

  return (
    <div className="scene cv" style={{ height, borderRadius: radius }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`bg${id}`} cx="0%" cy="0%" r="100%">
            <stop offset="0%" stopColor={tone} stopOpacity="0.34" />
            <stop offset="70%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`bh${id}`} cx={cx / W} cy={cy / H} r="40%">
            <stop offset="0%" stopColor={tone} stopOpacity="0.2" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
          <pattern id={`bp${id}`} width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="#EDE6D8" fillOpacity="0.08" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#090b10" />
        <rect width={W} height={H} fill={`url(#bg${id})`} />
        <rect width={W} height={H} fill={`url(#bp${id})`} />
        <rect width={W} height={H} fill={`url(#bh${id})`} />
        {[52, 70, 94, 124, 160].map((r, i) => (
          <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={tone} strokeOpacity={0.22 - i * 0.035} strokeWidth="0.7" strokeDasharray={i % 2 ? '1.2 3' : undefined} />
        ))}
        {ticks.map(([x1, y1, x2, y2, long], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={long ? tone : '#EDE6D8'} strokeOpacity={long ? 0.7 : 0.22} strokeWidth="0.7" />
        ))}
        <circle cx={cx} cy={cy} r="28" fill="#090b10" fillOpacity="0.5" stroke={tone} strokeOpacity="0.55" strokeWidth="0.8" />
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="31" fontWeight="600" fontFamily="Manrope, -apple-system, sans-serif" fill="#EDE6D8" letterSpacing="-1">
          {company.name[0]}
        </text>
      </svg>
      <div className="scene__shade cv__shade" />
      {children}
    </div>
  );
}

/* Обложка материала базы: запись эфира или гайд. */
export function MaterialCover({ material, height = 64, radius = 14, big = false, children }) {
  const zoom = material.kind === 'zoom';
  const tone = zoom ? '#8FA8C9' : '#C9A96E';
  return (
    <div className="scene" style={{ height, borderRadius: radius, background: zoom ? 'linear-gradient(145deg, #1f2635, #141311)' : 'linear-gradient(145deg, #352b1a, #141311)' }}>
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
