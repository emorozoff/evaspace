// Ссылка супер-админа: одноразовая, на 7 дней, привязана к одному входу. Её создаёт админ (пока супер-админа нет),
// супер-админ или консоль на сервере. По ссылке человек либо входит в свою АСЬКУ (своим паролем или задав новый),
// либо, если такого логина ещё нет, сам придумывает пароль — и становится супер-админом.
// В базе хранится только отпечаток кода: из базы ссылку не восстановить.
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TTL = 7 * 86_400_000;

const norm = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function createSuperLinks({ db, secret }) {
  const hash = (code) => crypto.createHmac('sha256', secret).update(`super:${norm(code)}`).digest('hex');

  // target: { userId } — уже есть в АСЬКЕ, или { username } — новый вход
  function create({ createdBy = null, fromConsole = false, userId = null, username = null }) {
    let code = '';
    for (const b of crypto.randomBytes(12)) code += ALPHABET[b % ALPHABET.length];
    const now = Date.now();
    // прежние неиспользованные ссылки на этот же вход больше не действуют
    db.prepare('DELETE FROM super_links WHERE used_at IS NULL AND (target_id = ? OR username = ?)').run(userId, username);
    db.prepare(`INSERT INTO super_links (code_hash, target_id, username, created_by, from_console, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(hash(code), userId, username, createdBy, fromConsole ? 1 : 0, now, now + TTL);
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
  }

  function read(code) {
    if (norm(code).length !== 12) return null;
    const row = db.prepare('SELECT * FROM super_links WHERE code_hash = ?').get(hash(code));
    return row && !row.used_at && row.expires_at > Date.now() ? row : null;
  }

  function markUsed(row) {
    db.prepare('UPDATE super_links SET used_at = ? WHERE code_hash = ?').run(Date.now(), row.code_hash);
  }

  return { create, read, markUsed };
}
