// Картинки-раскраски для «Истории АСЬКИ»: чёрный контур, белые области. Нажал на область — она красится
// в следующий цвет лубочной палитры (киноварь, золото, малахит, лазурь, охра, пурпур), ещё раз — дальше.
// Всё нарисовано здесь же — свои рисунки в духе русских сказок.
import { useState } from 'react';
import type { ReactElement } from 'react';

export const PALETTE = ['#d9302c', '#f2b632', '#2f7a46', '#2a5aa8', '#e98a2c', '#7a3e9d', '#f6e7c8', '#ffffff'];

type Shape = ReactElement<{ 'data-f'?: string }>;
// Каждая картинка — список областей; область с data-f закрашивается
export type ArtKey = 'word' | 'mail' | 'web' | 'runet' | 'flower' | 'sunset' | 'zoomer' | 'firebird' | 'scroll' | 'chest' | 'road' | 'quill';

const S = { stroke: '#2a1a10', strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function rays(cx: number, cy: number, r1: number, r2: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const a2 = a + Math.PI / n;
    return `M${cx + r1 * Math.cos(a)} ${cy + r1 * Math.sin(a)} L${cx + r2 * Math.cos(a2)} ${cy + r2 * Math.sin(a2)} L${cx + r1 * Math.cos(a + (2 * Math.PI) / n)} ${cy + r1 * Math.sin(a + (2 * Math.PI) / n)} Z`;
  });
}
function petals(cx: number, cy: number, r: number, pr: number, n = 8) {
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a), pr] as const; });
}

