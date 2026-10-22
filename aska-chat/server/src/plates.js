// Номера АСЬКИ — как автомобильные, разных стран и регионов. Каждый номер — коллекционный токен
// («как NFT» внутри АСЬКИ): у него есть номер токена, владелец, редкость, уровень улучшения и история.
// Покупаются и улучшаются за аськоины. Серия «А … МР» (АМР) — золотая, только у админов (голд).
import crypto from 'node:crypto';

// ---------- страны и регионы ----------

const RU_CITIES = [
  ['Москва', ['777', '77', '97', '99', '177', '197', '199', '797', '799', '977']],
  ['Московская область', ['50', '90', '150', '190', '750']],
  ['Санкт-Петербург', ['78', '98', '178', '198']],
  ['Казань', ['116', '16', '716']],
  ['Екатеринбург', ['196', '66', '96']],
  ['Новосибирск', ['154', '54']],
  ['Нижний Новгород', ['152', '52']],
  ['Сочи', ['123', '23', '93', '193']],
  ['Ростов-на-Дону', ['161', '61']],
  ['Самара', ['163', '63']],
  ['Уфа', ['102', '02', '702']],
  ['Красноярск', ['124', '24']],
  ['Пермь', ['159', '59']],
  ['Челябинск', ['174', '74']],
  ['Воронеж', ['136', '36']],
  ['Омск', ['55']],
  ['Тюмень', ['72']],
  ['Калининград', ['39']],
  ['Владивосток', ['125', '25']],
  ['Астрахань', ['30']],
];

export const COUNTRIES = {
  RU: { name: 'Россия', regions: RU_CITIES.flatMap(([city, codes]) => codes.map((code) => ({ code, city }))) },
  BY: { name: 'Беларусь', regions: [['7', 'Минск'], ['5', 'Минская область'], ['1', 'Брест'], ['2', 'Витебск'], ['3', 'Гомель'], ['4', 'Гродно'], ['6', 'Могилёв']].map(([code, city]) => ({ code, city })) },
  KZ: { name: 'Казахстан', regions: [['02', 'Алматы'], ['01', 'Астана'], ['17', 'Шымкент']].map(([code, city]) => ({ code, city })) },
  AM: { name: 'Армения', regions: [{ code: '', city: 'Ереван' }] },
  GE: { name: 'Грузия', regions: [{ code: '', city: 'Тбилиси' }] },
  DE: { name: 'Германия', regions: [['B', 'Берлин'], ['M', 'Мюнхен'], ['HH', 'Гамбург'], ['K', 'Кёльн'], ['F', 'Франкфурт']].map(([code, city]) => ({ code, city })) },
  US: { name: 'США', regions: [['CA', 'Калифорния'], ['NY', 'Нью-Йорк']].map(([code, city]) => ({ code, city })) },
  AE: { name: 'ОАЭ', regions: [{ code: 'DXB', city: 'Дубай' }] },
  GB: { name: 'Великобритания', regions: [{ code: 'L', city: 'Лондон' }] },
};

export const cityOf = (country, region) => COUNTRIES[country]?.regions.find((r) => r.code === region)?.city || '';

