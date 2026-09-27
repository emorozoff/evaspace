/* Генеративная графика: гильош, псевдо-код, машиночитаемая зона карты.
   Ни одной внешней картинки — всё рисуется вектором из строки-семени. */

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
export function guillochePath({ R = 100, r = 23, d = 62, turns = 23, steps = 900 } = {}) {
  const k = (R - r) / r;
  let out = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
    out += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return out;
}

/** Псевдо-QR: детерминированная матрица с угловыми маркерами. */
export function qrMatrix(value, n = 25) {
  const rnd = seeded('qr' + value);
  const grid = Array.from({ length: n }, () => Array.from({ length: n }, () => (rnd() > 0.52 ? 1 : 0)));
  const marker = (ox, oy) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const gy = oy + y, gx = ox + x;
        if (gy < 0 || gx < 0 || gy >= n || gx >= n) continue;
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        const inside = x >= 0 && y >= 0 && x <= 6 && y <= 6;
        grid[gy][gx] = inside && (edge || core) ? 1 : 0;
      }
    }
  };
  marker(0, 0);
  marker(n - 7, 0);
  marker(0, n - 7);
  return grid;
}

/** Машиночитаемая зона, как в ICAO-документах. */
export function mrz(name, number, country = 'UHC', expiry = '311227') {
  const clean = (s, len) =>
    (s || '')
      .replace(/[^A-Z0-9<]/g, '<')
      .slice(0, len)
      .padEnd(len, '<');
  const line1 = clean(`R<${country}${(name || '').replace(/\s+/g, '<<')}`, 44);
  const line2 = clean(`${number}${country}${expiry}<<<<<<<<<<<<<<<<<`, 44);
  return [line1, line2];
}

/** Стабильный номер резидента. */
export function memberNumber(seed, since = 2026) {
  const rnd = seeded('uhome-' + seed);
  return `UH-${String(since).slice(2)}-${Math.floor(rnd() * 9000) + 1000}`;
}
