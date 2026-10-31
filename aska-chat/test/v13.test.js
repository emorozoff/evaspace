// Тринадцатое обновление: комнаты — сообщества по интересам, как группы ВКонтакте (вступить, участники, лента),
// вход и посты бесплатные; темы — мото, пенное, предприниматели, «поплачь сюда» и другие.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { ROOMS, NIGHT_BOTS, CATEGORIES, COLLECTION_SIZE, isNightRoom } from '../server/src/night-data.js';
import { askaScripted } from '../server/src/personas.js';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, randomBytes } from '../client/src/lib/crypto.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0, wallReactChance: 0, batyaCardChance: 0, wallEmojiChance: 0, askaReactChance: 0, nightTickMs: 0 };

async function start() {
  const s = { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v13-')) };
  s.app = createApp({ dataDir: s.dataDir, publicUrl: 'http://localhost', log: () => {}, botTiming: TIMING, pushSender: async () => {} });
  await new Promise((r) => s.app.server.listen(0, '127.0.0.1', r));
  s.base = `http://127.0.0.1:${s.app.server.address().port}`;
  s.call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body) headers['content-type'] = 'application/json';
    const res = await fetch(s.base + url, { method, headers, body: body && JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return s;
}
const stop = async (s) => { await s.app.close(); fs.rmSync(s.dataDir, { recursive: true, force: true }); };
async function register(s, invite, displayName, password) {
  const kp = generateKeyPair();
  const salt = randomBytes(16);
  const { encKey, authKey } = await deriveFromPassword(password, salt);
  const r = await s.call('POST', '/api/register', { body: { invite, displayName, boxPk: toB64(kp.pk), kdfSalt: toB64(salt), authKey: toB64(authKey), backup: sealSecret(kp.sk, encKey) } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}

test('темы комнат: у каждой — категория, обложка, описание и свои постояльцы; бренды не используются', () => {
  const cats = new Set(CATEGORIES.map((c) => c.key));
  assert.ok(ROOMS.length >= 19, `комнат ${ROOMS.length}`);
  assert.equal(new Set(ROOMS.map((r) => r.key)).size, ROOMS.length, 'ключи не повторяются');
  for (const r of ROOMS) {
    assert.ok(cats.has(r.cat), `${r.key}: категория ${r.cat}`);
    assert.equal(r.cover?.length, 2, `${r.key}: обложка`);
    assert.ok(r.short && r.short.length <= 90, `${r.key}: короткое описание`);
    assert.ok(r.about && r.emoji && r.title, `${r.key}: о комнате`);
    assert.ok(NIGHT_BOTS.filter((b) => b.room === r.key).length >= 3, `${r.key}: постояльцы`);
    assert.ok(NIGHT_BOTS.filter((b) => b.room === r.key && b.president).length <= 1, `${r.key}: не больше одного президента`); // в «Портале» президент — первый человек АСЬКИ
  }
  for (const k of ['moto', 'beer', 'biz', 'whine']) assert.ok(ROOMS.find((r) => r.key === k), `есть «${k}»`);
  assert.equal(isNightRoom('matrix'), true);
  assert.equal(isNightRoom('moto'), false);
  // постояльцы тематических комнат — вне коллекции пиксельных аватаров
  assert.ok(NIGHT_BOTS.filter((b) => !isNightRoom(b.room)).every((b) => b.id > COLLECTION_SIZE));
  assert.equal(new Set(NIGHT_BOTS.map((b) => b.id)).size, NIGHT_BOTS.length);
  assert.equal(new Set(NIGHT_BOTS.map((b) => b.nick)).size, NIGHT_BOTS.length, 'ники постояльцев разные');
  const text = JSON.stringify(ROOMS).toLowerCase();
  for (const brand of ['harley', 'харли', 'дэвидсон', 'девидсон']) assert.ok(!text.includes(brand), `без бренда «${brand}»`);
  // в «Поплачь сюда» — телефоны помощи
  assert.match(ROOMS.find((r) => r.key === 'whine').about, /8-800-2000-122/);
});

test('комнаты как группы ВК: вступить и выйти бесплатно, «Мои», участники, лента, лимит постов', async () => {
  const S = await start();
  try {
    const boss = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const vera = await register(S, S.app.createInvite(boss.userId), 'Вера', 'пароль веры');
    const coins0 = S.app.db.prepare('SELECT coins FROM users WHERE id = ?').get(vera.userId).coins;
    const ov = (await S.call('GET', '/api/night', { token: vera.token })).data;
    assert.equal(ov.free, true);
    assert.deepEqual(ov.categories.map((c) => c.key), CATEGORIES.map((c) => c.key));
    const moto = ov.rooms.find((r) => r.key === 'moto');
    assert.equal(moto.joined, false);
    assert.equal(moto.cat, 'hobby');
    assert.equal(moto.members, NIGHT_BOTS.filter((b) => b.room === 'moto').length, 'сначала в комнате только постояльцы');
    assert.ok(moto.cover && moto.short);
    // вступить — бесплатно
    const j = await S.call('POST', '/api/night/rooms/moto/join', { token: vera.token });
    assert.equal(j.status, 200, JSON.stringify(j.data));
    assert.equal(j.data.joined, true);
    assert.equal(j.data.members, moto.members + 1);
    assert.equal((await S.call('POST', '/api/night/rooms/moto/join', { token: vera.token })).data.members, moto.members + 1, 'повторно — не удваивается');
    assert.equal((await S.call('POST', '/api/night/rooms/nope/join', { token: vera.token })).status, 404);
    const ov2 = (await S.call('GET', '/api/night', { token: vera.token })).data;
    assert.deepEqual(ov2.rooms.filter((r) => r.joined).map((r) => r.key), ['moto'], 'вкладка «Мои»');
    // страница комнаты: участники и лента
    const page = (await S.call('GET', '/api/night/rooms/moto', { token: vera.token })).data;
    assert.equal(page.joined, true);
    assert.equal(page.members, moto.members + 1);
    assert.ok(page.messages.length >= 3, 'в ленте уже есть записи постояльцев');
    assert.ok(page.faces.length >= 1, 'лица участников');
    // пишет под своим именем — в другой комнате, и сразу вступает
    const p = await S.call('POST', '/api/night/rooms/beer/messages', { token: vera.token, body: { text: 'Кто за светлое?' } });
    assert.equal(p.status, 200, JSON.stringify(p.data));
    assert.equal(p.data.message.avatar.nick, 'Вера');
    assert.equal(p.data.message.avatar.userId, vera.userId);
    assert.equal((await S.call('GET', '/api/night/rooms/beer', { token: vera.token })).data.joined, true);
    const beerPage = (await S.call('GET', '/api/night/rooms/beer', { token: boss.token })).data;
    assert.ok(beerPage.faces.some((f) => f.nick === 'Вера'), 'Вера среди лиц участников');
    // не больше 10 постов в минуту
    for (let i = 0; i < 9; i++) assert.equal((await S.call('POST', '/api/night/rooms/beer/messages', { token: vera.token, body: { text: `тост ${i}` } })).status, 200);
    assert.equal((await S.call('POST', '/api/night/rooms/beer/messages', { token: vera.token, body: { text: 'ещё' } })).status, 429);
    // выйти — тоже бесплатно
    const l = await S.call('POST', '/api/night/rooms/moto/leave', { token: vera.token });
    assert.equal(l.data.joined, false);
    assert.equal(l.data.members, moto.members);
    assert.equal(S.app.db.prepare('SELECT coins FROM users WHERE id = ?').get(vera.userId).coins, coins0, 'ни одного аськоина не списалось');
    // заблокированный не вступает
    S.app.db.prepare('UPDATE users SET blocked_at = ? WHERE id = ?').run(Date.now(), vera.userId);
    assert.ok([401, 403].includes((await S.call('POST', '/api/night/rooms/moto/join', { token: vera.token })).status));
  } finally {
    await stop(S);
  }
});

test('Аська рассказывает про комнаты и объявляет обновление на стене', async () => {
  const say = askaScripted('где тут комнаты?', {}).join(' ');
  assert.match(say, /Вступить/);
  assert.match(say, /бесплатн/);
  assert.match(askaScripted('как вступить в круг', {}).join(' '), /Чаты-круги/);
  const S = await start();
  try {
    await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    await new Promise((r) => setTimeout(r, 100));
    const posts = S.app.db.prepare("SELECT text FROM wall_posts WHERE text LIKE '%Комнаты теперь как группы%'").all();
    assert.equal(posts.length, 1, 'объявление один раз');
  } finally {
    await stop(S);
  }
});
