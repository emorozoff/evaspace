// Команды из консоли сервера (на сервере: docker exec -i aska node server/src/cli.js …):
//   invite                         — приглашение
//   help-code <вход>               — код для входа на сутки, если пароль забыт, а СМС не подключены
//                                    (<вход> — логин, телефон или номер АСЬКИ)
//   superadmin <логин>             — создать супер-админа (или сбросить ему пароль). Пароль читается из
//                                    переменной ASKA_PASSWORD или первой строкой из stdin. Чтобы пароль не попал в историю команд:
//                                    read -rs P; printf '%s\n' "$P" | docker exec -i aska node server/src/cli.js superadmin <логин>; unset P
//   super-link <вход>              — ссылка супер-админа на 7 дней (от имени первого админа). <вход> — логин, телефон или номер
//                                    того, кто уже есть в АСЬКЕ, или новый логин. Пароль человек задаёт сам, по ссылке.
import path from 'node:path';
import crypto from 'node:crypto';
import nacl from 'tweetnacl';
import { openDb, getSetting, tx, GENERAL_CHAT } from './db.js';
import { createInvite, formatInvite } from './app.js';
import { createCodes, normalizePhone, looksLikePhone } from './phone.js';
import { parsePlate, plateKey, formatCode } from './plates.js';
import * as M from './market.js';
import { createSuperLinks } from './superlink.js';

const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:8080').replace(/\/$/, '');
const [cmd, ...args] = process.argv.slice(2);
const b64 = (u8) => Buffer.from(u8).toString('base64');

function findHuman(db, login) {
  const s = String(login || '').trim();
  const q = (col, v) => (v ? db.prepare(`SELECT * FROM users WHERE kind = 'human' AND ${col} = ?`).get(v) : null);
  const byPlate = (k) => (k ? db.prepare("SELECT u.* FROM users u JOIN plates p ON p.owner_id = u.id WHERE u.kind = 'human' AND p.key = ?").get(k) : null);
  return (looksLikePhone(s) && q('phone', normalizePhone(s))) || byPlate(plateKey(s)) || byPlate(plateKey(parsePlate(s, 'RU')))
    || q('old_plate_key', plateKey(s)) || q('old_plate_key', plateKey(parsePlate(s, 'RU'))) || q('username', s.toLowerCase()) || null;
}

const plateText = (db, u) => { const p = M.plateRow(db, u.plate_id); return p ? formatCode(p.country, p.code) : '—'; };

async function readPassword() {
  if (process.env.ASKA_PASSWORD) return process.env.ASKA_PASSWORD;
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/)[0];
}

