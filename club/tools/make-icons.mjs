/* Иконки приложения рисуются кодом — без внешних картинок и лишних зависимостей.
   Запуск: node club/tools/make-icons.mjs */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/* --- минимальный кодировщик PNG (RGBA, без фильтров) --- */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // 8 бит на канал
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --- сам рисунок: тёмный квадрат и лаймовая искра --- */
const BG = [11, 14, 19];
const INK = [200, 247, 81];
const DIM = [124, 108, 255];

// четырёхлучевая звезда: |x|^k + |y|^k <= 1 при k < 1
function star(nx, ny, r, k = 0.42) {
  if (r <= 0) return 0;
  const v = Math.pow(Math.abs(nx) / r, k) + Math.pow(Math.abs(ny) / r, k);
  return 1 - v; // > 0 внутри фигуры
}

function draw(size, { bleed = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const radius = size * 0.235;           // скругление квадрата
  const big = size * (bleed ? 0.30 : 0.36);
  const small = size * (bleed ? 0.115 : 0.14);
  const sx = c + size * (bleed ? 0.20 : 0.245);
  const sy = c - size * (bleed ? 0.205 : 0.25);
  const ss = 1.4; // сглаживание, в пикселях

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let a = 1;

      if (!bleed) {
        // маска скруглённого квадрата
        const dx = Math.max(Math.abs(px - c) - (c - radius), 0);
        const dy = Math.max(Math.abs(py - c) - (c - radius), 0);
        const d = Math.hypot(dx, dy) - radius;
        a = Math.min(Math.max(0.5 - d, 0), 1);
      }

      let r = BG[0], g = BG[1], b = BG[2];

      // мягкое свечение под искрой
      const glow = Math.max(0, 1 - Math.hypot(px - c, py - c) / (size * 0.46));
      r += (INK[0] - r) * glow * glow * 0.10;
      g += (INK[1] - g) * glow * glow * 0.10;
      b += (INK[2] - b) * glow * glow * 0.10;

      // маленькая фиолетовая искра в углу
      const s2 = star(px - sx, py - sy, small);
      if (s2 > -0.4) {
        const cov = Math.min(Math.max(s2 * small * 1.6 / ss + 0.5, 0), 1);
        r += (DIM[0] - r) * cov;
        g += (DIM[1] - g) * cov;
        b += (DIM[2] - b) * cov;
      }

      // главная искра
      const s1 = star(px - c, py - c, big);
      if (s1 > -0.4) {
        const cov = Math.min(Math.max(s1 * big * 1.6 / ss + 0.5, 0), 1);
        r += (INK[0] - r) * cov;
        g += (INK[1] - g) * cov;
        b += (INK[2] - b) * cov;
      }

      const i = (y * size + x) * 4;
      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return png(size, size, buf);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['favicon-64.png', draw(64)],
  ['icon-192.png', draw(192)],
  ['icon-512.png', draw(512)],
  ['maskable-512.png', draw(512, { bleed: true })],
  ['apple-touch-icon.png', draw(180, { bleed: true })],
];
for (const [name, data] of files) {
  writeFileSync(join(OUT, name), data);
  console.log(name, data.length + ' Б');
}
