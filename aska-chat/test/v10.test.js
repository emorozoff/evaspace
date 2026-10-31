// Десятое обновление: уровни (Гость / Голд / Блэк), нетворк, место-регион, реестр на цепочке блоков, ночные комнаты.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { PLACES } from '../server/src/places.js';
import * as L from '../server/src/ledger.js';
import { ROOMS, NIGHT_BOTS, COLLECTION_SIZE } from '../server/src/night-data.js';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, randomBytes } from '../client/src/lib/crypto.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0, wallReactChance: 0, batyaCardChance: 0, wallEmojiChance: 0, askaReactChance: 0, nightTickMs: 0 };

async function start() {
  const s = { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v10-')) };
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
  return { ...r.data, password };
}
async function login(s, loginStr, password, region) {
  const q = new URLSearchParams({ login: loginStr, ...(region ? { region } : {}) });
  const { salt } = (await s.call('GET', `/api/salt?${q}`)).data;
  const { authKey } = await deriveFromPassword(password, Buffer.from(salt, 'base64'));
  return s.call('POST', '/api/login', { body: { login: loginStr, authKey: toB64(authKey), region } });
}
const coins = async (s, u) => (await s.call('GET', '/api/state', { token: u.token })).data.profile.coins;
const setCoins = (s, u, n) => s.app.db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(n, u.userId);

test('уровни: Гость по умолчанию, админ не ниже Голд, Голд за аськоины, скидки, VIP-регион, место', async () => {
  const S = await start();
  try {
    const boss = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы'); // первый — админ
    const artem = await register(S, S.app.createInvite(boss.userId), 'Артём', 'пароль артёма');
    let lv = (await S.call('GET', '/api/levels', { token: artem.token })).data;
    assert.equal(lv.tier, 'guest');
    assert.equal(lv.tiers.length, 3);
    assert.equal((await S.call('GET', '/api/levels', { token: boss.token })).data.tier, 'gold', 'админ — не ниже Голд');
    // гость: VIP-регион нельзя, место можно
    assert.equal((await S.call('POST', '/api/levels/vip-region', { token: artem.token, body: { region: '888' } })).status, 403);
    assert.equal((await S.call('POST', '/api/me/place', { token: artem.token, body: { place: 'bali' } })).status, 200);
    assert.equal((await S.call('POST', '/api/me/place', { token: artem.token, body: { place: 'atlantis' } })).status, 400);
    let me = (await S.call('GET', '/api/state', { token: boss.token })).data.users.find((u) => u.id === artem.userId);
    assert.equal(me.place, 'bali');
    assert.equal(me.vipRegion, undefined);
    assert.equal(me.gold, false);
    // Голд за 500 🪙: не хватает — 402; хватает — Голд на 30 дней, звезда, VIP-регион, скидка
    await coins(S, artem); // бонус за вход сегодня уже получен — дальше считаем точно
    setCoins(S, artem, 100);
    assert.equal((await S.call('POST', '/api/levels/gold', { token: artem.token })).status, 402);
    setCoins(S, artem, 700);
    const quoteBefore = (await S.call('POST', '/api/plates/quote', { token: artem.token, body: { country: 'RU', region: '777', code: 'К123ХО' } })).data;
    lv = (await S.call('POST', '/api/levels/gold', { token: artem.token })).data;
    assert.equal(lv.tier, 'gold');
    assert.ok(lv.tierUntil > Date.now() + 29 * 86_400_000);
    assert.equal(await coins(S, artem), 200);
    assert.equal((await S.call('GET', '/api/levels', { token: boss.token })).data.tier, 'gold');
    const quoteAfter = (await S.call('POST', '/api/plates/quote', { token: artem.token, body: { country: 'RU', region: '777', code: 'К123ХО' } })).data;
    assert.equal(quoteAfter.price, Math.round(quoteBefore.price * 0.8), 'скидка Голд 20%');
    assert.equal((await S.call('POST', '/api/levels/vip-region', { token: artem.token, body: { region: '888' } })).status, 200);
    me = (await S.call('GET', '/api/state', { token: boss.token })).data.users.find((u) => u.id === artem.userId);
    assert.equal(me.gold, true);
    assert.equal(me.vipRegion, '888');
    // пригласившему — подарок за Голд друга
    const bossLog = S.app.db.prepare("SELECT * FROM coin_log WHERE user_id = ? AND reason LIKE '%стал(а) Голд'").all(boss.userId);
    assert.equal(bossLog.length, 1);
    // срок кончился — снова Гость
    S.app.db.prepare('UPDATE users SET tier_until = ? WHERE id = ?').run(Date.now() - 1000, artem.userId);
    assert.equal((await S.call('GET', '/api/levels', { token: artem.token })).data.tier, 'guest');
    // гостю — 3 свободных приглашения
    for (let i = 0; i < 3; i++) assert.equal((await S.call('POST', '/api/invites', { token: artem.token })).status, 200);
    const lim = await S.call('POST', '/api/invites', { token: artem.token });
    assert.equal(lim.status, 403);
    assert.equal(lim.data.limit, 3);
    // вход по серии без региона (регион в окне входа — «где я»)
    const plate = (await S.call('GET', '/api/state', { token: artem.token })).data.profile.plate;
    const series = plate.slice(0, 6);
    assert.equal((await login(S, series, 'пароль артёма', '197')).status, 200);
    assert.equal((await login(S, series.toLowerCase(), 'пароль артёма')).status, 200);
    assert.equal((await S.call('GET', '/api/places')).data.places.length, PLACES.length);
  } finally {
    await stop(S);
  }
});

test('нетворк: цепочка, аськоины по линиям, штраф за заблокированного, Голд за большой нетворк', async () => {
  const S = await start();
  try {
    const a = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const b = await register(S, S.app.createInvite(a.userId), 'Артём', 'пароль артёма');
    const c = await register(S, S.app.createInvite(b.userId), 'Ника', 'пароль ники');
    const a0 = await coins(S, a), b0 = await coins(S, b);
    const d = await register(S, S.app.createInvite(c.userId), 'Макс', 'пароль макса');
    assert.equal(await coins(S, b), b0 + 15, '2-я линия +15');
    assert.equal(await coins(S, a), a0 + 5, '3-я линия +5');
    const net = (await S.call('GET', '/api/network', { token: a.token })).data;
    assert.equal(net.total, 3);
    assert.deepEqual(net.lines.slice(0, 3), [1, 1, 1]);
    assert.equal(net.children[0].name, 'Артём');
    assert.equal(net.children[0].children[0].children[0].name, 'Макс');
    assert.ok(net.earned >= 50 + 15 + 5);
    assert.equal((await S.call('GET', '/api/network', { token: d.token })).data.invitedBy.name, 'Ника');
    // Макса заблокировали — с Ники штраф
    const c0 = await coins(S, c);
    assert.equal((await S.call('POST', `/api/admin/users/${d.userId}/block`, { token: a.token, body: { blocked: true } })).status, 200);
    assert.equal(await coins(S, c), Math.max(0, c0 - 50));
    // нетворк 10 человек — Голд навсегда
    S.app.db.prepare('UPDATE users SET net_size = 10 WHERE id = ?').run(b.userId);
    assert.equal((await S.call('GET', '/api/levels', { token: b.token })).data.tier, 'gold');
  } finally {
    await stop(S);
  }
});

test('Блэк: только по приглашению, закрытый чат, UPASS; администрация меняет уровень', async () => {
  const S = await start();
  try {
    const boss = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(boss.userId), 'Артём', 'пароль артёма');
    const nika = await register(S, S.app.createInvite(boss.userId), 'Ника', 'пароль ники');
    assert.equal((await S.call('POST', '/api/levels/black-invite', { token: artem.token, body: { userId: nika.userId } })).status, 403, 'гость не зовёт в Блэк');
    assert.equal((await S.call('POST', '/api/levels/black-invite', { token: boss.token, body: { userId: artem.userId } })).status, 200);
    assert.equal((await S.call('POST', '/api/levels/black-invite', { token: boss.token, body: { userId: artem.userId } })).status, 409);
    let lv = (await S.call('GET', '/api/levels', { token: artem.token })).data;
    assert.equal(lv.blackInvites.length, 1);
    lv = (await S.call('POST', '/api/levels/black-accept', { token: artem.token, body: { inviteId: lv.blackInvites[0].id } })).data;
    assert.equal(lv.tier, 'black');
    assert.match(lv.upass, /^UP-[0-9A-F]{5}-[0-9A-F]{5}$/);
    const st = (await S.call('GET', '/api/state', { token: artem.token })).data;
    assert.ok(st.chats.some((c) => c.id === 'circle:black'), 'закрытый чат Блэк');
    assert.ok(!(await S.call('GET', '/api/state', { token: nika.token })).data.chats.some((c) => c.id === 'circle:black'));
    // Блэк зовёт одного в месяц
    assert.equal((await S.call('POST', '/api/levels/black-invite', { token: artem.token, body: { userId: nika.userId } })).status, 200);
    // администрация: Голд на 7 дней, потом снять
    assert.equal((await S.call('POST', `/api/admin/users/${nika.userId}/tier`, { token: boss.token, body: { tier: 'gold', days: 7 } })).data.tier, 'gold');
    assert.equal((await S.call('POST', `/api/admin/users/${nika.userId}/tier`, { token: boss.token, body: { tier: 'guest' } })).data.tier, 'guest');
    // снять Блэк — уходит из закрытого чата
    await S.call('POST', `/api/admin/users/${artem.userId}/tier`, { token: boss.token, body: { tier: 'guest' } });
    assert.ok(!(await S.call('GET', '/api/state', { token: artem.token })).data.chats.some((c) => c.id === 'circle:black'));
    assert.ok(L.verify(S.app.db).ok);
  } finally {
    await stop(S);
  }
});

