/* Ядро: DOM, форматирование чисел и дат. Все модули собираются в одну
   область видимости (см. build.py), поэтому функции отсюда видны везде. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const byKey = (arr, k) => Object.fromEntries(arr.map(x => [x[k], x]));

/* Слияние как у db.update(): вложенные объекты сливаются, остальное заменяется */
function deepMerge(base, patch) {
  const out = isObj(base) ? {...base} : {};
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : clone(v);
  }
  return out;
}

/* Делегирование событий: on(root, 'click', '[data-x]', (e, el) => …) */
function on(root, type, sel, fn) {
  root.addEventListener(type, e => {
    const el = e.target.closest(sel);
    if (el && root.contains(el)) fn(e, el);
  });
}

/* ── числа ── */
const NB = ' ';
function fmt(n, d = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const v = Number(n);
  return v.toLocaleString('ru-RU', {minimumFractionDigits: d, maximumFractionDigits: d}).replace(/\s/g, NB);
}
const rub = n => (n === null || n === undefined ? '—' : fmt(Math.round(n)) + NB + '₽');
/* компактно: 1,45 млн ₽ · 290 тыс ₽ · 900 ₽ */
function rubK(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return s + fmt(a / 1e6, a >= 1e7 ? 1 : 2).replace(/,?0+$/, '') + NB + 'млн' + NB + '₽';
  if (a >= 1e4) return s + fmt(Math.round(a / 1e3)) + NB + 'тыс' + NB + '₽';
  return s + fmt(Math.round(a)) + NB + '₽';
}
const signed = (n, f = rubK) => (n > 0 ? '+' : n < 0 ? '' : '') + f(n);
const pct = (x, d = 0) => (x === null || x === undefined || !Number.isFinite(x) ? '—' : fmt(x * 100, d) + '%');
const parseNum = s => {
  const v = parseFloat(String(s ?? '').replace(/\s| /g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* ── даты: всё в местном времени, формат 'YYYY-MM-DD' и месяц 'YYYY-MM' ── */
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
/* «сегодня» можно подменить для проверок: window.__EVA_TODAY = '2026-10-15' */
const today = () => (typeof window !== 'undefined' && window.__EVA_TODAY) || isoOf(new Date());
const addDays = (s, n) => { const d = dateOf(s); d.setDate(d.getDate() + n); return isoOf(d); };
const monthOf = s => String(s).slice(0, 7);
const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5);
const daysInMonth = m => { const [y, mm] = m.split('-').map(Number); return new Date(y, mm, 0).getDate(); };
const monthStart = m => m + '-01';
const monthEnd = m => m + '-' + pad(daysInMonth(m));
function addMonths(m, n) {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function monthRange(from, to) {
  const out = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}
/* понедельник недели */
const weekStart = s => { const d = dateOf(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return isoOf(d); };
const weekday = s => (dateOf(s).getDay() + 6) % 7; // 0 = пн

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SH = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD_SH = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const monthIdx = m => Number(m.slice(5, 7)) - 1;
/* 'Октябрь' · с годом, если он не текущий квартальный: 'Январь 2027' */
function monthName(m, withYear = false) {
  const name = cap(MONTHS[monthIdx(m)]);
  return withYear || m.slice(0, 4) !== today().slice(0, 4) ? `${name} ${m.slice(0, 4)}` : name;
}
const monthShort = m => cap(MONTHS_SH[monthIdx(m)]) + (m.slice(0, 4) !== today().slice(0, 4) ? ' ' + m.slice(2, 4) : '');
/* '5 окт' · '5 октября' */
const dayShort = s => { const d = dateOf(s); return `${d.getDate()}${NB}${MONTHS_SH[d.getMonth()]}`; };
const dayLong = s => { const d = dateOf(s); return `${d.getDate()}${NB}${MONTHS_GEN[d.getMonth()]}`; };
const dayWd = s => `${WD_SH[weekday(s)]}, ${dayShort(s)}`;
/* подпись недели: '5–11 окт' или '28 сен – 4 окт' */
function weekLabel(start) {
  const end = addDays(start, 6), a = dateOf(start), b = dateOf(end);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()}${NB}${MONTHS_SH[b.getMonth()]}`
    : `${dayShort(start)} – ${dayShort(end)}`;
}
function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) { const m = Math.round(s / 60); return `${m}${NB}мин назад`; }
  if (s < 86400) { const h = Math.round(s / 3600); return `${h}${NB}ч назад`; }
  const d = new Date(ts);
  return `${d.getDate()}${NB}${MONTHS_SH[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ── хранилище браузера: только удобства одного зрителя ── */
const Local = {
  get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватное окно */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ничего */ } },
};
/* состояние вида (вкладка, фильтр) — помнится в этом браузере */
const View = {
  _s: null,
  get(k, def) { if (!this._s) this._s = Local.get('eva-crm2-view', {}); return k in this._s ? this._s[k] : def; },
  set(k, v) { if (!this._s) this._s = Local.get('eva-crm2-view', {}); this._s[k] = v; Local.set('eva-crm2-view', this._s); },
};
/* ── CRM: время событий хранится меткой времени (мс) ── */
const hm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const isoTs = ts => isoOf(new Date(ts));
/* '25 сен, 14:05' · 'сегодня, 14:05' · 'вчера, 09:10' */
function when(ts) {
  if (!ts) return '—';
  const d = isoTs(ts), t = today();
  if (d === t) return `сегодня, ${hm(ts)}`;
  if (d === addDays(t, -1)) return `вчера, ${hm(ts)}`;
  if (d === addDays(t, 1)) return `завтра, ${hm(ts)}`;
  return `${dayShort(d)}${d.slice(0, 4) !== t.slice(0, 4) ? ' ' + d.slice(0, 4) : ''}, ${hm(ts)}`;
}
const dayOrWhen = s => (!s ? '—' : s === today() ? 'сегодня' : s === addDays(today(), 1) ? 'завтра' : s === addDays(today(), -1) ? 'вчера' : dayShort(s));
/* 3:07 · 1:02:15 */
function dur(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function durLong(sec) {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return `${m}${NB}мин`;
  return `${Math.floor(m / 60)}${NB}ч ${m % 60 ? (m % 60) + NB + 'мин' : ''}`.trim();
}
const ageOf = birth => { if (!birth) return null; const b = dateOf(birth), n = dateOf(today()); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a; };

/* ── телефоны: храним цифрами 79991234567, показываем +7 999 123-45-67 ── */
const phoneDigits = s => { let d = String(s || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); if (d.length === 10) d = '7' + d; return d; };
function phoneFmt(s) {
  const d = phoneDigits(s);
  if (d.length === 11 && d[0] === '7') return `+7${NB}${d.slice(1, 4)}${NB}${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  return d ? '+' + d : '';
}
const tgUser = s => String(s || '').trim().replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '');

/* ── детерминированный генератор для демо-данных ── */
function rng(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    some: (arr, n) => { const c = arr.slice(), out = []; while (c.length && out.length < n) out.push(c.splice(Math.floor(next() * c.length), 1)[0]); return out; },
    /* выбор с весами: [[значение, вес], …] */
    weighted: pairs => { const tot = sum(pairs, p => p[1]); let x = next() * tot; for (const [v, w] of pairs) { if ((x -= w) <= 0) return v; } return pairs[pairs.length - 1][0]; },
  };
  return r;
}

/* ── CSV: запятая или точка с запятой, кавычки по правилам RFC 4180 ── */
function csvParse(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const first = src.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}
const csvCell = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvOf = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');

/* копирование: только из обработчика клика; если нельзя — выделяем текст */
async function copyText(text, fallbackEl) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    if (fallbackEl) { fallbackEl.hidden = false; fallbackEl.value = text; fallbackEl.focus(); fallbackEl.select(); }
    return false;
  }
}

/* устойчивый хеш строки — для цветов аватаров и промокодов */
function hashStr(s) { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
/* промокод-приглашение из имени: «Алёна» → ALENA417 */
function refCodeFor(name) {
  const tr = {а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya'};
  const first = String(name).trim().split(/\s+/)[0].toLowerCase();
  const lat = [...first].map(ch => tr[ch] ?? (/[a-z0-9]/.test(ch) ? ch : '')).join('').slice(0, 10);
  return (lat || 'eva').toUpperCase() + (100 + (hashStr(name) % 900));
}
