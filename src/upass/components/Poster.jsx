import { useId, useMemo } from 'react';
import Scene, { SceneThumb } from './Scene.jsx';
import { EVENT_KINDS } from '../data/life.js';
import { REGIONS } from '../data/regions.js';
import { seeded } from '../lib/art.js';
import Icon from './Icons.jsx';

/* Заставка мероприятия. Офлайн — силуэт региона, эфир — своя абстрактная
   графика, большие слёты — торжественная с римской цифрой года.
   Ни одной картинки: всё рисуется вектором. */

export default function Poster({ event, height = 168, radius, children, compact }) {
  const kind = EVENT_KINDS[event.kind];
  const big = ['connect', 'conf', 'world'].includes(event.kind);

  /* У трёх событий года своя заставка: силуэт города для них слишком
     обычный, а сами слёты каждый раз в новой стране. */
  if (big) {
    return (
      <Flagship kind={event.kind} seed={event.id} height={height} radius={radius}>
        {children}
      </Flagship>
    );
  }

  if (!event.online && REGIONS[event.region]) {
    return (
      <Scene city={event.region} height={height} radius={radius} label>
        {children}
      </Scene>
    );
  }
  return (
    <Live tone={kind.tone} seed={event.id} height={height} radius={radius} label={kind.name} icon={kind.icon} compact={compact}>
      {children}
    </Live>
  );
}

