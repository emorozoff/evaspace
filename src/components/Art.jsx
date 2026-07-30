import { useId } from 'react';

/* ============================================================
   Генеративные обложки.
   Внешние картинки не используются: каждая обложка рисуется
   вектором прямо в приложении — грузится мгновенно, работает
   офлайн и никогда не «ломается».
   Если у элемента задано поле image (ссылка на фото), показываем фото.
   ============================================================ */

const H = (h, s, l, a = 1) => `hsla(${h} ${s}% ${l}% / ${a})`;

function Sky({ h, n = 26, seed = 1 }) {
  const dots = [];
  let x = seed * 9301;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280), x / 233280);
  for (let i = 0; i < n; i++) {
    const cx = rnd() * 400;
    const cy = rnd() * 260;
    const r = rnd() * 1.5 + 0.5;
    dots.push(<circle key={i} cx={cx} cy={cy} r={r} fill={H(h, 100, 96, 0.55 + rnd() * 0.45)} />);
  }
  return <g>{dots}</g>;
}

function Petals({ n, rx, ry, cx, cy, fill, rot = 0, opacity = 1 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + rot;
    out.push(
      <path
        key={i}
        d={`M0 0 C ${rx} ${-ry * 0.35} ${rx * 0.75} ${-ry} 0 ${-ry * 1.25} C ${-rx * 0.75} ${-ry} ${-rx} ${-ry * 0.35} 0 0 Z`}
        transform={`translate(${cx} ${cy}) rotate(${a})`}
        fill={fill}
        opacity={opacity}
      />
    );
  }
  return <g>{out}</g>;
}