test('реестр: Голд заносит, кто первый — того и тапки, авторство по согласованию, цепочка блоков цела', async () => {
  const S = await start();
  try {
    const boss = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(boss.userId), 'Артём', 'пароль артёма');
    const music = (await S.call('GET', '/api/catalog?kind=music', { token: artem.token })).data.items;
    assert.ok(music.some((m) => m.synth === 'dialup' && m.rights === 'verified'), 'хиты Аськи — уже в реестре');
    const song = { kind: 'music', title: 'Ночной город', author: 'Артём', year: 2026, link: 'https://example.com/song', claim: true };
    assert.equal((await S.call('POST', '/api/catalog', { token: artem.token, body: song })).status, 403, 'гостю — только смотреть');
    await S.call('POST', `/api/admin/users/${artem.userId}/tier`, { token: boss.token, body: { tier: 'gold' } });
    const c0 = await coins(S, artem);
    const r = await S.call('POST', '/api/catalog', { token: artem.token, body: song });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.match(r.data.item.token, /^M-\d{6}$/);
    assert.equal(r.data.item.addedByName, 'Артём');
    assert.equal(r.data.item.rights, 'claimed');
    assert.equal(r.data.item.hash.length, 64);
    assert.equal(await coins(S, artem), c0 + 5);
    const dup = await S.call('POST', '/api/catalog', { token: boss.token, body: { ...song, title: 'ночной  ГОРОД!', claim: false } });
    assert.equal(dup.status, 409);
    assert.equal(dup.data.item.addedByName, 'Артём', 'кто первый занёс');
    assert.equal((await S.call('POST', '/api/catalog', { token: boss.token, body: { kind: 'film', title: 'x', author: 'y', link: 'javascript:alert(1)' } })).status, 400);
    // администрация согласовала авторство
    const claims = (await S.call('GET', '/api/admin/catalog', { token: boss.token })).data.claims;
    assert.equal(claims.length, 1);
    const ok = await S.call('POST', `/api/admin/catalog/${claims[0].id}`, { token: boss.token, body: { ok: true } });
    assert.equal(ok.data.item.rights, 'verified');
    assert.ok(ok.data.item.rightsBlock > r.data.item.block);
    const led = (await S.call('GET', '/api/ledger', { token: artem.token })).data;
    assert.ok(led.check.ok);
    assert.ok(led.blocks.some((b) => b.kind === 'catalog.rights' && b.ref === r.data.item.token));
    // подделка старого блока видна сразу
    S.app.db.prepare("UPDATE ledger SET data = '{\"title\":\"подмена\"}' WHERE id = ?").run(r.data.item.block);
    const bad = L.verify(S.app.db);
    assert.equal(bad.ok, false);
    assert.equal(bad.brokenAt, r.data.item.block);
  } finally {
    await stop(S);
  }
});

