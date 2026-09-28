import { EXCHANGE } from '../data/people.js';
import { REGIONS } from '../data/regions.js';
import { lowerFirst } from './format.js';

/* Совместимость считается встречно: он даёт то, что я ищу, и наоборот.
   Общие интересы, цели и регион только добавляют — сами по себе метча не делают. */

export function match(me, p) {
  if (!me || !p || p.id === 'team') return { pct: 0, reasons: [] };
  const needs = me.needs || [];
  const gives = me.gives || [];
  const toMe = needs.filter((x) => (p.gives || []).includes(x));
  const fromMe = (p.needs || []).filter((x) => gives.includes(x));
  const hobbies = (me.interests || []).filter((x) => (p.interests || []).includes(x));
  const goals = (me.goals || []).filter((x) => (p.goals || []).includes(x));
  const near = me.region && me.region === p.region;

  let score = 32;
  score += Math.min(2, toMe.length) * 16;
  score += Math.min(2, fromMe.length) * 8;
  score += Math.min(3, hobbies.length) * 5;
  score += Math.min(2, goals.length) * 3;
  if (near) score += 8;
  const pct = Math.max(35, Math.min(97, score));

  const reasons = [];
  // строчная только первая буква: «AI и автоматизация» остаётся с «AI»
  if (toMe.length) reasons.push(`даёт то, что вы ищете: ${toMe.map((x) => lowerFirst(EXCHANGE[x].name)).join(', ')}`);
  if (fromMe.length) reasons.push(`ищет то, чем вы сильны: ${fromMe.map((x) => lowerFirst(EXCHANGE[x].name)).join(', ')}`);
  if (hobbies.length) reasons.push(`общее: ${hobbies.map((x) => x.toLowerCase()).join(', ')}`);
  if (near) reasons.push(`оба ${REGIONS[me.region].loc}`);
  return { pct, reasons, toMe, fromMe, hobbies, near };
}

export function ranked(me, people) {
  return people
    .filter((p) => p.id !== me.id)
    .map((p) => ({ p, ...match(me, p) }))
    .sort((a, b) => b.pct - a.pct);
}
