// Сквозная проверка сервера вместе с шифрованием клиента: регистрация, сообщения, пуши, вход с паролем.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createApp } from '../server/src/app.js';
import {
  generateKeyPair, deriveFromPassword, sealSecret, openSecret, toB64, fromB64, randomBytes,
  publicFromSecret, encryptFile, decryptFile, safetyCode,
} from '../client/src/lib/crypto.ts';
import { encodeOutgoing, decodeIncoming, decodePreview } from '../client/src/lib/protocol.ts';

let srv, base, dataDir;
const pushes = [];

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svoi-test-'));
  srv = createApp({
    dataDir,
    publicUrl: 'http://localhost',
    pushSender: async (sub, payload) => { pushes.push({ endpoint: sub.endpoint, data: JSON.parse(payload) }); },
    log: () => {},
  });
  await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.server.address().port}`;
});

after(async () => {
  await srv.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function call(method, url, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  if (raw) headers['content-type'] = 'application/octet-stream';
  const res = await fetch(base + url, { method, headers, body: raw || (body && JSON.stringify(body)) });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer());
  return { status: res.status, data };
}

async function register(invite, username, displayName, password) {
  const kp = generateKeyPair();
  const salt = randomBytes(16);
  const { encKey, authKey } = await deriveFromPassword(password, salt);
  const backup = sealSecret(kp.sk, encKey);
  const r = await call('POST', '/api/register', {
    body: { invite, username, displayName, boxPk: toB64(kp.pk), kdfSalt: toB64(salt), authKey: toB64(authKey), backup },
  });
  return { ...r, kp };
}

function connect(token, visible) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws?token=${token}&visible=${visible ? 1 : 0}`);
    ws.inbox = [];
    ws.on('message', (d) => ws.inbox.push(JSON.parse(d.toString())));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

const waitFor = async (fn, ms = 2000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timeout');
};

const U = {};

