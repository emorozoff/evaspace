// Седьмое обновление: «+» на записи — реакции, аськоины автору, гифки-мемы, «убрать для себя»;
// живые Аська и ИИ-люди на стенах и в личке без «мозга».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { PERSON_POSTS, ASKA_WALL, WALL_COMMENTS } from '../server/src/personas.js';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, fromB64, randomBytes } from '../client/src/lib/crypto.ts';
import { encodeOutgoing, decodeIncoming } from '../client/src/lib/protocol.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0, wallReactChance: 0, batyaCardChance: 0, wallEmojiChance: 0, askaReactChance: 0 };

async function start({ ai, dataDir } = {}) {
  const s = { dataDir: dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v7-')), pushes: [], aiCalls: [] };
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

// крошечный настоящий JPEG (1×1)
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const coins = async (s, me) => (await s.call('GET', '/api/state', { token: me.token })).data.profile.coins;
async function upload(s, me, buf, type = 'image/jpeg') {
  const res = await fetch(`${s.base}/api/wall/photo`, { method: 'POST', headers: { authorization: `Bearer ${me.token}`, 'content-type': type }, body: buf });
  return { status: res.status, data: await res.json().catch(() => null) };
}


test('реакции, аськоины автору, гифки, «убрать для себя»', async () => {
  const S = await start();
  try {
    const liza = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(null), 'Артём', 'пароль артёма');
    const nika = await register(S, S.app.createInvite(null), 'Ника', 'пароль ники');
    await S.app.bots.idle();
    const post = (await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'text', text: 'привет!' } })).data.post;
    // реакция: одна от человека, можно сменить, та же — снять
    let r = await S.call('POST', `/api/wall/posts/${post.id}/react`, { token: nika.token, body: { emoji: '🔥' } });
    assert.deepEqual(r.data.reactions, { '🔥': 1 });
    r = await S.call('POST', `/api/wall/posts/${post.id}/react`, { token: liza.token, body: { emoji: '🔥' } });
    r = await S.call('POST', `/api/wall/posts/${post.id}/react`, { token: nika.token, body: { emoji: '😂' } });
    assert.deepEqual(r.data.reactions, { '🔥': 1, '😂': 1 });
    assert.equal(r.data.myReaction, '😂');
    r = await S.call('POST', `/api/wall/posts/${post.id}/react`, { token: nika.token, body: { emoji: '😂' } });
    assert.deepEqual(r.data.reactions, { '🔥': 1 }, 'та же реакция ещё раз — снята');
    assert.equal((await S.call('POST', `/api/wall/posts/${post.id}/react`, { token: nika.token, body: { emoji: '🍕' } })).status, 400);
    // аськоины автору: из своих, автору прибавляется, себе нельзя, больше, чем есть, — нельзя
    const a0 = await coins(S, artem), n0 = await coins(S, nika);
    const t = await S.call('POST', `/api/wall/posts/${post.id}/tip`, { token: nika.token, body: { amount: 10 } });
    assert.equal(t.status, 200);
    assert.equal(t.data.tips, 10);
    assert.equal(await coins(S, nika), n0 - 10);
    assert.equal(await coins(S, artem), a0 + 10);
    assert.equal((await S.call('POST', `/api/wall/posts/${post.id}/tip`, { token: artem.token, body: { amount: 5 } })).status, 400, 'себе нельзя');
    assert.equal((await S.call('POST', `/api/wall/posts/${post.id}/tip`, { token: nika.token, body: { amount: 7 } })).status, 400, 'только 5, 10, 25, 50');
    S.app.db.prepare('UPDATE users SET coins = 3 WHERE id = ?').run(nika.userId);
    assert.equal((await S.call('POST', `/api/wall/posts/${post.id}/tip`, { token: nika.token, body: { amount: 5 } })).status, 402);
    const feed = (await S.call('GET', '/api/wall/feed', { token: liza.token })).data.posts.find((p) => p.id === post.id);
    assert.equal(feed.tips, 10);
    assert.deepEqual(feed.reactions, { '🔥': 1 });
    assert.equal(feed.myReaction, '🔥');
    // гифка-мем: комментарием и записью
    const c = await S.call('POST', `/api/wall/posts/${post.id}/comments`, { token: nika.token, body: { text: '', sticker: 'oru' } });
    assert.equal(c.data.comment.sticker, 'oru');
    assert.equal((await S.call('POST', `/api/wall/posts/${post.id}/comments`, { token: nika.token, body: { sticker: 'nope' } })).status, 400);
    const sp = await S.call('POST', `/api/wall/${artem.userId}`, { token: liza.token, body: { kind: 'sticker', sticker: 'tusa', text: 'в пятницу!' } });
    assert.equal(sp.data.post.sticker, 'tusa');
    assert.equal((await S.call('POST', `/api/wall/${artem.userId}`, { token: liza.token, body: { kind: 'sticker', sticker: 'nope' } })).status, 400);
    // Артёму — весточка о подарке
    await S.app.bots.idle();
    const aska = await askaOf(S, artem);
    assert.ok((await texts(S, artem, dmId(aska, artem.userId))).some((m) => m.includes('Ника подарил(а) тебе 10 🪙 за запись')));

    // «убрать для себя»: Лиза убирает Нику — её записей и комментариев не видно, на стену Лизы она не пишет
    assert.equal((await S.call('POST', '/api/hides', { token: liza.token, body: { userId: liza.userId, on: true } })).status, 400);
    const h = await S.call('POST', '/api/hides', { token: liza.token, body: { userId: nika.userId, on: true } });
    assert.deepEqual(h.data.hidden, [nika.userId]);
    assert.deepEqual((await S.call('GET', '/api/state', { token: liza.token })).data.hidden, [nika.userId]);
    await S.call('POST', `/api/wall/${artem.userId}`, { token: nika.token, body: { kind: 'text', text: 'запись Ники' } });
    const lf = (await S.call('GET', '/api/wall/feed', { token: liza.token })).data.posts;
    assert.ok(!lf.some((p) => p.authorId === nika.userId), 'записи Ники Лизе не видны');
    assert.ok(!lf.find((p) => p.id === post.id).comments.some((x) => x.authorId === nika.userId), 'и комментарии');
    assert.ok((await S.call('GET', '/api/wall/feed', { token: artem.token })).data.posts.some((p) => p.authorId === nika.userId), 'другим видно');
    assert.equal((await S.call('POST', `/api/wall/${liza.userId}`, { token: nika.token, body: { kind: 'text', text: 'эй' } })).status, 400, 'на стену Лизы — нельзя');
    await S.call('POST', '/api/hides', { token: liza.token, body: { userId: nika.userId, on: false } });
    assert.ok((await S.call('GET', '/api/wall/feed', { token: liza.token })).data.posts.some((p) => p.authorId === nika.userId), 'вернула — снова видно');
  } finally {
    await stop(S);
  }
});

