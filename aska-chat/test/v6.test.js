// Шестое обновление: стены (записи, фото, открытки, магниты, цветочки, «Пост дня», «Стена АСЬКИ»),
// боты на стенах, ИИ-люди без «мозга» (живут и коротко отвечают), новые друзья.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { PEOPLE, PERSON_WALL, personScripted } from '../server/src/personas.js';
import { setSetting } from '../server/src/db.js';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, fromB64, randomBytes } from '../client/src/lib/crypto.ts';
import { encodeOutgoing, decodeIncoming } from '../client/src/lib/protocol.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0, wallReactChance: 0, batyaCardChance: 0, wallEmojiChance: 0, askaReactChance: 0 };

async function start({ ai, dataDir } = {}) {
  const s = { dataDir: dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v6-')), pushes: [], aiCalls: [] };
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

test('стена: запись, открытка, магнит за аськоины, фото, цветочки, комментарии, удаление', async () => {
  const S = await start();
  try {
    const liza = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(null), 'Артём', 'пароль артёма');
    const nika = await register(S, S.app.createInvite(null), 'Ника', 'пароль ники');
    await S.app.bots.idle();
    // у новичка на стене уже открытка от Аськи
    const aska = await askaOf(S, liza);
    let w = (await S.call('GET', `/api/wall/${liza.userId}`, { token: artem.token })).data;
    assert.ok(w.posts.some((p) => p.authorId === aska && p.kind === 'card'), 'Аська повесила приветственную открытку');

    const t = await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'text', text: 'привет, Лиза!\nкак дела?' } });
    assert.equal(t.status, 200);
    assert.equal(t.data.post.text, 'привет, Лиза!\nкак дела?', 'переносы строк сохраняются');
    assert.equal((await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'card', card: 'cake', text: 'с днём рождения' } })).status, 200);
    assert.equal((await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'card', card: 'nope' } })).status, 400);
    assert.equal((await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'text', text: '' } })).status, 400);
    assert.equal((await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'text', text: 'x'.repeat(501) } })).status, 400);
    // магнит: 10 аськоинов, себе — бесплатно, Луна — 50
    const before = await coins(S, artem);
    assert.equal((await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'magnet', magnet: 'JP', text: 'из Токио' } })).status, 200);
    assert.equal(await coins(S, artem), before - 10);
    const mine = await coins(S, liza);
    assert.equal((await S.call('POST', `/api/wall/${liza.userId}`, { token: liza.token, body: { kind: 'magnet', magnet: 'TR' } })).status, 200);
    assert.equal(await coins(S, liza), mine, 'себе магнит бесплатно');
    S.app.db.prepare('UPDATE users SET coins = 20 WHERE id = ?').run(nika.userId);
    const poor = await S.call('POST', `/api/wall/${liza.userId}`, { token: nika.token, body: { kind: 'magnet', magnet: 'MOON' } });
    assert.equal(poor.status, 402);
    assert.equal(poor.data.price, 50);
    w = (await S.call('GET', `/api/wall/${liza.userId}`, { token: nika.token })).data;
    assert.deepEqual(w.fridge.map((m) => m.code).sort(), ['JP', 'TR'], 'магниты на холодильнике');

    // фото: только картинки, только своё и один раз
    assert.equal((await upload(S, artem, Buffer.from('not an image'))).status, 400);
    const ph = await upload(S, artem, JPEG);
    assert.equal(ph.status, 200);
    const pp = await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'photo', text: 'закат', photo: { id: ph.data.id, w: 1, h: 1 } } });
    assert.equal(pp.status, 200);
    assert.equal((await S.call('POST', `/api/wall/${liza.userId}`, { token: nika.token, body: { kind: 'photo', photo: { id: ph.data.id } } })).status, 400, 'чужое фото не повесить');
    const img = await fetch(`${S.base}/api/wall/photo/${ph.data.id}`, { headers: { authorization: `Bearer ${nika.token}` } });
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/jpeg');
    assert.equal((await fetch(`${S.base}/api/wall/photo/${ph.data.id}`)).status, 401, 'без входа фото не отдаём');

    // 🌼: навсегда, один раз, автору +1 аськоин; себе — без аськоинов
    const postId = pp.data.post.id;
    const a0 = await coins(S, artem);
    assert.equal((await S.call('POST', `/api/wall/posts/${postId}/flower`, { token: nika.token })).data.flowers, 1);
    assert.equal((await S.call('POST', `/api/wall/posts/${postId}/flower`, { token: nika.token })).data.flowers, 1, 'второй раз — не считается');
    assert.equal(await coins(S, artem), a0 + 1);
    await S.call('POST', `/api/wall/posts/${postId}/flower`, { token: artem.token });
    assert.equal(await coins(S, artem), a0 + 1, 'свой цветочек аськоинов не даёт');
    const c = await S.call('POST', `/api/wall/posts/${postId}/comments`, { token: liza.token, body: { text: 'вау 😍' } });
    assert.equal(c.data.comment.text, 'вау 😍');

    // «Стена АСЬКИ»: все записи с указанием, на чьей стене и кто оставил
    const feed = (await S.call('GET', '/api/wall/feed', { token: nika.token })).data.posts;
    const fp = feed.find((p) => p.id === postId);
    assert.equal(fp.wallId, liza.userId);
    assert.equal(fp.authorId, artem.userId);
    assert.equal(fp.flowers, 2);
    assert.equal(fp.comments.length, 1);
    assert.ok(feed.findIndex((p) => p.id === postId) < feed.findIndex((p) => p.id === t.data.post.id), 'новые сверху');
    const top = (await S.call('GET', '/api/wall/feed?top=1', { token: nika.token })).data.posts;
    assert.equal(top[0].id, postId, 'в «Лучшем» — самые цветущие');

    // у личного ИИ стены нет; удалить может автор, хозяин стены и голд, но не посторонний
    const twin = (await S.call('GET', '/api/state', { token: liza.token })).data.users.find((u) => u.kind === 'twin' && u.ownerId === liza.userId);
    assert.equal((await S.call('GET', `/api/wall/${twin.id}`, { token: liza.token })).status, 404);
    const art = (await S.call('POST', `/api/wall/${artem.userId}`, { token: liza.token, body: { kind: 'text', text: 'запись Лизы у Артёма' } })).data.post;
    assert.equal((await S.call('DELETE', `/api/wall/posts/${t.data.post.id}`, { token: nika.token })).status, 403);
    assert.equal((await S.call('DELETE', `/api/wall/posts/${t.data.post.id}`, { token: liza.token })).status, 200, 'хозяин стены удаляет');
    assert.equal((await S.call('DELETE', `/api/wall/posts/${art.id}`, { token: liza.token })).status, 200, 'автор удаляет');
    assert.equal((await S.call('GET', `/api/wall/${liza.userId}`, { token: liza.token })).data.posts.some((p) => p.id === t.data.post.id), false);
  } finally {
    await stop(S);
  }
});

