import { useId, useMemo } from 'react';
import { LANDMARKS } from '../data/landmarks.js';
import { CITIES } from '../data/places.js';
import { seeded } from '../lib/art.js';

/* Обложка-иллюстрация: плотная тонированная поверхность, звёзды, луна,
   линия горизонта и силуэт достопримечательности города. Не сливается
   с фоном экрана: у неё свой цвет и светлая кромка. */

export const PLATES = {
  dubai: '#3a2f18', bali: '#173a2f', phuket: '#163446', moscow: '#2a2141', istanbul: '#3f2420',
  tbilisi: '#1c3a38', yerevan: '#3b1f1c', almaty: '#3a2c14', belgrade: '#2c2440', lisbon: '#1d2547',
  barcelona: '#3b1e2c', london: '#232a3a', newyork: '#1b2436', miami: '#3a1d2c', mexico: '#3d2414',
  saopaulo: '#173628', capetown: '#183334', bangkok: '#3a3014', singapore: '#1e2247', tokyo: '#32203a',
};

export default function Scene({ city, height = 150, children, style, label, radius, sun = true, size }) {
  const id = useId().replace(/:/g, '');
  const plate = PLATES[city] || '#1f2430';
  const lm = LANDMARKS[city];
  const stars = useMemo(() => {
    const rnd = seeded('scene-' + city);
    return Array.from({ length: 22 }, () => [rnd() * 320, rnd() * 78, 0.5 + rnd() * 1.1, 0.25 + rnd() * 0.55]);
  }, [city]);

  const W = 320, H = 160;
  const scale = 1.25;              // силуэт занимает ~125px по высоте
  const lx = W - 100 * scale - 26; // прижат к правому краю
  const ly = H - 100 * scale + 22; // горизонт силуэта (y=84) ложится на линию горизонта обложки

  return (
    <div className="scene" style={{ height, borderRadius: radius, background: plate, ...style }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`dots${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.55" fill="#fff" fillOpacity="0.07" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill={plate} />
        <rect width={W} height={H} fill={`url(#dots${id})`} />
        {stars.map(([x, y, r, o], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff" fillOpacity={o} />
        ))}
        {sun && <circle cx={W - 52} cy={34} r={16} fill="#D9B26B" fillOpacity="0.16" />}
        {sun && <circle cx={W - 52} cy={34} r={9} fill="#D9B26B" fillOpacity="0.55" />}
        <line x1="0" y1={ly + 84 * scale} x2={W} y2={ly + 84 * scale} stroke="#D9B26B" strokeOpacity="0.35" strokeWidth="1" />
        <rect x="0" y={ly + 84 * scale} width={W} height={H} fill="#000" fillOpacity="0.18" />
        {lm && (
          <g transform={`translate(${lx} ${ly}) scale(${scale})`}>
            {lm.parts.map((p, i) =>
              p.c ? (
                <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill={p.fill ? '#D9B26B' : 'none'} fillOpacity={p.fill ? 0.25 : 1} stroke="#D9B26B" strokeWidth="1.7" />
              ) : (
                <path key={i} d={p.d} fill={p.fill ? '#D9B26B' : 'none'} fillOpacity={p.fill ? 0.2 : 1} stroke="#D9B26B" strokeWidth={p.thin ? 0.9 : 1.7} strokeOpacity={p.thin ? 0.7 : 1} strokeLinecap="round" strokeLinejoin="round" />
              )
            )}
          </g>
        )}
        <rect width={W} height={H} fill="url(#none)" />
      </svg>
      {label && (
        <div style={{ position: 'absolute', left: 14, top: 12, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,.55)' }}>
          {(CITIES[city]?.flag || '') + ' ' + (label === true ? (CITIES[city]?.name || '').toUpperCase() : label)}
        </div>
      )}
      {children}
    </div>
  );
}

/* Квадратная миниатюра: только плита и силуэт — для строк списков. */
export function SceneThumb({ city, size = 48, radius = 12 }) {
  const plate = PLATES[city] || '#1f2430';
  const lm = LANDMARKS[city];
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: radius, background: plate, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      {lm && (
        <svg viewBox="8 6 84 84" width={size * 0.8} height={size * 0.8}>
          {lm.parts.map((p, i) =>
            p.c ? (
              <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill={p.fill ? '#D9B26B' : 'none'} fillOpacity={p.fill ? 0.25 : 1} stroke="#D9B26B" strokeWidth="2.6" />
            ) : (
              <path key={i} d={p.d} fill={p.fill ? '#D9B26B' : 'none'} fillOpacity={p.fill ? 0.22 : 1} stroke="#D9B26B" strokeWidth={p.thin ? 1.4 : 2.6} strokeLinecap="round" strokeLinejoin="round" />
            )
          )}
        </svg>
      )}
    </div>
  );
}
