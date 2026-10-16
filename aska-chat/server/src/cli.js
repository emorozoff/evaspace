// Создать приглашение из консоли сервера: node server/src/cli.js invite
import path from 'node:path';
import { openDb } from './db.js';
import { createInvite, formatInvite } from './app.js';

const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:8080').replace(/\/$/, '');
const [cmd] = process.argv.slice(2);

if (cmd === 'invite') {
  const db = openDb(dataDir);
  const code = formatInvite(createInvite(db, null));
  console.log(`${publicUrl}/#invite=${code}`);
  console.log(`Код: ${code}`);
  db.close();
} else {
  console.log('Команды: invite');
  process.exit(1);
}
