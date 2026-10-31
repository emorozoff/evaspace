// Двенадцатое обновление: зверята-смайлы, гифки по ТЗ, НФТ-галерея (авторы, совладельцы, цена, вещь с номером, сертификат),
// биржа с курсами валют (10 🪙 = $1), копия цепочки на телефонах («свидетели»), правила и цели при регистрации.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createApp } from '../server/src/app.js';
import { split, mediaType } from '../server/src/nft.js';
import { gifFromBrief, cleanGif } from '../server/src/gifs.js';
import { parseCbr } from '../server/src/fx.js';
import { ZOO_EMOJI, SUPER_EMOJI, askaScripted } from '../server/src/personas.js';
import { ZOO } from '../client/src/lib/zoo.ts';
import { SUPER, SFX, superOf } from '../client/src/lib/sfx.ts';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, randomBytes } from '../client/src/lib/crypto.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0, wallReactChance: 0, batyaCardChance: 0, wallEmojiChance: 0, askaReactChance: 0, nightTickMs: 0 };
const CBR = { Date: '2026-10-31T11:30:00+03:00', Valute: { USD: { Nominal: 1, Value: 81.5 }, EUR: { Nominal: 1, Value: 94.2 }, IDR: { Nominal: 10000, Value: 50.1 } } };

