import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
const socket = process.env.SOCKET; // на сервере слушаем сокет, к нему ходит общий Caddy
const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const staticDir = path.resolve(process.env.STATIC_DIR || 'client/dist');
const publicUrl = (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');

// ASKA_FAKE_AI=1 — заготовки вместо Claude, только для проверки на своём компьютере
const aiImpl = process.env.ASKA_FAKE_AI === '1' ? (await import('./fake-ai.js')).fakeAi : undefined;
const { server, db, createInvite } = createApp({ dataDir, staticDir, publicUrl, trustProxy: Boolean(socket), aiImpl });

function ready(where) {
  console.log(`АСЬКА: ${publicUrl} (${where}, данные в ${dataDir})`);
  const users = db.prepare("SELECT COUNT(*) AS n FROM users WHERE kind = 'human'").get().n;
  const invites = db.prepare('SELECT COUNT(*) AS n FROM invites WHERE used_by IS NULL').get().n;
  if (!users && !invites) {
    const code = createInvite(null);
    console.log(`Первое приглашение: ${publicUrl}/#invite=${code}  (код ${code})`);
  }
}

if (socket) {
  fs.rmSync(socket, { force: true });
  server.listen(socket, () => {
    fs.chmodSync(socket, 0o666);
    ready(`слушаю ${socket}`);
  });
} else {
  server.listen(port, host, () => ready(`слушаю ${host}:${port}`));
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
