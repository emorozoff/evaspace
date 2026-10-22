// Номера-токены и аськоины: выдать, купить, продать, улучшить, сделать основным.
// Голд (админы) получают номер золотой серии АМР; при снятии голд золотые номера возвращаются АСЬКЕ.
import { mintPlate, randomFreeCode, isGoldCode, partsOf, plateKey, keyTaken, priceOf, LEVELS, ADMIN_PLATE, SUPER_PLATE, defaultRegion, plateView, SHOWCASE } from './plates.js';
import { getSetting, setSetting } from './db.js';

export const isGold = (u) => Boolean(u) && (u.role === 'admin' || u.role === 'super');
export const plateRow = (db, id) => (id ? db.prepare('SELECT * FROM plates WHERE id = ?').get(id) : null);

export function addCoins(db, userId, delta, reason) {
  if (!delta) return;
  db.prepare('UPDATE users SET coins = MAX(0, coins + ?) WHERE id = ?').run(delta, userId);
  db.prepare('INSERT INTO coin_log (user_id, delta, reason, at) VALUES (?, ?, ?, ?)').run(userId, delta, reason, Date.now());
}

// Сделать номер основным: по нему входят и его видят все
export function activate(db, userId, plateId) {
  const p = plateRow(db, plateId);
  db.prepare('UPDATE users SET plate = ?, plate_id = ? WHERE id = ?').run(p.code, p.id, userId);
}

export function give(db, userId, { country, code, kind = 'mint', note = null, active = true }) {
  const id = mintPlate(db, { country, code, ownerId: userId, kind, note });
  if (active) activate(db, userId, id);
  return id;
}

// Новый человек: номер его страны (по телефону); самому первому — А 001 МР 777
export function firstPlate(db, userId, { country = 'RU', region, gold = false, preferred } = {}) {
  const reg = region ?? defaultRegion(country);
  const code = preferred && !keyTaken(db, plateKey(preferred)) ? preferred : randomFreeCode(db, gold ? 'RU' : country, gold ? '777' : reg, { gold });
  return give(db, userId, { country: gold ? 'RU' : country, code, note: 'первый номер' });
}

// Стал голд: золотой номер АМР с теми же цифрами (если свободен) — основным
export function grantGoldPlate(db, user) {
  const own = db.prepare('SELECT * FROM plates WHERE owner_id = ? AND gold = 1 ORDER BY id LIMIT 1').get(user.id);
  if (own) { activate(db, user.id, own.id); return own.id; }
  const cur = plateRow(db, user.plate_id);
  const parts = cur && cur.country === 'RU' ? partsOf('RU', cur.code) : null;
  const pref = user.role === 'super' ? SUPER_PLATE : null;
  const code = pref && !keyTaken(db, plateKey(pref)) ? pref : randomFreeCode(db, 'RU', parts?.region || '777', { gold: true, keepDigits: parts?.digits });
  return give(db, user.id, { country: 'RU', code, kind: 'gold', note: 'золотая серия' });
}

// Снят голд: золотые номера уходят АСЬКЕ (не продаются), основным — другой свой номер или новый
export function revokeGoldPlates(db, user) {
  for (const p of db.prepare('SELECT * FROM plates WHERE owner_id = ? AND gold = 1').all(user.id)) {
    db.prepare('UPDATE plates SET owner_id = NULL, price = NULL WHERE id = ?').run(p.id);
    db.prepare("INSERT INTO plate_history (plate_id, from_id, to_id, price, kind, note, at) VALUES (?, ?, NULL, NULL, 'revoke', 'снят голд', ?)").run(p.id, user.id, Date.now());
  }
  const keep = db.prepare('SELECT * FROM plates WHERE owner_id = ? ORDER BY level DESC, rarity DESC, id LIMIT 1').get(user.id);
  if (keep) activate(db, user.id, keep.id);
  else {
    const cur = plateRow(db, user.plate_id);
    const parts = cur?.country === 'RU' ? partsOf('RU', cur.code) : null;
    give(db, user.id, { country: 'RU', code: randomFreeCode(db, 'RU', parts?.region || '777', { keepDigits: parts?.digits }), note: 'вместо золотого' });
  }
}

export function canHold(user, plate) {
  return !plate.gold || isGold(user) || user.kind === 'aska';
}

// Популярные номера на витрине — выпускаются один раз
export function seedShowcase(db) {
  if (getSetting(db, 'showcase_v1')) return;
  for (const [country, code] of SHOWCASE) {
    if (keyTaken(db, plateKey(code)) || isGoldCode(country, code)) continue;
    mintPlate(db, { country, code, ownerId: null, price: priceOf(country, code), kind: 'mint', note: 'витрина' });
  }
  setSetting(db, 'showcase_v1', '1');
}

export function upgradeCost(plate) {
  return LEVELS[plate.level + 1]?.cost ?? null;
}

export function viewWithOwner(db, row) {
  const v = plateView(row);
  if (!v) return v;
  if (row.owner_id) v.ownerName = db.prepare('SELECT display_name FROM users WHERE id = ?').get(row.owner_id)?.display_name || '';
  return v;
}

export { ADMIN_PLATE, SUPER_PLATE };