/* --- сцены --- */
const SCENES = {
  aurora: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <path d="M-20 190 C 80 130 150 220 240 160 S 380 120 430 170 L430 280 L-20 280Z" fill={H(h + 18, 70, 74, 0.55)} />
      <path d="M-20 215 C 90 165 170 245 260 195 S 390 165 430 205 L430 280 L-20 280Z" fill={H(h - 12, 65, 62, 0.6)} />
      <path d="M-20 240 C 100 205 180 262 280 226 S 400 210 430 236 L430 280 L-20 280Z" fill={H(h - 30, 55, 46, 0.65)} />
      <circle cx="308" cy="66" r="34" fill={H(h + 40, 95, 88, 0.85)} />
      <circle cx="308" cy="66" r="52" fill={H(h + 40, 95, 88, 0.22)} />
    </>
  ),
  sunrise: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      {[110, 88, 66, 46].map((r, i) => (
        <circle key={i} cx="200" cy="176" r={r} fill="none" stroke={H(h + 30, 90, 88, 0.28 + i * 0.08)} strokeWidth="1.6" />
      ))}
      <circle cx="200" cy="176" r="34" fill={H(h + 42, 96, 84, 0.95)} />
      <circle cx="200" cy="176" r="56" fill={H(h + 42, 96, 84, 0.22)} />
      <path d="M-10 196 C 90 176 150 210 210 196 S 340 178 410 200 L410 280 L-10 280Z" fill={H(h - 20, 52, 40, 0.72)} />
    </>
  ),
  lotus: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <circle cx="200" cy="150" r="92" fill={H(h + 30, 90, 90, 0.25)} />
      <Petals n={5} rx={34} ry={78} cx={200} cy={196} fill={H(h + 15, 78, 84, 0.75)} rot={180} />
      <Petals n={3} rx={26} ry={62} cx={200} cy={196} fill={H(h + 35, 88, 93, 0.9)} rot={180} />
      <ellipse cx="200" cy="200" rx="14" ry="9" fill={H(h + 45, 95, 96, 0.95)} />
      <path d="M-10 216 C 110 200 150 228 200 220 S 330 202 410 218 L410 280 L-10 280Z" fill={H(h - 25, 50, 42, 0.6)} />
    </>
  ),
  moon: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <Sky h={h + 40} n={34} seed={3} />
      <circle cx="292" cy="72" r="36" fill={H(h + 45, 96, 92, 0.96)} />
      <circle cx="276" cy="64" r="32" fill={H(h - 10, 45, 26)} opacity="0.92" />
      <path d="M-10 200 C 70 150 120 210 190 196 S 320 160 410 208 L410 280 L-10 280Z" fill={H(h - 8, 45, 30, 0.85)} />
      <path d="M-10 232 C 90 200 160 244 250 224 S 370 214 410 236 L410 280 L-10 280Z" fill={H(h - 14, 50, 20, 0.9)} />
    </>
  ),
  botanical: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <g stroke={H(h - 15, 45, 42, 0.75)} strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M120 262 C 130 190 150 140 196 96" />
        <path d="M286 262 C 276 200 260 158 224 118" />
      </g>
      {[
        [150, 190, -34],
        [166, 152, -18],
        [188, 118, -6],
        [258, 196, 34],
        [244, 160, 22],
        [228, 132, 10],
      ].map(([x, y, r], i) => (
        <path
          key={i}
          d="M0 0 C 22 -12 40 -6 46 10 C 30 24 8 20 0 0 Z"
          transform={`translate(${x} ${y}) rotate(${r}) scale(${i % 2 ? 1 : -1},1)`}
          fill={H(h + 12, 62, 66, 0.85)}
        />
      ))}
      <circle cx="204" cy="86" r="15" fill={H(h + 45, 95, 90, 0.95)} />
      <circle cx="204" cy="86" r="28" fill={H(h + 45, 95, 90, 0.25)} />
    </>
  ),
  waves: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M-20 ${86 + i * 34} C 70 ${56 + i * 34} 130 ${118 + i * 34} 210 ${88 + i * 34} S 350 ${52 + i * 34} 430 ${94 + i * 34}`}
          fill="none"
          stroke={H(h + i * 8, 80, 84 - i * 6, 0.55)}
          strokeWidth={2.5 + i * 0.7}
          strokeLinecap="round"
        />
      ))}
      <circle cx="86" cy="66" r="24" fill={H(h + 40, 95, 90, 0.85)} />
    </>
  ),
  starmap: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <Sky h={h + 45} n={44} seed={7} />
      <g stroke={H(h + 45, 90, 92, 0.55)} strokeWidth="1" fill="none">
        <path d="M92 176 L146 118 L214 142 L268 82 L330 116" />
        <path d="M146 118 L166 62" />
        <path d="M214 142 L232 200" />
      </g>
      {[
        [92, 176, 4],
        [146, 118, 5.5],
        [214, 142, 4.5],
        [268, 82, 6],
        [330, 116, 4],
        [166, 62, 3.4],
        [232, 200, 3.4],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={H(h + 48, 98, 95, 0.98)} />
      ))}
    </>
  ),
  mandala: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <g transform="translate(200 130)">
        <Petals n={12} rx={22} ry={96} cx={0} cy={0} fill={H(h + 20, 82, 86, 0.35)} />
        <Petals n={8} rx={26} ry={64} cx={0} cy={0} fill={H(h + 35, 88, 90, 0.5)} rot={22} />
        <circle r="70" fill="none" stroke={H(h + 40, 90, 92, 0.4)} strokeWidth="1.2" />
        <circle r="44" fill="none" stroke={H(h + 40, 90, 92, 0.55)} strokeWidth="1.2" />
        <circle r="18" fill={H(h + 45, 96, 94, 0.95)} />
      </g>
    </>
  ),
  candle: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <circle cx="200" cy="126" r="88" fill={H(h + 42, 96, 88, 0.18)} />
      <circle cx="200" cy="126" r="56" fill={H(h + 42, 96, 88, 0.26)} />
      <rect x="176" y="150" width="48" height="86" rx="10" fill={H(h + 20, 60, 92, 0.95)} />
      <ellipse cx="200" cy="150" rx="24" ry="7" fill={H(h + 20, 55, 84, 0.95)} />
      <path d="M200 96 C 214 116 210 138 200 144 C 190 138 186 116 200 96Z" fill="hsl(34 98% 66%)" />
      <path d="M200 112 C 207 124 205 136 200 140 C 195 136 193 124 200 112Z" fill="hsl(48 100% 90%)" />
    </>
  ),
  silk: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M-30 ${200 - i * 40} C 80 ${120 - i * 30} 160 ${240 - i * 30} 250 ${150 - i * 34} S 380 ${60 - i * 20} 430 ${120 - i * 30}`}
          fill="none"
          stroke={H(h + i * 14, 78, 82 - i * 5, 0.5)}
          strokeWidth={26 - i * 6}
          strokeLinecap="round"
        />
      ))}
    </>
  ),
  figure: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <circle cx="200" cy="122" r="96" fill={H(h + 38, 92, 90, 0.28)} />
      <circle cx="200" cy="122" r="70" fill={H(h + 42, 94, 92, 0.3)} />
      <g fill={H(h - 22, 48, 26, 0.9)}>
        <ellipse cx="200" cy="228" rx="86" ry="26" />
        <path d="M200 132 C 176 136 164 158 158 196 L242 196 C 236 158 224 136 200 132 Z" />
        <circle cx="200" cy="106" r="23" />
      </g>
      <g stroke={H(h - 22, 48, 26, 0.9)} strokeWidth="15" strokeLinecap="round" fill="none">
        <path d="M170 152 C 150 172 144 198 156 212" />
        <path d="M230 152 C 250 172 256 198 244 212" />
      </g>
      <path d="M200 60 c 2.6 14 5 20 10.5 24 -5.5 4 -7.9 10 -10.5 24 -2.6-14-5-20-10.5-24 5.5-4 7.9-10 10.5-24Z" fill={H(h + 48, 98, 96, 0.95)} />
    </>
  ),
  bloom: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <g transform="translate(200 140)">
        <Petals n={7} rx={40} ry={92} cx={0} cy={0} fill={H(h + 12, 80, 82, 0.55)} />
        <Petals n={7} rx={30} ry={66} cx={0} cy={0} fill={H(h + 30, 90, 90, 0.75)} rot={26} />
        <circle r="20" fill={H(h + 45, 96, 92, 0.95)} />
        <circle r="9" fill={H(h + 50, 98, 78, 0.9)} />
      </g>
    </>
  ),

  /* --- товары маркета --- */
  p_mat: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <g transform="translate(200 140) rotate(-12)">
        <rect x="-120" y="-26" width="240" height="52" rx="26" fill={H(h + 10, 62, 74)} />
        <rect x="-120" y="-26" width="70" height="52" rx="26" fill={H(h + 20, 72, 86)} />
        <circle cx="-86" cy="0" r="17" fill={H(h + 30, 80, 94)} />
        <circle cx="-86" cy="0" r="7" fill={H(h, 55, 62)} />
      </g>
    </>
  ),
  p_cushion: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <ellipse cx="200" cy="196" rx="112" ry="20" fill={H(h - 20, 40, 40, 0.18)} />
      <path d="M100 178 C 100 118 300 118 300 178 C 300 208 100 208 100 178 Z" fill={H(h + 10, 66, 76)} />
      <ellipse cx="200" cy="146" rx="100" ry="34" fill={H(h + 20, 76, 87)} />
      <ellipse cx="200" cy="146" rx="46" ry="15" fill={H(h + 28, 82, 93)} />
      <path d="M100 178 C 130 190 270 190 300 178" fill="none" stroke={H(h, 50, 60, 0.5)} strokeWidth="2" />
    </>
  ),
  p_candle: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <circle cx="200" cy="120" r="70" fill={H(h + 40, 96, 90, 0.25)} />
      <rect x="158" y="128" width="84" height="102" rx="14" fill={H(h + 12, 55, 92)} />
      <ellipse cx="200" cy="128" rx="42" ry="12" fill={H(h + 16, 50, 84)} />
      <rect x="158" y="176" width="84" height="30" fill={H(h + 6, 45, 78, 0.55)} />
      <path d="M200 74 C 216 98 212 118 200 124 C 188 118 184 98 200 74Z" fill="hsl(34 98% 64%)" />
      <path d="M200 90 C 208 104 206 116 200 120 C 194 116 192 104 200 90Z" fill="hsl(48 100% 90%)" />
    </>
  ),
  p_blanket: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <ellipse cx="200" cy="214" rx="112" ry="16" fill={H(h - 20, 40, 40, 0.16)} />
      <rect x="96" y="150" width="208" height="60" rx="16" fill={H(h + 8, 62, 78)} />
      <rect x="110" y="112" width="180" height="52" rx="14" fill={H(h + 18, 72, 86)} />
      <rect x="126" y="80" width="148" height="46" rx="13" fill={H(h + 28, 80, 92)} />
      <path d="M126 103h148M110 138h180M96 180h208" stroke={H(h, 45, 62, 0.35)} strokeWidth="2.5" />
    </>
  ),
  p_mask: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <path d="M112 108 h176 a26 26 0 0 1 26 26 v22 a34 34 0 0 1-34 34 h-32 a22 22 0 0 1-18-10 l-6-9 a18 18 0 0 0-30 0 l-6 9 a22 22 0 0 1-18 10 h-32 a34 34 0 0 1-34-34 v-22 a26 26 0 0 1 26-26Z" fill={H(h + 16, 68, 84)} />
      <path d="M86 128 C 50 122 34 116 22 112M314 128 C 350 122 366 116 378 112" stroke={H(h + 6, 55, 72)} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M150 140 a26 20 0 0 1 44 0M206 140 a26 20 0 0 1 44 0" stroke={H(h, 45, 62, 0.5)} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </>
  ),
  p_dress: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <path d="M170 62 C 186 50 214 50 230 62 L268 84 L252 118 L238 110 L246 224 C 214 236 186 236 154 224 L162 110 L148 118 L132 84 Z" fill={H(h + 14, 68, 82)} />
      <path d="M170 62 C 186 78 214 78 230 62" fill="none" stroke={H(h, 50, 58, 0.5)} strokeWidth="2.5" />
      <path d="M162 110 C 200 126 200 126 238 110" fill="none" stroke={H(h, 50, 58, 0.35)} strokeWidth="2" />
      <circle cx="200" cy="38" r="10" fill="none" stroke={H(h - 10, 40, 50, 0.6)} strokeWidth="3" />
    </>
  ),
  p_robe: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <path d="M164 60 L200 76 L236 60 L286 96 L262 128 L250 118 L256 232 L144 232 L150 118 L138 128 L114 96 Z" fill={H(h + 16, 70, 84)} />
      <path d="M200 76 L200 232" stroke={H(h, 45, 58, 0.45)} strokeWidth="2.5" />
      <path d="M164 60 L200 128 L236 60" fill={H(h + 26, 76, 92, 0.9)} />
      <rect x="132" y="160" width="136" height="12" rx="6" fill={H(h + 4, 55, 66)} />
    </>
  ),
  p_tea: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <path d="M148 124 h104 v46 a52 52 0 0 1-104 0Z" fill={H(h + 14, 62, 88)} />
      <ellipse cx="200" cy="124" rx="52" ry="15" fill={H(h + 26, 72, 94)} />
      <path d="M252 136 a26 26 0 1 1 0 40" fill="none" stroke={H(h + 14, 62, 88)} strokeWidth="10" />
      <ellipse cx="200" cy="214" rx="76" ry="12" fill={H(h, 50, 70, 0.5)} />
      <g stroke={H(h + 30, 70, 92, 0.85)} strokeWidth="4" fill="none" strokeLinecap="round">
        <path d="M182 100 C 192 88 174 78 184 64" />
        <path d="M212 98 C 222 86 204 76 214 62" />
      </g>
    </>
  ),
  p_journal: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <rect x="128" y="52" width="150" height="164" rx="12" fill={H(h + 10, 58, 80)} transform="rotate(-6 200 130)" />
      <rect x="140" y="60" width="150" height="164" rx="12" fill={H(h + 22, 70, 92)} transform="rotate(4 200 130)" />
      <g stroke={H(h, 45, 62, 0.55)} strokeWidth="3" strokeLinecap="round" transform="rotate(4 200 130)">
        <path d="M166 106h96M166 132h96M166 158h60" />
      </g>
      <path d="M296 74 l14 22 -14 128 -14-128Z" fill={H(h - 10, 55, 58)} transform="rotate(6 296 130)" />
    </>
  ),
  p_crystal: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <ellipse cx="200" cy="216" rx="88" ry="16" fill={H(h - 20, 40, 40, 0.18)} />
      <path d="M200 46 L246 124 L222 212 L178 212 L154 124 Z" fill={H(h + 20, 74, 86, 0.95)} />
      <path d="M200 46 L200 212" stroke={H(h + 34, 84, 96, 0.8)} strokeWidth="3" />
      <path d="M154 124 L200 150 L246 124" fill="none" stroke={H(h + 34, 84, 96, 0.7)} strokeWidth="3" />
      <path d="M262 132 L286 172 L274 214 L250 214 L242 172 Z" fill={H(h + 6, 66, 76, 0.9)} />
    </>
  ),
  p_oil: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <rect x="176" y="42" width="48" height="34" rx="8" fill={H(h - 6, 48, 62)} />
      <path d="M160 82 h80 a18 18 0 0 1 18 18 v96 a20 20 0 0 1-20 20 h-76 a20 20 0 0 1-20-20 v-96 a18 18 0 0 1 18-18Z" fill={H(h + 18, 70, 84, 0.95)} />
      <rect x="162" y="120" width="76" height="52" rx="8" fill={H(h + 32, 84, 95, 0.9)} />
      <path d="M258 108 a34 34 0 0 1 0 60" fill="none" stroke={H(h + 30, 80, 92, 0.5)} strokeWidth="5" />
    </>
  ),
  p_band: (h, g) => (
    <>
      <rect width="400" height="260" fill={`url(#${g})`} />
      <path d="M110 130 C 110 82 290 82 290 130 C 290 178 110 178 110 130 Z" fill="none" stroke={H(h + 16, 70, 82)} strokeWidth="22" strokeLinecap="round" />
      <path d="M120 168 C 170 208 230 208 280 168" fill="none" stroke={H(h + 30, 80, 92)} strokeWidth="18" strokeLinecap="round" />
    </>
  ),
};

const STYLE_KEYS = Object.keys(SCENES).filter((k) => !k.startsWith('p_'));

export function hashCode(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function autoArt(id = '') {
  const n = hashCode(id);
  return { style: STYLE_KEYS[n % STYLE_KEYS.length], hue: (n * 37) % 360 };
}

export default function Art({ art, id, ratio = '16-10', className = '', image, alt = '', kenburns = false, children }) {
  const gid = useId().replace(/:/g, '');
  const a = art || autoArt(id);
  const hue = ((a.hue ?? 320) + 360) % 360;
  const scene = SCENES[a.style] || SCENES.aurora;

  return (
    <div className={`art art-${ratio} ${className}`}>
      {image ? (
        <img src={image} alt={alt} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className={kenburns ? 'kenburns' : ''}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={H(hue, 62, 88)} />
              <stop offset="55%" stopColor={H(hue + 22, 58, 70)} />
              <stop offset="100%" stopColor={H(hue + 46, 48, 46)} />
            </linearGradient>
          </defs>
          {scene(hue, gid)}
        </svg>
      )}
      {children}
    </div>
  );
}
