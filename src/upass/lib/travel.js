/* Перелёт и стоимость жизни в регионе.
   Считается из расстояния и данных региона, а не берётся из воздуха:
   одна и та же формула для всех направлений, поэтому цифры сопоставимы. */

import { REGIONS } from '../data/regions.js';
import { distanceKm } from '../data/world.js';

const CRUISE = 800;      // средняя путевая скорость с учётом набора и снижения, км/ч
const GROUND = 1.3;      // руление, круг, выход — часы
const TRANSFER = 1.8;    // пересадка на дальних плечах

/** Перелёт из региона в регион: расстояние, время в пути, цена билета. */
export function flight(fromKey, toKey) {
  const a = REGIONS[fromKey];
  const b = REGIONS[toKey];
  if (!a || !b || fromKey === toKey) return null;

  const km = distanceKm(a, b);
  const direct = km < 6500;
  const hours = km / CRUISE + GROUND + (direct ? 0 : TRANSFER);
  const index = (a.price + b.price) / 2;
  const from = Math.round(((75 + km * 0.055) * index) / 5) * 5;

  return {
    km,
    hours,
    direct,
    from,
    avg: Math.round((from * 1.7) / 5) * 5,
    business: Math.round((from * 3.4) / 10) * 10,
  };
}

/** Месяц жизни в регионе: жильё + всё остальное. style — 'lean' | 'comfort'. */
export function monthly(regionKey, style = 'lean', housing = 'apt') {
  const r = REGIONS[regionKey];
  if (!r) return null;
  const i = style === 'lean' ? 0 : 1;
  const rent = r.rent[housing][i];
  const living = r.budget[i] - r.rent.apt[i]; // еда, транспорт, связь, спорт
  return { rent, living: Math.max(300, living), total: rent + Math.max(300, living) };
}

/** Сколько стоит поездка целиком: билет туда-обратно плюс месяц жизни. */
export function tripCost(fromKey, toKey, style = 'lean', housing = 'apt', months = 1) {
  const f = flight(fromKey, toKey);
  const m = monthly(toKey, style, housing);
  if (!m) return null;
  const tickets = f ? (style === 'lean' ? f.from : f.avg) * 2 : 0;
  return { tickets, months, living: m.total * months, total: tickets + m.total * months, flight: f, monthly: m };
}

/** Регионы, которые укладываются в бюджет на месяц: жильё плюс жизнь. */
export function fitsBudget(fromKey, limit, style = 'lean', housing = 'apt') {
  return Object.keys(REGIONS)
    .filter((k) => k !== fromKey)
    .map((k) => ({ key: k, ...tripCost(fromKey, k, style, housing, 1) }))
    .filter((x) => x.total <= limit)
    .sort((a, b) => a.total - b.total);
}

export const hoursText = (h) => {
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  return M ? `${H} ч ${M} мин` : `${H} ч`;
};
