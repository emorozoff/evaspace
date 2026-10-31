// Уровни АСЬКИ: 👤 Гость (бесплатно, с ограничениями) → ⭐ Голд (VIP) → 🖤 Блэк (супер-VIP, только по приглашению).
// Уровень хранится в users.tier (+ tier_until у оплаченного Голд). Права администратора — отдельно, в users.role:
// админ всегда не ниже Голд, супер-админ — Блэк. Голд дают: покупка за аськоины, большой нетворк или администратор.
import crypto from 'node:crypto';

export const TIER_ORDER = ['guest', 'gold', 'black'];
export const TIERS = {
  guest: {
    key: 'guest', name: 'Гость', emoji: '👤', daily: 20, invites: 3, discount: 0,
    night: false, catalogAdd: false, nightFree: false, vip: false,
  },
  gold: {
    key: 'gold', name: 'Голд', emoji: '⭐', daily: 40, invites: 10, discount: 20,
    night: true, catalogAdd: true, nightFree: false, vip: true,
  },
  black: {
    key: 'black', name: 'Блэк', emoji: '🖤', daily: 60, invites: 50, discount: 40,
    night: true, catalogAdd: true, nightFree: true, vip: true, upass: true, blackChat: true,
  },
};
export const GOLD_PRICE = 500;            // аськоинов за Голд…
export const GOLD_DAYS = 30;              // …на 30 дней
export const NET_GOLD = 10;               // столько человек в нетворке — Голд навсегда
export const BLACK_INVITES_PER_MONTH = 1; // Блэк может позвать в Блэк одного человека в месяц (админы — без ограничений)
export const VIP_REGIONS = ['777', '888'];
export const BLACK_CHAT = 'circle:black';

const rank = (t) => Math.max(0, TIER_ORDER.indexOf(t));
const isAdminRole = (u) => u?.role === 'admin' || u?.role === 'super';

// Действующий уровень человека: что записано (Голд — пока оплачен), не ниже уровня по роли и по нетворку
export function tierOf(u, now = Date.now()) {
  if (!u || u.kind !== 'human') return 'guest';
  let t = TIERS[u.tier] ? u.tier : 'guest';
  if (t === 'gold' && u.tier_until && u.tier_until < now) t = 'guest';
  const floors = [t];
  if (u.role === 'super') floors.push('black');
  else if (u.role === 'admin') floors.push('gold');
  if ((u.net_size || 0) >= NET_GOLD) floors.push('gold');
  return floors.reduce((a, b) => (rank(b) > rank(a) ? b : a), 'guest');
}
export const tierRank = (u) => rank(tierOf(u));
export const perks = (u) => TIERS[tierOf(u)];
export const isGoldTier = (u) => tierRank(u) >= 1;   // Голд или Блэк: золотая звезда, VIP-регион, ночь
export const isBlack = (u) => tierOf(u) === 'black';
export const isAdmin = isAdminRole;

// Цена со скидкой уровня
export const discounted = (u, price) => Math.max(0, Math.round(price * (100 - perks(u).discount) / 100));

// Регион на номере: у Голд и Блэк — VIP 777 или 888, у остальных — место, где человек сейчас
export const vipRegionOf = (u) => (isGoldTier(u) ? (VIP_REGIONS.includes(u.vip_region) ? u.vip_region : '777') : null);

// Пропуск UPASS у Блэк — свой номер, выдаётся один раз
export function upassCode() {
  const r = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `UP-${r.slice(0, 5)}-${r.slice(5)}`;
}

// Что открыто на уровне — для экрана «Уровни» (порядок важен: каждый следующий добавляет своё)
export const TIER_PERKS = {
  guest: [
    'Личка, стены, круги и «Бизнес»',
    `+${TIERS.guest.daily} 🪙 за вход каждый день`,
    `${TIERS.guest.invites} приглашения одновременно`,
    'Номер с регионом «где я сейчас»: Москва 197, Питер 198, Бали, Дубай…',
    '🏠 Комнаты по интересам — вступать и писать бесплатно',
    'Реестр музыки, кино и книг — читать',
  ],
  gold: [
    'Золотая звезда ★ и золотой цветок',
    'VIP-регион на номере: 777 или 888',
    `+${TIERS.gold.daily} 🪙 за вход, ${TIERS.gold.invites} приглашений`,
    `Скидка ${TIERS.gold.discount}% на номера, улучшения и НФТ`,
    '📹 Видеоквадратики до 40 секунд',
    '⛓ Заносить свою музыку, фильмы и книги в реестр — кто первый занёс, того и тапки',
    'Золотая серия АМР в «Подобрать»',
  ],
  black: [
    'Чёрная карта 🖤 и чёрный цветок',
    'Закрытый чат Блэк',
    'Пропуск UPASS',
    '📹 Видеоквадратики до 40 секунд',
    `Скидка ${TIERS.black.discount}% и +${TIERS.black.daily} 🪙 за вход`,
    'Позвать в Блэк одного человека в месяц',
  ],
};
