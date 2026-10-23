// Значок АСЬКИ (с 23.10.2026): ромашка на зелёном — белые лепестки, жёлтая серединка и один коралловый
// лепесток-«сообщение». Не копия цветка ICQ: шесть вытянутых лепестков вместо восьми кружков.
// Цветочки-статусы в списке остаются как в «Аське», у голд — золотые.
// Те же рисунки лежат файлами в client/public/icons/ (значок приложения) и в brand/ (логотип с надписью).

let uid = 0;

function daisy(id: string, petal: string, accent: string, center: string) {
  let out = '';
  for (let i = 0; i < 6; i++) {
    const fill = i === 1 ? `url(#${id}a)` : `url(#${id}p)`;
    out += `<g transform="rotate(${i * 60} 32 32)"><ellipse cx="32" cy="18.6" rx="6.5" ry="10.2" fill="rgba(0,60,40,.16)" transform="translate(.6 1.2)"/>`
      + `<ellipse cx="32" cy="18.6" rx="6.5" ry="10.2" fill="${fill}"/><ellipse cx="30.4" cy="14.6" rx="2.1" ry="4" fill="#fff" opacity=".45"/></g>`;
  }
  return `<defs>
<linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${petal}"/><stop offset="1" stop-color="${petal === '#ffffff' ? '#e3fbec' : petal}"/></linearGradient>
<linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9db0"/><stop offset="1" stop-color="${accent}"/></linearGradient>
<radialGradient id="${id}c" cx=".38" cy=".34" r=".75"><stop offset="0" stop-color="#fff6b8"/><stop offset=".55" stop-color="${center}"/><stop offset="1" stop-color="#f2a100"/></radialGradient>
</defs>${out}<circle cx="32" cy="32" r="8.8" fill="rgba(0,60,40,.18)" transform="translate(.5 1)"/><circle cx="32" cy="32" r="8.8" fill="url(#${id}c)"/><circle cx="29.4" cy="29.2" r="2.3" fill="#fff" opacity=".75"/>`;
}

const sparkle = (x: number, y: number, r: number, fill = '#fff') =>
  `<path d="M${x} ${y - r}C${x + r * 0.18} ${y - r * 0.18} ${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}C${x + r * 0.18} ${y + r * 0.18} ${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}C${x - r * 0.18} ${y + r * 0.18} ${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}C${x - r * 0.18} ${y - r * 0.18} ${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${fill}"/>`;

// Значок: ромашка на зелёном квадрате со скруглением, в круге (аватарка Аськи) или во весь квадрат (значок
// приложения: углы скругляет сам телефон). scale — размер ромашки (для «maskable» поменьше, чтобы не обрезалась)
export function markSvg(size = 28, shape: 'square' | 'circle' | 'full' = 'square', scale = 0.86): string {
  const id = `ak${++uid}`;
  const rx = shape === 'full' ? 0 : 15;
  const bg = shape === 'circle'
    ? `<circle cx="32" cy="32" r="32" fill="url(#${id}b)"/><circle cx="32" cy="32" r="32" fill="url(#${id}h)"/>`
    : `<rect width="64" height="64" rx="${rx}" fill="url(#${id}b)"/><rect width="64" height="64" rx="${rx}" fill="url(#${id}h)"/>`;
  const sp = scale / 0.86;
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ee894"/><stop offset=".55" stop-color="#14b86c"/><stop offset="1" stop-color="#078a5c"/></linearGradient>
<radialGradient id="${id}h" cx=".22" cy=".12" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>${bg}<g transform="translate(32 33) scale(${scale}) translate(-32 -32)">${daisy(id, '#ffffff', '#ff3d6e', '#ffd84a')}</g>`
    + `<g transform="translate(32 32) scale(${sp}) translate(-32 -32)">${sparkle(51.5, 12.5, 4.6)}${sparkle(57, 21, 2, 'rgba(255,255,255,.8)')}</g></svg>`;
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
