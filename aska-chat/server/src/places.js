// Регион на номере — это место, где человек сейчас: Москва 197, Питер 198, Бали, Дубай, США…
// У российских мест — цифры региона, у остальных — короткий код и флаг. У Голд и Блэк вместо места — 777 или 888.
// Держать одинаковым с client/src/lib/places.ts (проверяется в test/v10.test.js).
export const PLACES = [
  { key: 'msk', name: 'Москва', code: '197', flag: '🇷🇺' },
  { key: 'spb', name: 'Питер', code: '198', flag: '🇷🇺' },
  { key: 'kzn', name: 'Казань', code: '116', flag: '🇷🇺' },
  { key: 'sochi', name: 'Сочи', code: '123', flag: '🇷🇺' },
  { key: 'ekb', name: 'Екатеринбург', code: '196', flag: '🇷🇺' },
  { key: 'nsk', name: 'Новосибирск', code: '154', flag: '🇷🇺' },
  { key: 'krd', name: 'Краснодар', code: '93', flag: '🇷🇺' },
  { key: 'kgd', name: 'Калининград', code: '39', flag: '🇷🇺' },
  { key: 'vvo', name: 'Владивосток', code: '125', flag: '🇷🇺' },
  { key: 'bali', name: 'Бали', code: 'BALI', flag: '🇮🇩', theme: 'tropic' },
  { key: 'dubai', name: 'Дубай', code: 'DXB', flag: '🇦🇪', theme: 'desert' },
  { key: 'usa', name: 'США', code: 'USA', flag: '🇺🇸', theme: 'usa' },
  { key: 'nyc', name: 'Нью-Йорк', code: 'NYC', flag: '🇺🇸', theme: 'usa' },
  { key: 'miami', name: 'Майами', code: 'MIA', flag: '🇺🇸', theme: 'tropic' },
  { key: 'la', name: 'Лос-Анджелес', code: 'LA', flag: '🇺🇸', theme: 'usa' },
  { key: 'phuket', name: 'Пхукет', code: 'PKT', flag: '🇹🇭', theme: 'tropic' },
  { key: 'goa', name: 'Гоа', code: 'GOA', flag: '🇮🇳', theme: 'tropic' },
  { key: 'srilanka', name: 'Шри-Ланка', code: 'LKA', flag: '🇱🇰', theme: 'tropic' },
  { key: 'maldives', name: 'Мальдивы', code: 'MLE', flag: '🇲🇻', theme: 'tropic' },
  { key: 'ist', name: 'Стамбул', code: 'IST', flag: '🇹🇷' },
  { key: 'tbs', name: 'Тбилиси', code: 'TBS', flag: '🇬🇪' },
  { key: 'evn', name: 'Ереван', code: 'EVN', flag: '🇦🇲' },
  { key: 'ala', name: 'Алматы', code: 'ALA', flag: '🇰🇿' },
  { key: 'msq', name: 'Минск', code: 'MSQ', flag: '🇧🇾' },
  { key: 'cyprus', name: 'Кипр', code: 'CY', flag: '🇨🇾', theme: 'tropic' },
  { key: 'paris', name: 'Париж', code: 'PAR', flag: '🇫🇷' },
  { key: 'london', name: 'Лондон', code: 'LDN', flag: '🇬🇧' },
  { key: 'bcn', name: 'Барселона', code: 'BCN', flag: '🇪🇸' },
  { key: 'tokyo', name: 'Токио', code: 'TYO', flag: '🇯🇵' },
  { key: 'moon', name: 'Луна', code: 'MOON', flag: '🌙', theme: 'space' },
];
export const placeOf = (key) => PLACES.find((p) => p.key === key) || null;

// Регион старого номера → место (москвичи с 777 — Москва, питерцы — Питер)
const BY_REGION = { 77: 'msk', 97: 'msk', 99: 'msk', 177: 'msk', 197: 'msk', 199: 'msk', 777: 'msk', 797: 'msk', 799: 'msk', 977: 'msk', 50: 'msk', 90: 'msk', 150: 'msk', 190: 'msk', 750: 'msk',
  78: 'spb', 98: 'spb', 178: 'spb', 198: 'spb', 116: 'kzn', 16: 'kzn', 716: 'kzn', 123: 'sochi', 23: 'krd', 93: 'krd', 193: 'sochi', 196: 'ekb', 66: 'ekb', 96: 'ekb',
  154: 'nsk', 54: 'nsk', 39: 'kgd', 125: 'vvo', 25: 'vvo' };
export function defaultPlace(plateCountry, plateRegion) {
  if (plateCountry === 'RU') return BY_REGION[Number(plateRegion)] || 'msk';
  return { BY: 'msq', KZ: 'ala', AM: 'evn', GE: 'tbs', AE: 'dubai', US: 'usa', GB: 'london', DE: 'paris' }[plateCountry] || 'msk';
}
