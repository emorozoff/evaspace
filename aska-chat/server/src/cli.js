// Команды из консоли сервера:
//   node server/src/cli.js invite                  — приглашение
//   node server/src/cli.js help-code <вход>         — код для входа, если человек (в том числе администратор)
//                                                    забыл пароль, а СМС не подключены. <вход> — логин, телефон или номер АСЬКИ
import path from 'node:path';
import { openDb, getSetting } from './db.js';
import { createInvite, formatInvite } from './app.js';
import { createCodes, normalizePhone, looksLikePhone } from './phone.js';
import { normalizePlate, formatPlate } from './plates.js';

const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:8080').replace(/\/$/, '');
const [cmd, ...args] = process.argv.slice(2);

function findHuman(db, login) {
  const s = String(login || '').trim();
  const q = (col, v) => (v ? db.prepare(`SELECT * FROM users WHERE kind = 'human' AND ${col} = ?`).get(v) : null);
  return (looksLikePhone(s) && q('phone', normalizePhone(s))) || q('plate', normalizePlate(s)) || q('username', s.toLowerCase()) || null;
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
    for (const r of db.prepare("SELECT username, display_name, plate FROM users WHERE kind = 'human' ORDER BY id").all()) console.log(`  ${r.display_name} — логин ${r.username}, номер ${formatPlate(r.plate)}`);
    db.close();
    process.exit(1);
  }
  const code = createCodes({ db, secret: getSetting(db, 'secret') }).issueHelp(u.id);
  console.log(`${u.display_name} (логин ${u.username}, номер ${formatPlate(u.plate)})`);
  console.log(`Код для входа: ${code} — действует сутки. На экране входа: «Не помню пароль» → «Телефон не привязан».`);
  db.close();
} else {
  console.log('Команды: invite | help-code <логин, телефон или номер>');
  process.exit(1);
}