test('регистрация по приглашениям', async () => {
  const first = srv.createInvite(null);
  const check = await call('GET', `/api/invites/${first.toLowerCase()}`);
  assert.equal(check.status, 200);

  const a = await register(first, 'Alice', 'Алиса', 'пароль алисы 1');
  assert.equal(a.status, 200, JSON.stringify(a.data));
  U.alice = { ...a.data, kp: a.kp, password: 'пароль алисы 1' };

  const again = await register(first, 'alice2', 'Алиса 2', 'x'.repeat(10));
  assert.equal(again.status, 404, 'приглашение одноразовое');

  const inv = await call('POST', '/api/invites', { token: U.alice.token });
  assert.match(inv.data.code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const taken = await register(inv.data.code, 'alice', 'Ещё Алиса', 'x'.repeat(10));
  assert.equal(taken.status, 409, 'имя занято');

  const b = await register(inv.data.code, 'bob', 'Боря', 'пароль бори 2');
  assert.equal(b.status, 200);
  U.bob = { ...b.data, kp: b.kp, password: 'пароль бори 2' };

  const inv2 = await call('POST', '/api/invites', { token: U.bob.token });
  const c = await register(inv2.data.code, 'carol', 'Катя', 'пароль кати 3');
  assert.equal(c.status, 200);
  U.carol = { ...c.data, kp: c.kp };

  const st = await call('GET', '/api/state', { token: U.alice.token });
  assert.equal(st.data.users.length, 3);
  assert.equal(st.data.users[0].username, 'alice');
  const general = st.data.chats.find((x) => x.id === 'general');
  assert.equal(general.members.length, 3);
  assert.ok(st.data.vapidPublicKey);
});

test('без входа ничего не отдаётся', async () => {
  assert.equal((await call('GET', '/api/state')).status, 401);
  assert.equal((await call('GET', '/api/state', { token: 'fake' })).status, 401);
  assert.equal((await call('POST', '/api/messages', { body: {} })).status, 401);
  assert.equal((await call('POST', '/api/read', { body: {} })).status, 401);
  assert.equal((await call('POST', '/api/push/subscribe', { body: {} })).status, 401);
});

test('сообщение в общий чат: доставка, расшифровка, пуш с превью', async () => {
  const bobWs = await connect(U.bob.token, false);   // Боря свернул приложение — ему нужен пуш
  const carolWs = await connect(U.carol.token, true); // Катя сидит в приложении — пуш не нужен

  const sub = await call('POST', '/api/push/subscribe', {
    token: U.bob.token, body: { endpoint: 'https://web.push.apple.com/test-bob', keys: { p256dh: 'x', auth: 'y' } },
  });
  assert.equal(sub.status, 200);
  const evil = await call('POST', '/api/push/subscribe', {
    token: U.bob.token, body: { endpoint: 'https://evil.example.com/', keys: { p256dh: 'x', auth: 'y' } },
  });
  assert.equal(evil.status, 400, 'чужие адреса для пушей не принимаем');

  const members = [U.alice, U.bob, U.carol].map((u) => ({ id: u.userId, pk: u.kp.pk }));
  const boxes = encodeOutgoing('general', 'uuid-0001', { kind: 'text', text: 'Привет всем!' }, members, U.alice.userId, U.alice.kp.sk);

  const bad = await call('POST', '/api/messages', { token: U.alice.token, body: { chatId: 'general', uuid: 'uuid-0000', boxes: boxes.slice(0, 2) } });
  assert.equal(bad.status, 409, 'если кого-то забыли — сервер не принимает');

  const sent = await call('POST', '/api/messages', { token: U.alice.token, body: { chatId: 'general', uuid: 'uuid-0001', boxes } });
  assert.equal(sent.status, 200);
  U.firstMsg = sent.data.id;

  const dup = await call('POST', '/api/messages', { token: U.alice.token, body: { chatId: 'general', uuid: 'uuid-0001', boxes } });
  assert.equal(dup.data.id, sent.data.id, 'повторная отправка не создаёт дубль');

  for (const [ws, me] of [[bobWs, U.bob], [carolWs, U.carol]]) {
    const ev = await waitFor(() => ws.inbox.find((e) => e.type === 'msg'));
    const body = decodeIncoming(ev.m, U.alice.kp.pk, me.kp.sk);
    assert.equal(body.text, 'Привет всем!');
    assert.equal(decodeIncoming(ev.m, U.alice.kp.pk, U.alice.kp.sk), null, 'чужую копию открыть нельзя');
  }

  await waitFor(() => pushes.length);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(pushes.length, 1, 'пуш только тому, кто не в приложении');
  const p = pushes[0].data;
  assert.equal(p.c, 'general');
  assert.equal(p.s, U.alice.userId);
  assert.equal(p.b, 1, 'счётчик непрочитанных');
  assert.equal(decodePreview(p.pn, p.pc, U.alice.kp.pk, U.bob.kp.sk), 'Привет всем!');
  assert.ok(!JSON.stringify(p).includes('Привет'), 'в пуше нет открытого текста');

  const read = await call('POST', '/api/read', { token: U.bob.token, body: { chatId: 'general', upTo: U.firstMsg } });
  assert.equal(read.data.badge, 0);
  await waitFor(() => carolWs.inbox.find((e) => e.type === 'read' && e.userId === U.bob.userId));

  bobWs.close();
  carolWs.close();
});

test('кто в сети: видно в состоянии и приходит событием', async () => {
  const aliceWs = await connect(U.alice.token, true);
  const before = await call('GET', '/api/state', { token: U.alice.token });
  assert.ok(before.data.online.includes(U.alice.userId));
  // Новый человек заходит — Алисе приходит событие «в сети»
  const inv = await call('POST', '/api/invites', { token: U.alice.token });
  const dan = await register(inv.data.code, 'dan', 'Даня', 'пароль дани 4');
  const danWs = await connect(dan.data.token, true);
  await waitFor(() => aliceWs.inbox.find((e) => e.type === 'presence' && e.userId === dan.data.userId && e.online));
  const st = await call('GET', '/api/state', { token: U.alice.token });
  assert.ok(st.data.online.includes(dan.data.userId));
  aliceWs.close();
  danWs.close();
});

test('сервер не может перенести сообщение в другой чат', async () => {
  const sync = await call('GET', '/api/sync?after=0', { token: U.bob.token });
  const row = sync.data.messages[0];
  assert.ok(decodeIncoming(row, U.alice.kp.pk, U.bob.kp.sk));
  assert.equal(decodeIncoming({ ...row, chatId: 'dm:1:2' }, U.alice.kp.pk, U.bob.kp.sk), null);
  assert.equal(decodeIncoming(row, U.carol.kp.pk, U.bob.kp.sk), null, 'подделать отправителя нельзя');
});

test('личный чат виден только двоим', async () => {
  const dm = await call('POST', '/api/chats/dm', { token: U.alice.token, body: { userId: U.bob.userId } });
  assert.equal(dm.data.chat.id, `dm:${U.alice.userId}:${U.bob.userId}`);
  const members = [U.alice, U.bob].map((u) => ({ id: u.userId, pk: u.kp.pk }));
  const boxes = encodeOutgoing(dm.data.chat.id, 'uuid-dm-1', { kind: 'text', text: 'секрет' }, members, U.alice.userId, U.alice.kp.sk);
  assert.equal((await call('POST', '/api/messages', { token: U.alice.token, body: { chatId: dm.data.chat.id, uuid: 'uuid-dm-1', boxes } })).status, 200);

  const carolPost = await call('POST', '/api/messages', { token: U.carol.token, body: { chatId: dm.data.chat.id, uuid: 'uuid-dm-2', boxes } });
  assert.equal(carolPost.status, 403);
  const carolSync = await call('GET', '/api/sync?after=0', { token: U.carol.token });
  assert.equal(carolSync.data.messages.length, 1, 'Катя видит только общий чат');
  const carolState = await call('GET', '/api/state', { token: U.carol.token });
  assert.equal(carolState.data.chats.length, 1);
});

test('вход на новом телефоне: пароль восстанавливает ключ', async () => {
  const { data: { salt } } = await call('GET', '/api/salt?username=bob');
  const { authKey, encKey } = await deriveFromPassword(U.bob.password, fromB64(salt));
  const login = await call('POST', '/api/login', { body: { username: 'bob', authKey: toB64(authKey) } });
  assert.equal(login.status, 200);
  const sk = openSecret(login.data.backup, encKey);
  assert.deepEqual(publicFromSecret(sk), U.bob.kp.pk);

  const wrong = await deriveFromPassword('не тот пароль', fromB64(salt));
  assert.equal((await call('POST', '/api/login', { body: { username: 'bob', authKey: toB64(wrong.authKey) } })).status, 401);

  const fake = await call('GET', '/api/salt?username=nobody');
  assert.equal(fake.status, 200, 'для несуществующего имени тоже есть «соль»');
  assert.equal(fake.data.salt, (await call('GET', '/api/salt?username=nobody')).data.salt);
});

test('фото: шифруется на телефоне, сервер хранит шифр', async () => {
  const photo = randomBytes(5000);
  const f = encryptFile(photo);
  const up = await call('POST', '/api/blobs', { token: U.alice.token, raw: f.ct });
  assert.equal(up.status, 200);
  const stored = fs.readFileSync(path.join(dataDir, 'blobs', up.data.id));
  assert.notDeepEqual(new Uint8Array(stored), photo);
  const down = await call('GET', `/api/blobs/${up.data.id}`, { token: U.bob.token });
  assert.deepEqual(decryptFile(down.data, f.key, f.nonce, f.hash), photo);
  const tampered = down.data.slice();
  tampered[40] ^= 1;
  assert.equal(decryptFile(tampered, f.key, f.nonce, f.hash), null);
  assert.equal((await call('GET', `/api/blobs/${up.data.id}`)).status, 401);
});

test('код безопасности стабилен и разный у разных людей', () => {
  assert.match(safetyCode(U.alice.kp.pk), /^\d{4} \d{4} \d{4} \d{4} \d{4}$/);
  assert.equal(safetyCode(U.alice.kp.pk), safetyCode(U.alice.kp.pk));
  assert.notEqual(safetyCode(U.alice.kp.pk), safetyCode(U.bob.kp.pk));
});