test('«Пост дня», весточка Аськи о новом на стене, Аська отвечает на своей стене', async () => {
  const S = await start();
  try {
    const liza = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(null), 'Артём', 'пароль артёма');
    const nika = await register(S, S.app.createInvite(null), 'Ника', 'пароль ники');
    await S.app.bots.idle();
    const aska = await askaOf(S, liza);
    const post = (await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'card', card: 'sun', text: 'доброе утро' } })).data.post;
    await S.app.bots.idle();
    const note = (await texts(S, liza, dmId(aska, liza.userId))).find((m) => m.startsWith('📌 На твоей стене новое'));
    assert.ok(note && note.includes('Артём — открытка «Доброе утро»'), note);
    // комментарий к записи Артёма — весточка Артёму
    await S.call('POST', `/api/wall/posts/${post.id}/comments`, { token: liza.token, body: { text: 'и тебе!' } });
    await S.app.bots.idle();
    assert.ok((await texts(S, artem, dmId(aska, artem.userId))).some((m) => m.includes('Лиза ответил(а) на твою запись: «и тебе!»')));
    // «Пост дня»: два цветочка от других — +30 аськоинов и весточка автору
    await S.call('POST', `/api/wall/posts/${post.id}/flower`, { token: liza.token });
    await S.call('POST', `/api/wall/posts/${post.id}/flower`, { token: nika.token });
    const c0 = await coins(S, artem);
    const best = S.app.wall.bestOfDay(true);
    assert.equal(best.id, post.id);
    assert.equal(await coins(S, artem), c0 + 30);
    await S.app.bots.idle();
    assert.ok((await texts(S, artem, dmId(aska, artem.userId))).some((m) => m.startsWith('🏆 Твоя запись на стене у Лиза — пост дня!')));
    assert.ok((await S.call('GET', '/api/wall/feed', { token: nika.token })).data.posts.find((p) => p.id === post.id).best);
    assert.equal(S.app.wall.bestOfDay(), null, 'второй раз за день — нет');
    // на стене Аськи она сама дарит цветочек и благодарит (без «мозга» — по шпаргалке)
    const toAska = (await S.call('POST', `/api/wall/${aska}`, { token: nika.token, body: { kind: 'text', text: 'Аська, ты лучшая!' } })).data.post;
    await S.app.bots.idle();
    const seen = (await S.call('GET', `/api/wall/${aska}`, { token: nika.token })).data.posts.find((p) => p.id === toAska.id);
    assert.equal(seen.flowers, 1);
    assert.ok(seen.comments.some((c) => c.authorId === aska && c.text.startsWith('Спасибо')));
  } finally {
    await stop(S);
  }
});

