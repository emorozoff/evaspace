// Третья версия: номера-токены разных стран и регионов (купить, улучшить, продать), аськоины,
// голд-админы (золотая серия АМР), блокировка, супер-админ (в приложении и из консоли), переезд старых номеров.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createApp } from '../server/src/app.js';
import { parsePlate, formatCode, plateKey, rarityOf, regionForCity, countryForPhone, partsOf, isGoldCode } from '../server/src/plates.js';
import { generateKeyPair, deriveFromPassword, sealSecret, openSecret, toB64, fromB64, randomBytes, publicFromSecret } from '../client/src/lib/crypto.ts';

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
  return { ...r.data, status: r.status, kp: k.kp };
}
async function login(s, name, password) {
  const { data: { salt } } = await s.call('GET', `/api/salt?login=${encodeURIComponent(name)}`);
  const { authKey, encKey } = await deriveFromPassword(password, fromB64(salt));
  const r = await s.call('POST', '/api/login', { body: { login: name, authKey: toB64(authKey) } });
  return { ...r, encKey };
}
const st = (s, u) => s.call('GET', '/api/state', { token: u.token }).then((r) => r.data);
const me = async (s, u) => (await s.call('GET', '/api/plates/me', { token: u.token })).data;

test('номера разных стран: разбор, вид, ключ, редкость, регион', () => {
  assert.equal(parsePlate('а001мр', 'RU'), 'А001МР777');
  assert.equal(parsePlate('В 777 ОР 116', 'RU'), 'В777ОР116');
  assert.equal(parsePlate('1234 ab-7', 'BY'), '1234AB-7');
  assert.equal(parsePlate('777 aaa 02', 'KZ'), '777AAA02');
  assert.equal(parsePlate('b ab 1234', 'DE'), 'B-AB1234');
  assert.equal(parsePlate('7AAA777', 'US'), '7AAA777');
  assert.equal(parsePlate('a 777', 'AE'), 'A777');
  assert.equal(parsePlate('мусор', 'BY'), null);
  assert.equal(formatCode('RU', 'А001МР777'), 'А 001 МР 777');
  assert.equal(formatCode('BY', '1234AB-7'), '1234 AB-7');
  assert.equal(formatCode('DE', 'B-AB1234'), 'B AB 1234');
  assert.equal(plateKey('А 001 МР 777'), plateKey('a001mp777'), 'кириллица и латиница — один номер');
  assert.equal(rarityOf('RU', 'В304КТ777'), 0);
  assert.equal(rarityOf('RU', 'В112КТ777'), 1);
  assert.equal(rarityOf('RU', 'В121КТ777'), 2);
  assert.equal(rarityOf('RU', 'В111КТ777'), 3);
  assert.equal(rarityOf('RU', 'В777КТ777'), 4);
  assert.equal(rarityOf('RU', 'Е304КХ777'), 1, 'особая серия ЕКХ дороже');
  assert.ok(isGoldCode('RU', 'А304МР777') && !isGoldCode('RU', 'В304МР777'));
  assert.deepEqual(regionForCity('Казань'), { country: 'RU', region: '116' });
  assert.deepEqual(regionForCity('Минск'), { country: 'BY', region: '7' });
  assert.equal(countryForPhone('+375291234567'), 'BY');
  assert.equal(countryForPhone('+77011234567'), 'KZ');
  assert.equal(countryForPhone('+79161234567'), 'RU');
});

