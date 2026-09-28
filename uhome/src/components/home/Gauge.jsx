import { useEffect, useId, useRef, useState } from 'react';

/* Приборы главной: кольцо «польза», досчитывающаяся цифра и хук
   «блок вошёл в экран». Кольцо прорисовывается, цифра бежит от нуля —
   один раз, когда блок впервые показался. Без движения (reduced motion)
   всё сразу стоит на месте. */

const still = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** true, когда элемент впервые вошёл в экран (и дальше остаётся true). */
export function useInView(ref, { threshold = 0.3 } = {}) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined' || still()) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (list) => {
        if (list.some((x) => x.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, threshold]);
  return seen;
}

/** Цифра досчитывается от нуля за ~0.7 с. Пишем прямо в узел — без лишних рендеров. */
export function CountUp({ value, run = true, ms = 700, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!run) {
      el.textContent = '0';
      return;
    }
    if (still()) {
      el.textContent = String(value);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const tick = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, Math.max(0, (t - t0 - delay) / ms));
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(value * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run, ms, delay]);
  return <span ref={ref}>{run ? value : 0}</span>;
}

/** Кольцо-прибор: дорожка, золотая дуга до pct и светящаяся точка на её конце. */
export function Ring({ pct, size = 52, stroke = 2, run = true, delay = 0, children, className = '' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tick = size / 2 - 0.8;
  const r = size / 2 - 4.5 - stroke / 2;
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(100, pct)) / 100;
  const hi = pct >= 75;
  return (
    <span className={`gauge${hi ? ' gauge--hi' : ''}${run ? ' gauge--on' : ''} ${className}`} style={{ width: size, height: size, '--gd': `${delay}ms` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f0dcb4" />
            <stop offset="100%" stopColor="#b8894a" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(237,230,216,.09)" strokeWidth={stroke} />
        {/* риски шкалы: 12 делений, как у прибора */}
        <circle cx={size / 2} cy={size / 2} r={tick} fill="none" stroke="rgba(237,230,216,.16)" strokeWidth="1.6" strokeDasharray={`0.9 ${(2 * Math.PI * tick) / 12 - 0.9}`} transform={`rotate(-90.5 ${size / 2} ${size / 2})`} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            className="gauge__arc"
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#g${id})`} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} style={{ strokeDashoffset: run ? c * (1 - k) : c }}
          />
        </g>
        <g className="gauge__tip" style={{ transform: `rotate(${run ? k * 360 : 0}deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}>
          <circle cx={size / 2} cy={size / 2 - r} r={stroke + 0.6} fill="#f0dcb4" />
        </g>
      </svg>
      {children && <span className="gauge__in">{children}</span>}
    </span>
  );
}