test('новые друзья: появляются и без «мозга», пишут на стенах, коротко отвечают в личке, ИИ не подписаны', async () => {
  const S = await start();
  try {
    const me = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    assert.equal(S.app.bots.peopleEnabled(), false);
    await stop(S, true);
    // перезапуск: ИИ-людей ещё ни разу не включали — включаются сами
    const S2 = await start({ dataDir: S.dataDir });
    try {
      await S2.app.bots.idle();
      assert.equal(S2.app.bots.peopleEnabled(), true);
      const st = (await S2.call('GET', '/api/state', { token: me.token })).data;
      const ppl = st.users.filter((u) => u.kind === 'human' && u.id !== me.userId);
      for (const name of ['Полина', 'Сеня', 'Даша', 'Никитос', 'Алина']) assert.ok(ppl.some((u) => u.displayName === name), name);
      assert.equal(ppl.length, PEOPLE.length);
      assert.ok(ppl.every((u) => u.kind === 'human' && !/ИИ/.test(u.displayName)), 'для всех — обычные люди');
      const polina = ppl.find((u) => u.displayName === 'Полина');
      const pw = (await S2.call('GET', `/api/wall/${polina.id}`, { token: me.token })).data;
      assert.equal(pw.posts[0].text, PERSON_WALL.polina, 'на стене уже есть запись');
      assert.equal(polina.plateCountry, 'RU');
      assert.equal(ppl.find((u) => u.displayName === 'Алина').plateCountry, 'KZ', 'Алина из Алматы — казахстанский номер');
      // в личке без «мозга»: до пяти коротких человеческих ответов в день, шестой — «занят(а)», дальше тишина до завтра
      const dm = (await S2.call('POST', '/api/chats/dm', { token: me.token, body: { userId: polina.id } })).data.chat.id;
      const fromPolina = async () => (await read(S2, me, dm)).filter((m) => m.senderId === polina.id).map((m) => m.text);
      await send(S2, me, dm, 'привет!');
      await S2.app.bots.idle();
      assert.ok(['привет)', 'хай!', 'о, привет', 'приветик)'].includes((await fromPolina())[0]));
      for (const t of ['как дела?', 'что делаешь?', 'ты откуда?', 'люблю кино', 'ау?']) { await send(S2, me, dm, t); await S2.app.bots.idle(); }
      const got = await fromPolina();
      assert.ok(got.some((t) => t.includes('Санкт-Петербург')), got.join(' | '));
      assert.match(got[got.length - 1], /занят|бегу|завал/);
      await send(S2, me, dm, 'эй');
      await S2.app.bots.idle();
      assert.equal((await fromPolina()).length, got.length, 'после «занята» до завтра молчит');
      // всерьёз спросили — признаётся
      assert.match(personScripted('скажи честно, ты ии?')[0], /честно: я ИИ/);
    } finally {
      await stop(S2);
    }
  } finally {
    fs.rmSync(S.dataDir, { recursive: true, force: true });
  }
});