// Город из профиля → страна и регион номера
const CITY_ALIASES = [
  [/москв/, 'RU', '777'], [/подмосков|московск\w* обл/, 'RU', '50'], [/петербург|питер|спб/, 'RU', '78'], [/казан/, 'RU', '116'],
  [/екатеринбург|екб/, 'RU', '196'], [/новосибирск/, 'RU', '154'], [/нижн\w* новгород|нн\b/, 'RU', '152'], [/сочи|краснодар/, 'RU', '123'],
  [/ростов/, 'RU', '161'], [/самар/, 'RU', '163'], [/уф[аеы]/, 'RU', '102'], [/красноярск/, 'RU', '124'], [/перм/, 'RU', '159'],
  [/челябинск/, 'RU', '174'], [/воронеж/, 'RU', '136'], [/омск/, 'RU', '55'], [/тюмен/, 'RU', '72'], [/калининград/, 'RU', '39'],
  [/владивосток/, 'RU', '125'], [/астрахан/, 'RU', '30'],
  [/минск/, 'BY', '7'], [/брест/, 'BY', '1'], [/витебск/, 'BY', '2'], [/гомел/, 'BY', '3'], [/гродн/, 'BY', '4'], [/могил[её]в/, 'BY', '6'],
  [/алмат/, 'KZ', '02'], [/астан/, 'KZ', '01'], [/шымкент/, 'KZ', '17'], [/ереван/, 'AM', ''], [/тбилиси/, 'GE', ''],
  [/берлин/, 'DE', 'B'], [/мюнхен/, 'DE', 'M'], [/гамбург/, 'DE', 'HH'], [/к[её]льн/, 'DE', 'K'], [/франкфурт/, 'DE', 'F'],
  [/лос-?анджелес|сан-?франциско|калифорни/, 'US', 'CA'], [/нью-?йорк/, 'US', 'NY'], [/дуба/, 'AE', 'DXB'], [/лондон/, 'GB', 'L'],
];
export function regionForCity(city) {
  const c = String(city || '').toLowerCase().replace(/ё/g, 'е');
  const hit = CITY_ALIASES.find(([re]) => re.test(c));
  return hit ? { country: hit[1], region: hit[2] } : null;
}

// Телефон → страна номера при регистрации
export function countryForPhone(phone) {
  const p = String(phone || '');
  if (p.startsWith('+375')) return 'BY';
  if (/^\+77\d/.test(p)) return 'KZ';
  if (p.startsWith('+374')) return 'AM';
  if (p.startsWith('+995')) return 'GE';
  if (p.startsWith('+49')) return 'DE';
  if (p.startsWith('+971')) return 'AE';
  if (p.startsWith('+44')) return 'GB';
  if (p.startsWith('+1')) return 'US';
  return 'RU';
}

export const defaultRegion = (country) => COUNTRIES[country]?.regions[0]?.code ?? '';

// ---------- формат номеров ----------

const RU_LETTERS = 'АВЕКМНОРСТУХ';
const LAT_OF = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X' };
const CYR_OF = Object.fromEntries(Object.entries(LAT_OF).map(([c, l]) => [l, c]));
const LAT_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

// Ключ для поиска: кириллица → похожая латиница, только буквы и цифры. «А 001 МР 777» = «a001mp777»
export function plateKey(s) {
  return String(s || '').toUpperCase().replace(/Ё/g, 'Е').replace(/[А-Я]/g, (c) => LAT_OF[c] || c).replace(/[^0-9A-Z]/g, '');
}

