// 📈 Биржа АСЬКИ (тестовые механизмы UPASS): курсы валют и условный курс аськоина.
// 10 аськоинов = 1 доллар (1 🪙 = $0,10) — условная цена, купить или вывести аськоины за деньги пока нельзя.
// Курсы валют — Банк России (cbr-xml-daily.ru, рублей за единицу), раз в 3 часа по запросу; нет связи — последний
// сохранённый курс или примерный запасной (так и подписано). История по дням — для графиков.
import { getSetting, setSetting } from './db.js';

export const ASK_USD = 0.1; // 1 аськоин = $0.10
export const CURRENCIES = {
  USD: { name: 'Доллар США', flag: '🇺🇸', sign: '$' }, EUR: { name: 'Евро', flag: '🇪🇺', sign: '€' }, RUB: { name: 'Рубль', flag: '🇷🇺', sign: '₽' },
  CNY: { name: 'Юань', flag: '🇨🇳', sign: '¥' }, AED: { name: 'Дирхам ОАЭ', flag: '🇦🇪', sign: 'AED' }, THB: { name: 'Бат', flag: '🇹🇭', sign: '฿' },
  IDR: { name: 'Рупия (Бали)', flag: '🇮🇩', sign: 'Rp' }, KZT: { name: 'Тенге', flag: '🇰🇿', sign: '₸' }, BYN: { name: 'Белорусский рубль', flag: '🇧🇾', sign: 'Br' },
  GEL: { name: 'Лари', flag: '🇬🇪', sign: '₾' }, AMD: { name: 'Драм', flag: '🇦🇲', sign: '֏' }, TRY: { name: 'Лира', flag: '🇹🇷', sign: '₺' },
  GBP: { name: 'Фунт', flag: '🇬🇧', sign: '£' }, INR: { name: 'Рупия (Индия)', flag: '🇮🇳', sign: '₹' },
};
// Запасной курс (рублей за единицу) — примерный ориентир, когда нет связи с Банком России
export const FALLBACK = { USD: 82, EUR: 95, CNY: 11.4, AED: 22.3, THB: 2.5, IDR: 0.005, KZT: 0.16, BYN: 25, GEL: 30, AMD: 0.21, TRY: 2, GBP: 108, INR: 0.95 };
const STALE_MS = 3 * 3_600_000;
const URL_TODAY = 'https://www.cbr-xml-daily.ru/daily_json.js';
const urlDay = (d) => `https://www.cbr-xml-daily.ru/archive/${d.replace(/-/g, '/')}/daily_json.js`;

// ответ ЦБ → { date, rates: { USD: рублей за 1 доллар, … } }
export function parseCbr(json) {
  const v = json?.Valute;
  if (!v || typeof v !== 'object') return null;
  const rates = {};
  for (const code of Object.keys(CURRENCIES)) {
    if (code === 'RUB') continue;
    const x = v[code];
    if (x && Number(x.Nominal) > 0 && Number(x.Value) > 0) rates[code] = Number(x.Value) / Number(x.Nominal);
  }
  if (!rates.USD) return null;
  const date = String(json.Date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  return { date, rates };
}

export function createFx({ db, fetchImpl = globalThis.fetch, log = () => {} }) {
  let refreshing = null;
  const saveDay = (date, rates, source) => db.prepare('INSERT OR REPLACE INTO fx_rates (date, data, source, at) VALUES (?, ?, ?, ?)').run(date, JSON.stringify(rates), source, Date.now());
  const lastRow = () => db.prepare('SELECT * FROM fx_rates ORDER BY date DESC LIMIT 1').get();

  async function getJson(url) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetchImpl(url, { signal: ctl.signal });
      if (!r.ok) throw new Error(`http ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const today = parseCbr(await getJson(URL_TODAY));
        if (!today) throw new Error('bad cbr');
        saveDay(today.date, today.rates, 'cbr');
        setSetting(db, 'fx_checked', String(Date.now()));
        // история для графиков: досчитываем до 14 последних дней, если их нет
        const have = db.prepare("SELECT COUNT(*) AS n FROM fx_rates WHERE source = 'cbr'").get().n;
        if (have < 7) {
          for (let i = 1; i <= 14; i++) {
            const d = new Date(Date.parse(today.date) - i * 86_400_000).toISOString().slice(0, 10);
            if (db.prepare('SELECT 1 FROM fx_rates WHERE date = ?').get(d)) continue;
            try { const day = parseCbr(await getJson(urlDay(d))); if (day) saveDay(day.date, day.rates, 'cbr'); } catch { /* выходной или нет связи */ }
          }
        }
      } catch (e) {
        setSetting(db, 'fx_checked', String(Date.now()));
        log('fx', e?.message || e);
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  // Курсы сейчас: отдаём сохранённое, а если устарело — освежаем в фоне (в первый раз — ждём)
  async function rates({ wait = false } = {}) {
    const checked = Number(getSetting(db, 'fx_checked') || 0);
    if (Date.now() - checked > STALE_MS) {
      const p = refresh();
      if (wait || !lastRow()) await Promise.race([p, new Promise((r) => setTimeout(r, 7000))]);
    }
    const last = lastRow();
    const usedFallback = !last;
    const current = last ? JSON.parse(last.data) : FALLBACK;
    const history = db.prepare('SELECT date, data FROM fx_rates ORDER BY date DESC LIMIT 30').all().reverse().map((r) => ({ date: r.date, rates: JSON.parse(r.data) }));
    const prev = history.length > 1 ? history[history.length - 2].rates : null;
    return {
      date: last?.date || null, source: usedFallback ? 'fallback' : last.source, rates: { RUB: 1, ...FALLBACK, ...current }, prev,
      approx: usedFallback ? Object.keys(FALLBACK) : Object.keys(FALLBACK).filter((c) => !(c in current)), // каких валют нет у ЦБ — примерный курс
      ask: { usd: ASK_USD, rub: ASK_USD * (current.USD || FALLBACK.USD) }, currencies: CURRENCIES, history,
    };
  }

  return { rates, refresh };
}
