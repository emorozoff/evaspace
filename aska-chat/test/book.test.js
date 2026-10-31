// «Книга перемен» (автор — Адам): книга открыта всем, Аська отвечает по ней — и по шпаргалке, и «мозгу» она в подсказке.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/src/app.js';
import { BOOK, bookAnswer, BOOK_BRIEF } from '../server/src/book.js';
import * as P from '../server/src/personas.js';

test('книга: 12 перемен, у каждой знак из шести черт, образ, текст и совет', () => {
  assert.equal(BOOK.author, 'Адам');
  assert.equal(BOOK.chapters.length, 12);
  const keys = new Set();
  for (const c of BOOK.chapters) {
    assert.equal(c.lines.length, 6, c.key);
    assert.ok(c.lines.every((l) => l === 0 || l === 1), c.key);
    assert.ok(c.image && c.text.length && c.advice && c.summary && c.keywords.length, c.key);
    assert.ok(!keys.has(c.key)); keys.add(c.key);
  }
  const names = new Set(BOOK.chapters.map((c) => c.lines.join('')));
  assert.equal(names.size, 12, 'знаки не повторяются');
});

test('Аська отвечает по книге: проекты, Кирилл, новый интернет; лишнего не цепляет', () => {
  const ask = (q) => (bookAnswer(q) || []).join(' ');
  assert.match(ask('что такое UPASS?'), /пропуск/);
  assert.match(ask('расскажи про юпас'), /пропуск/);
  assert.match(ask('что за Ева?'), /Eva Space/);
  assert.match(ask('UHOME — это что'), /сообщество предпринимателей/);
  assert.match(ask('что такое куни-календарь'), /время/i);
  assert.match(ask('а срм зачем'), /CRM/);
  assert.match(ask('кто создал аську?'), /Кирилл Ковалёв/);
  assert.match(ask('что такое блокчейн'), /цепочка записей/i);
  assert.match(ask('Книга перемен'), /Адам/);
  assert.match(ask('календарь цикла'), /Eva Space/, 'календарь цикла — это Ева, не Куни');
  assert.equal(bookAnswer('пошли налево'), null, '«ева» только с начала слова');
  assert.equal(bookAnswer('привет'), null);
  // шпаргалка Аськи берёт ответ из книги
  assert.match(P.askaScripted('расскажи про UPASS', {}).join(' '), /Книга перемен/);
  assert.match(P.askaScripted('привет', { name: 'Лиза' })[0], /Привет, Лиза/);
  // и «мозгу» Аськи книга в подсказке
  assert.ok(P.ASKA_RULES.includes(BOOK_BRIEF));
  assert.match(BOOK_BRIEF, /ТОЛЬКО по этой книге/);
});

test('GET /api/book открыт без входа, без служебных ключевых слов; Аська объявила книгу на стене', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aska-book-'));
  const app = createApp({ dataDir, publicUrl: 'http://localhost', log: () => {}, botTiming: { scale: 0, tickMs: 5, presenceMs: 50, proactiveMs: 3_600_000, nightTickMs: 0 }, pushSender: async () => {} });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    const res = await fetch(`http://127.0.0.1:${app.server.address().port}/api/book`);
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.title, 'Книга перемен');
    assert.equal(b.chapters.length, 12);
    assert.equal(b.chapters[0].keywords, undefined);
    assert.equal(b.chapters[0].summary, undefined);
    assert.ok(b.chapters[0].text.length);
    // объявление на стене Аськи
    for (let i = 0; i < 50 && !app.db.prepare("SELECT 1 FROM settings WHERE key = 'announced_book'").get(); i++) await new Promise((r) => setTimeout(r, 20));
    const post = app.db.prepare("SELECT text FROM wall_posts WHERE text LIKE '%Книга перемен%'").get();
    assert.ok(post, 'запись о книге на стене Аськи');
  } finally {
    await app.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