// Разбор канонического кода на части для показа
export function partsOf(country, code) {
  let m;
  switch (country) {
    case 'RU': m = /^([А-Я])(\d{3})([А-Я]{2})(\d{2,3})$/.exec(code); return m && { letters: m[1] + m[3], digits: m[2], region: m[4], text: `${m[1]} ${m[2]} ${m[3]} ${m[4]}` };
    case 'BY': m = /^(\d{4})([A-Z]{2})-(\d)$/.exec(code); return m && { letters: m[2], digits: m[1], region: m[3], text: `${m[1]} ${m[2]}-${m[3]}` };
    case 'KZ': m = /^(\d{3})([A-Z]{3})(\d{2})$/.exec(code); return m && { letters: m[2], digits: m[1], region: m[3], text: `${m[1]} ${m[2]} ${m[3]}` };
    case 'AM': m = /^(\d{2})([A-Z]{2})(\d{3})$/.exec(code); return m && { letters: m[2], digits: m[3], region: '', text: `${m[1]} ${m[2]} ${m[3]}` };
    case 'GE': m = /^([A-Z]{2})(\d{3})([A-Z]{2})$/.exec(code); return m && { letters: m[1] + m[3], digits: m[2], region: '', text: `${m[1]}-${m[2]}-${m[3]}` };
    case 'DE': m = /^(B|M|HH|K|F)-([A-Z]{1,2})(\d{1,4})$/.exec(code); return m && { letters: m[2], digits: m[3], region: m[1], text: `${m[1]} ${m[2]} ${m[3]}` };
    case 'US':
      m = /^(\d)([A-Z]{3})(\d{3})$/.exec(code);
      if (m) return { letters: m[2], digits: m[1] + m[3], region: 'CA', text: code };
      m = /^([A-Z]{3})(\d{4})$/.exec(code); return m && { letters: m[1], digits: m[2], region: 'NY', text: `${m[1]}-${m[2]}` };
    case 'AE': m = /^([A-Z])(\d{1,5})$/.exec(code); return m && { letters: m[1], digits: m[2], region: 'DXB', text: `${m[1]} ${m[2]}` };
    case 'GB': m = /^(L[A-Z])(\d{2})([A-Z]{3})$/.exec(code); return m && { letters: m[1] + m[3], digits: m[2], region: 'L', text: `${m[1]}${m[2]} ${m[3]}` };
    default: return null;
  }
}

export const formatCode = (country, code) => partsOf(country, code)?.text || code || '';
export const ADMIN_PLATE = 'А001МР777';
export const ASKA_PLATE = 'А000МР777';
export const SUPER_PLATE = 'А777МР777';

// Золотая серия: российские «А … МР» — только у админов (голд)
export const isGoldCode = (country, code) => country === 'RU' && /^А\d{3}МР\d{2,3}$/.test(code || '');

// Что набрал человек (или администратор) → канонический код. Регион по умолчанию — из выбранного.
export function parsePlate(input, country = 'RU', region) {
  const raw = String(input || '').toUpperCase().replace(/Ё/g, 'Е');
  if (country === 'RU') {
    const t = raw.replace(/[A-Z]/g, (c) => CYR_OF[c] || c).replace(/[^0-9А-Я]/g, '');
    const L = `[${RU_LETTERS}]`;
    const reg = region || '777';
    let m = new RegExp(`^(${L})(\\d{1,3})(${L}{2})(\\d{2,3})?$`).exec(t);
    if (m) return `${m[1]}${m[2].padStart(3, '0')}${m[3]}${m[4] || reg}`;
    m = new RegExp(`^(${L})(${L}{2})(\\d{1,3})(\\d{2,3})?$`).exec(t); // «АМР-001-777»
    if (m) return `${m[1]}${m[3].padStart(3, '0')}${m[2]}${m[4] || reg}`;
    m = /^(\d{1,3})$/.exec(t);
    if (m) return `А${m[1].padStart(3, '0')}МР${reg}`;
    return null;
  }
  const t = raw.replace(/[А-Я]/g, (c) => LAT_OF[c] || c).replace(/[^0-9A-Z]/g, '');
  let m;
  switch (country) {
    case 'BY': m = /^(\d{4})([A-Z]{2})(\d)?$/.exec(t); return m ? `${m[1]}${m[2]}-${m[3] || region || '7'}` : null;
    case 'KZ': m = /^(\d{3})([A-Z]{3})(\d{2})?$/.exec(t); return m ? `${m[1]}${m[2]}${m[3] || region || '02'}` : null;
    case 'AM': m = /^(\d{2})([A-Z]{2})(\d{3})$/.exec(t); return m ? t : null;
    case 'GE': m = /^([A-Z]{2})(\d{3})([A-Z]{2})$/.exec(t); return m ? t : null;
    case 'DE': {
      const pre = ['HH', 'B', 'M', 'K', 'F'].find((p) => t.startsWith(p) && /^[A-Z]{1,2}\d{1,4}$/.test(t.slice(p.length)) && (!region || p === region));
      return pre ? `${pre}-${t.slice(pre.length)}` : null;
    }
    case 'US': return /^\d[A-Z]{3}\d{3}$/.test(t) || /^[A-Z]{3}\d{4}$/.test(t) ? t : null;
    case 'AE': return /^[A-Z]\d{1,5}$/.test(t) ? t : null;
    case 'GB': return /^L[A-Z]\d{2}[A-Z]{3}$/.test(t) ? t : null;
    default: return null;
  }
}

