import { LANDMARKS } from '../data/landmarks.js';
import { REGIONS } from '../data/regions.js';
import { catById } from '../data/services.js';
import Icon from './Icons.jsx';
import { Mark } from './Art.jsx';

/* Обложки — как слайды колоды: тёмная поверхность с лёгким тоном региона,
   одна золотая линия силуэта города и больше ничего. Без картинок из сети:
   грузится мгновенно и работает офлайн. */

const GOLD = '#D9B26B';

function Landmark({ region, x, y, scale, stroke = 1.1, draw = true }) {
  const lm = LANDMARKS[region];
  if (!lm) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke={GOLD} strokeLinecap="round" strokeLinejoin="round">
      {lm.parts.map((p, i) => {
        const extra = {
          className: draw ? 's-lm' : undefined,
          pathLength: draw ? 1 : undefined,
          style: draw ? { '--d': `${i * 70}ms` } : undefined,
          fill: p.fill ? GOLD : 'none',
          fillOpacity: p.fill ? 0.06 : undefined,
          strokeWidth: p.thin ? stroke * 0.6 : stroke,
          strokeOpacity: p.thin ? 0.5 : 0.85,
        };
        return p.c ? <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} {...extra} /> : <path key={i} d={p.d} {...extra} />;
      })}
    </g>
  );
}

/* Регион: тон региона сверху, тонкая линия горизонта и силуэт у правого края. */
export function Scene({ region, height = 160, radius, children, style }) {
  const R = REGIONS[region];
  const plate = R?.plate || '#1f1d19';
  const W = 320, H = 160, HZ = 118, s = 0.98;
  const lx = W - 100 * s - 22;
  const ly = HZ - 84 * s;
  return (
    <div className="scene" style={{ height, borderRadius: radius, background: `linear-gradient(180deg, ${plate} 0%, #0a0b10 100%)`, ...style }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <line x1="0" y1={HZ} x2={W} y2={HZ} stroke={GOLD} strokeOpacity="0.28" strokeWidth="0.8" />
        <Landmark region={region} x={lx} y={ly} scale={s} />
      </svg>
      <div className="scene__shade" />
      {children}
    </div>
  );
}

/* Эфир в Zoom: спокойный тон и один значок. */
export function Live({ height = 160, radius, children }) {
  return (
    <div className="scene" style={{ height, borderRadius: radius, background: 'linear-gradient(180deg, #1a2030 0%, #0a0b10 100%)' }}>
      <div className="s-live" aria-hidden="true"><span className="disc"><Icon name="video" size={20} /></span></div>
      <div className="scene__shade" />
      {children}
    </div>
  );
}

export function EventCover({ event, height = 160, radius, children }) {
  if (event.kind === 'online' || !REGIONS[event.region]) return <Live height={height} radius={radius}>{children}</Live>;
  return <Scene region={event.region} height={height} radius={radius}>{children}</Scene>;
}

/* Квадратная миниатюра для строк: тон региона и тонкий силуэт. */
export function Thumb({ region, online, size = 44, radius = 13 }) {
  if (online || !REGIONS[region]) {
    return <span className="disc" style={{ width: size, height: size, borderRadius: radius }}><Icon name="video" size={size * 0.4} /></span>;
  }
  return (
    <span className="s-thumb" style={{ width: size, height: size, borderRadius: radius, background: `linear-gradient(180deg, ${REGIONS[region].plate}, #0b0d12)` }}>
      <svg viewBox="6 8 88 84" width={size * 0.78} height={size * 0.78}>
        <Landmark region={region} x={0} y={0} scale={1} stroke={2.2} draw={false} />
      </svg>
    </span>
  );
}

/* Компания: тёмная поверхность и первая буква названия антиквой. */
export function Brand({ company, height = 150, radius, children, size }) {
  const tone = catById(company.cat)?.tone || GOLD;
  if (size) {
    return (
      <span className="s-brand" style={{ width: size, height: size, borderRadius: radius ?? size * 0.3, fontSize: size * 0.5, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
        {company.name[0]}
      </span>
    );
  }
  return (
    <div className="scene" style={{ height, borderRadius: radius, background: `linear-gradient(160deg, ${tone}26 0%, #0a0b10 70%)` }}>
      <span className="s-brand s-brand--big" style={{ boxShadow: `inset 0 0 0 1px ${tone}66` }}>{company.name[0]}</span>
      <div className="scene__shade" />
      {children}
    </div>
  );
}

/* Материал базы: запись эфира или гайд. */
export function MaterialCover({ material, height = 150, radius, children }) {
  const zoom = material.kind === 'zoom';
  return (
    <div className="scene" style={{ height, borderRadius: radius, background: zoom ? 'linear-gradient(160deg, #1b2030, #0a0b10 75%)' : 'linear-gradient(160deg, #2a2418, #0a0b10 75%)' }}>
      <div className="s-live" aria-hidden="true">
        <span className="disc" style={{ width: 56, height: 56 }}>{zoom ? <Icon name="play" size={20} fill="currentColor" width={1} /> : <Mark size={26} />}</span>
      </div>
      <div className="scene__shade" />
      {children}
    </div>
  );
}
