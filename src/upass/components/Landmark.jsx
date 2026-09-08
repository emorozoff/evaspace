import { LANDMARKS } from '../data/landmarks.js';

/* Силуэт достопримечательности города: штрих одним цветом, лёгкая заливка масс. */
export default function Landmark({ city, size = 64, color = '#D7B06A', stroke = 2.2, style }) {
  const lm = LANDMARKS[city];
  if (!lm) return null;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={style} aria-hidden="true">
      {lm.parts.map((p, i) =>
        p.c ? (
          <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} fill={p.fill ? color : 'none'} fillOpacity={p.fill ? 0.2 : 1} stroke={color} strokeWidth={stroke} />
        ) : (
          <path
            key={i}
            d={p.d}
            fill={p.fill ? color : 'none'}
            fillOpacity={p.fill ? 0.16 : 1}
            stroke={color}
            strokeWidth={p.thin ? stroke * 0.55 : stroke}
            strokeOpacity={p.thin ? 0.7 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      )}
    </svg>
  );
}