// ---------- редкость, цены, улучшения ----------

export const RARITY = [
  { id: 'common', name: 'Обычный', price: 50 },
  { id: 'rare', name: 'Редкий', price: 150 },
  { id: 'epic', name: 'Эпический', price: 400 },
  { id: 'legendary', name: 'Легендарный', price: 1200 },
  { id: 'mythic', name: 'Мифический', price: 5000 },
];

export const LEVELS = [
  { name: 'Базовый', cost: 0 },
  { name: 'Серебро', cost: 60 },
  { name: 'Неон', cost: 150 },
  { name: 'Голограмма', cost: 350 },
  { name: 'Платина', cost: 800 },
  { name: 'Бриллиант', cost: 2000 },
];

function digitTier(d) {
  if (!d) return 0;
  const n = d.replace(/^0+/, '');
  if (n === '1' || n === '7' || /^7+$/.test(d)) return 4;            // 001, 007, 777
  if (/^(\d)\1+$/.test(d) && d.length >= 2) return 3;                // 111, 2222
  if (['123', '1234', '12345', '321', '4321'].includes(d)) return 3;
  if (/^[1-9]0+$/.test(d) && d.length >= 3) return 3;                // 100, 1000
  if (n.length === 1 && d.length >= 3) return 3;                      // 002 … 009
  if (d.length >= 3 && d === [...d].reverse().join('')) return 2;     // 121, 1001
  if (/00$/.test(d)) return 2;                                        // 300, 1200
  if (n.length < d.length) return 1;                                  // 012 … 099
  if (/(\d)\1/.test(d)) return 1;                                     // 112, 455
  return 0;
}

const SPECIAL_SERIES = new Set(['ЕКХ', 'ООО', 'ААА', 'ВВВ', 'ЕЕЕ', 'ККК', 'МММ', 'ННН', 'РРР', 'ССС', 'ТТТ', 'УУУ', 'ХХХ', 'АМР', 'ХКХ']);

export function rarityOf(country, code) {
  const p = partsOf(country, code);
  if (!p) return 0;
  let t = digitTier(p.digits);
  const L = p.letters;
  if (L && L.length >= 2 && /^(.)\1+$/.test(L)) t += 1;
  if (country === 'RU' && SPECIAL_SERIES.has(L[0] + L.slice(1))) t += 1;
  return Math.min(4, t);
}

export const priceOf = (country, code) => RARITY[rarityOf(country, code)].price;

// ---------- выпуск номеров ----------

const pick = (s) => s[crypto.randomInt(s.length)];
const digits = (n) => Array.from({ length: n }, () => crypto.randomInt(10)).join('');

function randomCode(country, region, gold) {
  switch (country) {
    case 'RU': {
      if (gold) return `А${digits(3)}МР${region}`;
      let a; let bc;
      do { a = pick(RU_LETTERS); bc = pick(RU_LETTERS) + pick(RU_LETTERS); } while ((a === 'А' && bc === 'МР') || SPECIAL_SERIES.has(a + bc) || /^(.)\1\1$/.test(a + bc));
      return `${a}${digits(3)}${bc}${region}`;
    }
    case 'BY': return `${digits(4)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}-${region}`;
    case 'KZ': return `${digits(3)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${region}`;
    case 'AM': return `${digits(2)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${digits(3)}`;
    case 'GE': return `${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${digits(3)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}`;
    case 'DE': return `${region}-${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${1 + crypto.randomInt(9)}${digits(3)}`;
    case 'US': return region === 'NY' ? `${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${digits(4)}` : `${1 + crypto.randomInt(9)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${digits(3)}`;
    case 'AE': return `${pick(LAT_LETTERS)}${1 + crypto.randomInt(9)}${digits(4)}`;
    case 'GB': return `L${pick(LAT_LETTERS)}${digits(2)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}${pick(LAT_LETTERS)}`;
    default: return null;
  }
}