test('комнаты: вход бесплатный, пишут под своим именем или НФТ-ником, ранги, постояльцы отвечают', async () => {
  const S = await start();
  try {
    const boss = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(boss.userId), 'Артём', 'пароль артёма');
    const ov = (await S.call('GET', '/api/night', { token: artem.token })).data;
    assert.equal(ov.rooms.length, ROOMS.length);
    assert.equal(ov.canWrite, true, 'писать могут все — бесплатно');
    assert.equal(ov.prices.hour, 0);
    assert.equal(ov.rooms.find((r) => r.key === 'portal').president.nick, 'Лиза', 'в «Портале» президент — первый человек АСЬКИ');
    const room = (await S.call('GET', '/api/night/rooms/matrix', { token: artem.token })).data;
    assert.ok(room.messages.length >= 8, 'в комнате уже идёт разговор');
    assert.equal(room.joined, false);
    assert.equal(room.council.president.nick, NIGHT_BOTS.find((b) => b.room === 'matrix' && b.president).nick);
    assert.equal(room.council.advisors.length, 2);
    assert.equal(room.council.keepers.length, 3);
    // гость пишет бесплатно, под своим именем — и сразу в комнате
    const p0 = await S.call('POST', '/api/night/rooms/matrix/messages', { token: artem.token, body: { text: 'привет' } });
    assert.equal(p0.status, 200, JSON.stringify(p0.data));
    assert.equal(p0.data.message.avatar.nick, 'Артём');
    assert.equal(p0.data.message.avatar.profile, true);
    assert.equal((await S.call('GET', '/api/night/rooms/matrix', { token: artem.token })).data.joined, true);
    // пиксельный НФТ-аватар — по желанию (100 🪙, у Голд скидка 20%)
    const coll = (await S.call('GET', '/api/night/collection', { token: artem.token })).data.avatars;
    assert.equal(coll.length, COLLECTION_SIZE);
    assert.ok(coll.find((a) => a.id === 7).taken, 'аватары постояльцев заняты');
    assert.equal((await S.call('POST', '/api/night/avatar', { token: artem.token, body: { id: 7, nick: 'Занятый' } })).status, 409);
    assert.equal((await S.call('POST', '/api/night/avatar', { token: artem.token, body: { id: 50, nick: 'Кролик_404' } })).status, 409, 'ник занят');
    assert.equal((await S.call('POST', '/api/night/avatar', { token: artem.token, body: { id: 50, nick: 'a' } })).status, 400);
    await S.call('POST', `/api/admin/users/${artem.userId}/tier`, { token: boss.token, body: { tier: 'gold' } });
    const c0 = await coins(S, artem);
    const minted = await S.call('POST', '/api/night/avatar', { token: artem.token, body: { id: 50, nick: 'Нео_из_Химок' } });
    assert.equal(minted.status, 200, JSON.stringify(minted.data));
    assert.equal(await coins(S, artem), c0 - 80, 'НФТ 100 🪙, у Голд скидка 20%');
    assert.equal((await S.call('POST', '/api/night/avatar', { token: artem.token, body: { id: 51, nick: 'Второй' } })).status, 409, 'один аватар');
    const posted = await S.call('POST', '/api/night/rooms/matrix/messages', { token: artem.token, body: { text: 'Всем привет из Химок!' } });
    assert.equal(posted.status, 200);
    assert.equal(posted.data.message.avatar.nick, 'Нео_из_Химок');
    assert.ok(['jedi', 'samurai'].includes(posted.data.message.avatar.rank));
    await new Promise((r) => setTimeout(r, 50));
    const after = (await S.call('GET', '/api/night/rooms/matrix', { token: artem.token })).data.messages;
    const mine = after.findIndex((m) => m.id === posted.data.message.id);
    assert.ok(after.slice(mine + 1).some((m) => m.text.includes('Нео_из_Химок') || m.avatar.nick !== 'Нео_из_Химок'), 'постоялец ответил');
    // спасибо за сообщение: +2 к репутации, себе — нельзя (и под своим именем тоже)
    assert.equal((await S.call('POST', `/api/night/messages/${posted.data.message.id}/thanks`, { token: artem.token })).status, 400);
    assert.equal((await S.call('POST', `/api/night/messages/${p0.data.message.id}/thanks`, { token: artem.token })).status, 400);
    assert.equal((await S.call('POST', `/api/night/messages/${posted.data.message.id}/thanks`, { token: boss.token })).data.thanks, 1);
    // старые «зайти» и «оплатить час» — теперь просто бесплатно вступить
    const c1 = await coins(S, artem);
    assert.equal((await S.call('POST', '/api/night/rooms/sofa/enter', { token: artem.token })).data.pass.unlimited, true);
    assert.equal((await S.call('POST', '/api/night/rooms/sofa/pay', { token: artem.token })).status, 200);
    assert.equal(await coins(S, artem), c1, 'ничего не списалось');
    // постоялец сам говорит по расписанию
    const n0 = S.app.db.prepare("SELECT COUNT(*) AS n FROM night_messages WHERE room = 'shar'").get().n;
    await S.app.night.chatter('shar');
    assert.equal(S.app.db.prepare("SELECT COUNT(*) AS n FROM night_messages WHERE room = 'shar'").get().n, n0 + 1);
    assert.ok(L.verify(S.app.db).ok);
  } finally {
    await stop(S);
  }
});

test('места: в приложении и на сервере одинаковые, у каждого — код и флаг', async () => {
  const { PLACES: CLIENT } = await import('../client/src/lib/places.ts');
  assert.deepEqual(CLIENT, PLACES);
  assert.equal(new Set(PLACES.map((p) => p.key)).size, PLACES.length);
  assert.equal(PLACES.find((p) => p.key === 'msk').code, '197');
  assert.equal(PLACES.find((p) => p.key === 'spb').code, '198');
  for (const k of ['bali', 'dubai', 'usa']) assert.ok(PLACES.find((p) => p.key === k)?.flag);
});
