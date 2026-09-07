/* Карта мира точками. Маска суши получена офлайн из Natural Earth (land-50m,
   пакет world-atlas) и вшита в код, чтобы приложение не ходило в сеть. */

export const WORLD = {
  cols: 180,
  rows: 69,
  lon0: -180,
  lon1: 180,
  lat0: 80,
  lat1: -58,
  step: 2,
};

const MASK_B64 =
  'AAAAAEB4D////wAADwAAAAA8AAAAAAAAAAAMQDz8//8fAEAAAAAAAA4AAAAAAAAAABX0A+D//wAAAADAAMD/A4ATAAAAAAAX' +
  '8f4A/P8FAAAAAALg//8zAAAAARgAgD/sfwD/XwAAAAAguPf///e/AQjw//XntlMP8P8BAID/QHjj////////B/7/////wYP/' +
  'AQAA/n/9v////////8/4/////4sf8AF4APB5/f//////////AP////8fwAIeAADA5////////////w/4+///f4AHwAEAAHz+' +
  '/////////08PAB7g//8HeAIAAABhx/////////8BBACAAPT//wF/AAAAGDD+////////B3AAAACA/v//+R8AAMBB4P//////' +
  '/38ABwAAAOD//7//AwAANv7/////////LxAAAAAA/P///z8AAAD///////////8CAAAAAAD+//8/BgAA4P//////////DwAA' +
  'AAAA8P///4MAAAD+/9/3/////38CAAAAAAD///9vAAAA4O+fPv//////AwAAAAAA8P//fwAAAOCP+cDz/////x8DAAAAAAD/' +
  '//8BAAAAPGTvf/7///9/AAAAAAAA8P//DwAAAOADpP/j////HwIBAAAAAAD+//8AAAAAGCz6f/7///9nDAAAAAAAwP//DwAA' +
  'AIB/QPT/////P/IAAAAAAAD4/z8AAAAA/A8A//////+DAQAAAAAAAP//AQAAAOD/9/7/////fwAAAAAAAADAPyAAAAAA/v+/' +
  'v/////8HAAAAAAAAAPoBAgAAAPj///fn////PwAAAAAAAABAHwAAAACA//9//oD///8BAAAAAAAAAOABAwAAAPz//+//8P//' +
  'TwAAAAAAAAAAHoYAAADA/////Qf+8Q8AAAAAAAAAAMAzwAAAAPz//59/gA9+AQAAAAAAAAAA8AMAAADA////+wF4oA8EAAAA' +
  'AAAAAADwAAAAAP7//78HgAP4QAAAAAAAAAAAAAwAAADA////FwA4gB8EAAAAAAAAAACA4AAAAPz///8MAAPIAAEAAAAAAAAA' +
  'AFD/AACA////fwAQgAQAAAAAAAAAAAAA+B8AAPD///8HAAQAAAEAAAAAAAAAAID/DwAABv7/PwAAQIMBAAAAAAAAAAAA+P8B' +
  'AACA//8BAAAoHAAAAAAAAAAAAMD/HwAAAPj/DwAAgPMFAAAAAAAAAAAA/P8HAADA/38AAAAwHhgAAAAAAAAAAMD//wMAAPj/' +
  'AwAAAOZCHQAAAAAAAAAA/v//AAAA/z8AAABAAIAHAAAAAAAAAMD//x8AAPD/AwAAAHgA+BAAAAAAAAAA+P//AAAA/z8AAAAA' +
  'EAELBAAAAAAAAID//wcAAOD/AwAAAAAAAAAAAAAAAAAA8P9/AAAA/z8EAAAAADgCAAAAAAAAAAD//wMAAPD/QwAAAADgYwAC' +
  'AAAAAAAAwP8/AAAA/x8HAAAAgP8HAAAAAAAAAAD4/wMAAPD/cAAAAAD4fwAAAAAAAAAAgP8/AAAA/g8DAAAA8P8fEAAAAAAA' +
  'AAD4/wAAAOD/MAAAAID//wEAAAAAAAAAgP8DAAAA/gcDAAAA+P8/AAAAAAAAAAD4PwAAAMA/AAAAAID//wcAAAAAAAAAwP8B' +
  'AAAA/AMAAAAA+P9/AAAAAAAAAAD8DwAAAIAfAAAAAAD//wcAAAAAAAAAwP8AAAAA+AAAAAAA8OA/AAAAAAAAAAD8AQAAAAAA' +
  'AAAAAAAB/AEAAAAAAAAA4D8AAAAAAAAAAAAAAAAfAAIAAAAAAAB+AAAAAAAAAAAAAAAAAABgAAAAAAAA4AUAAAAAAAAAAAAA' +
  'AAAMAAMAAAAAAAA8AAAAAAAAAAAAAAAAgAAYAAAAAAAA4AEAAAAAAAAAAAAAAAAAwAAAAAAAAAAeAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAA8AAAAAAAAAAAEAAAAAAAAAAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

let bits = null;
function landBits() {
  if (bits) return bits;
  const raw = atob(MASK_B64);
  bits = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bits[i] = raw.charCodeAt(i);
  return bits;
}

export function isLand(col, row) {
  const i = row * WORLD.cols + col;
  return (landBits()[i >> 3] >> (i & 7)) & 1;
}

/** Все точки суши в координатах 0..1 (равнопромежуточная проекция). */
export function landDots() {
  const out = [];
  for (let r = 0; r < WORLD.rows; r++) {
    for (let c = 0; c < WORLD.cols; c++) {
      if (isLand(c, r)) out.push([(c + 0.5) / WORLD.cols, (r + 0.5) / WORLD.rows]);
    }
  }
  return out;
}

/** Географические координаты → доли ширины и высоты карты. */
export function project(lat, lon) {
  return {
    x: (lon - WORLD.lon0) / (WORLD.lon1 - WORLD.lon0),
    y: (WORLD.lat0 - lat) / (WORLD.lat0 - WORLD.lat1),
  };
}

/** Расстояние по большому кругу, км — для «кто рядом» и перелётов. */
export function distanceKm(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}
