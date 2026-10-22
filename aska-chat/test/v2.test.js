// Вторая версия АСЬКИ: номера, телефоны и СМС, восстановление, круги, «печатает…», личный ИИ,
// Аська и ИИ-люди. Боты шифруют сообщения на сервере — проверяем, что телефон их открывает.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createApp } from '../server/src/app.js';
import { setSetting } from '../server/src/db.js';
import { parsePlate, formatCode } from '../server/src/plates.js';
const normalizePlate = (x) => parsePlate(x, 'RU');
const formatPlate = (c) => formatCode('RU', c);
import { normalizePhone } from '../server/src/phone.js';
import { generateKeyPair, deriveFromPassword, sealSecret, openSecret, toB64, fromB64, randomBytes, publicFromSecret } from '../client/src/lib/crypto.ts';
import { encodeOutgoing, decodeIncoming, decodePreview } from '../client/src/lib/protocol.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 1, chainChance: 0 };

async function start({ sms, ai } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v2-'));
  const s = { dataDir, sms: [], pushes: [], aiCalls: [] };
  s.app = createApp({
    dataDir, publicUrl: 'http://localhost', log: () => {}, botTiming: TIMING,
    pushSender: async (sub, payload) => { s.pushes.push(JSON.parse(payload)); },
    smsSender: sms ? async (phone, text) => { s.sms.push({ phone, text }); } : undefined,
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

async function stop(s) {
  await s.app.close();
  fs.rmSync(s.dataDir, { recursive: true, force: true });
}

async function keysFor(password) {
  const kp = generateKeyPair();
  const salt = randomBytes(16);
  const { encKey, authKey } = await deriveFromPassword(password, salt);
  return { kp, body: { boxPk: toB64(kp.pk), kdfSalt: toB64(salt), authKey: toB64(authKey), backup: sealSecret(kp.sk, encKey) } };
}

async function register(s, invite, displayName, password, extra = {}) {
  const k = await keysFor(password);
  const r = await s.call('POST', '/api/register', { body: { invite, displayName, ...extra, ...k.body } });
  return { ...r, kp: k.kp, password };
}

async function login(s, loginName, password) {
  const { data: { salt } } = await s.call('GET', `/api/salt?login=${encodeURIComponent(loginName)}`);
  const { authKey, encKey } = await deriveFromPassword(password, fromB64(salt));
  const r = await s.call('POST', '/api/login', { body: { login: loginName, authKey: toB64(authKey) } });
  return { ...r, encKey };
}

function connect(s, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${s.base.replace('http', 'ws')}/ws?token=${token}&visible=1`);
    ws.inbox = [];
    ws.on('message', (d) => ws.inbox.push(JSON.parse(d.toString())));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

const waitFor = async (fn, ms = 3000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error('timeout');
};

// Все расшифрованные сообщения человека в одном чате
async function read(s, me, chatId) {
  const st = await s.call('GET', '/api/state', { token: me.token });
  const users = Object.fromEntries(st.data.users.map((u) => [u.id, u]));
  const sync = await s.call('GET', '/api/sync?after=0', { token: me.token });
  return sync.data.messages.filter((m) => m.chatId === chatId).map((m) => {
    const u = users[m.senderId];
    const body = [u.boxPk, ...(u.prevPks || [])].map((pk) => decodeIncoming(m, fromB64(pk), me.kp.sk)).find(Boolean);
    return { senderId: m.senderId, id: m.id, text: body?.text ?? null };
  });
}

async function send(s, me, chatId, body) {
  const st = await s.call('GET', '/api/state', { token: me.token });
  const chat = st.data.chats.find((c) => c.id === chatId);
  const users = Object.fromEntries(st.data.users.map((u) => [u.id, u]));
  const members = chat.members.map((m) => ({ id: m.userId, pk: fromB64(users[m.userId].boxPk) }));
  const uuid = `u-${Math.random().toString(36).slice(2, 12)}`;
  const boxes = encodeOutgoing(chatId, uuid, body, members, me.userId, me.kp.sk);
  return s.call('POST', '/api/messages', { token: me.token, body: { chatId, uuid, boxes } });
}

const dmId = (a, b) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`;

// ---------------------------------------------------------------- без СМС и без ИИ

let A;
const U = {};
before(async () => { A = await start(); });
after(async () => { await stop(A); });

test('номера: разбор и вид', () => {
  assert.equal(normalizePlate('а001мр'), 'А001МР777');
  assert.equal(normalizePlate('A001MP777'), 'А001МР777');
  assert.equal(normalizePlate('АМР-001-777'), 'А001МР777');
  assert.equal(normalizePlate('42'), 'А042МР777');
  assert.equal(normalizePlate('привет'), null);
  assert.equal(formatPlate('А001МР777'), 'А 001 МР 777');
  assert.equal(normalizePhone('8 (999) 123-45-67'), '+79991234567');
  assert.equal(normalizePhone('9991234567'), '+79991234567');
  assert.equal(normalizePhone('123'), null);
});

test('регистрация с телефоном, номер, вход по телефону и номеру', async () => {
  const inv = A.app.createInvite(null);
  const info = await A.call('GET', `/api/invites/${inv}`);
  assert.equal(info.data.sms, false, 'СМС не настроены');
  const e = await register(A, inv, 'Егор', 'пароль егора', { phone: '8 999 111-22-33' });
  assert.equal(e.status, 200, JSON.stringify(e.data));
  assert.equal(e.data.plate, 'А001МР777', 'первому — первый номер');
  U.egor = { ...e.data, kp: e.kp, password: e.password };

  const inv2 = await A.call('POST', '/api/invites', { token: U.egor.token });
  const taken = await register(A, inv2.data.code, 'Тоже Егор', 'пароль 12345', { phone: '+79991112233' });
  assert.equal(taken.status, 409, 'телефон уже занят');
  const m = await register(A, inv2.data.code, 'Маша', 'пароль маши', { phone: '+7 916 000-00-01' });
  assert.equal(m.status, 200);
  assert.match(m.data.plate, /^[А-Я]\d{3}[А-Я]{2}777$/);
  assert.ok(!/^А\d{3}МР/.test(m.data.plate), 'серия АМР — только у голд');
  U.masha = { ...m.data, kp: m.kp, password: m.password };

  for (const name of ['89991112233', '+7 999 111 22 33', 'а001мр', 'А 001 МР 777', '001']) {
    const r = await login(A, name, 'пароль егора');
    assert.equal(r.status, 200, `вход «${name}»`);
    assert.equal(r.data.userId, U.egor.userId);
    assert.deepEqual(publicFromSecret(openSecret(r.data.backup, r.encKey)), U.egor.kp.pk);
  }
  assert.equal((await login(A, '001', 'не тот пароль')).status, 401);
  const fake1 = await A.call('GET', '/api/salt?login=%2B79990000000');
  const fake2 = await A.call('GET', '/api/salt?login=89990000000');
  assert.equal(fake1.data.salt, fake2.data.salt, 'выдуманная соль одинакова для одного номера в разной записи');

  const st = await A.call('GET', '/api/state', { token: U.egor.token });
  assert.equal(st.data.profile.isAdmin, true, 'первый человек — администратор');
  assert.equal(st.data.profile.phone, '+79991112233');
  assert.equal(st.data.profile.phoneVerified, false);
  const aska = st.data.users.find((u) => u.kind === 'aska');
  assert.equal(aska.plate, 'А000МР777');
  U.aska = aska.id;
  const mashaTwin = st.data.users.find((u) => u.kind === 'twin' && u.ownerId === U.masha.userId);
  assert.ok(mashaTwin, 'у Маши есть личный ИИ');
  U.mashaTwin = mashaTwin.id;
  assert.ok(st.data.chats.some((c) => c.id === dmId(U.aska, U.egor.userId)), 'есть беседа с Аськой');
  assert.ok(!st.data.users.some((u) => 'persona' in u || 'bot_sk' in u), 'секреты ботов наружу не уходят');
});

test('Аська встречает новичка и отвечает по шпаргалке без ИИ', async () => {
  await A.app.bots.idle();
  const chat = dmId(U.aska, U.masha.userId);
  const hello = await read(A, U.masha, chat);
  assert.ok(hello.length >= 2, 'приветствие пришло');
  assert.ok(hello.every((m) => m.text), 'сообщения Аськи расшифровываются на телефоне');
  assert.ok(hello.some((m) => m.text.includes(formatPlate(U.masha.plate))), 'Аська называет номер');

  await send(A, U.masha, chat, { kind: 'text', text: 'а что такое круги?' });
  await waitFor(async () => { await A.app.bots.idle(); return (await read(A, U.masha, chat)).some((m) => /Круги — это/.test(m.text)); });
});

test('администратор и обычный человек', async () => {
  assert.equal((await A.call('GET', '/api/admin', { token: U.masha.token })).status, 403);
  const adm = await A.call('GET', '/api/admin', { token: U.egor.token });
  assert.equal(adm.status, 200);
  assert.equal(adm.data.ai.configured, false);
  assert.equal(adm.data.users.length, 2);
  const key = await A.call('POST', '/api/admin/ai', { token: U.egor.token, body: { apiKey: 'sk-ant-test-1234', model: 'claude-haiku-5-5', dailyLimit: 50 } });
  assert.equal(key.data.ai.keyHint, '…1234', 'ключ целиком не возвращается');
  assert.equal(key.data.ai.model, 'claude-haiku-5-5');
  assert.ok(!JSON.stringify(key.data).includes('sk-ant-test-1234'));
  await A.call('POST', '/api/admin/ai', { token: U.egor.token, body: { apiKey: '' } });
  assert.equal((await A.call('POST', '/api/admin/people', { token: U.egor.token, body: { on: true } })).status, 400, 'без ИИ нельзя включить ИИ-людей');
});

test('восстановление по коду от администратора: новый ключ, старые входы закрыты', async () => {
  const code = await A.call('POST', '/api/admin/help-code', { token: U.egor.token, body: { userId: U.masha.userId } });
  assert.match(code.data.code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const k = await keysFor('новый пароль маши');
  const bad = await A.call('POST', '/api/recover', { body: { login: U.masha.plate, helpCode: 'AAAA-BBBB', ...k.body } });
  assert.equal(bad.status, 401);
  const ok = await A.call('POST', '/api/recover', { body: { login: '+79160000001', helpCode: code.data.code.toLowerCase(), ...k.body } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal((await A.call('GET', '/api/state', { token: U.masha.token })).status, 401, 'старый вход больше не работает');
  const again = await A.call('POST', '/api/recover', { body: { login: U.masha.plate, helpCode: code.data.code, ...k.body } });
  assert.equal(again.status, 401, 'код одноразовый');
  const r = await login(A, U.masha.plate, 'новый пароль маши');
  assert.equal(r.status, 200);
  U.masha = { ...U.masha, token: ok.data.token, kp: k.kp };
  const st = await A.call('GET', '/api/state', { token: U.egor.token });
  const masha = st.data.users.find((u) => u.id === U.masha.userId);
  assert.equal(masha.boxPk, toB64(k.kp.pk));
  assert.equal(masha.prevPks.length, 1, 'старый ключ остался в истории — друзья поймут, что это восстановление');
  await A.app.bots.idle();
  const welcomeBack = await read(A, U.masha, dmId(U.aska, U.masha.userId));
  assert.ok(welcomeBack.some((m) => /С возвращением/.test(m.text)));
});

test('профиль, закрепление и «печатает…»', async () => {
  assert.equal((await A.call('POST', '/api/me', { token: U.masha.token, body: { displayName: 'Мария', about: 'люблю горы', city: 'Казань' } })).status, 200);
  const st = await A.call('GET', '/api/state', { token: U.egor.token });
  const masha = st.data.users.find((u) => u.id === U.masha.userId);
  assert.equal(masha.displayName, 'Мария');
  assert.equal(masha.city, 'Казань');
  assert.equal(st.data.users.find((u) => u.id === U.mashaTwin).displayName, 'ИИ · Мария', 'имя личного ИИ следует за хозяином');

  const pins = await A.call('POST', '/api/pins', { token: U.egor.token, body: { userId: U.masha.userId, on: true } });
  assert.deepEqual(pins.data.pins, [U.masha.userId]);

  const dm = await A.call('POST', '/api/chats/dm', { token: U.egor.token, body: { userId: U.masha.userId } });
  const egorWs = await connect(A, U.egor.token);
  const mashaWs = await connect(A, U.masha.token);
  mashaWs.send(JSON.stringify({ type: 'typing', chatId: dm.data.chat.id }));
  mashaWs.send(JSON.stringify({ type: 'typing', chatId: 'general-not-mine' }));
  await waitFor(() => egorWs.inbox.find((e) => e.type === 'typing' && e.userId === U.masha.userId && e.chatId === dm.data.chat.id));
  assert.ok(!mashaWs.inbox.some((e) => e.type === 'typing' && e.userId === U.masha.userId), 'себе не приходит');
  egorWs.close();
  mashaWs.close();

  const phone = await A.call('POST', '/api/me/phone', { token: U.masha.token, body: { phone: '+79991112233' } });
  assert.equal(phone.status, 409, 'чужой телефон нельзя');
});

test('круги: список, вступить, свой круг, выйти', async () => {
  const list = await A.call('GET', '/api/circles', { token: U.masha.token });
  const ids = list.data.circles.map((c) => c.id);
  for (const id of ['general', 'circle:kino', 'circle:music', 'circle:travel', 'circle:food', 'circle:fun', 'circle:q']) assert.ok(ids.includes(id), id);
  assert.equal(list.data.circles.find((c) => c.id === 'general').member, true);
  assert.equal(list.data.circles.find((c) => c.id === 'circle:kino').member, false);

  const join = await A.call('POST', '/api/circles/circle%3Akino/join', { token: U.masha.token });
  assert.equal(join.status, 200);
  assert.ok(join.data.chat.members.some((m) => m.userId === U.masha.userId));
  assert.equal((await send(A, U.masha, 'circle:kino', { kind: 'text', text: 'Что посмотреть вечером?' })).status, 200);

  const mine = await A.call('POST', '/api/circles', { token: U.egor.token, body: { title: 'Дача', emoji: '🏡', about: 'Шашлыки', memberIds: [U.masha.userId, U.aska, U.mashaTwin] } });
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.data.chat.members.map((m) => m.userId).sort(), [U.egor.userId, U.masha.userId].sort(), 'Аську и личный ИИ в круг не добавить');
  const others = await A.call('GET', '/api/circles', { token: U.egor.token });
  assert.ok(others.data.circles.some((c) => c.id === mine.data.chat.id), 'свой закрытый круг виден участникам');

  assert.equal((await A.call('POST', `/api/circles/${encodeURIComponent(mine.data.chat.id)}/leave`, { token: U.masha.token })).status, 200);
  const st = await A.call('GET', '/api/state', { token: U.masha.token });
  assert.ok(!st.data.chats.some((c) => c.id === mine.data.chat.id));
});

test('личный ИИ без ИИ: передаёт комплимент анонимно и вопрос, отвечает хозяин', async () => {
  // Маша пишет ИИ Егора анонимно
  const egorTwin = (await A.call('GET', '/api/twin', { token: U.egor.token })).data.twinId;
  assert.equal((await A.call('POST', '/api/chats/dm', { token: U.masha.token, body: { userId: egorTwin } })).status, 403, 'чужому ИИ — только через выбор открыто/анонимно');
  const anon = await A.call('POST', `/api/twins/${egorTwin}/chat`, { token: U.masha.token, body: { anon: true } });
  assert.equal(anon.status, 200);
  assert.equal(anon.data.chat.twin.anon, true);
  const anonChat = anon.data.chat.id;
  await send(A, U.masha, anonChat, { kind: 'text', text: 'ты лучший!', act: 'compliment' });
  await A.app.bots.idle();
  const ownerChat = dmId(egorTwin, U.egor.userId);
  let inbox = await read(A, U.egor, ownerChat);
  const fwd = inbox.find((m) => m.text?.includes('ты лучший!'));
  assert.ok(fwd, 'комплимент дошёл до Егора');
  assert.match(fwd.text, /анонимно/);
  assert.ok(!fwd.text.includes('Мария'), 'имя не раскрыто');
  const anonReplies = await read(A, U.masha, anonChat);
  assert.ok(anonReplies.some((m) => m.senderId === egorTwin && /Передал/.test(m.text)), 'ИИ подтвердил');

  // Открыто: вопрос
  const open = await A.call('POST', `/api/twins/${egorTwin}/chat`, { token: U.masha.token, body: { anon: false } });
  const openChat = open.data.chat.id;
  assert.notEqual(openChat, anonChat);
  await send(A, U.masha, openChat, { kind: 'text', text: 'Когда шашлыки?', act: 'question' });
  await A.app.bots.idle();
  inbox = await read(A, U.egor, ownerChat);
  const q = inbox.find((m) => m.text?.includes('Когда шашлыки?'));
  assert.ok(q && q.text.includes('Мария'), 'в открытой беседе видно, кто спрашивает');
  assert.ok(inbox.some((m) => /заглянул\(а\) Мария/.test(m.text || '')), 'хозяин знает, кто заходил открыто');

  // Егор отвечает на сообщение с вопросом
  await send(A, U.egor, ownerChat, { kind: 'text', text: 'В субботу!', reply: q.id });
  await A.app.bots.idle();
  const answer = (await read(A, U.masha, openChat)).find((m) => m.text?.includes('В субботу!'));
  assert.ok(answer, 'ответ пришёл Маше');
  const facts = await A.call('GET', '/api/twin', { token: U.egor.token });
  assert.ok(facts.data.facts.some((f) => f.text.includes('В субботу!')), 'ответ запомнился');

  // Егор запрещает анонимные сообщения
  await A.call('POST', '/api/me', { token: U.egor.token, body: { allowAnon: false } });
  const closed = await A.call('POST', `/api/twins/${egorTwin}/chat`, { token: U.masha.token, body: { anon: true } });
  assert.equal(closed.status, 403);

  // Егор учит своего ИИ
  await send(A, U.egor, ownerChat, { kind: 'text', text: 'Я люблю горы и сноуборд' });
  await A.app.bots.idle();
  const learned = await A.call('GET', '/api/twin', { token: U.egor.token });
  assert.ok(learned.data.facts.some((f) => f.text.includes('сноуборд')));
  const fact = learned.data.facts.find((f) => f.text.includes('сноуборд'));
  await A.call('DELETE', `/api/twin/facts/${fact.id}`, { token: U.egor.token });
  assert.ok(!(await A.call('GET', '/api/twin', { token: U.egor.token })).data.facts.some((f) => f.id === fact.id));
});

test('игра «Кто здесь ИИ?»: о людях', async () => {
  const g = await A.call('POST', '/api/guess', { token: U.masha.token, body: { userId: U.egor.userId, guess: 'ai' } });
  assert.deepEqual([g.data.correct, g.data.truth], [false, 'human']);
  const again = await A.call('POST', '/api/guess', { token: U.masha.token, body: { userId: U.egor.userId, guess: 'human' } });
  assert.equal(again.data.already, true, 'второй попытки нет');
  assert.equal((await A.call('POST', '/api/guess', { token: U.masha.token, body: { userId: U.aska, guess: 'ai' } })).status, 400, 'про Аську угадывать нечего');
  const game = await A.call('GET', '/api/game', { token: U.masha.token });
  assert.deepEqual([game.data.right, game.data.total], [0, 1]);
});

// ---------------------------------------------------------------- со СМС и ИИ

test('СМС: регистрация с кодом, восстановление по телефону', async () => {
  const B = await start({ sms: true });
  try {
    const inv = B.app.createInvite(null);
    const k = await keysFor('пароль 1');
    const noTicket = await B.call('POST', '/api/register', { body: { invite: inv, displayName: 'Оля', phone: '+79990000011', ...k.body } });
    assert.equal(noTicket.status, 400, 'без кода нельзя');
    assert.equal(noTicket.data.error, 'phone_unverified');

    const sent = await B.call('POST', '/api/phone/send', { body: { phone: '8 999 000 00 11', purpose: 'register', invite: inv } });
    assert.equal(sent.data.mode, 'sms');
    const code = B.sms.at(-1).text.match(/\d{4}/)[0];
    assert.equal(B.sms.at(-1).phone, '+79990000011');
    assert.equal((await B.call('POST', '/api/phone/verify', { body: { phone: '+79990000011', purpose: 'register', code: code === '0000' ? '1111' : '0000' } })).status, 400);
    const v = await B.call('POST', '/api/phone/verify', { body: { phone: '+79990000011', purpose: 'register', code } });
    assert.ok(v.data.ticket);
    const reg = await B.call('POST', '/api/register', { body: { invite: inv, displayName: 'Оля', phone: '+79990000011', phoneTicket: v.data.ticket, ...k.body } });
    assert.equal(reg.status, 200, JSON.stringify(reg.data));
    const st = await B.call('GET', '/api/state', { token: reg.data.token });
    assert.equal(st.data.profile.phoneVerified, true);

    // Чужой номер — сервер не говорит, что такого нет
    const ghost = await B.call('POST', '/api/phone/send', { body: { phone: '+79990000099', purpose: 'recover' } });
    assert.equal(ghost.data.mode, 'sms');
    const before = B.sms.length;
    await B.call('POST', '/api/phone/send', { body: { phone: '+79990000011', purpose: 'recover' } });
    assert.equal(B.sms.length, before + 1);
    const rcode = B.sms.at(-1).text.match(/\d{4}/)[0];
    const rv = await B.call('POST', '/api/phone/verify', { body: { phone: '+79990000011', purpose: 'recover', code: rcode } });
    const nk = await keysFor('новый пароль');
    const rec = await B.call('POST', '/api/recover', { body: { ticket: rv.data.ticket, ...nk.body } });
    assert.equal(rec.status, 200);
    assert.equal((await B.call('GET', '/api/state', { token: reg.data.token })).status, 401);
    assert.equal((await login(B, '89990000011', 'новый пароль')).status, 200);
    assert.equal((await B.call('POST', '/api/recover', { body: { ticket: rv.data.ticket.replace(/.$/, 'x'), ...nk.body } })).status, 401, 'подделанный билет не принимается');
  } finally {
    await stop(B);
  }
});

test('с ИИ: Аська, личный ИИ и ИИ-люди в кругах и в личке', async () => {
  const replies = (req) => {
    const p = req.schema.properties;
    if (p.reply) return { reply: 'Привет!' };
    if (p.facts) return { messages: ['Классно! Запомню.'], facts: ['любит пироги'] };
    if (p.forward) return { messages: ['Он точно обрадуется 🙂'], forward: /передай/i.test(req.prompt) ? 'привет от друга' : '', ask_owner: '' };
    return { messages: [req.system.includes('Аська') ? 'Привет-привет 🌼' : 'ахах, привет'], note: 'любит кино' };
  };
  const C = await start({ ai: replies });
  try {
    const inv = C.app.createInvite(null);
    const e = await register(C, inv, 'Егор', 'пароль егора', { phone: '+79991112233' });
    const me = { ...e.data, kp: e.kp };
    await C.app.bots.idle();
    const st0 = await C.call('GET', '/api/state', { token: me.token });
    assert.equal(st0.data.features.ai, true);
    const aska = st0.data.users.find((u) => u.kind === 'aska').id;
    await send(C, me, dmId(aska, me.userId), { kind: 'text', text: 'Привет, Аська!' });
    await C.app.bots.idle();
    assert.ok((await read(C, me, dmId(aska, me.userId))).some((m) => m.text === 'Привет-привет 🌼'), 'Аська отвечает через ИИ');
    const askaCall = C.aiCalls.find((c) => c.system.includes('Ты — Аська'));
    assert.ok(askaCall.prompt.includes('Привет, Аська!'), 'Аська видит переписку');

    const check = await C.call('POST', '/api/admin/ai/check', { token: me.token });
    assert.equal(check.data.ok, true);

    // ИИ-люди
    assert.equal((await C.call('POST', '/api/admin/people', { token: me.token, body: { on: true } })).data.people, true);
    const st = await C.call('GET', '/api/state', { token: me.token });
    const people = st.data.users.filter((u) => u.kind === 'human' && u.id !== me.userId);
    assert.equal(people.length, 7, 'пришли семь новых людей');
    assert.ok(people.every((p) => p.plate && !/^А\d{3}МР/.test(p.plate) && p.city && !p.gold), 'у всех номера своих городов и города, как у людей');
    const plates = new Set([me.plate, ...people.map((p) => p.plate)]);
    assert.equal(plates.size, 8, 'номера не повторяются');
    await C.app.bots.idle();
    assert.ok((await read(C, me, dmId(aska, me.userId))).some((m) => /новые люди/.test(m.text || '')), 'Аська объявила о новых людях');

    // Пишу в круг — кто-то из ИИ-людей отвечает
    await C.call('POST', '/api/circles/circle%3Akino/join', { token: me.token });
    await send(C, me, 'circle:kino', { kind: 'text', text: 'Кто что смотрит?' });
    await waitFor(async () => { await C.app.bots.idle(); return (await read(C, me, 'circle:kino')).some((m) => m.senderId !== me.userId && m.text === 'ахах, привет'); });
    const circleCall = C.aiCalls.find((c) => c.prompt.includes('Общий круг «🎬 Кино и сериалы»'));
    assert.ok(circleCall?.system.includes('Кто здесь ИИ?'), 'ИИ-человек знает правила игры');

    // Пишу ИИ-человеку в личку
    const katya = people.find((p) => p.displayName === 'Катя');
    const dm = await C.call('POST', '/api/chats/dm', { token: me.token, body: { userId: katya.id } });
    const ws = await connect(C, me.token);
    await send(C, me, dm.data.chat.id, { kind: 'text', text: 'привет! ты откуда?' });
    await waitFor(async () => { await C.app.bots.idle(); return (await read(C, me, dm.data.chat.id)).some((m) => m.senderId === katya.id); });
    assert.ok(ws.inbox.some((ev) => ev.type === 'typing' && ev.userId === katya.id), 'Катя «печатает…»');
    assert.ok(ws.inbox.some((ev) => ev.type === 'read' && ev.userId === katya.id), 'и читает');
    ws.close();

    // Угадываю
    const guess = await C.call('POST', '/api/guess', { token: me.token, body: { userId: katya.id, guess: 'ai' } });
    assert.deepEqual([guess.data.correct, guess.data.truth], [true, 'ai']);
    const st2 = await C.call('GET', '/api/state', { token: me.token });
    assert.equal(st2.data.guesses[katya.id], 'ai');

    // У ИИ-людей тоже есть личный ИИ — чтобы не выдавать, кто есть кто
    const katyaTwin = st2.data.users.find((u) => u.kind === 'twin' && u.ownerId === katya.id);
    assert.ok(katyaTwin);
    const tchat = await C.call('POST', `/api/twins/${katyaTwin.id}/chat`, { token: me.token, body: { anon: false } });
    await send(C, me, tchat.data.chat.id, { kind: 'text', text: 'передай ей привет' });
    await C.app.bots.idle();
    assert.ok((await read(C, me, tchat.data.chat.id)).some((m) => m.text === 'Он точно обрадуется 🙂'));

    // Мой ИИ: учится в разговоре со мной
    const twinId = (await C.call('GET', '/api/twin', { token: me.token })).data.twinId;
    const own = await C.call('POST', `/api/twins/${twinId}/chat`, { token: me.token, body: {} });
    assert.equal(own.data.chat.id, dmId(twinId, me.userId), 'своему ИИ — обычная личка');
    await send(C, me, dmId(twinId, me.userId), { kind: 'text', text: 'Я обожаю пироги' });
    await C.app.bots.idle();
    assert.ok((await C.call('GET', '/api/twin', { token: me.token })).data.facts.some((f) => f.text === 'любит пироги'));

    // Пуш от бота: имя и ключ отправителя, текст зашифрован
    C.pushes.length = 0;
    await C.call('POST', '/api/push/subscribe', { token: me.token, body: { endpoint: 'https://web.push.apple.com/egor', keys: { p256dh: 'x', auth: 'y' } } });
    await send(C, me, dmId(aska, me.userId), { kind: 'text', text: 'как дела?' });
    await waitFor(async () => { await C.app.bots.idle(); return C.pushes.find((p) => p.s === aska); });
    const p = C.pushes.find((x) => x.s === aska);
    assert.equal(p.sn, 'Аська');
    assert.equal(decodePreview(p.pn, p.pc, fromB64(p.spk), me.kp.sk), 'Привет-привет 🌼');
  } finally {
    await stop(C);
  }
});

test('обновление: Аська один раз рассказывает всем, что нового', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aska-upd-'));
  const mk = () => createApp({ dataDir, publicUrl: 'http://localhost', log: () => {}, botTiming: TIMING });
  let app = mk();
  const D = { app };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  D.base = `http://127.0.0.1:${app.server.address().port}`;
  D.call = async (method, url, { token, body } = {}) => {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body) headers['content-type'] = 'application/json';
    const res = await fetch(D.base + url, { method, headers, body: body && JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  const e = await register(D, app.createInvite(null), 'Егор', 'пароль егора');
  const me = { ...e.data, kp: e.kp };
  await app.bots.idle();
  setSetting(app.db, 'announced', 'old');
  await app.close();

  app = mk(); // перезапуск с новой версией
  D.app = app;
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  D.base = `http://127.0.0.1:${app.server.address().port}`;
  await waitFor(async () => { await app.bots.idle(); const st = await D.call('GET', '/api/state', { token: me.token }); const aska = st.data.users.find((u) => u.kind === 'aska').id; return (await read(D, me, dmId(aska, me.userId))).some((m) => /Что нового/.test(m.text || '')); });
  await app.close();
  app = mk(); // ещё один перезапуск — повтора нет
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  D.base = `http://127.0.0.1:${app.server.address().port}`;
  await app.bots.idle();
  const st = await D.call('GET', '/api/state', { token: me.token });
  const aska = st.data.users.find((u) => u.kind === 'aska').id;
  const news = (await read(D, me, dmId(aska, me.userId))).filter((m) => /Что нового/.test(m.text || ''));
  assert.equal(news.length, 1);
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('запрос к Claude: модель, схема ответа, запасная модель, разбор ответа', async () => {
  const { createAi } = await import('../server/src/ai.js');
  const { openDb } = await import('../server/src/db.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aska-ai-'));
  const db = openDb(dir);
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url: String(url), headers: Object.fromEntries(new Headers(init.headers)), body: JSON.parse(init.body) });
    const body = { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_sequence: null,
      content: [{ type: 'text', text: '{"messages":["привет"],"note":""}' }], usage: { input_tokens: 10, output_tokens: 5 } };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const ai = createAi({ db, fetchImpl, log: () => {} });
  assert.equal(await ai.complete({ system: 's', prompt: 'p', schema: { type: 'object' } }), null, 'без ключа не ходим');
  ai.setConfig({ apiKey: 'sk-ant-test' });
  const out = await ai.complete({ system: 'система', prompt: 'вопрос', schema: { type: 'object', properties: {} } });
  assert.deepEqual(out, { messages: ['привет'], note: '' });
  const req = seen[0];
  assert.match(req.url, /\/v1\/messages/);
  assert.equal(req.headers['x-api-key'], 'sk-ant-test');
  assert.match(req.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(req.body.model, 'claude-opus-5-5');
  assert.equal(req.body.fallbacks, 'default');
  assert.equal(req.body.output_config.effort, 'low');
  assert.equal(req.body.output_config.format.type, 'json_schema');
  assert.equal(req.body.system[0].cache_control.type, 'ephemeral');
  assert.equal(req.body.thinking, undefined, 'размышления не трогаем — у Opus 5.5 их нельзя выключить');
  ai.setConfig({ model: 'claude-haiku-5-5' });
  await ai.complete({ system: 's', prompt: 'p', schema: { type: 'object', properties: {} } });
  assert.equal(seen[1].body.fallbacks, undefined, 'у Haiku запасной модели нет');
  assert.equal(ai.status().usedToday, 2);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
