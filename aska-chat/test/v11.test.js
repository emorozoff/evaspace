// Одиннадцатое обновление: аудиозвонки (1:1 и групповые) и видео-квадратики.
// Сервер звонков только знакомит телефоны и передаёт им зашифрованные сигналы; звук идёт напрямую (WebRTC).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createApp } from '../server/src/app.js';
import { previewText as serverPreview } from '../server/src/seal.js';
import * as P from '../server/src/personas.js';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, randomBytes, boxFor, openFrom, utf8, fromUtf8, fromB64 } from '../client/src/lib/crypto.ts';
import { encodeOutgoing, decodeIncoming, previewText } from '../client/src/lib/protocol.ts';
import { buildNotification } from '../client/src/sw-logic.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0, wallReactChance: 0, batyaCardChance: 0, wallEmojiChance: 0, askaReactChance: 0, nightTickMs: 0, callRingMs: 400 };

async function start() {
  const s = { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v11-')), pushes: [] };
  s.app = createApp({ dataDir: s.dataDir, publicUrl: 'http://localhost', log: () => {}, botTiming: TIMING, pushSender: async (sub, payload) => { s.pushes.push(JSON.parse(payload)); } });
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
  return { ...r.data, kp };
}
function connect(s, token, visible = true) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${s.base.replace('http', 'ws')}/ws?token=${token}&visible=${visible ? 1 : 0}`);
    ws.inbox = [];
    ws.on('message', (d) => ws.inbox.push(JSON.parse(d.toString())));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}
const send = (ws, obj) => ws.send(JSON.stringify(obj));
const waitFor = async (fn, ms = 2000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 15)); }
  throw new Error('timeout');
};
const last = (ws, type, pred = () => true) => [...ws.inbox].reverse().find((e) => e.type === type && pred(e));

test('звонок 1:1: гудки, пуш тому, кто не в приложении, принять, зашифрованные сигналы, положить трубку', async () => {
  const S = await start();
  try {
    const lisa = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(lisa.userId), 'Артём', 'пароль артёма');
    const nika = await register(S, S.app.createInvite(lisa.userId), 'Ника', 'пароль ники');
    const dm = (await S.call('POST', '/api/chats/dm', { token: lisa.token, body: { userId: artem.userId } })).data.chat.id;
    assert.equal((await S.call('POST', '/api/push/subscribe', { token: artem.token, body: { endpoint: 'https://web.push.apple.com/test-artem', keys: { p256dh: 'x', auth: 'y' } } })).status, 200);
    const wl = await connect(S, lisa.token);
    const wa = await connect(S, artem.token, false); // приложение Артёма свёрнуто — нужен пуш
    const wn = await connect(S, nika.token);
    send(wl, { type: 'call_start', chatId: dm });
    const ring = await waitFor(() => last(wa, 'call', (e) => e.call.chatId === dm));
    assert.deepEqual(ring.call.members, [lisa.userId]);
    assert.deepEqual(ring.call.ringing, [artem.userId]);
    const push = await waitFor(() => S.pushes.find((p) => p.t === 'c'));
    assert.equal(push.c, dm);
    assert.equal(push.sn, 'Лиза');
    assert.equal(buildNotification(push, {}).title, '📞 Звонок в АСЬКЕ');
    // Ника не в этой беседе — ей не звонят и сигнал она отправить не может
    assert.equal(last(wn, 'call'), undefined);
    send(wn, { type: 'call_join', chatId: dm });
    await waitFor(() => last(wn, 'call_error'));
    // Артём берёт трубку
    send(wa, { type: 'call_join', chatId: dm });
    const both = await waitFor(() => last(wl, 'call', (e) => e.call.members.length === 2));
    assert.deepEqual(both.call.members, [lisa.userId, artem.userId], 'порядок входа: предлагает соединение тот, кто вошёл позже');
    assert.deepEqual(both.call.ringing, []);
    // сигнал шифрован ключом собеседника — сервер передаёт как есть
    const sealed = boxFor(utf8(JSON.stringify({ k: 'offer', sdp: 'v=0 test', chat: dm })), artem.kp.pk, lisa.kp.sk);
    send(wl, { type: 'call_signal', chatId: dm, to: artem.userId, data: sealed });
    const sig = await waitFor(() => last(wa, 'call_signal'));
    assert.equal(sig.from, lisa.userId);
    assert.deepEqual(sig.data, sealed);
    assert.equal(JSON.parse(fromUtf8(openFrom(sig.data, lisa.kp.pk, artem.kp.sk))).sdp, 'v=0 test');
    // сигнал тому, кто не в звонке, не уходит
    send(wl, { type: 'call_signal', chatId: dm, to: nika.userId, data: sealed });
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(last(wn, 'call_signal'), undefined);
    // Артём положил трубку — в личке звонок кончается у обоих
    send(wa, { type: 'call_leave', chatId: dm });
    const end = await waitFor(() => last(wl, 'call_end'));
    assert.equal(end.reason, 'end');
    assert.equal(S.app.calls.get(dm), null);
    for (const w of [wl, wa, wn]) w.close();
  } finally { await stop(S); }
});

test('не ответили, отклонили; Аське и личному ИИ не звонят; ИИ-человеку звонить можно — он не берёт', async () => {
  const S = await start();
  try {
    const lisa = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(lisa.userId), 'Артём', 'пароль артёма');
    const dm = (await S.call('POST', '/api/chats/dm', { token: lisa.token, body: { userId: artem.userId } })).data.chat.id;
    const wl = await connect(S, lisa.token);
    const wa = await connect(S, artem.token);
    send(wl, { type: 'call_start', chatId: dm });
    const end = await waitFor(() => last(wl, 'call_end'), 3000);
    assert.equal(end.reason, 'no_answer');
    wl.inbox.length = 0;
    send(wl, { type: 'call_start', chatId: dm });
    await waitFor(() => last(wa, 'call', (e) => e.call.ringing.includes(artem.userId)));
    send(wa, { type: 'call_decline', chatId: dm });
    assert.equal((await waitFor(() => last(wl, 'call_end'))).reason, 'declined');
    // Аська
    const state = (await S.call('GET', '/api/state', { token: lisa.token })).data;
    const aska = Object.values(state.users).find((u) => u.kind === 'aska');
    const askaDm = (await S.call('POST', '/api/chats/dm', { token: lisa.token, body: { userId: aska.id } })).data.chat.id;
    wl.inbox.length = 0;
    send(wl, { type: 'call_start', chatId: askaDm });
    assert.equal((await waitFor(() => last(wl, 'call_error'))).error, 'forbidden');
    // ИИ-человек: для приложения он «human», звонок идёт, но никто не берёт
    const person = S.app.db.prepare("SELECT id FROM users WHERE kind = 'person' LIMIT 1").get();
    if (person) {
      const pDm = (await S.call('POST', '/api/chats/dm', { token: lisa.token, body: { userId: person.id } })).data.chat.id;
      wl.inbox.length = 0;
      send(wl, { type: 'call_start', chatId: pDm });
      const c = await waitFor(() => last(wl, 'call', (e) => e.call.chatId === pDm));
      assert.deepEqual(c.call.ringing, [], 'ИИ-человеку звонок не «доставляется», но и ошибки нет');
      assert.equal((await waitFor(() => last(wl, 'call_end', (e) => e.chatId === pDm), 3000)).reason, 'no_answer');
    }
    wl.close(); wa.close();
  } finally { await stop(S); }
});

test('групповой звонок в рабочем чате: всем звонит, входят по очереди, уходят — звонок идёт, пока кто-то есть', async () => {
  const S = await start();
  try {
    const lisa = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(lisa.userId), 'Артём', 'пароль артёма');
    const nika = await register(S, S.app.createInvite(lisa.userId), 'Ника', 'пароль ники');
    const chat = (await S.call('POST', '/api/circles', { token: lisa.token, body: { title: 'Команда', biz: 'team', memberIds: [artem.userId, nika.userId] } })).data.chat.id;
    const wl = await connect(S, lisa.token);
    const wa = await connect(S, artem.token);
    const wn = await connect(S, nika.token);
    send(wl, { type: 'call_start', chatId: chat });
    const ring = await waitFor(() => last(wn, 'call', (e) => e.call.chatId === chat));
    assert.deepEqual(ring.call.ringing.sort(), [artem.userId, nika.userId].sort());
    send(wa, { type: 'call_join', chatId: chat });
    send(wn, { type: 'call_join', chatId: chat });
    const all = await waitFor(() => last(wl, 'call', (e) => e.call.members.length === 3));
    assert.deepEqual(all.call.members, [lisa.userId, artem.userId, nika.userId]);
    // Лиза ушла — звонок продолжается
    wa.inbox.length = 0;
    send(wl, { type: 'call_leave', chatId: chat });
    const two = await waitFor(() => last(wa, 'call', (e) => e.call.members.length === 2));
    assert.deepEqual(two.call.members, [artem.userId, nika.userId]);
    // новичок в приложении после переподключения узнаёт об идущем звонке
    const wl2 = await connect(S, lisa.token);
    const calls = await waitFor(() => last(wl2, 'calls'));
    assert.equal(calls.calls[0].chatId, chat);
    send(wa, { type: 'call_leave', chatId: chat });
    send(wn, { type: 'call_leave', chatId: chat });
    await waitFor(() => last(wl2, 'call_end', (e) => e.chatId === chat));
    // ICE: по умолчанию STUN, TURN — из настроек администратора (пароль наружу не отдаётся)
    let iceR = (await S.call('GET', '/api/calls/ice', { token: artem.token })).data;
    assert.equal(iceR.iceServers.length, 1);
    assert.equal((await S.call('POST', '/api/admin/turn', { token: artem.token, body: { urls: 'turn:turn.example.org:3478' } })).status, 403);
    await S.call('POST', '/api/admin/turn', { token: lisa.token, body: { urls: 'turn:turn.example.org:3478?transport=udp, javascript:alert(1)', username: 'u', credential: 'p' } });
    iceR = (await S.call('GET', '/api/calls/ice', { token: artem.token })).data;
    assert.deepEqual(iceR.iceServers[1].urls, ['turn:turn.example.org:3478?transport=udp']);
    const adm = (await S.call('GET', '/api/admin', { token: lisa.token })).data;
    assert.equal(adm.turn.username, 'u');
    assert.equal(adm.turn.credential, undefined);
    for (const w of [wl, wa, wn, wl2]) w.close();
  } finally { await stop(S); }
});

test('видео-квадратик: вид сообщения в шифре, превью, проверка формата; Аська отвечает на квадратик', () => {
  const a = generateKeyPair();
  const b = generateKeyPair();
  const video = { blob: 'abc123', key: 'k', nonce: 'n', hash: 'h', mime: 'video/mp4', dur: 7.4, thumb: 'data:image/jpeg;base64,AAAA' };
  const boxes = encodeOutgoing('dm:1:2', 'u-1', { kind: 'video', video }, [{ id: 1, pk: a.pk }, { id: 2, pk: b.pk }], 1, a.sk);
  const row = { id: 5, chatId: 'dm:1:2', senderId: 1, uuid: 'u-1', createdAt: 1, ...boxes.find((x) => x.to === 2) };
  const body = decodeIncoming(row, a.pk, b.sk);
  assert.equal(body.kind, 'video');
  assert.equal(body.video.blob, 'abc123');
  assert.equal(body.video.dur, 7.4);
  assert.equal(previewText(body), '🎬 Видео-квадратик');
  assert.equal(serverPreview({ kind: 'video' }), '🎬 Видео-квадратик');
  // чужой «mime» и картинка не из data: не проходят
  const bad = encodeOutgoing('dm:1:2', 'u-2', { kind: 'video', video: { ...video, mime: 'text/html', thumb: 'https://evil' } }, [{ id: 2, pk: b.pk }], 1, a.sk);
  const badBody = decodeIncoming({ id: 6, chatId: 'dm:1:2', senderId: 1, uuid: 'u-2', createdAt: 1, ...bad[0] }, a.pk, b.sk);
  assert.equal(badBody.kind, 'text');
  const thumbOk = encodeOutgoing('dm:1:2', 'u-3', { kind: 'video', video: { ...video, thumb: 'https://evil' } }, [{ id: 2, pk: b.pk }], 1, a.sk);
  assert.equal(decodeIncoming({ id: 7, chatId: 'dm:1:2', senderId: 1, uuid: 'u-3', createdAt: 1, ...thumbOk[0] }, a.pk, b.sk).video.thumb, undefined);
  assert.match(P.askaScripted('[видео-квадратик]', {}).join(' '), /квадратик/);
  assert.ok(fromB64);
});
