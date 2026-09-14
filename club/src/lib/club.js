/* Основа клуба: пакеты доступа, люди, города, сезон и партнёры.
   Всё остальное опирается на этот слой, а он — только на утилиты. */
import { DAY } from './time.js';
import { cityMembers } from './events.js';

export const PACKAGES = {
  start: { id: 'start', title: 'START', price: 1900, note: 'Расписание, база знаний, люди' },
  club: { id: 'club', title: 'CLUB', price: 4900, note: 'Всё, кроме команд и рейтинга' },
  pro: { id: 'pro', title: 'PRO', price: 9900, note: 'Команда, рейтинг, мастермайнды' },
};

const RANK = { start: 0, club: 1, pro: 2 };

export function packRank(p) {
  return RANK[p] ?? 0;
}

export function hasPackage(user, min) {
  return packRank(user?.package) >= packRank(min);
}

export const isPro = (user) => hasPackage(user, 'pro');
/* ---------- люди и города ---------- */

export function userById(state, id) {
  return state.users.find((u) => u.id === id) || null;
}

export function cityById(state, id) {
  return state.cities.find((c) => c.id === id) || null;
}

export function cityName(state, id) {
  return cityById(state, id)?.name || '';
}

export function cityStats(state, id) {
  const members = cityMembers(state, id);
  const city = cityById(state, id);
  return {
    city,
    members,
    count: members.length,
    organizer: city?.organizerId ? userById(state, city.organizerId) : null,
    ready: members.length >= 2,
  };
}
/* ---------- сезон ---------- */

export function seasonProgress(state, now = Date.now()) {
  const { startsAt, graduationAt } = state.season;
  const total = graduationAt - startsAt;
  const passed = Math.min(Math.max(now - startsAt, 0), total);
  const monthIndex = Math.min(3, Math.floor((now - startsAt) / (total / 3)) + 1);
  return {
    percent: Math.round((passed / total) * 100),
    monthIndex,
    daysLeft: Math.max(0, Math.ceil((graduationAt - now) / DAY)),
    startsAt,
    graduationAt,
  };
}
/* ---------- спонсоры ---------- */

export function sponsorById(state, id) {
  return state.sponsors.find((s) => s.id === id) || null;
}
/* ---------- рефералка ---------- */

export const REFERRAL_BONUS = 1500;

export function referralStats(state, userId) {
  const list = state.referrals.filter((r) => r.inviterId === userId);
  return {
    list,
    visited: list.length,
    paid: list.filter((r) => r.status === 'paid').length,
    earned: list.filter((r) => r.status === 'paid').reduce((s, r) => s + r.bonus, 0),
  };
}

export function referralLink(user) {
  const base = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname;
  return `${base}#/join/${user?.ref || 'club'}`;
}
