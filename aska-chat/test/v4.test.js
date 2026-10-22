// Четвёртое обновление: Аська пишет админам и пригласившему о новичке, опрос о вечеринке зумеров
// (кто был, оценка 1–10, отзыв), новые ИИ-люди появляются сами, у каждого свой темп переписки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { setSetting } from '../server/src/db.js';
import { PEOPLE, parseParty } from '../server/src/personas.js';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, fromB64, randomBytes } from '../client/src/lib/crypto.ts';
import { encodeOutgoing, decodeIncoming, decodePreview } from '../client/src/lib/protocol.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0 };

async function start({ ai, dataDir } = {}) {
  const s = { dataDir: dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v4-')), pushes: [], aiCalls: [] };
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

test('опрос без «мозга»: разбор ответа про вечеринку', () => {
  assert.deepEqual(parseParty('да, 9/10'), { attended: 'yes', rating: 9, comment: '' });
  assert.deepEqual(parseParty('нет'), { attended: 'no', rating: 0, comment: '' });
  assert.deepEqual(parseParty('не, не был'), { attended: 'no', rating: 0, comment: '' });
  assert.equal(parseParty('была! 8 из 10, музыка огонь').rating, 8);
  assert.equal(parseParty('была! 8 из 10, музыка огонь').comment, 'была! 8 из 10, музыка огонь');
  assert.equal(parseParty('восемь').rating, 8);
  assert.equal(parseParty('в 2 ночи всё только началось, 9/10').rating, 9, 'оценка «из 10» важнее других чисел');
  assert.equal(parseParty('привет как дела').attended, 'unknown');
});

test('новичок: Аська пишет админам и тому, кто позвал; опрос о вечеринке по шпаргалке', async () => {
  const S = await start();
  try {
    const admin = await register(S, S.app.createInvite(null), 'Админ', 'пароль админа');
    const friend = await register(S, S.app.createInvite(null), 'Друг', 'пароль друга');
    const aska = await askaOf(S, admin);
    await S.app.bots.idle();
    assert.ok((await texts(S, admin, dmId(aska, admin.userId))).some((t) => t.startsWith('🆕 В АСЬКЕ новый человек: Друг')), 'админ узнал о новичке');

    // Друг зовёт третьего — ему и админу приходит весточка, админу пушем
    await S.call('POST', '/api/push/subscribe', { token: admin.token, body: { endpoint: 'https://web.push.apple.com/admin', keys: { p256dh: 'x', auth: 'y' } } });
    S.pushes.length = 0;
    const code = (await S.call('POST', '/api/invites', { token: friend.token })).data.code;
    const third = await register(S, code, 'Третий', 'пароль третьего');
    await S.app.bots.idle();
    const toFriend = await texts(S, friend, dmId(aska, friend.userId));
    assert.ok(toFriend.some((t) => t.startsWith('🎉 Третий') && t.includes('по твоему приглашению') && t.includes('+50')), 'пригласивший узнал и получил аськоины');
    const toAdmin = await texts(S, admin, dmId(aska, admin.userId));
    assert.ok(toAdmin.some((t) => t.startsWith('🆕 В АСЬКЕ новый человек: Третий') && t.includes('позвал(а) Друг')));
    const p = S.pushes.find((x) => x.s === aska && x.c === dmId(aska, admin.userId));
    assert.ok(p, 'админу пришёл пуш');
    assert.match(decodePreview(p.pn, p.pc, fromB64(p.spk), admin.kp.sk), /новый человек: Третий/);
    assert.ok(!toFriend.some((t) => t.startsWith('🆕')), 'обычному человеку о чужих новичках не пишем');

    // Опрос: Аська спрашивает новичка, понимает ответ и записывает
    const dm3 = dmId(aska, third.userId);
    assert.ok((await texts(S, third, dm3)).some((t) => t.includes('вечеринке зумеров')), 'Аська спросила про вечеринку');
    await send(S, third, dm3, 'да! 9/10, музыка огонь');
    await S.app.bots.idle();
    assert.ok((await texts(S, third, dm3)).includes('Записала: 9/10 🎉 Спасибо!'));
    await send(S, friend, dmId(aska, friend.userId), 'не, не был');
    await S.app.bots.idle();
    assert.ok((await texts(S, friend, dmId(aska, friend.userId))).some((t) => t.startsWith('Поняла! Тогда в следующий раз')));
    // Тот, кто был без оценки, получает вопрос об оценке
    await send(S, admin, dmId(aska, admin.userId), 'да, была');
    await S.app.bots.idle();
    assert.ok((await texts(S, admin, dmId(aska, admin.userId))).some((t) => t.includes('какую оценку')));
    await send(S, admin, dmId(aska, admin.userId), '7');
    await S.app.bots.idle();
    assert.ok((await texts(S, admin, dmId(aska, admin.userId))).includes('Записала: 7/10 🎉 Спасибо!'));

    // Админу — сводка ответов и таблица в «Управлении АСЬКОЙ»
    const digest = (await texts(S, admin, dmId(aska, admin.userId))).filter((t) => t.startsWith('🎉 Вечеринка зумеров — новые ответы')).join('\n');
    assert.ok(digest.includes('Третий — 9/10 «да! 9/10, музыка огонь»') && digest.includes('Друг — не был(а)'), digest);
    assert.ok(!digest.includes('Админ —'), 'свой ответ себе не пересылаем');
    const party = (await S.call('GET', '/api/admin', { token: admin.token })).data.party;
    assert.equal(party.asked, 3);
    assert.equal(party.went, 2);
    assert.equal(party.rated, 2);
    assert.equal(party.avg, 8);
    assert.deepEqual(party.votes.map((v) => [v.name, v.attended, v.rating]), [['Третий', true, 9], ['Админ', true, 7], ['Друг', false, null]]);
    assert.equal(party.votes[0].comment, 'да! 9/10, музыка огонь');
    assert.equal((await S.call('GET', '/api/admin', { token: friend.token })).status, 403, 'результаты — только админам');
  } finally {
    await stop(S);
  }
});

test('с «мозгом»: Аська собирает оценку через ИИ, Рома пишет тому, кто был на вечеринке', async () => {
  const ai = (req) => {
    const p = req.schema.properties;
    if (p.reply) return { reply: 'Привет!' };
    if (p.attended) {
      const yes = /Друг: был, оценка 10/.test(req.prompt);
      return { messages: [yes ? 'Ого, 10! Записала 🎉' : 'Ну как тебе?'], note: '', attended: yes ? 'yes' : 'unknown', rating: yes ? 10 : 0, comment: yes ? 'лучшая тусовка' : '' };
    }
    if (p.facts) return { messages: ['Запомню!'], facts: [] };
    if (p.forward) return { messages: ['Ок'], forward: '', ask_owner: '' };
    return { messages: [req.system.includes('Рома') ? 'о, привет) мы ж виделись на вечеринке...' : 'привет'], note: '' };
  };
  const S = await start({ ai });
  try {
    const admin = await register(S, S.app.createInvite(null), 'Админ', 'пароль админа');
    assert.equal((await S.call('POST', '/api/admin/people', { token: admin.token, body: { on: true } })).data.people, true);
    const friend = await register(S, S.app.createInvite(null), 'Друг', 'пароль друга');
    const aska = await askaOf(S, friend);
    await S.app.bots.idle();
    await send(S, friend, dmId(aska, friend.userId), 'был, оценка 10 — лучшая тусовка');
    await S.app.bots.idle();
    const call = S.aiCalls.find((c) => c.schema.properties.attended);
    assert.ok(call.prompt.includes('спросила его в этой переписке про вечеринку зумеров'), 'Аська помнит, что спрашивала');
    assert.ok((await texts(S, friend, dmId(aska, friend.userId))).includes('Ого, 10! Записала 🎉'));
    const party = (await S.call('GET', '/api/admin', { token: admin.token })).data.party;
    assert.deepEqual(party.votes.map((v) => [v.name, v.rating, v.comment]), [['Друг', 10, 'лучшая тусовка'], ['Админ', null, '']], 'админа спросили, он пока молчит');

    // Рома_незнакомец пишет первым — «мы же знакомы»
    const st = await S.call('GET', '/api/state', { token: friend.token });
    const roma = st.data.users.find((u) => u.displayName === 'Рома_незнакомец');
    assert.ok(roma && roma.kind === 'human', 'Рома выглядит как обычный человек');
    await S.app.bots.idle();
    assert.ok((await texts(S, friend, dmId(roma.id, friend.userId))).includes('о, привет) мы ж виделись на вечеринке...'));
    const hello = S.aiCalls.find((c) => c.system.includes('Рома') && c.prompt.includes('тоже был(а) на вечеринке зумеров'));
    assert.ok(hello, 'Рома знает, что человек был на вечеринке');
    assert.ok(hello.system.includes('не слежка'), 'у Ромы есть границы роли');
    await send(S, friend, dmId(aska, friend.userId), 'а какая средняя оценка?');
    await S.app.bots.idle();
    assert.ok(S.aiCalls.find((c) => c.system.includes('Ты — Аська') && c.prompt.includes('средняя 10 из 10')), 'Аська знает средний балл');
  } finally {
    await stop(S);
  }
});

test('новые ИИ-люди из кода появляются сами и здороваются; Рома отвечает не сразу', async () => {
  const S = await start({ ai: () => ({ messages: ['всем привет'], note: '' }) });
  const admin = await register(S, S.app.createInvite(null), 'Админ', 'пароль админа');
  // как будто ИИ-люди были включены ещё до Ромы, Вики и Гоши
  setSetting(S.app.db, 'people', '1');
  setSetting(S.app.db, 'people_announced', '1');
  await stop(S, true);
  const R = await start({ ai: () => ({ messages: ['всем привет'], note: '' }), dataDir: S.dataDir });
  try {
    await R.app.bots.idle();
    const st = await R.call('GET', '/api/state', { token: admin.token });
    const names = st.data.users.filter((u) => u.kind === 'human' && u.id !== admin.userId).map((u) => u.displayName);
    assert.equal(names.length, PEOPLE.length);
    for (const n of ['Рома_незнакомец', 'Вика 🍒', 'Гоша']) assert.ok(names.includes(n), n);
    const intro = R.aiCalls.filter((c) => c.prompt.includes('Ты только что появился(ась) в АСЬКЕ'));
    assert.equal(intro.length, PEOPLE.length, 'каждый новенький поздоровался в своём круге');
    const per = PEOPLE.find((p) => p.key === 'roma');
    assert.ok(per.pace > 1 && per.typing > 1, 'Рома отвечает и печатает медленнее');
  } finally {
    await stop(R);
  }
});
