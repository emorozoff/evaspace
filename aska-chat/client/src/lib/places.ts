// Регион на номере — место, где человек сейчас (≡ server/src/places.js, проверяется в test/v10.test.js).
// У Голд и Блэк вместо места на номере — VIP-регион 777 или 888.
import type { User } from './store.ts';

export interface Place { key: string; name: string; code: string; flag: string; theme?: string }
export const PLACES: Place[] = [
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
export const VIP_REGIONS = ['777', '888'];
export const placeOf = (key?: string | null) => PLACES.find((p) => p.key === key) || null;
const PLACE_KEY = 'aska-place';
export function lastPlace() { try { return placeOf(localStorage.getItem(PLACE_KEY))?.key || 'msk'; } catch { return 'msk'; } }
export function rememberPlace(key: string) { try { localStorage.setItem(PLACE_KEY, key); } catch { /* приватный режим */ } }

// Что показать в окошке региона на номере человека
export interface RegionShow { code: string; flag: string; vip: boolean; ru: boolean; place?: Place | null }
export function regionOf(u?: User | null): RegionShow | null {
  if (!u) return null;
  if (u.vipRegion) return { code: u.vipRegion, flag: '🇷🇺', vip: true, ru: true, place: placeOf(u.place) };
  const p = placeOf(u.place);
  if (!p) return null;
  return { code: p.code, flag: p.flag, vip: false, ru: /^\d+$/.test(p.code), place: p };
}