let S;
const U = {};
before(async () => {
  S = mk(fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v3-')));
  await S.listen();
});
after(async () => {
  await S.app.close();
  fs.rmSync(S.dataDir, { recursive: true, force: true });
});

test('регистрация: голд у первого, номер страны по телефону, стартовые аськоины, бонус за друга', async () => {
  U.boss = await register(S, S.app.createInvite(null), 'Кирилл', 'пароль босса', '+79990000001');
  assert.equal(U.boss.plate, 'А001МР777');
  const inv = (await S.call('POST', '/api/invites', { token: U.boss.token })).data.code;
  U.ann = await register(S, inv, 'Аня', 'пароль ани', '+79160000002');
  assert.ok(partsOf('RU', U.ann.plate) && !isGoldCode('RU', U.ann.plate), 'обычный российский номер, не АМР');
  const inv2 = (await S.call('POST', '/api/invites', { token: U.boss.token })).data.code;
  U.max = await register(S, inv2, 'Макс', 'пароль макса', '+375291112233');
  assert.match(U.max.plate, /^\d{4}[A-Z]{2}-7$/, 'из Беларуси — белорусский номер');

  const s1 = await st(S, U.boss);
  assert.equal(s1.profile.role, 'admin');
  assert.equal(s1.users.find((u) => u.id === U.boss.userId).gold, true, 'у голд золотой значок');
  assert.equal(s1.users.find((u) => u.id === U.ann.userId).gold, false);
  assert.equal(s1.users.find((u) => u.id === U.max.userId).plateCountry, 'BY');
  // 100 на старт + 2×50 за друзей + 40 за вход сегодня (с десятой версии админ — не ниже Голд, у Голд бонус 40)
  assert.equal(s1.profile.bonus, 40);
  assert.equal(s1.profile.coins, 240);
  assert.equal((await st(S, U.boss)).profile.bonus, 0, 'бонус за вход — раз в день');
  assert.equal((await login(S, `${U.max.plate.slice(0, 4)} ${U.max.plate.slice(4).toLowerCase()}`, 'пароль макса')).status, 200, 'вход по белорусскому номеру');
});

test('витрина, покупка, основной номер, улучшение, продажа другому', async () => {
  const market = (await S.call('GET', '/api/plates/market', { token: U.ann.token })).data;
  assert.ok(market.showcase.length >= 10, 'популярные номера на витрине');
  assert.ok(market.showcase.some((p) => p.country === 'BY') && market.showcase.some((p) => p.country === 'US'), 'есть номера разных стран');
  assert.ok(!market.showcase.some((p) => p.gold), 'золотые не продаются');
  const cheap = market.showcase.reduce((a, b) => (a.price < b.price ? a : b));

  const poor = await S.call('POST', '/api/plates/buy', { token: U.ann.token, body: { plateId: cheap.id } });
  if (cheap.price > 120) assert.equal(poor.status, 402, 'не хватает аськоинов');
  assert.equal((await S.call('POST', `/api/admin/users/${U.ann.userId}/coins`, { token: U.boss.token, body: { delta: 20000 } })).status, 200);
  const bought = await S.call('POST', '/api/plates/buy', { token: U.ann.token, body: { plateId: cheap.id, activate: true } });
  assert.equal(bought.status, 200, JSON.stringify(bought.data));
  assert.equal((await st(S, U.ann)).users.find((u) => u.id === U.ann.userId).plate, cheap.code, 'стал основным');
  assert.equal((await login(S, U.ann.plate, 'пароль ани')).status, 200, 'по прежнему номеру войти можно');

  // свой вариант: Казань, 116 регион
  const q = (await S.call('POST', '/api/plates/quote', { token: U.ann.token, body: { country: 'RU', region: '116', code: 'К 555 ТТ' } })).data;
  assert.equal(q.code, 'К555ТТ116');
  assert.equal(q.free, true);
  assert.ok(q.price >= 1200, 'красивые цифры и одинаковые буквы — дорого');
  const own = await S.call('POST', '/api/plates/buy', { token: U.ann.token, body: { country: 'RU', region: '116', code: 'К555ТТ' } });
  assert.equal(own.status, 200);
  assert.equal((await S.call('POST', '/api/plates/buy', { token: U.max.token, body: { country: 'RU', region: '116', code: 'К555ТТ' } })).status, 409, 'занят');
  assert.equal((await S.call('POST', '/api/plates/buy', { token: U.ann.token, body: { country: 'RU', code: 'А 555 МР' } })).status, 403, 'золотая серия — только голд');

  // улучшение
  const up = await S.call('POST', `/api/plates/${own.data.plate.id}/upgrade`, { token: U.ann.token });
  assert.equal(up.data.plate.level, 1);
  assert.equal(up.data.plate.levelName, 'Серебро');

  // продажа: основной нельзя, другой — можно
  const active = (await me(S, U.ann)).activeId;
  assert.equal((await S.call('POST', `/api/plates/${active}/list`, { token: U.ann.token, body: { price: 10 } })).status, 400);
  assert.equal((await S.call('POST', `/api/plates/${own.data.plate.id}/list`, { token: U.ann.token, body: { price: 90 } })).status, 200);
  const annBefore = (await me(S, U.ann)).coins;
  const maxBuys = await S.call('POST', '/api/plates/buy', { token: U.max.token, body: { plateId: own.data.plate.id } });
  assert.equal(maxBuys.status, 200, JSON.stringify(maxBuys.data));
  assert.equal((await me(S, U.ann)).coins, annBefore + 90, 'продавец получил аськоины');
  const card = (await S.call('GET', `/api/plates/${own.data.plate.id}`, { token: U.ann.token })).data.plate;
  assert.equal(card.ownerName, 'Макс');
  assert.equal(card.level, 1, 'улучшение остаётся у номера');
  assert.deepEqual(card.history.map((h) => h.kind), ['buy', 'upgrade', 'list', 'sale']);
  assert.match(card.token, /^#\d{4}$/);
});

test('голд: назначить, снять (только супер-админ), блокировка, смена номера', async () => {
  // Назначаю Аню голд — получает золотой номер с теми же цифрами
  assert.equal((await S.call('POST', `/api/admin/users/${U.ann.userId}/role`, { token: U.ann.token, body: { role: 'admin' } })).status, 403, 'не админ — нельзя');
  assert.equal((await S.call('POST', `/api/admin/users/${U.ann.userId}/role`, { token: U.boss.token, body: { role: 'admin' } })).status, 200);
  let ann = (await st(S, U.boss)).users.find((u) => u.id === U.ann.userId);
  assert.equal(ann.gold, true);
  assert.ok(isGoldCode('RU', ann.plate), 'у голд номер серии АМР');
  // Админ не может снять другого админа — только супер-админ
  assert.equal((await S.call('POST', `/api/admin/users/${U.ann.userId}/role`, { token: U.boss.token, body: { role: 'user' } })).status, 403);

  // Админ меняет номер Максу
  const set = await S.call('POST', `/api/admin/users/${U.max.userId}/plate`, { token: U.boss.token, body: { country: 'KZ', code: '123 ABC 02' } });
  assert.equal(set.status, 200, JSON.stringify(set.data));
  assert.equal((await st(S, U.max)).users.find((u) => u.id === U.max.userId).plate, '123ABC02');
  assert.equal((await S.call('POST', `/api/admin/users/${U.max.userId}/plate`, { token: U.boss.token, body: { country: 'RU', code: 'А 123 МР' } })).status, 400, 'золотой — только голд');
  assert.equal((await S.call('POST', `/api/admin/users/${U.max.userId}/plate`, { token: U.boss.token, body: { country: 'RU', code: '001' } })).status, 400);
  const taken = await S.call('POST', `/api/admin/users/${U.max.userId}/plate`, { token: U.boss.token, body: { country: 'RU', code: ann.plate } });
  assert.ok([400, 409].includes(taken.status), 'чужой номер не отдать');

  // Блокировка
  assert.equal((await S.call('POST', `/api/admin/users/${U.max.userId}/block`, { token: U.boss.token, body: { blocked: true } })).status, 200);
  assert.equal((await S.call('GET', '/api/state', { token: U.max.token })).status, 401, 'сессия закрыта');
  const blockedLogin = await login(S, '+375291112233', 'пароль макса');
  assert.equal(blockedLogin.status, 403);
  assert.equal(blockedLogin.data.error, 'blocked');
  const general = (await st(S, U.boss)).chats.find((c) => c.id === 'general');
  assert.ok(!general.members.some((m) => m.userId === U.max.userId), 'убран из общего чата');
  assert.equal((await st(S, U.boss)).users.find((u) => u.id === U.max.userId).blocked, true);
  assert.equal((await S.call('POST', `/api/admin/users/${U.max.userId}/block`, { token: U.boss.token, body: { blocked: false } })).status, 200);
  const back = await login(S, '+375291112233', 'пароль макса');
  assert.equal(back.status, 200);
  U.max.token = back.data.token;
  assert.ok((await st(S, U.boss)).chats.find((c) => c.id === 'general').members.some((m) => m.userId === U.max.userId), 'вернулся в общий чат');
});

test('супер-админ: создаётся один раз, им нельзя управлять, он снимает голд', async () => {
  const k = await keysFor('пароль супер-админа');
  const r = await S.call('POST', '/api/admin/super', { token: U.boss.token, body: { login: 'Big_Boss', ...k.body } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.plate, 'А777МР777');
  assert.equal((await S.call('POST', '/api/admin/super', { token: U.boss.token, body: { login: 'another', ...(await keysFor('xxxxxx')).body } })).status, 409, 'второго не бывает');
  const sup = await login(S, 'BIG_BOSS', 'пароль супер-админа');
  assert.equal(sup.status, 200);
  assert.deepEqual(publicFromSecret(openSecret(sup.data.backup, sup.encKey)), k.kp.pk);
  const supTok = sup.data.token;
  assert.equal((await S.call('GET', '/api/admin', { token: supTok })).data.me.role, 'super');
  assert.equal((await S.call('POST', `/api/admin/users/${sup.data.userId}/block`, { token: U.boss.token, body: { blocked: true } })).status, 403, 'супер-админа не заблокировать');
  // супер-админ снимает голд с Ани — золотые номера возвращаются АСЬКЕ
  assert.equal((await S.call('POST', `/api/admin/users/${U.ann.userId}/role`, { token: supTok, body: { role: 'user' } })).status, 200);
  const ann = (await st(S, U.boss)).users.find((u) => u.id === U.ann.userId);
  assert.equal(ann.gold, false);
  assert.ok(!isGoldCode('RU', ann.plate));
  assert.ok(!(await me(S, U.ann)).plates.some((p) => p.gold), 'золотых номеров у неё больше нет');
});

test('из консоли: супер-админ с паролем и переезд старых номеров АМР', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aska-cli-'));
  let s = mk(dir);
  await s.listen();
  const boss = await register(s, s.app.createInvite(null), 'Босс', 'пароль босса', '+79990000001');
  const inv = (await s.call('POST', '/api/invites', { token: boss.token })).data.code;
  const old = await register(s, inv, 'Старый', 'пароль старого', '+79990000002');
  // как было во второй версии: у обычного человека номер серии АМР и нет токена
  s.app.db.prepare('UPDATE users SET plate = ?, plate_id = NULL WHERE id = ?').run('А304МР777', old.userId);
  s.app.db.prepare('DELETE FROM plate_history WHERE plate_id IN (SELECT id FROM plates WHERE owner_id = ?)').run(old.userId);
  s.app.db.prepare('DELETE FROM plates WHERE owner_id = ?').run(old.userId);
  await s.app.close();

  // консоль: пароль из переменной — в коде его нет
  const out = execFileSync('node', ['--disable-warning=ExperimentalWarning', 'server/src/cli.js', 'superadmin', 'Test_Master'],
    { env: { ...process.env, DATA_DIR: dir, ASKA_PASSWORD: 'консольный пароль' } }).toString();
  assert.match(out, /Создан супер-админ Test_Master/);

  s = mk(dir);
  await s.listen();
  const sup = await login(s, 'test_master', 'консольный пароль');
  assert.equal(sup.status, 200, 'ключи из консоли открываются паролем, как с телефона');
  assert.ok(openSecret(sup.data.backup, sup.encKey));
  const users = (await s.call('GET', '/api/state', { token: sup.data.token })).data.users;
  const moved = users.find((u) => u.id === old.userId);
  assert.match(moved.plate, /^[А-Я]304[А-Я]{2}777$/, 'те же цифры');
  assert.ok(!isGoldCode('RU', moved.plate), 'но уже не золотая серия');
  assert.equal(users.find((u) => u.id === boss.userId).plate, 'А001МР777', 'у голд осталась');
  assert.equal((await login(s, 'а304мр', 'пароль старого')).status, 200, 'по старому номеру АМР войти можно');
  assert.equal((await login(s, moved.plate, 'пароль старого')).status, 200, 'и по новому');
  assert.equal(users.find((u) => u.id === sup.data.userId).gold, true);
  await s.app.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
