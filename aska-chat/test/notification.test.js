// Текст уведомления, который собирает service worker на телефоне.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, toB64 } from '../client/src/lib/crypto.ts';
import { encodeOutgoing } from '../client/src/lib/protocol.ts';
import { buildNotification } from '../client/src/sw-logic.ts';

const alice = generateKeyPair();
const bob = generateKeyPair();
const users = {
  1: { id: 1, username: 'alice', displayName: 'Алиса', pk: toB64(alice.pk) },
  2: { id: 2, username: 'bob', displayName: 'Боря', pk: toB64(bob.pk) },
};
const chats = {
  general: { id: 'general', kind: 'general', title: 'Общий чат', members: [], lastId: 0 },
  'dm:1:2': { id: 'dm:1:2', kind: 'dm', title: null, members: [], lastId: 0 },
};
const bobView = { keys: { pk: toB64(bob.pk), sk: toB64(bob.sk) }, users, chats };
const members = [{ id: 1, pk: alice.pk }, { id: 2, pk: bob.pk }];

function pushFor(chatId, body) {
  const boxes = encodeOutgoing(chatId, 'u-1', body, members, 1, alice.sk);
  const b = boxes.find((x) => x.to === 2);
  return { t: 'm', c: chatId, s: 1, i: 5, pn: b.pn, pc: b.pc, b: 1 };
}

test('общий чат: название чата, имя и текст', () => {
  const n = buildNotification(pushFor('general', { kind: 'text', text: 'Идём гулять?' }), bobView);
  assert.deepEqual(n, { title: 'Общий чат', body: 'Алиса: Идём гулять?' });
});

test('личный чат: имя и текст', () => {
  const n = buildNotification(pushFor('dm:1:2', { kind: 'text', text: 'Привет' }), bobView);
  assert.deepEqual(n, { title: 'Алиса', body: 'Привет' });
});

test('фото', () => {
  const n = buildNotification(pushFor('dm:1:2', { kind: 'image', image: { blob: 'x' } }), bobView);
  assert.equal(n.body, '📷 Фото');
});

test('без ключа (вышел из аккаунта) — общее уведомление без текста', () => {
  const n = buildNotification(pushFor('dm:1:2', { kind: 'text', text: 'секрет' }), { users, chats });
  assert.deepEqual(n, { title: 'Алиса', body: 'Новое сообщение' });
});

test('новый личный чат, которого ещё нет на телефоне', () => {
  const n = buildNotification(pushFor('dm:1:2', { kind: 'text', text: 'Йо' }), { ...bobView, chats: {} });
  assert.deepEqual(n, { title: 'Алиса', body: 'Йо' });
});

test('Аська пишет, а телефон её ещё не знает: имя и ключ из пуша', () => {
  const aska = generateKeyPair();
  const boxes = encodeOutgoing('dm:2:9', 'u-9', { kind: 'text', text: 'Привет! Это Аська 🌼' }, [{ id: 9, pk: aska.pk }, { id: 2, pk: bob.pk }], 9, aska.sk);
  const b = boxes.find((x) => x.to === 2);
  const n = buildNotification({ t: 'm', c: 'dm:2:9', s: 9, i: 7, pn: b.pn, pc: b.pc, b: 1, sn: 'Аська', spk: toB64(aska.pk) }, bobView);
  assert.deepEqual(n, { title: 'Аська', body: 'Привет! Это Аська 🌼' });
});

test('круг: эмодзи и название', () => {
  const view = { ...bobView, chats: { ...chats, 'circle:kino': { id: 'circle:kino', kind: 'circle', emoji: '🎬', title: 'Кино и сериалы', members: [], lastId: 0 } } };
  const n = buildNotification(pushFor('circle:kino', { kind: 'text', text: 'Что смотрим?' }), view);
  assert.deepEqual(n, { title: '🎬 Кино и сериалы', body: 'Алиса: Что смотрим?' });
});
