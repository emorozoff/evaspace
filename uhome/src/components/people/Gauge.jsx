import { useEffect, useState } from 'react';

/* Кольцо «польза знакомства»: шкала-циферблат с рисками, золотая дуга
   дорисовывается до значения, цифра досчитывается. Число — оценка по
   анкетам (встречное совпадение), а не точный факт. */

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Досчёт до значения за ms — один короткий rAF, без циклов в фоне. */
export function useCountUp(value, { ms = 750, delay = 0, run = true } = {}) {
  const [n, setN] = useState(() => (run && !reducedMotion() ? 0 : value));
  useEffect(() => {
    if (!run) { setN(0); return undefined; }
    if (reducedMotion()) { setN(value); return undefined; }
    let raf = 0;
    let t0 = 0;
    const tick = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, Math.max(0, (t - t0 - delay) / ms));
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, delay, run]);
  return n;
}

export const tone = (pct) => (pct >= 75 ? 'hi' : pct >= 55 ? 'mid' : 'lo');

export default function Gauge({ pct, size = 60, label = 'польза', run = true, delay = 120, className = '' }) {
  const n = useCountUp(pct, { run, delay });
  const sw = size >= 70 ? 3 : 2.4;
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const ticks = size >= 50 ? 40 : 28;
  const R1 = size / 2 - 1.5;
  const R2 = size / 2 - 3.6;
  const lit = Math.round((ticks * (run ? pct : 0)) / 100);
  return (
    <div className={`pgauge pgauge--${tone(pct)} ${className}`} style={{ width: size, height: size, '--gs': `${size}px` }} aria-label={`${label}: ${pct}%`} role="img">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <g transform={`translate(${size / 2} ${size / 2})`}>
          {Array.from({ length: ticks }, (_, i) => {
            const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
            return (
              <line
                key={i}
                className={i < lit ? 'pgauge__tick pgauge__tick--on' : 'pgauge__tick'}
                style={{ '--td': `${delay + i * 14}ms` }}
                x1={Math.cos(a) * R1} y1={Math.sin(a) * R1} x2={Math.cos(a) * R2} y2={Math.sin(a) * R2}
              />
            );
          })}
          <circle className="pgauge__track" r={r} strokeWidth={sw} />
          <circle
            className="pgauge__arc"
            r={r}
            strokeWidth={sw}
            strokeDasharray={c}
            strokeDashoffset={run ? c * (1 - pct / 100) : c}
            transform="rotate(-90)"
            style={{ '--td': `${delay}ms`, '--c': c }}
          />
        </g>
      </svg>
      <div className="pgauge__v">
        <b>{n}</b>
        <i>%</i>
      </div>
      {label && size >= 70 && <div className="pgauge__l">{label}</div>}
    </div>
  );
}
