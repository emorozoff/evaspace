import { useId, useMemo } from 'react';
import { hash } from '../lib/format.js';

/* Обложка события рисуется вектором — ни одной картинки из сети.
   Эфир — волны сигнала и орбита, пятница в городе — силуэт домов,
   командный созвон — связанные узлы, слёт — лучи. Цвет — от типа. */

export const TONES = { online: '#6d9bff', offline: '#79d2bf', team: '#8e7bf5', summit: '#e9b872' };

function rng(seed) {
  let s = hash(String(seed)) % 2147483647 || 7;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const W = 320;
const H = 200;

export default function Cover({ event, children, className = '' }) {
  const id = useId().replace(/:/g, '');
  const tone = TONES[event.type] || TONES.online;
  const art = useMemo(() => draw(event, tone), [event.type, event.series, event.id, tone]);

  return (
    <div className={`ev__cover ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`g${id}`} cx="75%" cy="20%" r="80%">
            <stop offset="0%" stopColor={tone} stopOpacity="0.5" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`w${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={tone} stopOpacity="0" />
            <stop offset="40%" stopColor={tone} stopOpacity="0.9" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#0f121a" />
        <rect width={W} height={H} fill={`url(#g${id})`} />
        <g stroke={`url(#w${id})`}>{art}</g>
      </svg>
      <div className="ev__shade" />
      {children}
    </div>
  );
}

function draw(event, tone) {
  const rnd = rng(event.series || event.id);

  if (event.type === 'offline') {
    // Силуэт вечернего города: разной высоты дома и редкие окна
    const items = [];
    let x = -10;
    let i = 0;
    while (x < W + 20) {
      const w = 22 + rnd() * 34;
      const h = 40 + rnd() * 90;
      items.push(<rect key={`b${i}`} x={x} y={H - h} width={w} height={h} fill={tone} fillOpacity={0.1 + rnd() * 0.12} stroke="none" />);
      for (let k = 0; k < 6; k++) {
        if (rnd() > 0.5) continue;
        items.push(<rect key={`w${i}-${k}`} x={x + 5 + rnd() * (w - 10)} y={H - h + 8 + rnd() * (h - 16)} width="3" height="4" fill={tone} fillOpacity="0.75" stroke="none" />);
      }
      x += w + 4 + rnd() * 6;
      i++;
    }
    items.push(<circle key="moon" cx={250} cy={48} r={16} fill={tone} fillOpacity="0.55" stroke="none" />);
    return items;
  }

  if (event.type === 'team') {
    // Узлы и связи: команда
    const nodes = Array.from({ length: 7 }, () => [40 + rnd() * 240, 40 + rnd() * 120]);
    const items = [];
    nodes.forEach(([x1, y1], a) => {
      nodes.slice(a + 1).forEach(([x2, y2], b) => {
        if (Math.hypot(x1 - x2, y1 - y2) < 120) items.push(<line key={`l${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" strokeOpacity="0.55" />);
      });
    });
    nodes.forEach(([x, y], a) => items.push(<circle key={`n${a}`} cx={x} cy={y} r={a === 0 ? 7 : 4} fill={tone} fillOpacity={a === 0 ? 0.9 : 0.7} stroke="none" />));
    return items;
  }

  if (event.type === 'summit') {
    // Лучи из точки — праздник
    const items = [];
    for (let a = 0; a < 26; a++) {
      const ang = (a / 26) * Math.PI * 2;
      const len = 90 + rnd() * 90;
      items.push(<line key={a} x1={230} y1={70} x2={230 + Math.cos(ang) * len} y2={70 + Math.sin(ang) * len} strokeWidth={a % 3 ? 0.8 : 1.4} strokeOpacity={0.35 + rnd() * 0.4} />);
    }
    items.push(<circle key="c" cx={230} cy={70} r={10} fill={tone} stroke="none" />);
    return items;
  }

  // Эфир: волны сигнала и орбита
  const items = [];
  for (let i = 0; i < 5; i++) {
    const amp = 8 + rnd() * 14;
    const freq = 1.3 + rnd() * 1.6;
    const y = 60 + i * 28;
    let d = '';
    for (let x = 0; x <= 40; x++) {
      const px = (x / 40) * W;
      const py = y + Math.sin((x / 40) * Math.PI * 2 * freq + i) * amp;
      d += (x ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1);
    }
    items.push(<path key={i} d={d} fill="none" strokeWidth={i === 0 ? 1.6 : 1} strokeOpacity={0.55 - i * 0.08} />);
  }
  items.push(<circle key="o1" cx={236} cy={56} r={34} fill="none" strokeWidth="1" strokeOpacity="0.4" />);
  items.push(<circle key="o2" cx={236} cy={56} r={20} fill="none" strokeWidth="1" strokeOpacity="0.6" />);
  items.push(<circle key="o3" cx={236} cy={56} r={6} fill={tone} stroke="none" />);
  return items;
}

/* Маленькая версия для строк списка */
export function CoverThumb({ event, size = 46 }) {
  return (
    <div className="thumb" style={{ width: size, height: size }}>
      <Cover event={event} className="ev__cover--square" />
    </div>
  );
}