const ART: Record<ArtKey, () => Shape[]> = {
  // «В начале было Слово» — раскрытая книга и солнце
  word: () => [
    ...rays(120, 46, 26, 40, 12).map((d, i) => <path key={`r${i}`} data-f="" d={d} />),
    <circle key="sun" data-f="" cx="120" cy="46" r="24" />,
    <path key="bl" data-f="" d="M40 96 Q80 82 118 96 L118 150 Q80 138 40 152 Z" />,
    <path key="br" data-f="" d="M122 96 Q160 82 200 96 L200 152 Q160 138 122 150 Z" />,
    <path key="sp" d="M118 96 L122 96 L122 150 L118 150" fill="none" />,
    <text key="lo" x="64" y="130" fontSize="22" fontFamily="Georgia, serif" fill="#2a1a10">LO</text>,
    <path key="l1" d="M140 110 H185 M140 120 H180 M140 130 H186" fill="none" />,
    <path key="st" data-f="" d="M30 160 H210 L200 170 H40 Z" />,
  ],
  // Письмо-птица летит между двух теремов
  mail: () => [
    <path key="t1" data-f="" d="M20 160 V96 L40 76 L60 96 V160 Z" />,
    <path key="t1r" data-f="" d="M16 98 L40 62 L64 98 Z" />,
    <rect key="t1w" data-f="" x="32" y="110" width="16" height="20" rx="8" />,
    <path key="t2" data-f="" d="M180 160 V96 L200 76 L220 96 V160 Z" />,
    <path key="t2r" data-f="" d="M176 98 L200 62 L224 98 Z" />,
    <rect key="t2w" data-f="" x="192" y="110" width="16" height="20" rx="8" />,
    <path key="wire" d="M60 100 Q120 140 180 100" fill="none" strokeDasharray="4 4" />,
    <path key="wl" data-f="" d="M98 82 Q80 60 92 50 Q104 64 112 78 Z" />,
    <path key="wr" data-f="" d="M142 82 Q160 60 148 50 Q136 64 128 78 Z" />,
    <rect key="env" data-f="" x="98" y="76" width="44" height="30" rx="3" />,
    <path key="envf" d="M98 76 L120 94 L142 76" fill="none" />,
    <text key="at" x="113" y="104" fontSize="11" fontFamily="Georgia, serif" fill="#2a1a10">@</text>,
    <path key="gr" data-f="" d="M10 160 H230 V172 H10 Z" />,
  ],
  // Всемирная паутина — шар земной в сетях
  web: () => [
    <circle key="g" data-f="" cx="120" cy="92" r="58" />,
    <path key="m1" d="M120 34 Q90 92 120 150 M120 34 Q150 92 120 150 M62 92 H178 M70 64 H170 M70 120 H170" fill="none" />,
    ...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2; return <path key={`s${i}`} d={`M120 92 L${120 + 80 * Math.cos(a)} ${92 + 80 * Math.sin(a)}`} fill="none" strokeDasharray="2 3" />; }),
    <circle key="sp" data-f="" cx="190" cy="40" r="8" />,
    <path key="spl" d="M182 36 L172 30 M182 42 L172 46 M198 36 L208 30 M198 42 L208 46 M190 32 V14" fill="none" />,
    <path key="c1" data-f="" d="M88 74 Q100 62 112 72 Q108 86 96 88 Q86 84 88 74 Z" />,
    <path key="c2" data-f="" d="M130 104 Q148 96 156 110 Q150 126 136 124 Q126 116 130 104 Z" />,
  ],
  // Рунет: башня с часами и модем, что поёт при дозвоне
  runet: () => [
    <path key="b" data-f="" d="M80 168 V80 H120 V168 Z" />,
    <path key="b2" data-f="" d="M86 80 V58 H114 V80 Z" />,
    <path key="sp" data-f="" d="M84 60 L100 20 L116 60 Z" />,
    <path key="star" data-f="" d="M100 8 L103 15 L110 15 L104 19 L106 26 L100 22 L94 26 L96 19 L90 15 L97 15 Z" />,
    <circle key="cl" data-f="" cx="100" cy="100" r="11" />,
    <path key="ch" d="M100 100 V92 M100 100 L106 103" fill="none" />,
    <rect key="g1" data-f="" x="90" y="124" width="20" height="44" rx="10" />,
    <rect key="mo" data-f="" x="140" y="132" width="76" height="30" rx="5" />,
    ...[0, 1, 2, 3].map((i) => <circle key={`l${i}`} data-f="" cx={152 + i * 12} cy="147" r="3.5" />),
    <path key="cord" d="M140 150 Q122 160 112 150" fill="none" />,
    <path key="nt" d="M168 122 Q172 112 168 104 M178 120 Q186 108 178 96 M188 118 Q200 104 188 88" fill="none" />,
    <path key="gr" data-f="" d="M20 168 H230 V178 H20 Z" />,
  ],
  // Цветок ICQ — семь зелёных лепестков и один красный, «о-оу!»
  flower: () => [
    <path key="st" data-f="" d="M118 120 Q114 150 120 176 L124 176 Q118 150 122 120 Z" />,
    <path key="lf" data-f="" d="M120 156 Q90 140 84 160 Q102 170 120 162 Z" />,
    <path key="lf2" data-f="" d="M122 146 Q152 128 160 148 Q140 158 122 152 Z" />,
    ...petals(120, 70, 30, 17).map(([x, y, r], i) => <circle key={`p${i}`} data-f="" cx={x} cy={y} r={r} />),
    <circle key="c" data-f="" cx="120" cy="70" r="16" />,
    <text key="u" x="166" y="30" fontSize="14" fontStyle="italic" fontFamily="Georgia, serif" fill="#2a1a10">о-оу!</text>,
    <path key="sp1" data-f="" d="M40 30 L44 40 L54 42 L44 46 L40 56 L36 46 L26 42 L36 40 Z" />,
    <path key="sp2" data-f="" d="M196 120 L199 127 L206 128 L199 131 L196 138 L193 131 L186 128 L193 127 Z" />,
  ],
  // Закат царства: солнце садится, цветок склоняется
  sunset: () => [
    <circle key="s" data-f="" cx="120" cy="120" r="44" />,
    ...rays(120, 120, 50, 64, 14).slice(7).map((d, i) => <path key={`r${i}`} data-f="" d={d} />),
    <path key="h1" data-f="" d="M10 130 Q70 100 130 128 Q180 146 230 120 V176 H10 Z" />,
    <path key="h2" data-f="" d="M10 150 Q80 132 150 152 Q200 164 230 150 V176 H10 Z" />,
    <path key="fs" d="M60 150 Q66 128 80 120" fill="none" />,
    ...petals(84, 116, 7, 4.5).map(([x, y, r], i) => <circle key={`p${i}`} data-f="" cx={x} cy={y} r={r} />),
    <circle key="fc" data-f="" cx="84" cy="116" r="4" />,
  ],
  // Зумеры: смартфон и вопрос «а это что?»
  zoomer: () => [
    <rect key="ph" data-f="" x="84" y="30" width="72" height="136" rx="12" />,
    <rect key="sc" data-f="" x="92" y="44" width="56" height="104" rx="4" />,
    <circle key="hb" data-f="" cx="120" cy="157" r="4" />,
    <text key="q" x="110" y="108" fontSize="40" fontFamily="Georgia, serif" fill="#2a1a10">?</text>,
    <path key="b1" data-f="" d="M30 70 Q30 54 46 54 H64 Q78 54 78 70 Q78 84 64 84 H44 L36 92 V82 Q30 78 30 70 Z" />,
    <path key="b2" data-f="" d="M162 104 Q162 90 176 90 H196 Q210 90 210 104 Q210 118 196 118 H186 L178 126 V118 Q162 116 162 104 Z" />,
    <text key="t1" x="40" y="74" fontSize="10" fontFamily="Georgia, serif" fill="#2a1a10">аська?</text>,
    <text key="t2" x="171" y="108" fontSize="10" fontFamily="Georgia, serif" fill="#2a1a10">о-оу?</text>,
  ],
  // Жар-птица несёт цветок АСЬКИ
  firebird: () => [
    ...[0, 1, 2, 3, 4].map((i) => <path key={`t${i}`} data-f="" d={`M110 110 Q${40 + i * 6} ${80 + i * 22} ${20 + i * 10} ${150 + i * 4} Q${70 + i * 8} ${130 + i * 6} 116 118 Z`} />),
    <path key="b" data-f="" d="M108 116 Q120 80 160 78 Q176 92 168 108 Q150 128 108 116 Z" />,
    <path key="w" data-f="" d="M130 96 Q120 50 150 30 Q154 60 146 92 Z" />,
    <circle key="h" data-f="" cx="168" cy="72" r="12" />,
    <path key="bk" data-f="" d="M178 70 L194 74 L178 78 Z" />,
    <path key="cr" data-f="" d="M162 60 L164 48 L168 58 L172 46 L174 60 Z" />,
    <circle key="e" cx="170" cy="70" r="2" fill="#2a1a10" />,
    ...petals(196, 112, 8, 5).map(([x, y, r], i) => <circle key={`p${i}`} data-f="" cx={x} cy={y} r={r} />),
    <circle key="fc" data-f="" cx="196" cy="112" r="4.5" />,
  ],
  // Грамота с печатью — о правах
  scroll: () => [
    <path key="p" data-f="" d="M50 40 H180 Q190 40 190 52 V150 Q190 162 178 162 H62 Q50 162 50 150 Z" />,
    <path key="top" data-f="" d="M40 32 Q40 22 50 22 H184 Q196 22 196 34 Q196 44 184 44 H50 Q40 44 40 32 Z" />,
    <path key="lines" d="M70 66 H170 M70 80 H164 M70 94 H170 M70 108 H150" fill="none" />,
    <circle key="seal" data-f="" cx="160" cy="138" r="18" />,
    <path key="r1" data-f="" d="M150 152 L144 176 L154 170 L158 178 L160 156 Z" />,
    <path key="r2" data-f="" d="M170 152 L176 176 L166 170 L162 178 L160 156 Z" />,
    <text key="ic" x="149" y="143" fontSize="13" fontFamily="Georgia, serif" fill="#2a1a10">ICQ</text>,
  ],
  // Сундук с аськоинами — казна принадлежит людям
  chest: () => [
    <path key="lid" data-f="" d="M50 92 Q50 52 120 52 Q190 52 190 92 Z" />,
    <rect key="box" data-f="" x="50" y="92" width="140" height="70" rx="4" />,
    <rect key="b1" data-f="" x="70" y="92" width="12" height="70" />,
    <rect key="b2" data-f="" x="158" y="92" width="12" height="70" />,
    <rect key="lock" data-f="" x="110" y="104" width="20" height="24" rx="3" />,
    ...[[86, 46], [104, 38], [124, 42], [144, 36], [160, 46]].map(([x, y], i) => <circle key={`c${i}`} data-f="" cx={x} cy={y} r="9" />),
    <path key="gr" data-f="" d="M30 162 H210 V172 H30 Z" />,
  ],
  // Путь зодчего: пальма Бали — дорога — башня Москвы
  road: () => [
    <path key="tr" data-f="" d="M44 168 Q50 120 46 80 L54 80 Q58 120 54 168 Z" />,
    ...[[-1, -1], [1, -1], [-1, 0], [1, 0], [0, -1.2]].map(([dx, dy], i) => <path key={`l${i}`} data-f="" d={`M50 80 Q${50 + dx * 30} ${76 + dy * 26} ${50 + dx * 48} ${92 + dy * 10} Q${50 + dx * 22} ${84 + dy * 12} 50 80 Z`} />),
    <path key="road" data-f="" d="M70 172 Q120 140 150 120 Q170 108 190 104 L196 110 Q172 116 154 130 Q126 152 86 176 Z" />,
    <path key="tw" data-f="" d="M180 104 V50 H206 V104 Z" />,
    <path key="tws" data-f="" d="M178 52 L193 16 L208 52 Z" />,
    <path key="st" data-f="" d="M193 6 L195 11 L200 11 L196 14 L198 19 L193 16 L188 19 L190 14 L186 11 L191 11 Z" />,
    <circle key="sun" data-f="" cx="110" cy="40" r="16" />,
    <path key="sea" data-f="" d="M10 150 Q30 144 50 150 Q70 156 90 150 V176 H10 Z" />,
  ],
  // Перо и чернильница — «Создано ИИ АДАМ»
  quill: () => [
    <path key="q" data-f="" d="M150 20 Q200 30 170 90 Q150 128 118 150 Q140 100 150 20 Z" />,
    <path key="qs" d="M150 24 Q140 90 118 150" fill="none" />,
    <path key="ink" data-f="" d="M90 150 Q90 126 112 126 H128 Q150 126 150 150 V168 H90 Z" />,
    <rect key="neck" data-f="" x="104" y="116" width="32" height="12" rx="3" />,
    <path key="d1" data-f="" d="M50 170 Q60 160 72 168 Q66 178 50 170 Z" />,
  ],
};

export function ColorArt({ art, label }: { art: ArtKey; label: string }) {
  const [fills, setFills] = useState<Record<number, number>>({});
  const shapes = ART[art]();
  let k = 0;
  return (
    <figure className="hist-art">
      <svg viewBox="0 0 240 184" role="img" aria-label={label}>
        <g {...S} fill="#fff">
          {shapes.map((sh) => {
            if (sh.props['data-f'] === undefined) return sh;
            const i = k++;
            const c = fills[i];
            return <g key={`f${i}`} style={{ fill: c === undefined ? '#fff' : PALETTE[c], cursor: 'pointer' }}
              onClick={() => setFills((f) => ({ ...f, [i]: f[i] === undefined ? Math.floor(Math.random() * 6) : (f[i] + 1) % PALETTE.length }))}>{sh}</g>;
          })}
        </g>
      </svg>
      <figcaption>🎨 Раскрась: нажимай на картинку{Object.keys(fills).length > 0 && <button type="button" className="hist-reset" onClick={() => setFills({})}>↺ стереть</button>}</figcaption>
    </figure>
  );
}
