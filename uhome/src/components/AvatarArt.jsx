import { useId } from 'react';

/* Ева и Адам — цифровые аватары клуба в манере колоды UPASS: одна золотая
   линия на тёмном диске, как значки на слайдах. Никаких цветных картинок —
   только контур, свет и тонкое кольцо. Одинаково чётко в 24 и в 160 px.
   Появятся настоящие портреты — достаточно передать photo. */

const G = '#d9b26b';

export function AvatarPortrait({ who = 'eva', size = 56, ring = true, photo, style, tone = G }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sw = size >= 96 ? 1.4 : size >= 48 ? 1.8 : 2.4;
  return (
    <div
      className="aport"
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flex: 'none', position: 'relative', background: 'radial-gradient(70% 70% at 50% 28%, #1a1c26, #0a0b10)', ...style }}
    >
      {photo ? (
        <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
          <defs>
            <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f0dcb4" />
              <stop offset="100%" stopColor={tone} />
            </linearGradient>
          </defs>
          <g fill="none" stroke={`url(#g${id})`} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
            {who === 'adam' ? <Adam /> : <Eva />}
          </g>
        </svg>
      )}
      {ring && <i style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: `inset 0 0 0 1px ${tone}66`, pointerEvents: 'none' }} />}
    </div>
  );
}

/* Ева: длинные волосы, мягкий овал, серьга-капля. */
function Eva() {
  return (
    <>
      <path d="M50 24c-13 0-20 10-20 24 0 12 8 22 20 22s20-10 20-22c0-14-7-24-20-24Z" />
      <path d="M30 46c-3 14-7 26-10 40M70 46c3 14 7 26 10 40" />
      <path d="M31 44c2-14 10-22 19-22s17 8 19 22" />
      <path d="M32 40c3-9 9-14 18-14 4 0 7 1 10 3" opacity=".7" />
      <path d="M41 52c2-2 5-2 7 0M52 52c2-2 5-2 7 0" />
      <path d="M50 54c-.5 3-1 5 .6 6" opacity=".8" />
      <path d="M45 65c3 2 7 2 10 0" />
      <path d="M29 50v3" /><circle cx="29" cy="56" r="1.6" fill={G} stroke="none" />
      <path d="M40 72c-8 3-15 8-19 20h58c-4-12-11-17-19-20" />
    </>
  );
}

/* Адам: короткая стрижка, чёткая челюсть, ворот. */
function Adam() {
  return (
    <>
      <path d="M50 23c-12 0-19 9-19 22 0 8 2 14 5 19 3 5 8 8 14 8s11-3 14-8c3-5 5-11 5-19 0-13-7-22-19-22Z" />
      <path d="M31 44c-1-12 7-20 19-20s20 8 19 20c-3-6-9-9-19-9s-16 3-19 9Z" />
      <path d="M41 50c2-1.5 5-1.5 7 0M52 50c2-1.5 5-1.5 7 0" />
      <path d="M50 52c-.6 3.4-1.2 5.6.8 6.6" opacity=".8" />
      <path d="M45.5 64c3 1.3 6 1.3 9 0" />
      <path d="M43 70v6c-9 3-16 8-19 16h52c-3-8-10-13-19-16v-6" />
      <path d="M43 76l7 8 7-8" opacity=".8" />
    </>
  );
}