test('живые Аська и ИИ-люди: реакции и комментарии на стенах, записи у себя, знакомство в личке', async () => {
  const S = await start();
  try {
    const me = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    await S.call('POST', '/api/admin/people', { token: me.token, body: { on: true } });
    await S.app.bots.idle();
    const users = (await S.call('GET', '/api/state', { token: me.token })).data.users;
    const aska = users.find((u) => u.kind === 'aska').id;
    // Аська у себя на стене: раз в день, по очереди из заготовок
    S.app.bots.proactive(true);
    await S.app.bots.idle();
    const aw = (await S.call('GET', `/api/wall/${aska}`, { token: me.token })).data.posts;
    assert.ok(aw.some((p) => ASKA_WALL.includes(p.text)), 'Аська написала у себя на стене');
    // ИИ-люди пишут у себя из своих заготовок
    const ppl = users.filter((u) => u.kind === 'human' && u.id !== me.userId);
    const all = (await S.call('GET', '/api/wall/feed', { token: me.token })).data.posts;
    assert.ok(all.some((p) => ppl.some((u) => u.id === p.authorId) && Object.values(PERSON_POSTS).flat().includes(p.text)), 'ИИ-человек написал у себя');
    // и сам знакомится в личке
    const dms = (await S.call('GET', '/api/state', { token: me.token })).data.chats.filter((c) => c.kind === 'dm' && c.members.some((m) => ppl.some((u) => u.id === m.userId)));
    assert.ok(dms.length >= 1, 'кто-то из ИИ-людей написал первым');
    const opener = (await read(S, me, dms[0].id))[0];
    assert.ok(opener && opener.text, 'первое сообщение есть');
  } finally {
    await stop(S);
  }
  // запись человека: ИИ-люди и Аська реагируют и комментируют (шансы — на всё)
  const S2 = await start();
  try {
    const me = await register(S2, S2.app.createInvite(null), 'Лиза', 'пароль лизы');
    await S2.call('POST', '/api/admin/people', { token: me.token, body: { on: true } });
    await S2.app.bots.idle();
    const post = (await S2.call('POST', `/api/wall/${me.userId}`, { token: me.token, body: { kind: 'text', text: 'всем привет!' } })).data.post;
    // по умолчанию в проверках шансы нулевые — вызываем дела вручную, как сделал бы бот
    const ppl = (await S2.call('GET', '/api/state', { token: me.token })).data.users.filter((u) => u.kind === 'human' && u.id !== me.userId);
    const aska = await askaOf(S2, me);
    for (const id of [ppl[0].id, aska]) S2.app.db.prepare("INSERT INTO bot_jobs (due_at, kind, bot_id, chat_id, payload, created_at) VALUES (0, 'wall_react', ?, ?, ?, 0)").run(id, `wr:${post.id}:${id}`, JSON.stringify({ postId: post.id }));
    await S2.app.bots.idle();
    const got = (await S2.call('GET', `/api/wall/${me.userId}`, { token: me.token })).data.posts.find((p) => p.id === post.id);
    assert.ok(Object.values(got.reactions).reduce((a, b) => a + b, 0) >= 2, 'реакции от ИИ-человека и Аськи');
    assert.ok(got.comments.some((c) => c.authorId === aska), 'Аська прокомментировала');
    const personComment = got.comments.find((c) => c.authorId === ppl[0].id);
    if (personComment) assert.ok(personComment.sticker || WALL_COMMENTS.text.some((w) => personComment.text.toLowerCase().startsWith(w.replace(/\(.*?\)/, '').toLowerCase().slice(0, 3))));
  } finally {
    await stop(S2);
  }
});
