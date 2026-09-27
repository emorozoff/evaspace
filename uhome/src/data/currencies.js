/* Валюты для живого блока на главной. Курс хранится как «сколько единиц
   за один доллар», любая пара считается делением — поэтому новую пару
   добавить можно одной строкой в PAIRS. */

export const CURRENCIES = {
  USD: { sym: '$', name: 'доллар', pre: true },
  RUB: { sym: '₽', name: 'рубль' },
  IDR: { sym: 'Rp', name: 'рупия' },
  AED: { sym: 'AED', name: 'дирхам' },
  EUR: { sym: '€', name: 'евро', pre: true },
  GBP: { sym: '£', name: 'фунт', pre: true },
  THB: { sym: '฿', name: 'бат' },
  TRY: { sym: '₺', name: 'лира' },
  KZT: { sym: '₸', name: 'тенге' },
  USDT: { sym: '₮', name: 'тезер' },
  BTC: { sym: '₿', name: 'биткоин', pre: true },
  ETH: { sym: 'Ξ', name: 'эфир', pre: true },
};

export const PAIRS = [
  { id: 'USD-RUB', from: 'USD', to: 'RUB', title: 'Доллар в рублях' },
  { id: 'USD-IDR', from: 'USD', to: 'IDR', title: 'Доллар в рупиях' },
  { id: 'BTC-USD', from: 'BTC', to: 'USD', title: 'Биткоин' },
  { id: 'USDT-RUB', from: 'USDT', to: 'RUB', title: 'Тезер в рублях' },
  { id: 'EUR-RUB', from: 'EUR', to: 'RUB', title: 'Евро в рублях' },
  { id: 'EUR-USD', from: 'EUR', to: 'USD', title: 'Евро в долларах' },
  { id: 'USD-AED', from: 'USD', to: 'AED', title: 'Доллар в дирхамах' },
  { id: 'AED-RUB', from: 'AED', to: 'RUB', title: 'Дирхам в рублях' },
  { id: 'RUB-IDR', from: 'RUB', to: 'IDR', title: 'Рубль в рупиях' },
  { id: 'ETH-USD', from: 'ETH', to: 'USD', title: 'Эфир' },
  { id: 'USD-THB', from: 'USD', to: 'THB', title: 'Доллар в батах' },
  { id: 'USD-TRY', from: 'USD', to: 'TRY', title: 'Доллар в лирах' },
  { id: 'USD-KZT', from: 'USD', to: 'KZT', title: 'Доллар в тенге' },
  { id: 'GBP-USD', from: 'GBP', to: 'USD', title: 'Фунт в долларах' },
];

export const DEFAULT_RATES = ['USD-RUB', 'USD-IDR', 'BTC-USD'];

/* Ориентир на случай, когда сети нет и свежий курс ещё ни разу не пришёл.
   Такие цифры приложение подписывает как примерные — не как биржевые. */
export const FALLBACK = {
  USD: 1, RUB: 82, IDR: 16400, AED: 3.6725, EUR: 0.86, GBP: 0.75, THB: 32.5,
  TRY: 41, KZT: 540, USDT: 1, BTC: 1 / 110000, ETH: 1 / 4000,
};

export const pairById = (id) => PAIRS.find((p) => p.id === id);
