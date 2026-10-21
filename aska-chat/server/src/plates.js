// Номера АСЬКИ — как автомобильные: А 001 МР 777 (777 — Москва).
// Первый номер серии — у администратора, остальным выдаём случайный свободный,
// чтобы по номеру нельзя было понять, кто пришёл раньше (и кто здесь ИИ).
import crypto from 'node:crypto';

// В номерах бывают только буквы, похожие на латинские
const LETTERS = 'АВЕКМНОРСТУХ';
const LATIN = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х' };
export const REGION = '777';
// Серии по порядку: когда кончаются номера в одной, берём следующую
const SERIES = [['А', 'МР'], ['В', 'МР'], ['Е', 'МР'], ['К', 'МР'], ['М', 'МР'], ['Н', 'МР'], ['О', 'МР'], ['Р', 'МР']];

export const plateOf = (num, series = SERIES[0]) => `${series[0]}${String(num).padStart(3, '0')}${series[1]}${REGION}`;
export const ADMIN_PLATE = plateOf(1);
export const ASKA_PLATE = plateOf(0);

// «А001МР777» → «А 001 МР 777»
export function formatPlate(p) {
  const m = /^([А-Я])(\d{3})([А-Я]{2})(\d{2,3})$/.exec(p || '');
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p || '';
}

// Что угодно, что человек может набрать: «001», «а001мр», «A001MP777», «АМР-001-777»
export function normalizePlate(s) {
  let t = String(s || '').toUpperCase().replace(/[A-Z]/g, (c) => LATIN[c] || c).replace(/Ё/g, 'Е').replace(/[^0-9А-Я]/g, '');
  if (!t) return null;
  const L = `[${LETTERS}]`;
  let m = new RegExp(`^(${L})(\\d{1,3})(${L}{2})(\\d{2,3})?$`).exec(t);
  if (m) return `${m[1]}${m[2].padStart(3, '0')}${m[3]}${m[4] || REGION}`;
  m = new RegExp(`^(${L})(${L}{2})(\\d{1,3})(\\d{3})?$`).exec(t); // АМР001777, АМР-001-777
  if (m) return `${m[1]}${m[3].padStart(3, '0')}${m[2]}${m[4] || REGION}`;
  m = /^(\d{1,3})$/.exec(t);
  if (m) return plateOf(Number(m[1]));
  return null;
}

export function looksLikePlate(s) {
  return /[А-ЯA-Zа-яa-z]/.test(s || '') && /\d/.test(s || '') && normalizePlate(s) !== null;
}

export function freePlate(db) {
  const used = new Set(db.prepare('SELECT plate FROM users WHERE plate IS NOT NULL').all().map((r) => r.plate));
  for (const series of SERIES) {
    const free = [];
    for (let n = 2; n <= 999; n++) {
      const p = plateOf(n, series);
      if (!used.has(p)) free.push(p);
    }
    if (free.length) return free[crypto.randomInt(free.length)];
  }
  throw new Error('no plates left');
}