export const keyTaken = (db, key) => Boolean(db.prepare('SELECT 1 FROM plates WHERE key = ?').get(key));

// Случайный свободный обычный номер страны и региона (редкие и золотые — только за аськоины или админам)
export function randomFreeCode(db, country = 'RU', region = defaultRegion(country), { gold = false, keepDigits } = {}) {
  if (keepDigits && country === 'RU') {
    for (let i = 0; i < 40; i++) {
      const c = gold ? `А${keepDigits}МР${region}` : randomCode('RU', region, false).replace(/^(.)\d{3}/, `$1${keepDigits}`);
      if (!keyTaken(db, plateKey(c))) return c;
      if (gold) break;
    }
  }
  for (let i = 0; i < 400; i++) {
    const c = randomCode(country, region, gold);
    if (c && !keyTaken(db, plateKey(c)) && (gold || rarityOf(country, c) === 0)) return c;
  }
  throw new Error('no plates left');
}

// Выпустить номер-токен. ownerId = null — номер у АСЬКИ (витрина).
export function mintPlate(db, { country, code, ownerId = null, price = null, kind = 'mint', note = null }) {
  const p = partsOf(country, code);
  if (!p) throw new Error('bad_plate');
  const now = Date.now();
  const { lastInsertRowid } = db.prepare(`INSERT INTO plates (code, key, country, region, rarity, level, owner_id, price, gold, minted_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`).run(code, plateKey(code), country, p.region, rarityOf(country, code), ownerId, price, isGoldCode(country, code) ? 1 : 0, now);
  const id = Number(lastInsertRowid);
  db.prepare('INSERT INTO plate_history (plate_id, from_id, to_id, price, kind, note, at) VALUES (?, NULL, ?, ?, ?, ?, ?)').run(id, ownerId, price, kind, note, now);
  return id;
}

export function plateView(row, { history } = {}) {
  if (!row) return null;
  const v = {
    id: row.id, token: `#${String(row.id).padStart(4, '0')}`, code: row.code, text: formatCode(row.country, row.code), country: row.country,
    countryName: COUNTRIES[row.country]?.name || '', region: row.region, city: cityOf(row.country, row.region),
    rarity: row.rarity, rarityName: RARITY[row.rarity].name, level: row.level, levelName: LEVELS[row.level].name,
    gold: Boolean(row.gold), ownerId: row.owner_id, price: row.price, mintedAt: row.minted_at,
    nextLevelCost: LEVELS[row.level + 1]?.cost ?? null,
  };
  if (history) v.history = history;
  return v;
}

// Популярные номера на витрине АСЬКИ — выпускаются один раз
export const SHOWCASE = [
  ['RU', 'А777АА777'], ['RU', 'О001ОО77'], ['RU', 'Е007КХ99'], ['RU', 'М888ММ197'], ['RU', 'С123СС78'],
  ['RU', 'Т116ТТ116'], ['RU', 'В555ВВ797'], ['RU', 'Х100ХХ777'], ['RU', 'К777КК196'], ['RU', 'Р001РР123'],
  ['BY', '7777AA-7'], ['KZ', '777AAA02'], ['AM', '77AA777'], ['GE', 'AA777AA'], ['DE', 'B-AA777'],
  ['US', '7AAA777'], ['US', 'AAA7777'], ['AE', 'A777'], ['GB', 'LA77AAA'],
];
