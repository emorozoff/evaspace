import { useId } from 'react';

/* Флаги — векторные кружки, а не эмодзи: на Windows и в части Android
   эмодзи-флаги превращаются в буквы «ID», «RU», «AE». Рисуем сами —
   одинаково везде, чётко в 12 и в 40 пикселях. Каждый флаг нарисован
   в квадрате 24×24 и обрезан кругом (или скруглённым прямоугольником). */

const W = '#F4F1EA';

const FLAGS = {
  ru: () => (<><rect width="24" height="8" fill={W} /><rect y="8" width="24" height="8" fill="#1E4FB5" /><rect y="16" width="24" height="8" fill="#D52B1E" /></>),
  id: () => (<><rect width="24" height="12" fill="#D8262F" /><rect y="12" width="24" height="12" fill={W} /></>),
  ae: () => (<><rect width="24" height="8" fill="#138A3F" /><rect y="8" width="24" height="8" fill={W} /><rect y="16" width="24" height="8" fill="#141414" /><rect width="8" height="24" fill="#D52B1E" /></>),
  us: () => (
    <>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} y={i * 3.43} width="24" height="1.72" fill="#C8262F" />)}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={`w${i}`} y={i * 3.43 + 1.72} width="24" height="1.71" fill={W} />)}
      <rect width="11.5" height="12" fill="#243C87" />
      {[[2.2, 2.2], [5.7, 2.2], [9.2, 2.2], [4, 5], [7.5, 5], [2.2, 7.8], [5.7, 7.8], [9.2, 7.8], [4, 10.4], [7.5, 10.4]].map(([x, y], i) => <circle key={`s${i}`} cx={x} cy={y} r=".7" fill={W} />)}
    </>
  ),
  eu: () => (
    <>
      <rect width="24" height="24" fill="#1F3F9E" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={12 + Math.cos(a) * 6.2} cy={12 + Math.sin(a) * 6.2} r=".95" fill="#F5C83B" />;
      })}
    </>
  ),
  gb: () => (
    <>
      <rect width="24" height="24" fill="#21307E" />
      <path d="M0 0 24 24M24 0 0 24" stroke={W} strokeWidth="5" />
      <path d="M0 0 24 24M24 0 0 24" stroke="#C8262F" strokeWidth="1.8" />
      <path d="M12 0v24M0 12h24" stroke={W} strokeWidth="7" />
      <path d="M12 0v24M0 12h24" stroke="#C8262F" strokeWidth="4" />
    </>
  ),
  pt: () => (<><rect width="24" height="24" fill="#D52B1E" /><rect width="9.6" height="24" fill="#0B6A3A" /><circle cx="9.6" cy="12" r="4" fill="#F5C83B" /><circle cx="9.6" cy="12" r="2.2" fill="#D52B1E" /></>),
  es: () => (<><rect width="24" height="24" fill="#C8262F" /><rect y="6" width="24" height="12" fill="#F5C83B" /></>),
  de: () => (<><rect width="24" height="8" fill="#141414" /><rect y="8" width="24" height="8" fill="#D52B1E" /><rect y="16" width="24" height="8" fill="#F5C83B" /></>),
  cy: () => (<><rect width="24" height="24" fill={W} /><path d="M5.5 10.5c3-2 7-2.6 11.5-1.8l1.8-1.2-.4 2.4c-2 1.6-6 2.6-9.6 2.4-1.6-.1-2.8-.8-3.3-1.8Z" fill="#D57800" /><path d="M8 15.5c1.4 1 2.6 1.3 4 1.3s2.6-.3 4-1.3" fill="none" stroke="#3C7A2A" strokeWidth="1.1" /></>),
  tr: () => (<><rect width="24" height="24" fill="#D8262F" /><circle cx="10" cy="12" r="5" fill={W} /><circle cx="11.3" cy="12" r="4" fill="#D8262F" /><path d="m16.2 12-2.4.9 1.5-2.1v2.5l-1.5-2.1Z" fill={W} /></>),
  ge: () => (<><rect width="24" height="24" fill={W} /><path d="M12 0v24M0 12h24" stroke="#D8262F" strokeWidth="3.4" /><path d="M6 4v4M4 6h4M18 4v4M16 6h4M6 16v4M4 18h4M18 16v4M16 18h4" stroke="#D8262F" strokeWidth="1.2" /></>),
  am: () => (<><rect width="24" height="8" fill="#D8262F" /><rect y="8" width="24" height="8" fill="#1F3F9E" /><rect y="16" width="24" height="8" fill="#F2A800" /></>),
  kz: () => (<><rect width="24" height="24" fill="#16A7C7" /><circle cx="12" cy="10.5" r="3.4" fill="#F5C83B" /><path d="M7.5 15.5c2.8 1.6 6.2 1.6 9 0" fill="none" stroke="#F5C83B" strokeWidth="1.2" /></>),
  th: () => (<><rect width="24" height="24" fill="#C8262F" /><rect y="4" width="24" height="16" fill={W} /><rect y="8" width="24" height="8" fill="#21307E" /></>),
  sg: () => (<><rect width="24" height="12" fill="#D8262F" /><rect y="12" width="24" height="12" fill={W} /><circle cx="6.5" cy="6" r="3.2" fill={W} /><circle cx="7.8" cy="6" r="3" fill="#D8262F" /><g fill={W}>{[[10.4, 3.8], [12.6, 5.2], [11.8, 7.6], [9.2, 7.6], [8.6, 5.2]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r=".6" />)}</g></>),
  jp: () => (<><rect width="24" height="24" fill={W} /><circle cx="12" cy="12" r="5.2" fill="#C8262F" /></>),
};

export const FLAG_CODES = Object.keys(FLAGS);

/** Флаг страны: cc — код ISO ('ru', 'id', 'ae', 'us', 'eu' …). */
export default function Flag({ cc, size = 16, shape = 'round', ring = true, style, className }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const draw = FLAGS[cc];
  const r = shape === 'round' ? 12 : 4;
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}
      style={{ display: 'inline-block', flex: 'none', verticalAlign: '-0.14em', ...style }}
    >
      <defs><clipPath id={`f${id}`}><rect width="24" height="24" rx={r} /></clipPath></defs>
      <g clipPath={`url(#f${id})`}>{draw ? draw() : <rect width="24" height="24" fill="#3a3833" />}</g>
      {ring && <rect x=".5" y=".5" width="23" height="23" rx={r - 0.5} fill="none" stroke="rgba(255,255,255,.18)" />}
    </svg>
  );
}

/** Флаг и название рядом — для строк и подписей. */
export function Place({ cc, children, size = 14, gap = 6 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, minWidth: 0 }}>
      <Flag cc={cc} size={size} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
    </span>
  );
}
