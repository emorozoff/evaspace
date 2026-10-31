// «Мы в ответе за тех, кого пригласили». Нетворк — все, кого ты позвал, и вся цепочка дальше от них
// (кто позвал кого — таблица invites: created_by → used_by). За каждого нового человека в цепочке —
// аськоины: 1-я линия +50, 2-я +15, 3-я +5. Твой приглашённый стал Голд — тебе +100.
// Его заблокировали за нарушения — с тебя −50 (ты за него поручился).
export const LINE_BONUS = [50, 15, 5];   // 1-я, 2-я, 3-я линия
export const GOLD_FRIEND_BONUS = 100;
export const BLOCK_PENALTY = 50;
const MAX_DEPTH = 12;

export const inviterOf = (db, userId) => db.prepare('SELECT created_by FROM invites WHERE used_by = ?').get(userId)?.created_by || null;

// Цепочка вверх: кто позвал меня, кто позвал его… (без петель)
export function ancestors(db, userId) {
  const out = [];
  const seen = new Set([userId]);
  let cur = inviterOf(db, userId);
  while (cur && !seen.has(cur) && out.length < MAX_DEPTH) {
    out.push(cur);
    seen.add(cur);
    cur = inviterOf(db, cur);
  }
  return out;
}

// Новый человек в АСЬКЕ: всем вверх по цепочке +1 к нетворку, первым трём линиям — аськоины.
// addCoins(userId, delta, reason) — из market.js. Вызывать внутри транзакции регистрации.
export function onJoined(db, userId, name, addCoins) {
  const up = ancestors(db, userId);
  up.forEach((id, i) => {
    db.prepare('UPDATE users SET net_size = net_size + 1 WHERE id = ?').run(id);
    if (i > 0 && LINE_BONUS[i]) addCoins(id, LINE_BONUS[i], `нетворк: ${name} (${i + 1}-я линия)`);
  });
  return up;
}

// Пересчитать нетворк у всех (при переходе на десятую версию — один раз)
export function recountAll(db) {
  const kids = new Map();
  for (const r of db.prepare('SELECT created_by, used_by FROM invites WHERE used_by IS NOT NULL AND created_by IS NOT NULL').all()) {
    if (!kids.has(r.created_by)) kids.set(r.created_by, []);
    kids.get(r.created_by).push(r.used_by);
  }
  const size = (id, seen = new Set()) => {
    if (seen.has(id)) return 0;
    seen.add(id);
    return (kids.get(id) || []).reduce((n, k) => n + 1 + size(k, seen), 0);
  };
  const upd = db.prepare('UPDATE users SET net_size = ? WHERE id = ?');
  for (const { id } of db.prepare("SELECT id FROM users WHERE kind = 'human'").all()) upd.run(size(id), id);
}

// Дерево вниз для экрана «Мой нетворк» (до 6 линий и 400 человек)
export function tree(db, rootId, view) {
  const kidsOf = db.prepare('SELECT used_by, used_at FROM invites WHERE created_by = ? AND used_by IS NOT NULL ORDER BY used_at');
  let count = 0;
  const seen = new Set([rootId]);
  const walk = (id, depth) => kidsOf.all(id).filter((r) => !seen.has(r.used_by)).map((r) => {
    seen.add(r.used_by);
    count++;
    const node = { ...view(r.used_by), joinedAt: r.used_at, depth };
    node.children = depth < 6 && count < 400 ? walk(r.used_by, depth + 1) : [];
    return node;
  });
  const children = walk(rootId, 1);
  const lines = [0, 0, 0, 0, 0, 0];
  const visit = (n) => { lines[n.depth - 1]++; n.children.forEach(visit); };
  children.forEach(visit);
  return { children, lines, total: count };
}
