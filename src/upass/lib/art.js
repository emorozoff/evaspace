/* Генеративная графика: гильош, печать, псевдо-QR, обложки.
   Ни одной внешней картинки — всё рисуется вектором из строки-семени. */

import { sha256 } from './chain.js';

/** Детерминированный генератор чисел из строки. */
export function seeded(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Эпитрохоида — линия гильоша, как на банкноте или паспорте. */
export function guillochePath({ cx = 0, cy = 0, R = 100, r = 23, d = 62, turns = 23, steps = 900 } = {}) {
  const k = (R - r) / r;
  let out = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    out += (i ? 'L' : 'M') + (cx + x).toFixed(2) + ' ' + (cy + y).toFixed(2);
  }
  return out;
}

/** Волнообразные линии защитной сетки. */
export function wavePath({ w = 340, h = 210, y0 = 40, amp = 9, freq = 3.1, steps = 60 } = {}) {
  let out = '';
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const y = y0 + Math.sin((i / steps) * Math.PI * 2 * freq) * amp;
    out += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return out;
}

/** Псевдо-QR: детерминированная матрица с угловыми маркерами. */
export function qrMatrix(value, n = 25) {
  const hash = sha256(String(value));
  const bits = [];
  for (const ch of hash) bits.push(...parseInt(ch, 16).toString(2).padStart(4, '0').split('').map(Number));
  const grid = Array.from({ length: n }, () => Array(n).fill(0));
  let i = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      grid[y][x] = bits[i % bits.length] ^ ((x * 7 + y * 13 + i) % 3 === 0 ? 1 : 0);
      i++;
    }
  }
  const marker = (ox, oy) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[oy + y][ox + x] = edge || core ? 1 : 0;
      }
    }
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const gy = oy + y, gx = ox + x;
        if (gy < 0 || gx < 0 || gy >= n || gx >= n) continue;
        if (x === -1 || y === -1 || x === 7 || y === 7) grid[gy][gx] = 0;
      }
    }
  };
  marker(0, 0);
  marker(n - 7, 0);
  marker(0, n - 7);
  return grid;
}

/** Машиночитаемая зона паспорта, как в ICAO-документах. */
export function mrz(name, number, country = 'UHM', tier = 'P', expiry = '311227') {
  const clean = (s, len) =>
    (s || '')
      .replace(/[^A-Z0-9<]/g, '<')
      .slice(0, len)
      .padEnd(len, '<');
  const line1 = clean(`${tier}<${country}${(name || '').replace(/\s+/g, '<<')}`, 44);
  const line2 = clean(`${number}${country}${expiry}UHT<<<<<<<<<<<<<<`, 44);
  return [line1, line2];
}

/** Стабильный номер резидента из идентификатора. */
export function residentNumber(id, since = 2026) {
  const h = sha256('upass-' + id);
  const n = parseInt(h.slice(0, 6), 16) % 9000 + 1000;
  return `UP-${String(since).slice(2)}-${n}`;
}

/** Пара цветов обложки из семени, если она не задана явно. */
export function coverFrom(seed) {
  const rnd = seeded(seed);
  const hue = Math.floor(rnd() * 360);
  return [`hsl(${hue} 55% 46%)`, `hsl(${(hue + 28) % 360} 60% 12%)`];
}
