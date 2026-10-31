// Девятое обновление: «Бизнес» — рабочие разделы контактов (Команда, Работа, Бизнес, Партнёры),
// рабочие групповые чаты (закрытые, со своим разделом), позвать людей в чат; Аська рассказала о стилях.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { askaScripted } from '../server/src/personas.js';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, randomBytes } from '../client/src/lib/crypto.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0, wallReactChance: 0, batyaCardChance: 0, wallEmojiChance: 0, askaReactChance: 0 };

async function start() {
  const s = { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v9-')) };
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

async function register(s, invite, displayName, password) {
  const kp = generateKeyPair();
  const salt = randomBytes(16);
  const { encKey, authKey } = await deriveFromPassword(password, salt);
  const r = await s.call('POST', '/api/register', { body: { invite, displayName, boxPk: toB64(kp.pk), kdfSalt: toB64(salt), authKey: toB64(authKey), backup: sealSecret(kp.sk, encKey) } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}

test('рабочие разделы контактов и рабочие чаты', async () => {
  const S = await start();
  try {
    const liza = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(null), 'Артём', 'пароль артёма');
    const nika = await register(S, S.app.createInvite(null), 'Ника', 'пароль ники');
    const maks = await register(S, S.app.createInvite(null), 'Макс', 'пароль макса');
    await S.app.bots.idle();

    // разделы «Бизнеса» — это группы контактов; чужие слова не принимаются
    for (const [u, g] of [[artem, 'team'], [nika, 'biz'], [maks, 'partners']]) {
      const r = await S.call('POST', '/api/groups', { token: liza.token, body: { userId: u.userId, group: g } });
      assert.equal(r.status, 200);
      assert.equal(r.data.groups[u.userId], g);
    }
    assert.equal((await S.call('POST', '/api/groups', { token: liza.token, body: { userId: artem.userId, group: 'boss' } })).status, 400);
    assert.equal((await S.call('POST', '/api/groups', { token: liza.token, body: { userId: artem.userId, group: 'work' } })).data.groups[artem.userId], 'work');
    const st = (await S.call('GET', '/api/state', { token: liza.token })).data;
    assert.equal(st.groups[nika.userId], 'biz');
    assert.equal((await S.call('GET', '/api/state', { token: artem.token })).data.groups[liza.userId], 'meet', 'группы у каждого свои');

    // рабочий чат: всегда закрытый, со своим разделом; неизвестный раздел — нельзя
    const c = await S.call('POST', '/api/circles', { token: liza.token, body: { title: 'Отдел продаж', emoji: '💼', memberIds: [artem.userId], isPublic: true, biz: 'work' } });
    assert.equal(c.status, 200);
    assert.equal(c.data.chat.biz, 'work');
    assert.equal(c.data.chat.isPublic, false, 'рабочий чат не бывает открытым');
    assert.equal((await S.call('POST', '/api/circles', { token: liza.token, body: { title: 'x', biz: 'party' } })).status, 400);
    const chatId = c.data.chat.id;
    const artemState = (await S.call('GET', '/api/state', { token: artem.token })).data;
    assert.equal(artemState.chats.find((x) => x.id === chatId)?.biz, 'work', 'участник видит раздел чата');
    // в списке кругов рабочий чат помечен — приложение прячет его из «Кругов»
    assert.equal((await S.call('GET', '/api/circles', { token: liza.token })).data.circles.find((x) => x.id === chatId)?.biz, 'work');
    assert.ok(!(await S.call('GET', '/api/circles', { token: nika.token })).data.circles.some((x) => x.id === chatId), 'чужим его не видно');
    // обычный круг — без раздела
    const plain = await S.call('POST', '/api/circles', { token: liza.token, body: { title: 'Дача', isPublic: false } });
    assert.equal(plain.data.chat.biz, undefined);

    // позвать людей может участник; чужой — нет
    const add = await S.call('POST', `/api/circles/${chatId}/members`, { token: artem.token, body: { userIds: [maks.userId] } });
    assert.equal(add.status, 200);
    assert.ok(add.data.chat.members.some((m) => m.userId === maks.userId));
    assert.equal((await S.call('POST', `/api/circles/${chatId}/members`, { token: nika.token, body: { userIds: [nika.userId] } })).status, 404);
    assert.equal((await S.call('POST', `/api/circles/${chatId}/members`, { token: liza.token, body: { userIds: [] } })).status, 400);
    const aska = st.users.find((u) => u.kind === 'aska').id;
    const botTry = await S.call('POST', `/api/circles/${chatId}/members`, { token: liza.token, body: { userIds: [aska] } });
    assert.equal(botTry.status, 400, 'Аську и ботов в рабочий чат не зовут');
    assert.ok((await S.call('GET', '/api/state', { token: maks.token })).data.chats.some((x) => x.id === chatId), 'новенький видит чат');

    // Аська рассказала о стилях и «Бизнесе» записью на своей стене
    const news = (await S.call('GET', `/api/wall/${aska}`, { token: liza.token })).data.posts.find((p) => p.text.includes('Бизнес'));
    assert.ok(news, 'запись об обновлении');
  } finally {
    await S.app.close();
    fs.rmSync(S.dataDir, { recursive: true, force: true });
  }
});

test('Аська подсказывает про «Бизнес» и стили', () => {
  assert.ok(askaScripted('как вести рабочие чаты с коллегами?', {})[0].includes('Бизнес'));
  assert.ok(askaScripted('где поменять стиль?', {})[0].includes('Ночь'));
  assert.ok(!askaScripted('какая у вас система номеров?', {})[0].includes('Ночь'), '«система» — не про тему оформления');
});
