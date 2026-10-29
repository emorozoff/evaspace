// Значок АСЬКИ (с 29.10.2026): цветок «Аськи» — восемь лепестков, один красный, — но современный и «блокчейновый»:
// глянцевые лепестки, в серединке — кубик-блок, вокруг — орбита-цепочка с узлами-блоками, фон — ночь с сотами.
// Цветочки-статусы в списке остаются как в «Аське», у голд — золотые.
// Те же рисунки лежат файлами в client/public/icons/ (значок приложения) и в brand/ (логотип с надписью).

let uid = 0;

// Изометрический кубик-«блок»: верх светлый, бока темнее
function cube(cx: number, cy: number, s: number, top: string, left: string, right: string, stroke = 'none', sw = 0) {
  const k = s * 0.866;
  const T = `${cx},${cy - s}`, UR = `${cx + k},${cy - s / 2}`, LR = `${cx + k},${cy + s / 2}`, B = `${cx},${cy + s}`, LL = `${cx - k},${cy + s / 2}`, UL = `${cx - k},${cy - s / 2}`, C = `${cx},${cy}`;
  const st = stroke === 'none' ? '' : ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`;
  return `<polygon points="${T} ${UR} ${C} ${UL}" fill="${top}"${st}/><polygon points="${UL} ${C} ${B} ${LL}" fill="${left}"${st}/><polygon points="${C} ${UR} ${LR} ${B}" fill="${right}"${st}/>`;
}

const hex = (cx: number, cy: number, r: number) => {
  const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i + Math.PI / 6; return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`; });
  return `<polygon points="${pts.join(' ')}"/>`;
};

function flower(id: string) {
  let shade = '';
  let petals = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const x = (32 + 12.6 * Math.cos(a)).toFixed(2), y = (32 + 12.6 * Math.sin(a)).toFixed(2);
    shade += `<circle cx="${x}" cy="${y}" r="6.7" fill="rgba(0,0,0,.35)" transform="translate(.4 .9)"/>`;
    petals += `<circle cx="${x}" cy="${y}" r="6.6" fill="url(#${id}${i === 3 ? 'r' : 'g'})" stroke="rgba(0,40,20,.45)" stroke-width=".55"/>`
      + `<ellipse cx="${(+x - 1.9).toFixed(2)}" cy="${(+y - 2.2).toFixed(2)}" rx="2.3" ry="1.5" fill="#fff" opacity=".45" transform="rotate(-35 ${(+x - 1.9).toFixed(2)} ${(+y - 2.2).toFixed(2)})"/>`;
  }
  return `${shade}${petals}<circle cx="32" cy="32" r="8" fill="rgba(0,0,0,.3)" transform="translate(.3 .7)"/><circle cx="32" cy="32" r="7.8" fill="url(#${id}w)" stroke="rgba(0,40,20,.35)" stroke-width=".5"/>`
    + cube(32, 32.3, 4.4, '#9ff7c0', '#2cc46a', '#168c49');
}

// Значок: на тёмном квадрате со скруглением, в круге (аватарка Аськи) или во весь квадрат (значок приложения —
// углы скругляет сам телефон). scale — размер цветка (для «maskable» поменьше, чтобы не обрезался)
export function markSvg(size = 28, shape: 'square' | 'circle' | 'full' = 'square', scale = 1): string {
  const id = `ak${++uid}`;
  const rx = shape === 'full' ? 0 : 15;
  const clip = shape === 'circle' ? '<circle cx="32" cy="32" r="32"/>' : `<rect width="64" height="64" rx="${rx}"/>`;
  const grid = [[8, 8], [16.7, 13], [8, 18], [56, 46], [47.3, 51], [56, 56], [47.3, 41], [56, 8]].map(([x, y]) => hex(x, y, 5)).join('');
  // орбита-цепочка и четыре узла-блока по диагоналям, от узлов к цветку — тонкие связи
  const nodes = [45, 135, 225, 315].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return [32 + 24.5 * Math.cos(a), 32 + 24.5 * Math.sin(a)];
  });
  const links = nodes.map(([x, y]) => `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="32" y2="32" stroke="#5ef0a0" stroke-opacity=".45" stroke-width=".8"/>`).join('');
  const cubes = nodes.map(([x, y]) => cube(+x.toFixed(2), +y.toFixed(2), 3, '#b8ffd6', '#3bd47e', '#1a9a55')).join('');
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14254d"/><stop offset=".6" stop-color="#0c1b38"/><stop offset="1" stop-color="#06303a"/></linearGradient>
<radialGradient id="${id}glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2ee07a" stop-opacity=".55"/><stop offset=".6" stop-color="#2ee07a" stop-opacity=".12"/><stop offset="1" stop-color="#2ee07a" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}g" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#c8ffbf"/><stop offset=".45" stop-color="#46d660"/><stop offset="1" stop-color="#118a35"/></radialGradient>
<radialGradient id="${id}r" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffc0b5"/><stop offset=".45" stop-color="#f0403a"/><stop offset="1" stop-color="#a3121a"/></radialGradient>
<radialGradient id="${id}w" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfeee6"/></radialGradient>
<clipPath id="${id}c">${clip}</clipPath>
</defs><g clip-path="url(#${id}c)"><rect width="64" height="64" fill="url(#${id}b)"/>
<g fill="none" stroke="#7dffc0" stroke-opacity=".1" stroke-width=".7">${grid}</g>
<circle cx="32" cy="32" r="30" fill="url(#${id}glow)"/></g>
<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
<circle cx="32" cy="32" r="24.5" fill="none" stroke="#5ef0a0" stroke-opacity=".5" stroke-width=".9" stroke-dasharray="2.4 1.8"/>${links}${cubes}${flower(id)}</g></svg>`;
}

// Цветочек-статус голд: как в «Аське», только золотой
export function goldFlowerSvg(size = 16, online = true): string {
  const id = `gf${++uid}`;
  let petals = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    petals += `<circle cx="${(8 + 5 * Math.cos(a)).toFixed(2)}" cy="${(8 + 5 * Math.sin(a)).toFixed(2)}" r="2.7" fill="url(#${id})" stroke="#6e4c00" stroke-width=".55"/>`;
  }
  return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"${online ? '' : ' opacity=".5"'}><defs>
<radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff7c2"/><stop offset=".45" stop-color="#f6c83a"/><stop offset="1" stop-color="#b8860b"/></radialGradient>
</defs>${petals}<circle cx="8" cy="8" r="2.5" fill="#fff" stroke="#6e4c00" stroke-width=".55"/></svg>`;
}
