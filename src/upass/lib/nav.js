/* Расчёт чистой стоимости активов и всей экономики токена.
   Ни одна цена здесь не задана вручную — всё считается из состава активов. */

import { ASSETS, TREASURY, NAV_HISTORY, DISTRIBUTIONS } from '../data/capital.js';

export function portfolio(extraCash = 0, extraSupply = 0) {
  const assetsValue = ASSETS.reduce((s, a) => s + a.value, 0);
  const cost = ASSETS.reduce((s, a) => s + a.cost, 0);
  const rentYear = ASSETS.reduce((s, a) => s + a.rentYear, 0);
  const opexYear = ASSETS.reduce((s, a) => s + a.opexYear, 0);
  const cash = TREASURY.cash + extraCash;
  const nav = assetsValue + cash - TREASURY.liabilities;
  const supply = TREASURY.supply + extraSupply;
  return {
    assetsValue,
    cost,
    cash,
    liabilities: TREASURY.liabilities,
    nav,
    supply,
    price: nav / supply,
    rentYear,
    opexYear,
    netYear: rentYear - opexYear,
    netMonth: (rentYear - opexYear) / 12,
    buybackYear: rentYear * TREASURY.buybackShare,
    yieldOnValue: (rentYear - opexYear) / assetsValue,
    growth: (assetsValue - cost) / cost,
  };
}

/** Сколько токенов даёт взнос по правилу «цена выпуска = NAV на токен». */
export function issueAt(amount, price) {
  return amount / price;
}

/** История цены токена: цена = NAV ÷ количество токенов на дату. */
export function priceHistory() {
  return NAV_HISTORY.map((p) => ({ ...p, price: p.nav / p.supply }));
}

/**
 * Сравнение двух моделей выпуска на одинаковом потоке взносов и одинаковом
 * росте активов. honest — цена выпуска всегда равна текущему NAV на токен.
 * fixed — «за $1000 сначала 1000 токенов, потом 900, потом 800».
 * Во второй модели участник платит больше, чем стоит обеспечение его токена;
 * разница и есть та доходность ранних, которую оплачивают поздние.
 */
export function pyramidCompare({ rounds = 8, ticket = 1000, startNav = 10000, startSupply = 10000, growth = 0.02 } = {}) {
  const honest = [];
  const fixed = [];
  let hNav = startNav, hSup = startSupply;
  let fNav = startNav, fSup = startSupply;
  let step = 1000;

  for (let i = 0; i < rounds; i++) {
    hNav *= 1 + growth;
    fNav *= 1 + growth;

    const hPrice = hNav / hSup;
    honest.push({ round: i + 1, price: hPrice, backing: hPrice, tokens: ticket / hPrice, gap: 0 });
    hNav += ticket;
    hSup += ticket / hPrice;

    const fBacking = fNav / fSup;
    const fPrice = ticket / step;
    fixed.push({ round: i + 1, price: fPrice, backing: fBacking, tokens: step, gap: fPrice / fBacking - 1 });
    fNav += ticket;
    fSup += step;
    step = Math.max(400, step - 100);
  }
  return { honest, fixed };
}

/** Очередь на выход: локап, квартальный лимит, фонд обратного выкупа. */
export function redemption(myTokens, price, joinedMonthsAgo) {
  const capTokens = TREASURY.supply * TREASURY.quarterCapShare;
  const usedTokens = TREASURY.supply * TREASURY.quarterRedeemed;
  const leftTokens = Math.max(0, capTokens - usedTokens);
  const fundTokens = TREASURY.buybackFund / price;
  const available = Math.min(leftTokens, fundTokens);
  const lockLeft = Math.max(0, TREASURY.lockupMonths - joinedMonthsAgo);
  return {
    capTokens,
    usedTokens,
    leftTokens,
    fundTokens,
    available,
    lockLeft,
    canRedeem: lockLeft === 0,
    myValue: myTokens * price,
    queueTokens: TREASURY.queueTokens,
    queueMonths: Math.max(1, Math.ceil((TREASURY.queueTokens / Math.max(1, available)) * 3)),
  };
}

export function distributionFor(tokens) {
  return DISTRIBUTIONS.map((d) => ({ ...d, mine: d.perToken * tokens }));
}

export const totalVotes = (p) =>
  p.kind === 'choice' ? p.options.reduce((s, o) => s + o.votes, 0) : p.yes + p.no;