// Те же ключи, что делает телефон при регистрации (client/src/lib/crypto.ts): scrypt N=2^15, r=8 → 64 байта
function keysFromPassword(password) {
  const salt = crypto.randomBytes(16);
  const out = crypto.scryptSync(Buffer.from(password.normalize('NFKC')), salt, 64, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const encKey = out.subarray(0, 32);
  const authKey = out.subarray(32, 64);
  const kp = nacl.box.keyPair();
  const n = nacl.randomBytes(24);
  return {
    boxPk: b64(kp.publicKey), kdfSalt: b64(salt), authHash: crypto.createHash('sha256').update(authKey).digest('hex'),
    backupN: b64(n), backupC: b64(nacl.secretbox(kp.secretKey, n, new Uint8Array(encKey))),
  };
}

if (cmd === 'invite') {
  const db = openDb(dataDir);
  const code = formatInvite(createInvite(db, null));
  console.log(`${publicUrl}/#invite=${code}`);
  console.log(`Код: ${code}`);
  db.close();
} else if (cmd === 'help-code' && args.length) {
  const db = openDb(dataDir);
  const u = findHuman(db, args.join(' '));
  if (!u) {
    console.log('Такого человека нет. Люди:');
    for (const r of db.prepare("SELECT * FROM users WHERE kind = 'human' ORDER BY id").all()) console.log(`  ${r.display_name} — логин ${r.username}, номер ${plateText(db, r)}`);
    db.close();
    process.exit(1);
  }
  const code = createCodes({ db, secret: getSetting(db, 'secret') }).issueHelp(u.id);
  console.log(`${u.display_name} (логин ${u.username}, номер ${plateText(db, u)})`);
  console.log(`Код для входа: ${code} — действует сутки. На экране входа: «Не помню пароль» → «Телефон не привязан».`);
  db.close();
} else if (cmd === 'superadmin' && args.length === 1) {
  const login = args[0].trim();
  const uname = login.toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(uname)) { console.log('Логин: от 3 до 20 символов, латиница, цифры и _.'); process.exit(1); }
  const password = await readPassword();
  if (!password || password.length < 6) { console.log('Пароль — минимум 6 символов (ASKA_PASSWORD или первой строкой в stdin).'); process.exit(1); }
  const db = openDb(dataDir);
  const other = db.prepare("SELECT * FROM users WHERE role = 'super' AND username != ?").get(uname);
  if (other) console.log(`Внимание: супер-админ уже есть — ${other.username}. Будет ещё один.`);
  const k = keysFromPassword(password);
  const now = Date.now();
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(uname);
  const id = tx(db, () => {
    if (existing) {
      // Уже есть — новый пароль и новые ключи (как при восстановлении), права супер-админа
      const prev = [existing.box_pk, ...JSON.parse(existing.prev_pks || '[]')].slice(0, 5);
      db.prepare(`UPDATE users SET box_pk = ?, kdf_salt = ?, auth_hash = ?, backup_n = ?, backup_c = ?, prev_pks = ?, key_reset_at = ?,
        role = 'super', is_admin = 1, blocked_at = NULL WHERE id = ?`).run(k.boxPk, k.kdfSalt, k.authHash, k.backupN, k.backupC, JSON.stringify(prev), now, existing.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM message_boxes WHERE recipient_id = ?').run(existing.id);
      return existing.id;
    }
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO users (username, display_name, box_pk, kdf_salt, auth_hash, backup_n, backup_c, created_at, last_active, role, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'super', 1)
    `).run(uname, login, k.boxPk, k.kdfSalt, k.authHash, k.backupN, k.backupC, now, now);
    const newId = Number(lastInsertRowid);
    M.addCoins(db, newId, 100, 'подарок новичку');
    const maxId = db.prepare('SELECT MAX(id) AS id FROM messages').get().id || 0;
    db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, read_up_to) VALUES (?, ?, ?)').run(GENERAL_CHAT, newId, maxId);
    return newId;
  });
  M.grantGoldPlate(db, db.prepare('SELECT * FROM users WHERE id = ?').get(id));
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  console.log(`${existing ? 'Обновлён' : 'Создан'} супер-админ ${login}: вход — логин «${login}» или номер ${plateText(db, u)}, пароль — тот, что передан.`);
  console.log('Друзья увидят его после перезапуска приложения; Аська и личный ИИ появятся после следующей выкладки.');
  db.close();
} else if (cmd === 'super-link' && args.length) {
  const db = openDb(dataDir);
  const login = args.join(' ').trim();
  const target = findHuman(db, login);
  const from = db.prepare("SELECT * FROM users WHERE kind = 'human' AND role IN ('admin', 'super') AND blocked_at IS NULL ORDER BY id LIMIT 1").get();
  const links = createSuperLinks({ db, secret: getSetting(db, 'secret') });
  let code;
  if (target) {
    if (target.role === 'super') { console.log(`${target.display_name} (${target.username}) уже супер-админ.`); db.close(); process.exit(1); }
    code = links.create({ createdBy: from?.id ?? null, fromConsole: true, userId: target.id });
    console.log(`Для ${target.display_name}: логин ${target.username}, номер ${plateText(db, target)}. Войдёт своим паролем (или задаст новый) и станет супер-админом.`);
  } else {
    const uname = login.toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) { console.log('Такого человека нет, а новый логин — от 3 до 20 символов: латиница, цифры и _.'); db.close(); process.exit(1); }
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname)) { console.log('Этот логин занят.'); db.close(); process.exit(1); }
    code = links.create({ createdBy: from?.id ?? null, fromConsole: true, username: uname });
    console.log(`Новый вход «${uname}»: по ссылке человек сам придумает пароль и станет супер-админом.`);
  }
  console.log(`${publicUrl}/#super=${code}`);
  console.log(`Действует 7 дней, один раз${from ? `, приглашает ${from.display_name}` : ''}.`);
  db.close();
} else {
  console.log('Команды: invite | help-code <логин, телефон или номер> | superadmin <логин> (пароль — ASKA_PASSWORD или stdin) | super-link <вход или новый логин>');
  process.exit(1);
}
