// Пятое обновление: Батя (ИИ-друг, 100 вопросов), статусы, группы контактов, состояние «мозга»,
// шлюз и прокси для Claude.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { BATYA_QUESTIONS, STATUSES, batyaScripted } from '../server/src/personas.js';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, fromB64, randomBytes } from '../client/src/lib/crypto.ts';
import { encodeOutgoing, decodeIncoming } from '../client/src/lib/protocol.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0 };

async function start({ ai, dataDir } = {}) {
  const s = { dataDir: dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v5-')), pushes: [], aiCalls: [] };
  s.app = createApp({
    dataDir: s.dataDir, publicUrl: 'http://localhost', log: () => {}, botTiming: TIMING,
    pushSender: async (sub, payload) => { s.pushes.push(JSON.parse(payload)); },
    aiImpl: ai ? async (req) => { s.aiCalls.push(req); return ai(req); } : undefined,
  });
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
const stop = async (s, keep) => { await s.app.close(); if (!keep) fs.rmSync(s.dataDir, { recursive: true, force: true }); };

async function register(s, invite, displayName, password) {
  const kp = generateKeyPair();
  const salt = randomBytes(16);
  const { encKey, authKey } = await deriveFromPassword(password, salt);
  const r = await s.call('POST', '/api/register', { body: { invite, displayName, boxPk: toB64(kp.pk), kdfSalt: toB64(salt), authKey: toB64(authKey), backup: sealSecret(kp.sk, encKey) } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { ...r.data, kp };
}

async function read(s, me, chatId) {
  const st = await s.call('GET', '/api/state', { token: me.token });
  const users = Object.fromEntries(st.data.users.map((u) => [u.id, u]));
  const sync = await s.call('GET', '/api/sync?after=0', { token: me.token });
  return sync.data.messages.filter((m) => m.chatId === chatId).map((m) => {
    const u = users[m.senderId];
    const body = [u.boxPk, ...(u.prevPks || [])].map((pk) => decodeIncoming(m, fromB64(pk), me.kp.sk)).find(Boolean);
    return { senderId: m.senderId, text: body?.text ?? null };
  });
}

async function send(s, me, chatId, text) {
  const st = await s.call('GET', '/api/state', { token: me.token });
  const chat = st.data.chats.find((c) => c.id === chatId);
  const users = Object.fromEntries(st.data.users.map((u) => [u.id, u]));
  const members = chat.members.map((m) => ({ id: m.userId, pk: fromB64(users[m.userId].boxPk) }));
  const uuid = `u-${Math.random().toString(36).slice(2, 12)}`;
  const boxes = encodeOutgoing(chatId, uuid, { kind: 'text', text }, members, me.userId, me.kp.sk);
  return s.call('POST', '/api/messages', { token: me.token, body: { chatId, uuid, boxes } });
}

const dmId = (a, b) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`;
const askaOf = async (s, me) => (await s.call('GET', '/api/state', { token: me.token })).data.users.find((u) => u.kind === 'aska').id;
const texts = async (s, me, chatId) => (await read(s, me, chatId)).map((m) => m.text || '');

const batyaOf = async (s, me) => (await s.call('GET', '/api/state', { token: me.token })).data.users.find((u) => u.kind === 'friend');

test('Батя: сто разных вопросов и ответы по шпаргалке', () => {
  assert.equal(BATYA_QUESTIONS.length, 100);
  assert.equal(new Set(BATYA_QUESTIONS).size, 100, 'вопросы не повторяются');
  assert.ok(BATYA_QUESTIONS.some((q) => /маме/i.test(q)) && BATYA_QUESTIONS.some((q) => /личном фронте/.test(q)) && BATYA_QUESTIONS.some((q) => /покушать/i.test(q)));
  assert.match(batyaScripted('я сегодня не успела поесть', 'Q?')[0], /поешь/);
  assert.match(batyaScripted('мне очень плохо и одиноко', 'Q?').join(' '), /112/);
  assert.match(batyaScripted('привет', null)[0], /Здорово/);
  assert.ok(STATUSES.some((x) => x.text === 'медитирую') && STATUSES.some((x) => x.text === 'вджобываю') && STATUSES.some((x) => x.text === 'смотрю кинч'));
});

test('Батя знакомится с новичком, отвечает без «мозга» и раз в день проведывает', async () => {
  const S = await start();
  try {
    const me = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    await S.app.bots.idle();
    const batya = await batyaOf(S, me);
    assert.ok(batya, 'Батя есть у всех');
    assert.equal(batya.displayName, 'Батя');
    assert.ok(batya.status?.emoji && batya.status.text, 'у Бати статус по часам');
    assert.ok(batya.plate, 'и номер');
    const dm = dmId(batya.id, me.userId);
    const hello = await texts(S, me, dm);
    assert.equal(hello.length, 1, 'знакомится одним сообщением — один пуш');
    assert.ok(hello[0].startsWith('Здорово, Лиза! Это Батя 👋'));
    assert.ok(hello.some((t) => t.includes('покушать')));
    // без «мозга» — по шпаргалке
    await send(S, me, dm, 'не успела поесть, некогда');
    await S.app.bots.idle();
    assert.ok((await texts(S, me, dm)).some((t) => t.includes('поешь чего-нибудь горячего')));
    // в «Кто здесь ИИ?» Батю угадывать нельзя — он и так ИИ
    assert.equal((await S.call('POST', '/api/guess', { token: me.token, body: { userId: batya.id, guess: 'ai' } })).status, 400);
    // раз в день сам пишет вопрос из ста (сегодня уже знакомился — завтра)
    S.app.db.prepare('DELETE FROM settings WHERE key LIKE ?').run('batya_day:%');
    S.app.db.prepare('UPDATE messages SET created_at = created_at - 86400000 WHERE chat_id = ?').run(dm);
    S.app.bots.proactive(true);
    await S.app.bots.idle();
    const after = await texts(S, me, dm);
    const asked = after[after.length - 1];
    assert.ok(BATYA_QUESTIONS.some((q) => asked.endsWith(q)), asked);
    // второй раз за день — не пишет
    S.app.db.prepare("DELETE FROM settings WHERE key = 'batya_plan'").run();
    S.app.bots.proactive(true);
    await S.app.bots.idle();
    assert.equal((await texts(S, me, dm)).length, after.length);
  } finally {
    await stop(S);
  }
});

test('Батя с «мозгом» говорит своим голосом и запоминает', async () => {
  const ai = (req) => {
    const p = req.schema.properties;
    if (p.reply) return { reply: 'Привет!' };
    if (p.facts) return { messages: ['Запомню!'], facts: [] };
    if (p.forward) return { messages: ['Ок'], forward: '', ask_owner: '' };
    if (p.attended) return { messages: ['Ок'], note: '', attended: 'unknown', rating: 0, comment: '' };
    return { messages: [req.system.startsWith('Ты — Батя') ? 'Ну молодец, что написал. Суп ел?' : 'привет'], note: req.system.startsWith('Ты — Батя') ? 'учится на юриста' : '' };
  };
  const S = await start({ ai });
  try {
    const me = await register(S, S.app.createInvite(null), 'Артём', 'пароль артёма');
    await S.app.bots.idle();
    const batya = await batyaOf(S, me);
    const dm = dmId(batya.id, me.userId);
    await send(S, me, dm, 'привет, бать! я тут сессию сдаю');
    await S.app.bots.idle();
    assert.ok((await texts(S, me, dm)).includes('Ну молодец, что написал. Суп ел?'));
    const call = S.aiCalls.find((c) => c.system.startsWith('Ты — Батя') && c.prompt.includes('сессию сдаю'));
    assert.ok(call, 'Батя думает своими правилами');
    assert.match(call.prompt, /Артём/);
    const notes = S.app.db.prepare('SELECT notes FROM bot_notes WHERE bot_id = ? AND user_id = ?').get(batya.id, me.userId).notes;
    assert.match(notes, /юриста/);
  } finally {
    await stop(S);
  }
});

test('статусы: готовые, свои, снять; у ботов — сами', async () => {
  const S = await start({ ai: () => ({ messages: [], note: '' }) });
  try {
    const me = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const friend = await register(S, S.app.createInvite(null), 'Ника', 'пароль ники');
    const statusOf = async (who, id) => (await S.call('GET', '/api/state', { token: who.token })).data.users.find((u) => u.id === id).status;
    let r = await S.call('POST', '/api/me/status', { token: me.token, body: { key: 'meditate' } });
    assert.equal(r.status, 200);
    assert.deepEqual({ ...(await statusOf(friend, me.userId)), at: 0 }, { emoji: '🧘', text: 'медитирую', at: 0 });
    r = await S.call('POST', '/api/me/status', { token: me.token, body: { emoji: '🎬', text: 'смотрю кинч с подружками' } });
    assert.equal((await statusOf(friend, me.userId)).text, 'смотрю кинч с подружками');
    assert.equal((await S.call('POST', '/api/me/status', { token: me.token, body: { key: 'nope' } })).status, 400);
    assert.equal((await S.call('POST', '/api/me/status', { token: me.token, body: { emoji: 'abc', text: 'x' } })).status, 400, 'вместо эмодзи — буквы');
    assert.equal((await S.call('POST', '/api/me/status', { token: me.token, body: { text: 'x'.repeat(41) } })).status, 400);
    await S.call('POST', '/api/me/status', { token: me.token, body: {} });
    assert.equal(await statusOf(friend, me.userId), undefined, 'снят');
    // Аська всегда на связи, ИИ-люди — по расписанию
    const users = (await S.call('GET', '/api/state', { token: me.token })).data.users;
    assert.equal(users.find((u) => u.kind === 'aska').status.text, 'на связи 24/7');
    await S.call('POST', '/api/admin/people', { token: me.token, body: { on: true } });
    const ppl = (await S.call('GET', '/api/state', { token: me.token })).data.users.filter((u) => u.kind === 'human' && u.id !== me.userId && u.id !== friend.userId);
    assert.ok(ppl.length > 5 && ppl.some((u) => u.status), 'у ИИ-людей бывают статусы');
  } finally {
    await stop(S);
  }
});

test('группы контактов: ближний круг для своих, перенос, только люди', async () => {
  const S = await start();
  try {
    const a = await register(S, S.app.createInvite(null), 'Аня', 'пароль ани');
    const b = await register(S, (await S.call('POST', '/api/invites', { token: a.token })).data.code, 'Борис', 'пароль бориса');
    const c = await register(S, S.app.createInvite(null), 'Вера', 'пароль веры');
    const groups = async (who) => (await S.call('GET', '/api/state', { token: who.token })).data.groups;
    assert.equal((await groups(a))[b.userId], 'close', 'кого позвал — в ближнем круге');
    assert.equal((await groups(b))[a.userId], 'close', 'кто позвал — тоже');
    assert.equal((await groups(a))[c.userId], 'meet');
    const r = await S.call('POST', '/api/groups', { token: a.token, body: { userId: c.userId, group: 'work' } });
    assert.equal(r.data.groups[c.userId], 'work');
    assert.equal((await groups(a))[c.userId], 'work');
    assert.equal((await groups(c))[a.userId], 'meet', 'у каждого свои группы');
    assert.equal((await S.call('POST', '/api/groups', { token: a.token, body: { userId: c.userId, group: 'family' } })).status, 400);
    const aska = await askaOf(S, a);
    assert.equal((await S.call('POST', '/api/groups', { token: a.token, body: { userId: aska, group: 'work' } })).status, 400, 'Аська всегда в ИИ-друзьях');
    assert.equal((await S.call('POST', '/api/groups', { token: a.token, body: { userId: a.userId, group: 'work' } })).status, 400);
  } finally {
    await stop(S);
  }
});

test('«мозг»: видно снаружи и голд, шлюз и прокси без паролей в ответе', async () => {
  const S = await start();
  try {
    const admin = await register(S, S.app.createInvite(null), 'Админ', 'пароль админа');
    const user = await register(S, S.app.createInvite(null), 'Юзер', 'пароль юзера');
    const health = (await S.call('GET', '/api/health')).data;
    assert.deepEqual(health.brain, { key: false, people: false, today: 0, ok: null });
    assert.deepEqual((await S.call('GET', '/api/state', { token: admin.token })).data.brain, { key: false, people: false, error: '' });
    assert.equal((await S.call('GET', '/api/state', { token: user.token })).data.brain, undefined, 'обычным людям не показываем');
    assert.equal((await S.call('POST', '/api/admin/ai', { token: admin.token, body: { baseUrl: 'ftp://x' } })).status, 400);
    assert.equal((await S.call('POST', '/api/admin/ai', { token: admin.token, body: { proxy: 'не ссылка' } })).status, 400);
    const r = await S.call('POST', '/api/admin/ai', { token: admin.token, body: { baseUrl: 'https://gw.example.com/anthropic/', proxy: 'http://user:secret@1.2.3.4:3128' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.ai.baseUrl, 'https://gw.example.com/anthropic');
    assert.ok(!JSON.stringify(r.data).includes('secret'), 'пароль прокси наружу не уходит');
    assert.match(r.data.ai.proxy, /1\.2\.3\.4:3128/);
    const cleared = await S.call('POST', '/api/admin/ai', { token: admin.token, body: { baseUrl: '', proxy: '' } });
    assert.equal(cleared.data.ai.baseUrl, '');
    assert.equal(cleared.data.ai.proxy, '');
    assert.equal((await S.call('POST', '/api/admin/ai', { token: user.token, body: { baseUrl: 'https://x.y' } })).status, 403);
  } finally {
    await stop(S);
  }
});
