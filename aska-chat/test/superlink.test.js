// Ссылка супер-админа: админ (или консоль) создаёт одноразовую ссылку на вход — существующий или новый.
// По ней человек входит своим паролем, задаёт новый или придумывает пароль для нового входа — и становится супер-админом.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createApp } from '../server/src/app.js';
import { isGoldCode } from '../server/src/plates.js';
import { generateKeyPair, deriveFromPassword, sealSecret, openSecret, toB64, fromB64, randomBytes } from '../client/src/lib/crypto.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true };

function mk(dataDir) {
  const s = { dataDir };
  s.app = createApp({ dataDir, publicUrl: 'http://localhost', log: () => {}, botTiming: TIMING });
  s.listen = () => new Promise((r) => s.app.server.listen(0, '127.0.0.1', () => { s.base = `http://127.0.0.1:${s.app.server.address().port}`; r(); }));
  s.call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body) headers['content-type'] = 'application/json';
    const res = await fetch(s.base + url, { method, headers, body: body && JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return s;
}
async function keysFor(password) {
  const kp = generateKeyPair();
  const salt = randomBytes(16);
  const { encKey, authKey } = await deriveFromPassword(password, salt);
  return { kp, body: { boxPk: toB64(kp.pk), kdfSalt: toB64(salt), authKey: toB64(authKey), backup: sealSecret(kp.sk, encKey) } };
}
async function register(s, invite, displayName, password, phone) {
  const k = await keysFor(password);
  const r = await s.call('POST', '/api/register', { body: { invite, displayName, phone, ...k.body } });
  return { ...r.data, status: r.status };
}
async function login(s, name, password) {
  const { data: { salt } } = await s.call('GET', `/api/salt?login=${encodeURIComponent(name)}`);
  const { authKey, encKey } = await deriveFromPassword(password, fromB64(salt));
  const r = await s.call('POST', '/api/login', { body: { login: name, authKey: toB64(authKey) } });
  return { ...r, encKey };
}
const userOf = async (s, viewer, id) => (await s.call('GET', '/api/state', { token: viewer.token })).data.users.find((u) => u.id === id);

let S;
const U = {};
before(async () => {
  S = mk(fs.mkdtempSync(path.join(os.tmpdir(), 'aska-slink-')));
  await S.listen();
  U.boss = await register(S, S.app.createInvite(null), 'Егор', 'пароль егора', '+79170000001');
  for (const [k, name, phone] of [['kirill', 'Кирилл', '+79170000002'], ['ann', 'Аня', '+79170000003']]) {
    const inv = (await S.call('POST', '/api/invites', { token: U.boss.token })).data.code;
    U[k] = await register(S, inv, name, `пароль ${k}`, phone);
  }
});
after(async () => {
  await S.app.close();
  fs.rmSync(S.dataDir, { recursive: true, force: true });
});

test('ссылка на существующий вход: войти своим паролем → супер-админ, ссылка одноразовая', async () => {
  assert.equal((await S.call('POST', '/api/admin/super-link', { token: U.ann.token, body: { login: U.kirill.username } })).status, 403, 'не админ — нельзя');
  const made = await S.call('POST', '/api/admin/super-link', { token: U.boss.token, body: { login: U.kirill.plate } });
  assert.equal(made.status, 200, JSON.stringify(made.data));
  assert.match(made.data.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(made.data.target.displayName, 'Кирилл');

  const info = await S.call('GET', `/api/super-link/${made.data.code}`);
  assert.deepEqual([info.data.exists, info.data.displayName, info.data.invitedBy, info.data.username], [true, 'Кирилл', 'Егор', U.kirill.username]);

  // чужой вход ссылку не примет
  assert.equal((await S.call('POST', '/api/super-link/claim', { token: U.ann.token, body: { code: made.data.code } })).status, 401);
  const kir = await login(S, U.kirill.username, 'пароль kirill');
  const claim = await S.call('POST', '/api/super-link/claim', { token: kir.data.token, body: { code: made.data.code.toLowerCase() } });
  assert.equal(claim.status, 200, JSON.stringify(claim.data));
  const k = await userOf(S, U.boss, U.kirill.userId);
  assert.equal(k.gold, true);
  assert.ok(isGoldCode('RU', k.plate), 'золотой номер АМР');
  assert.equal((await S.call('GET', '/api/admin', { token: kir.data.token })).data.me.role, 'super');
  assert.equal((await S.call('GET', `/api/super-link/${made.data.code}`)).status, 404, 'второй раз не работает');
  assert.equal((await S.call('POST', '/api/super-link/claim', { token: kir.data.token, body: { code: made.data.code } })).status, 404);
  U.kirill.token = kir.data.token;
});

test('после появления супер-админа ссылки от обычного админа не действуют; супер-админ зовёт нового по логину', async () => {
  assert.equal((await S.call('POST', '/api/admin/super-link', { token: U.boss.token, body: { login: 'new_super' } })).status, 409, 'админ — только пока супер-админа нет');
  assert.equal((await S.call('POST', '/api/admin/super-link', { token: U.kirill.token, body: { login: 'плохой логин' } })).status, 400);
  assert.equal((await S.call('POST', '/api/admin/super-link', { token: U.kirill.token, body: { login: U.boss.username } })).status, 200, 'существующий человек');
  const made = await S.call('POST', '/api/admin/super-link', { token: U.kirill.token, body: { login: 'New_Super' } });
  assert.equal(made.status, 200, JSON.stringify(made.data));
  assert.equal(made.data.target, null);
  assert.equal(made.data.username, 'new_super');
  const info = (await S.call('GET', `/api/super-link/${made.data.code}`)).data;
  assert.deepEqual([info.exists, info.username, info.invitedBy], [false, 'new_super', 'Кирилл']);

  assert.equal((await S.call('POST', '/api/super-link/claim', { body: { code: made.data.code, displayName: 'Кирилл Ю' } })).status, 400, 'без ключей нельзя');
  const k = await keysFor('новый пароль кирилла');
  const claim = await S.call('POST', '/api/super-link/claim', { body: { code: made.data.code, displayName: 'Кирилл Ю', ...k.body } });
  assert.equal(claim.status, 200, JSON.stringify(claim.data));
  assert.ok(claim.data.token);
  const again = await login(S, 'new_super', 'новый пароль кирилла');
  assert.equal(again.status, 200);
  assert.ok(openSecret(again.data.backup, again.encKey), 'ключ открывается паролем');
  const nu = await userOf(S, U.boss, claim.data.userId);
  assert.equal(nu.gold, true);
  assert.equal(nu.displayName, 'Кирилл Ю');
  assert.ok(isGoldCode('RU', nu.plate));
});

test('ссылка на существующий вход, пароль забыт: новый пароль и новые ключи', async () => {
  const made = (await S.call('POST', '/api/admin/super-link', { token: U.kirill.token, body: { login: '+79170000003' } })).data;
  assert.equal(made.target.displayName, 'Аня');
  // повторная ссылка на тот же вход отменяет прежнюю
  const made2 = (await S.call('POST', '/api/admin/super-link', { token: U.kirill.token, body: { login: U.ann.username } })).data;
  assert.equal((await S.call('GET', `/api/super-link/${made.code}`)).status, 404, 'старая ссылка отменена');
  const k = await keysFor('новый пароль ани');
  const claim = await S.call('POST', '/api/super-link/claim', { body: { code: made2.code, ...k.body } });
  assert.equal(claim.status, 200, JSON.stringify(claim.data));
  assert.equal((await S.call('GET', '/api/state', { token: U.ann.token })).status, 401, 'прежние входы закрыты');
  assert.equal((await login(S, U.ann.username, 'пароль ann')).status, 401, 'старый пароль не подходит');
  assert.equal((await login(S, U.ann.username, 'новый пароль ани')).status, 200);
  assert.equal((await userOf(S, U.boss, U.ann.userId)).gold, true);
});

test('супер-админа может снять или заблокировать только другой супер-админ', async () => {
  assert.equal((await S.call('POST', `/api/admin/users/${U.ann.userId}/block`, { token: U.boss.token, body: { blocked: true } })).status, 403, 'админ — нет');
  assert.equal((await S.call('POST', `/api/admin/users/${U.kirill.userId}/role`, { token: U.kirill.token, body: { role: 'user' } })).status, 403, 'себя — нет');
  assert.equal((await S.call('POST', `/api/admin/users/${U.ann.userId}/role`, { token: U.kirill.token, body: { role: 'user' } })).status, 200);
  const ann = await userOf(S, U.boss, U.ann.userId);
  assert.equal(ann.gold, false);
  assert.ok(!isGoldCode('RU', ann.plate));
});

test('из консоли: ссылка супер-админа от имени первого админа', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aska-slink-cli-'));
  let s = mk(dir);
  await s.listen();
  const egor = await register(s, s.app.createInvite(null), 'Егор', 'пароль егора', '+79170000011');
  const inv = (await s.call('POST', '/api/invites', { token: egor.token })).data.code;
  const kir = await register(s, inv, 'Кирилл', 'пароль кирилла', '+79170000012');
  await s.app.close();

  const run = (...a) => execFileSync('node', ['--disable-warning=ExperimentalWarning', 'server/src/cli.js', 'super-link', ...a],
    { env: { ...process.env, DATA_DIR: dir, PUBLIC_URL: 'https://aska.example' } }).toString();
  const out = run(kir.username);
  const code = /https:\/\/aska\.example\/#super=([A-Z0-9-]+)/.exec(out)?.[1];
  assert.ok(code, out);
  assert.match(out, /приглашает Егор/);
  const outNew = run('new_super');
  assert.match(outNew, /Новый вход «new_super»/);

  s = mk(dir);
  await s.listen();
  const info = (await s.call('GET', `/api/super-link/${code}`)).data;
  assert.deepEqual([info.exists, info.displayName, info.invitedBy], [true, 'Кирилл', 'Егор']);
  const k = await login(s, kir.username, 'пароль кирилла');
  assert.equal((await s.call('POST', '/api/super-link/claim', { token: k.data.token, body: { code } })).status, 200);
  assert.equal((await s.call('GET', '/api/admin', { token: k.data.token })).data.me.role, 'super');
  // ссылка из консоли действует и когда супер-админ уже есть
  const code2 = /#super=([A-Z0-9-]+)/.exec(outNew)[1];
  const nk = await keysFor('пароль нового');
  assert.equal((await s.call('POST', '/api/super-link/claim', { body: { code: code2, displayName: 'Кирилл', ...nk.body } })).status, 200);
  assert.equal((await login(s, 'new_super', 'пароль нового')).status, 200);
  await s.app.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
