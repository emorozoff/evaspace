// Восьмое обновление: супер-смайлы (свой звук на 2 секунды) и прикольные символы в комментариях.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { SUPER_EMOJI, PEOPLE, personScripted, askaScripted } from '../server/src/personas.js';
import { SUPER, superOf, KAOMOJI, SYMBOLS, SFX } from '../client/src/lib/sfx.ts';
import { generateKeyPair, deriveFromPassword, sealSecret, toB64, randomBytes } from '../client/src/lib/crypto.ts';

const TIMING = { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, alwaysOnline: true, circleChance: 0, chainChance: 0, wallReactChance: 0, batyaCardChance: 0, wallEmojiChance: 0, askaReactChance: 0 };

async function start() {
  const s = { dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'aska-v8-')) };
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

// Ненастоящий WebAudio: запоминаем, когда звук замолкает
function fakeAudio() {
  let end = 0;
  const at = (t) => { end = Math.max(end, t); };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime(_, t) { at(t); }, exponentialRampToValueAtTime(_, t) { at(t); } });
  const node = () => ({ type: '', buffer: null, loop: false, frequency: param(), gain: param(), Q: param(), connect: (n) => n, start() {}, stop: at });
  const c = { sampleRate: 8000, currentTime: 0, destination: node(), createOscillator: node, createGain: node, createBiquadFilter: node, createBufferSource: node,
    createBuffer: (_ch, len, rate) => ({ sampleRate: rate, getChannelData: () => new Float32Array(len) }) };
  return { c, end: () => end };
}

test('супер-смайлы: 20 штук, у каждого свой звук около 2 секунд, свои движения', () => {
  assert.equal(SUPER.length, 20);
  assert.deepEqual(SUPER.map((x) => x.e), SUPER_EMOJI, 'сервер и приложение знают одни и те же супер-смайлы');
  assert.equal(new Set(SUPER.map((x) => x.e)).size, 20);
  const sfx = new Set(SFX.map((x) => x.e));
  for (const x of SUPER) {
    assert.ok(!sfx.has(x.e), `${x.e} не пересекается со звуковыми смайлами`);
    assert.ok(x.name && x.anim && x.glow, x.e);
    const a = fakeAudio();
    x.sound(a.c, a.c.destination, 0);
    assert.ok(a.end() >= 1.4 && a.end() <= 2.3, `${x.e} ${x.name}: звук ${a.end().toFixed(2)} с`);
    assert.equal(superOf(` ${x.e} `), x, 'узнаётся и с пробелами');
  }
  assert.equal(superOf('🤪 привет'), undefined, 'только если сообщение — один смайл');
  // у каждого движения есть анимация в стилях
  const css = fs.readFileSync(new URL('../client/src/v8.css', import.meta.url), 'utf8');
  for (const anim of new Set(SUPER.map((x) => x.anim))) {
    assert.ok(css.includes(`.ss-${anim} {`) && css.includes(`@keyframes ss-${anim} `), anim);
  }
  assert.ok(KAOMOJI.length >= 15 && SYMBOLS.length >= 30);
});

test('комментарии: прикольные символы и супер-смайлы доходят как есть', async () => {
  const S = await start();
  try {
    const liza = await register(S, S.app.createInvite(null), 'Лиза', 'пароль лизы');
    const artem = await register(S, S.app.createInvite(null), 'Артём', 'пароль артёма');
    await S.app.bots.idle();
    const post = (await S.call('POST', `/api/wall/${liza.userId}`, { token: artem.token, body: { kind: 'text', text: 'кто в кино?' } })).data.post;
    const say = (text) => S.call('POST', `/api/wall/posts/${post.id}/comments`, { token: liza.token, body: { text } });
    for (const t of ['¯\\_(ツ)_/¯', '( ͡° ͜ʖ ͡°)', '(╯°□°)╯︵ ┻━┻', 'ʕ•ᴥ•ʔ я ♥ кино ★', '😵‍💫', '🥳', '👨‍👩‍👧 семьёй']) {
      const r = await say(t);
      assert.equal(r.status, 200, t);
      assert.equal(r.data.comment.text, t, `«${t}» не испортился`);
    }
    // невидимые и «переворачивающие» знаки по-прежнему вырезаются
    assert.equal((await say('при‮вет​!')).data.comment.text, 'привет!');
    const feed = (await S.call('GET', '/api/wall/feed', { token: artem.token })).data.posts.find((p) => p.id === post.id);
    assert.ok(feed.comments.some((c) => c.text === '😵‍💫'));
    // Аська рассказала о супер-смайлах записью на своей стене и сразу показала один
    const askaId = (await S.call('GET', '/api/state', { token: liza.token })).data.users.find((u) => u.kind === 'aska').id;
    const news = (await S.call('GET', `/api/wall/${askaId}`, { token: liza.token })).data.posts.find((p) => p.text.includes('супер-смайлы'));
    assert.ok(news, 'запись об обновлении');
    assert.equal(news.comments[0]?.text, '🥳');
  } finally {
    await S.app.close();
    fs.rmSync(S.dataDir, { recursive: true, force: true });
  }
});

test('на супер-смайл Аська и друзья отвечают супер-смайлом', () => {
  for (let i = 0; i < 20; i++) {
    const a = askaScripted('🤪', { name: 'Лиза' });
    assert.ok(SUPER_EMOJI.includes(a[0]) && a[0] !== '🤪', a[0]);
    const per = PEOPLE[i % PEOPLE.length];
    const p = personScripted('🥳', per);
    assert.ok(SUPER_EMOJI.includes(p[0]) && p[0] !== '🥳', `${per.name}: ${p[0]}`);
  }
  assert.ok(askaScripted('как отправить смайл?', {})[0].includes('Супер'));
});