/* Абстрактная заставка эфира: орбита, волна сигнала и точка эфира. */
export function Live({ tone = '#5B8CFF', seed = 'x', height = 168, radius, label, icon = 'video', children, compact }) {
  const id = useId().replace(/:/g, '');
  const W = 320, H = 160;
  const waves = useMemo(() => {
    const rnd = seeded('live' + seed);
    return [0, 1, 2, 3].map((i) => {
      const amp = 8 + rnd() * 14;
      const freq = 1.4 + rnd() * 1.8;
      const y = 40 + i * 26;
      let d = '';
      for (let x = 0; x <= 40; x++) {
        const px = (x / 40) * W;
        const py = y + Math.sin((x / 40) * Math.PI * 2 * freq + i) * amp;
        d += (x ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
      }
      return { d, o: 0.5 - i * 0.09 };
    });
  }, [seed]);

  return (
    <div className="scene" style={{ height, borderRadius: radius, background: '#10131c' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`lg${id}`} cx="72%" cy="30%" r="70%">
            <stop offset="0%" stopColor={tone} stopOpacity="0.45" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`lw${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={tone} stopOpacity="0" />
            <stop offset="35%" stopColor={tone} stopOpacity="0.9" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#10131c" />
        <rect width={W} height={H} fill={`url(#lg${id})`} />
        {waves.map((w, i) => (
          <path key={i} d={w.d} fill="none" stroke={`url(#lw${id})`} strokeWidth={i === 0 ? 1.6 : 1} strokeOpacity={w.o} />
        ))}
        <circle cx="236" cy="52" r="34" fill="none" stroke={tone} strokeOpacity="0.35" strokeWidth="1" />
        <circle cx="236" cy="52" r="21" fill="none" stroke={tone} strokeOpacity="0.5" strokeWidth="1" />
        <circle cx="236" cy="52" r="6" fill={tone} />
      </svg>
      {label && (
        <div style={{ position: 'absolute', left: 14, top: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: tone }}>
          <Icon name={icon} size={13} color={tone} />
          {label.toUpperCase()}
        </div>
      )}
      {children}
    </div>
  );
}

/* ——— заставки трёх событий года ——————————————————————————————————————— */
const PLATE = { connect: '#3b1c33', conf: '#3d2617', world: '#2a2338' };

export function Flagship({ kind, seed = 'x', height = 168, radius, children }) {
  const id = useId().replace(/:/g, '');
  const tone = EVENT_KINDS[kind].tone;
  const plate = PLATE[kind] || '#241f33';
  const W = 320, H = 160;

  const art = useMemo(() => {
    const rnd = seeded('flag' + seed);
    if (kind === 'connect') {
      /* Слёт в новой стране: глобус, дуга маршрута и круг гостей. */
      const dots = Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI + (i / 12) * Math.PI;
        return [160 + Math.cos(a) * 96, 138 + Math.sin(a) * 30];
      });
      return (
        <g>
          <circle cx="228" cy="62" r="44" fill="none" stroke={tone} strokeOpacity="0.5" strokeWidth="1.1" />
          <ellipse cx="228" cy="62" rx="18" ry="44" fill="none" stroke={tone} strokeOpacity="0.3" strokeWidth="0.9" />
          <ellipse cx="228" cy="62" rx="34" ry="44" fill="none" stroke={tone} strokeOpacity="0.22" strokeWidth="0.9" />
          <path d="M184 62h88M192 40h72M192 84h72" stroke={tone} strokeOpacity="0.24" strokeWidth="0.9" />
          <path d="M62 96C110 24 210 12 268 34" fill="none" stroke={tone} strokeOpacity="0.5" strokeWidth="1.3" strokeDasharray="5 6" />
          <circle cx="62" cy="96" r="3" fill={tone} fillOpacity="0.7" />
          <circle cx="268" cy="34" r="3" fill={tone} fillOpacity="0.7" />
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.4" fill={tone} fillOpacity={0.16 + (i % 4) * 0.06} />
          ))}
        </g>
      );
    }
    if (kind === 'conf') {
      /* Конференция: схема, где линии сходятся в один узел. */
      const lines = Array.from({ length: 9 }, (_, i) => {
        const y = 18 + i * 16;
        return `M8 ${y}H${90 + rnd() * 60}L${196} 80`;
      });
      return (
        <g>
          {lines.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={tone} strokeOpacity={0.14 + (i % 3) * 0.1} strokeWidth="1" />
          ))}
          <circle cx="196" cy="80" r="34" fill="none" stroke={tone} strokeOpacity="0.28" strokeWidth="1" />
          <circle cx="196" cy="80" r="22" fill="none" stroke={tone} strokeOpacity="0.4" strokeWidth="1" />
          <circle cx="196" cy="80" r="6" fill={tone} fillOpacity="0.6" />
          {[248, 276].map((x, i) => (
            <rect key={x} x={x} y={58 + i * 22} width="13" height="13" rx="4" fill="none" stroke={tone} strokeOpacity="0.26" strokeWidth="1" />
          ))}
        </g>
      );
    }
    /* U-world: венок, лучи и звезда — церемония года. */
    const rays = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      return `M${228 + Math.cos(a) * 46} ${72 + Math.sin(a) * 46}L${228 + Math.cos(a) * 62} ${72 + Math.sin(a) * 62}`;
    });
    const leaf = (side) =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (-0.9 + i * 0.3) * side;
        const x = 228 + Math.sin(a) * 42 * side;
        const y = 72 + Math.cos(a) * 42;
        return `M${x} ${y}q${7 * side} -7 ${13 * side} -2q-8 7 -13 2z`;
      });
    return (
      <g>
        {rays.map((d, i) => (
          <path key={i} d={d} stroke={tone} strokeOpacity={i % 2 ? 0.1 : 0.2} strokeWidth="1" />
        ))}
        {[...leaf(1), ...leaf(-1)].map((d, i) => (
          <path key={i} d={d} fill={tone} fillOpacity="0.26" />
        ))}
        <circle cx="228" cy="72" r="32" fill="none" stroke={tone} strokeOpacity="0.4" strokeWidth="1.1" />
        <circle cx="228" cy="72" r="20" fill="none" stroke={tone} strokeOpacity="0.24" strokeWidth="1" />
        <path d="M228 60l4.4 9.6 9.6 4.4-9.6 4.4-4.4 9.6-4.4-9.6-9.6-4.4 9.6-4.4z" fill="none" stroke={tone} strokeOpacity="0.7" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    );
  }, [kind, seed, tone]);

  return (
    <div className="scene" style={{ height, borderRadius: radius, background: plate }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`fg${id}`} cx="70%" cy="34%" r="72%">
            <stop offset="0%" stopColor={tone} stopOpacity="0.34" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
          <pattern id={`fp${id}`} width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="#fff" fillOpacity="0.06" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={plate} />
        <rect width={W} height={H} fill={`url(#fp${id})`} />
        <rect width={W} height={H} fill={`url(#fg${id})`} />
        {art}
      </svg>
      <div className="scene__shade" />
      {children}
    </div>
  );
}

/* Маленькая квадратная заставка для строк списка. */
export function PosterThumb({ event, size = 46 }) {
  const kind = EVENT_KINDS[event.kind];
  const big = ['connect', 'conf', 'world'].includes(event.kind);
  if (!big && !event.online && REGIONS[event.region]) return <SceneThumb city={event.region} size={size} />;
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: size * 0.28, background: big ? `${kind.tone}2e` : `${kind.tone}1e`, boxShadow: big ? `inset 0 0 0 1px ${kind.tone}55` : 'none', display: 'grid', placeItems: 'center', color: kind.tone }}>
      <Icon name={kind.icon} size={size * 0.44} />
    </div>
  );
}
