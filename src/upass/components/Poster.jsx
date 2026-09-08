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

  if (!event.online && REGIONS[event.region]) {
    return (
      <Scene city={event.region} height={height} radius={radius} label>
        {big && <Ribbon kind={event.kind} />}
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

/* Лента большого события поверх силуэта региона. */
function Ribbon({ kind }) {
  const k = EVENT_KINDS[kind];
  return (
    <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: 'rgba(7,8,12,.6)', color: k.tone, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em' }}>
      <Icon name={k.icon} size={13} color={k.tone} />
      {k.name.toUpperCase()}
    </div>
  );
}

/* Маленькая квадратная заставка для строк списка. */
export function PosterThumb({ event, size = 46 }) {
  const kind = EVENT_KINDS[event.kind];
  if (!event.online && REGIONS[event.region]) return <SceneThumb city={event.region} size={size} />;
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: size * 0.28, background: `${kind.tone}1e`, display: 'grid', placeItems: 'center', color: kind.tone }}>
      <Icon name={kind.icon} size={size * 0.44} />
    </div>
  );
}
