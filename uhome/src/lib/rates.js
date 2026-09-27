import { useEffect, useState } from 'react';
import { CURRENCIES, FALLBACK, pairById } from '../data/currencies.js';

/* Курсы валют. Это единственное место, где приложение ходит в сеть, и то
   по желанию: без связи главная показывает последний полученный курс,
   а если его ещё не было — ориентир из данных с пометкой «примерно».
   Раз в десять минут курс обновляется сам. */

const KEY = 'uhome.rates.v1';
const EVERY = 10 * 60 * 1000;
const CODES = Object.keys(CURRENCIES);

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw && raw.perUsd ? raw : null;
  } catch {
    return null;
  }
}

function writeCache(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* место в хранилище кончилось — курс просто не переживёт перезапуск */
  }
}

const ok = (n) => Number.isFinite(n) && n > 0;

/* Один запрос отдаёт и фиат, и крипту за доллар. */
async function fromCoinbase() {
  const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', { cache: 'no-store' });
  if (!res.ok) throw new Error('coinbase ' + res.status);
  const rates = (await res.json())?.data?.rates || {};
  const out = {};
  for (const c of CODES) if (ok(Number(rates[c]))) out[c] = Number(rates[c]);
  out.USD = 1;
  return out;
}

/* Запасной путь: фиат и биткоин из двух открытых источников. */
async function fromBackup() {
  const out = { USD: 1 };
  const [fiat, crypto] = await Promise.allSettled([
    fetch('https://open.er-api.com/v6/latest/USD').then((r) => r.json()),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd').then((r) => r.json()),
  ]);
  if (fiat.status === 'fulfilled') {
    for (const c of CODES) if (ok(Number(fiat.value?.rates?.[c]))) out[c] = Number(fiat.value.rates[c]);
  }
  if (crypto.status === 'fulfilled') {
    const v = crypto.value || {};
    if (ok(v.bitcoin?.usd)) out.BTC = 1 / v.bitcoin.usd;
    if (ok(v.ethereum?.usd)) out.ETH = 1 / v.ethereum.usd;
    if (ok(v.tether?.usd)) out.USDT = 1 / v.tether.usd;
  }
  if (Object.keys(out).length < 4) throw new Error('backup empty');
  return out;
}

async function load() {
  try {
    return await fromCoinbase();
  } catch {
    return fromBackup();
  }
}

export function useRates() {
  const [state, setState] = useState(() => {
    const c = readCache();
    return c ? { ...c, live: false } : { perUsd: FALLBACK, prev: null, at: 0, live: false };
  });

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      try {
        const fresh = await load();
        if (!alive) return;
        setState((s) => {
          const perUsd = { ...FALLBACK, ...(s.at ? s.perUsd : {}), ...fresh };
          const next = { perUsd, prev: s.at ? s.perUsd : null, at: Date.now() };
          writeCache(next);
          return { ...next, live: true };
        });
      } catch {
        /* нет связи — остаётся прошлый курс */
      }
    };
    const cached = readCache();
    if (!cached || Date.now() - cached.at > 60 * 1000) run();
    const t = setInterval(run, EVERY);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return state;
}

/** Значение пары и направление изменения с прошлого обновления. */
export function pairValue(id, { perUsd, prev }) {
  const p = pairById(id);
  if (!p) return null;
  const v = perUsd[p.to] / perUsd[p.from];
  const was = prev && prev[p.to] && prev[p.from] ? prev[p.to] / prev[p.from] : null;
  const trend = was && Math.abs(v - was) / was > 0.0005 ? (v > was ? 1 : -1) : 0;
  return { ...p, value: v, trend };
}

/** Число и знак валюты отдельно — в живом блоке знак мельче числа. */
export function moneyParts(v, code) {
  const c = CURRENCIES[code] || { sym: code };
  const d = v >= 1000 ? 0 : v >= 1 ? 2 : 4;
  const num = v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  return { num, sym: c.sym, pre: !!c.pre };
}

/** «81,20 ₽», «$109 540», «16 350 Rp». Знаков после запятой — по величине. */
export function money(v, code) {
  const { num, sym, pre } = moneyParts(v, code);
  return pre ? `${sym}${num}` : `${num} ${sym}`;
}

/** Подпись свежести: «обновлено в 10:42» или «примерно, нет связи». */
export function freshness({ at, live }) {
  if (!at) return 'примерный курс — нет связи';
  const d = new Date(at);
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const today = new Date().toDateString() === d.toDateString();
  return `${live ? 'обновлено' : 'последний курс'} ${today ? `в ${t}` : d.toLocaleDateString('ru-RU')}`;
}