async function start() {
  const s = { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v12-')), fetched: [] };
  const fxFetch = async (url) => { s.fetched.push(url); return { ok: true, json: async () => CBR }; };
  s.app = createApp({ dataDir: s.dataDir, publicUrl: 'http://localhost', log: () => {}, botTiming: TIMING, pushSender: async () => {}, fxFetch });
  await new Promise((r) => s.app.server.listen(0, '127.0.0.1', r));
  s.base = `http://127.0.0.1:${s.app.server.address().port}`;
  s.call = async (method, url, { token, body, raw, type } = {}) => {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (body) headers['content-type'] = 'application/json';
    if (raw) headers['content-type'] = type || 'application/octet-stream';
    const res = await fetch(s.base + url, { method, headers, body: raw || (body && JSON.stringify(body)) });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  return s;
}
const stop = async (s) => { await s.app.close(); fs.rmSync(s.dataDir, { recursive: true, force: true }); };
async function register(s, invite, displayName, password, extra = {}) {
  const kp = generateKeyPair();
  const salt = randomBytes(16);
  const { encKey, authKey } = await deriveFromPassword(password, salt);
  const r = await s.call('POST', '/api/register', { body: { invite, displayName, boxPk: toB64(kp.pk), kdfSalt: toB64(salt), authKey: toB64(authKey), backup: sealSecret(kp.sk, encKey), ...extra } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
}
const coins = (s, u) => s.app.db.prepare('SELECT coins FROM users WHERE id = ?').get(u.userId).coins;
const setCoins = (s, u, n) => s.app.db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(n, u.userId);
// крошечный настоящий PNG 1×1
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function fakeAudio() {
  let end = 0;
  const at = (t) => { end = Math.max(end, t); };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime(_, t) { at(t); }, exponentialRampToValueAtTime(_, t) { at(t); } });
  const node = () => ({ type: '', buffer: null, loop: false, curve: null, frequency: param(), gain: param(), Q: param(), connect: (n) => n, start() {}, stop: at });
  const c = { sampleRate: 8000, currentTime: 0, destination: node(), createOscillator: node, createGain: node, createBiquadFilter: node, createBufferSource: node, createWaveShaper: node,
    createBuffer: (_ch, len, rate) => ({ sampleRate: rate, getChannelData: () => new Float32Array(len) }) };
  return { c, end: () => end };
}

test('зверята: 20 штук, свой голос 1,4–2,3 с, движение есть в стилях, сервер знает тех же; у 🦖 новый рык', () => {
  assert.equal(ZOO.length, 20);
  assert.deepEqual(ZOO.map((x) => x.e), ZOO_EMOJI);
  const taken = new Set([...SUPER.map((x) => x.e), ...SFX.map((x) => x.e)]);
  const css = fs.readFileSync(new URL('../client/src/v8.css', import.meta.url), 'utf8') + fs.readFileSync(new URL('../client/src/v12.css', import.meta.url), 'utf8');
  for (const x of ZOO) {
    assert.ok(!taken.has(x.e), `${x.e} не пересекается с другими смайлами`);
    const a = fakeAudio();
    x.sound(a.c, a.c.destination, 0);
    assert.ok(a.end() >= 1.4 && a.end() <= 2.3, `${x.e} ${x.name}: ${a.end().toFixed(2)} с`);
    assert.ok(css.includes(`.ss-${x.anim} {`) && css.includes(`@keyframes ss-${x.anim} `), `${x.e}: движение ${x.anim}`);
    assert.equal(superOf(x.e), x, 'зверёнок живёт в беседе как супер-смайл');
  }
  const dino = SUPER.find((x) => x.e === '🦖');
  const a = fakeAudio();
  dino.sound(a.c, a.c.destination, 0);
  assert.ok(a.end() >= 1.8 && a.end() <= 2.3);
  assert.ok(!SUPER_EMOJI.some((e) => ZOO_EMOJI.includes(e)));
  assert.ok(ZOO_EMOJI.includes(askaScripted('🐶', {})[0]), 'на зверёнка Аська отвечает зверёнком');
});

test('гифки по ТЗ: словарь без «мозга», проверка, генерация через API', async () => {
  const g = gifFromBrief('динозаврик танцует под дождём, подпись "РРР"');
  assert.equal(g.e.startsWith('🦖'), true);
  assert.equal(g.cap, 'РРР');
  assert.equal(g.anim, 'dance');
  assert.equal(g.fx, 'rain');
  assert.equal(g.snd, '🦖', 'у гифки с динозавром — его рык');
  assert.equal(cleanGif({ e: '<img src=x>', cap: 'x' }), null);
  assert.equal(cleanGif({ e: '🐱', cap: 'x', anim: 'hack', bg: ['url(x)', '#000'] }).anim, 'bounce');
  const S = await start();
  try {
    const u = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const r = await S.call('POST', '/api/gifs/make', { token: u.token, body: { brief: 'котик спит на солнышке' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.by, 'rules');
    assert.ok(r.data.spec.e.includes('🐱'));
    assert.equal((await S.call('POST', '/api/gifs/make', { token: u.token, body: { brief: '' } })).status, 400);
  } finally { await stop(S); }
});

test('НФТ: файл по первым байтам, автор и совладельцы с долями, цена, первая продажа — по долям, перепродажа — 90/10, вещь с номером, сертификат в цепочке', async () => {
  assert.equal(mediaType(PNG).mime, 'image/png');
  assert.equal(mediaType(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.deepEqual(split(10, [{ userId: 1, share: 70 }, { userId: 2, share: 30 }]), [{ userId: 1, coins: 7 }, { userId: 2, coins: 3 }]);
  assert.equal(split(7, [{ userId: 1, share: 50 }, { userId: 2, share: 50 }]).reduce((n, p) => n + p.coins, 0), 7, 'остаток не теряется');
  const S = await start();
  try {
    const liza = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(liza.userId), 'Артём', 'пароль артёма');
    const nika = await register(S, S.app.createInvite(liza.userId), 'Ника', 'пароль ники');
    const maks = await register(S, S.app.createInvite(liza.userId), 'Макс', 'пароль макса');
    // фото: загрузка, выпуск с совладельцем Артёмом (30%) и кольцом с номером
    assert.equal((await S.call('POST', '/api/nft/media', { token: liza.token, raw: Buffer.from('not a picture at all'), type: 'image/png' })).status, 400);
    const up = (await S.call('POST', '/api/nft/media', { token: liza.token, raw: PNG, type: 'image/png' })).data;
    assert.equal(up.kind, 'photo');
    assert.equal(up.hash, crypto.createHash('sha256').update(PNG).digest('hex'));
    // чужой файл выпустить нельзя
    assert.equal((await S.call('POST', '/api/nft', { token: artem.token, body: { kind: 'photo', title: 'Чужое', media: up.id } })).status, 400);
    assert.equal((await S.call('POST', '/api/nft', { token: liza.token, body: { kind: 'photo', title: 'Закат', media: up.id, coauthors: [{ userId: artem.userId, share: 100 }] } })).data.error, 'bad_share');
    const m = await S.call('POST', '/api/nft', { token: liza.token, body: { kind: 'photo', title: 'Закат на Бали', about: 'наше лето', media: up.id, price: 100,
      coauthors: [{ userId: artem.userId, share: 30 }], physical: { kind: 'ring', serial: 'AU-750-0001', note: 'золото, гравировка' } } });
    assert.equal(m.status, 200, JSON.stringify(m.data));
    const n = m.data.nft;
    assert.match(n.token, /^P-0+\d+$/);
    assert.deepEqual(n.rights.map((r) => [r.name, r.share, r.role]), [['Лиза', 70, 'author'], ['Артём', 30, 'coauthor']]);
    assert.equal(n.physical.serial, 'AU-750-0001');
    assert.equal(n.mediaHash, up.hash);
    // номер вещи уникален
    const up2 = (await S.call('POST', '/api/nft/media', { token: liza.token, raw: PNG, type: 'image/png' })).data;
    assert.equal((await S.call('POST', '/api/nft', { token: liza.token, body: { kind: 'photo', title: 'Копия', media: up2.id, physical: { kind: 'necklace', serial: 'AU-750-0001' } } })).data.error, 'serial_taken');
    // покупка: Ника платит 100 → Лиза 70, Артём 30
    setCoins(S, nika, 150); setCoins(S, liza, 0); setCoins(S, artem, 0);
    assert.equal((await S.call('POST', `/api/nft/${n.id}/buy`, { token: liza.token })).status, 403, 'своё не купить');
    const b1 = await S.call('POST', `/api/nft/${n.id}/buy`, { token: nika.token });
    assert.equal(b1.status, 200, JSON.stringify(b1.data));
    assert.equal(coins(S, nika), 50);
    assert.equal(coins(S, liza), 70);
    assert.equal(coins(S, artem), 30);
    assert.equal(b1.data.nft.ownerId, nika.userId);
    assert.equal(b1.data.nft.forSale, false);
    // перепродажа: Ника выставляет за 200, Макс покупает → Нике 180, правообладателям 20 (Лиза 14, Артём 6)
    assert.equal((await S.call('POST', `/api/nft/${n.id}/price`, { token: liza.token, body: { price: 1 } })).status, 403, 'цену меняет владелец');
    await S.call('POST', `/api/nft/${n.id}/price`, { token: nika.token, body: { price: 200, forSale: true } });
    setCoins(S, maks, 199);
    assert.equal((await S.call('POST', `/api/nft/${n.id}/buy`, { token: maks.token })).data.error, 'no_coins');
    setCoins(S, maks, 200);
    assert.equal((await S.call('POST', `/api/nft/${n.id}/buy`, { token: maks.token })).status, 200);
    assert.equal(coins(S, nika), 50 + 180);
    assert.equal(coins(S, liza), 70 + 14);
    assert.equal(coins(S, artem), 30 + 6);
    // сертификат: история владельцев и блоки в цепочке (выпуск, продажа, цена, продажа)
    const full = (await S.call('GET', `/api/nft/${n.id}`, { token: artem.token })).data.nft;
    assert.deepEqual(full.tradeList.map((t) => [t.sellerName, t.buyerName, t.price]), [['Лиза', 'Ника', 100], ['Ника', 'Макс', 200]]);
    assert.deepEqual(full.blocks.map((b) => b.kind), ['nft.mint', 'nft.sale', 'nft.price', 'nft.sale']);
    assert.equal(full.blocks[0].data.physical.serial, 'AU-750-0001');
    assert.equal(full.blocks[0].data.sha256, up.hash);
    assert.equal((await S.call('GET', '/api/ledger', { token: liza.token })).data.check.ok, true);
    // файл отдаётся кусками (для видео на iPhone)
    const part = await fetch(`${S.base}/api/nft/media/${up.id}`, { headers: { authorization: `Bearer ${artem.token}`, range: 'bytes=0-7' } });
    assert.equal(part.status, 206);
    // гифка-НФТ по ТЗ: по умолчанию 10 🪙; удалить автор может, пока не продавалась
    const spec = (await S.call('POST', '/api/gifs/make', { token: artem.token, body: { brief: 'пёс танцует, подпись "ГАВ"' } })).data.spec;
    const gm = await S.call('POST', '/api/nft', { token: artem.token, body: { kind: 'gif', title: 'Гав-гав', spec, brief: 'пёс танцует' } });
    assert.equal(gm.data.nft.price, 10);
    assert.match(gm.data.nft.token, /^G-/);
    assert.equal(gm.data.nft.spec.cap, 'ГАВ');
    assert.equal((await S.call('DELETE', `/api/nft/${gm.data.nft.id}`, { token: nika.token })).status, 403, "чужую не убрать (администрация — может)");
    assert.equal((await S.call('DELETE', `/api/nft/${gm.data.nft.id}`, { token: artem.token })).status, 200);
    assert.equal((await S.call('DELETE', `/api/nft/${n.id}`, { token: artem.token })).status, 403, 'проданное и чужое не удалить');
    // списки: моё, на продаже
    assert.equal((await S.call('GET', '/api/nft?mine=1', { token: maks.token })).data.items.length, 1);
    assert.equal((await S.call('GET', '/api/nft?authored=1', { token: artem.token })).data.items.length, 1, 'совладелец видит НФТ среди своих');
  } finally { await stop(S); }
});

test('биржа: курсы ЦБ, 10 🪙 = $1, рынок НФТ; цепочка на телефоне и свидетели; правила и цели при регистрации', async () => {
  const p = parseCbr(CBR);
  assert.equal(p.rates.USD, 81.5);
  assert.ok(Math.abs(p.rates.IDR - 0.00501) < 1e-6, 'номинал учитывается');
  const S = await start();
  try {
    const liza = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы', { charter: true });
    assert.ok(S.app.db.prepare('SELECT charter_at FROM users WHERE id = ?').get(liza.userId).charter_at > 0);
    const fx = (await S.call('GET', '/api/fx', { token: liza.token })).data;
    assert.equal(fx.source, 'cbr');
    assert.equal(fx.ask.usd, 0.1);
    assert.equal(fx.rates.USD, 81.5);
    assert.ok(Math.abs(fx.ask.rub - 8.15) < 1e-9, '1 🪙 = $0.10 = 8,15 ₽');
    assert.ok(fx.approx.includes('THB'), 'чего нет у ЦБ — примерно');
    assert.ok(fx.market && typeof fx.market.volume24h === 'number');
    assert.ok(S.fetched.some((u) => u.includes('cbr-xml-daily.ru')));
    // цепочка: телефон скачивает блоки, сам проверяет хеши и становится свидетелем
    S.app.db.prepare('UPDATE users SET tier = ? WHERE id = ?').run('black', liza.userId);
    const ch = (await S.call('GET', '/api/ledger/chain?after=0', { token: liza.token })).data;
    assert.ok(ch.blocks.length >= 1);
    let prev = '0'.repeat(64);
    for (const b of ch.blocks) {
      assert.equal(b.prev, prev);
      assert.equal(crypto.createHash('sha256').update(`${b.prev}|${b.id}|${b.kind}|${b.ref}|${b.actor ?? ''}|${b.data}|${b.at}`).digest('hex'), b.hash, 'телефон считает хеш так же, как сервер');
      prev = b.hash;
    }
    assert.equal((await S.call('POST', '/api/ledger/witness', { token: liza.token, body: { block: ch.head.block, hash: 'f'.repeat(64) } })).status, 409);
    const w = (await S.call('POST', '/api/ledger/witness', { token: liza.token, body: ch.head })).data;
    assert.equal(w.witnesses, 1);
    assert.equal(w.atHead, 1);
  } finally { await stop(S); }
});

test('Аська-консьерж: все в общем чате, привет новичку, ответ на зов; приветственный видеоквадратик Аськи', async () => {
  const { decodeIncoming } = await import('../server/src/seal.js');
  const P = await import('../server/src/personas.js');
  assert.match(P.conciergeHello('Ника', 'Лиза'), /Ника.*позвал\(а\) Лиза/);
  assert.ok(P.welcomeClip('Ника').length >= 3 && P.welcomeClip('Ника')[0].includes('Ника'));
  const S = await start();
  try {
    const liza = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const nika = await register(S, S.app.createInvite(liza.userId), 'Ника', 'пароль ники');
    const db = S.app.db;
    const aska = db.prepare("SELECT * FROM users WHERE kind = 'aska'").get();
    const members = db.prepare("SELECT user_id FROM chat_members WHERE chat_id = 'general'").all().map((r) => r.user_id);
    assert.ok(members.includes(aska.id) && members.includes(liza.userId) && members.includes(nika.userId), 'в общем чате все участники и Аська');
    const own = (chatId) => db.prepare(`SELECT m.id, m.chat_id AS chatId, m.uuid, b.nonce AS n, b.ct AS c FROM messages m JOIN message_boxes b ON b.message_id = m.id AND b.recipient_id = ?
      WHERE m.chat_id = ? AND m.sender_id = ? ORDER BY m.id`).all(aska.id, chatId, aska.id).map((r) => decodeIncoming(r, aska.box_pk, aska.bot_sk)).filter(Boolean);
    // привет новичку в общем чате
    let hello = [];
    for (let i = 0; i < 100 && !hello.some((b) => b.text?.includes('Ника')); i++) { await new Promise((r) => setTimeout(r, 30)); hello = own('general'); }
    assert.ok(hello.some((b) => /Знакомьтесь: Ника/.test(b.text || '')), JSON.stringify(hello));
    // приветственный видеоквадратик в личке
    const dm = `dm:${Math.min(aska.id, nika.userId)}:${Math.max(aska.id, nika.userId)}`;
    let clips = [];
    for (let i = 0; i < 100 && !clips.length; i++) { await new Promise((r) => setTimeout(r, 30)); clips = own(dm).filter((b) => b.clip); }
    assert.ok(clips[0].clip.lines[0].includes('Ника'));
    assert.ok(clips[0].text, 'для старых приложений — текстом');
  } finally { await stop(S); }
});
