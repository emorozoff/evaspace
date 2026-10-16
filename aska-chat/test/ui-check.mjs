// Прогон интерфейса в невидимом Chrome с экраном iPhone: два друга (один в «Зумере», другой в «Миллениале»)
// регистрируются по приглашениям, переписываются, шлют фото, отвечают, пишут лично, входят с нового телефона.
// Запуск: BASE=http://localhost:8091 INVITE=XXXX-XXXX OUT=/папка/для/скриншотов node test/ui-check.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8091';
const OUT = process.env.OUT || 'ui-shots';
const INVITE = process.env.INVITE;
const PHOTO = process.env.PHOTO || 'client/public/aska/icons/icon-512.png';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });

const IPHONE = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  viewport: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('•', ...a);
let shot = 0;
async function snap(page, name) {
  const file = path.join(OUT, `${String(++shot).padStart(2, '0')}-${name}.png`);
  await sleep(350);
  await page.screenshot({ path: file });
  log('скрин', path.basename(file));
}
async function clickText(page, text, selector = 'button') {
  const ok = await page.evaluate((text, selector) => {
    const el = [...document.querySelectorAll(selector)].find((b) => b.textContent.trim().includes(text) && b.offsetParent);
    if (el) { el.click(); return true; }
    return false;
  }, text, selector);
  if (!ok) throw new Error(`не нашёл «${text}» (${selector})`);
}
const waitText = (page, text, timeout = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
async function typeInto(page, selector, value) { await page.click(selector, { clickCount: 3 }); await page.type(selector, value); }

async function newPhone(browser, label) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.emulate(IPHONE);
  page.on('pageerror', (e) => console.log(`  [${label}: ошибка страницы]`, e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) console.log(`  [${label}: console]`, m.text()); });
  return page;
}

async function registerFlow(page, invite, nick, username, password, { design = 'zoomer', shots = false } = {}) {
  await page.goto(`${BASE}/#invite=${invite}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#loginwin');
  if (design === 'millennial') await page.click('.design-pick button[data-design="millennial"]');
  if (shots) await snap(page, `${design}-установка`);
  await clickText(page, 'Продолжить в браузере');
  await page.waitForSelector('#loginwin input.field');
  await clickText(page, 'Дальше');
  await page.waitForSelector('input[autocomplete="nickname"]');
  await typeInto(page, 'input[autocomplete="nickname"]', nick);
  await typeInto(page, 'input[autocomplete="username"]', username);
  const pw = await page.$$('input[type="password"]');
  await pw[0].type(password);
  await pw[1].type(password);
  if (shots) await snap(page, `${design}-регистрация`);
  await clickText(page, 'Получить АСЬКУ');
  await page.waitForSelector('#cwin', { timeout: 20000 });
}

async function openChat(page, title) {
  await page.waitForFunction((t) => [...document.querySelectorAll('#cwin .citem .nick')].some((n) => n.textContent.replace(' ⚠', '') === t), { timeout: 10000 }, title);
  await page.evaluate((t) => {
    const it = [...document.querySelectorAll('#cwin .citem')].find((r) => r.querySelector('.nick')?.textContent.replace(' ⚠', '') === t);
    it.click();
  }, title);
  await page.waitForSelector('#chatwin .compose textarea');
}
async function send(page, text) {
  await page.type('#chatwin .compose textarea', text);
  await clickText(page, 'Отправить', '#chatwin .send-row button');
  const probe = text.split(' :')[0]; // смайлы вроде :) превращаются в картинки
  await page.waitForFunction((t) => [...document.querySelectorAll('#chatwin .msg.me .txt')].some((e) => e.textContent.includes(t)), {}, probe);
}
async function backToList(page) {
  // нажимаем напрямую: сверху может висеть всплывашка о новом сообщении (по ней открывается та беседа)
  await page.evaluate(() => document.querySelector('#chatwin .tbtn.back').click());
  await page.waitForFunction(() => !document.querySelector('#chatwin'));
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--no-default-browser-check', '--lang=ru-RU'] });
try {
  // 1. Алиса (Зумер)
  const alice = await newPhone(browser, 'Алиса');
  await registerFlow(alice, INVITE, 'Алиса', 'alice', 'пароль алисы 1', { shots: true });
  await snap(alice, 'zoomer-контакты-пусто');

  // 2. Алиса зовёт Борю
  await clickText(alice, 'Позвать', 'nav.tabbar button');
  await alice.waitForSelector('#auxwin .uin-box');
  const code = await alice.$eval('#auxwin .uin-box', (e) => e.textContent.trim());
  log('приглашение для Бори', code);
  await snap(alice, 'zoomer-позвать');
  await clickText(alice, 'Чаты', 'nav.tabbar button');

  // 3. Боря выбирает «Миллениал»
  const bob = await newPhone(browser, 'Боря');
  await registerFlow(bob, code, 'Боря_98', 'bob', 'пароль бори 2', { design: 'millennial', shots: true });

  // 4. Алиса видит Борю «в сети» и пишет в общий чат
  await alice.waitForFunction(() => [...document.querySelectorAll('#cwin .citem:not(.off) .nick')].some((n) => n.textContent === 'Боря_98'), { timeout: 15000 });
  await snap(alice, 'zoomer-контакты-боря-в-сети');
  await openChat(alice, 'Общий чат');
  await send(alice, 'Привет! Это наша АСЬКА :)');
  await send(alice, 'Шифрование работает. Ссылка: https://tytproai.ru');

  // 5. Боря видит конвертик, открывает, отвечает и шлёт фото
  await bob.waitForFunction(() => document.querySelector('#cwin .citem .badge')?.textContent === '2', { timeout: 10000 });
  await snap(bob, 'millennial-контакты-конвертик');
  await openChat(bob, 'Общий чат');
  await waitText(bob, 'Это наша АСЬКА');
  await send(bob, 'О-оу! Работает :D');
  const input = await bob.$('#chatwin input[type="file"]');
  await input.uploadFile(PHOTO);
  await bob.waitForFunction(() => document.querySelector('#chatwin .msg.me .aska-photo img:not(.thumb)'), { timeout: 15000 });
  await bob.waitForFunction(() => ![...document.querySelectorAll('#chatwin .msg.me .aska-tick')].some((t) => t.textContent === '…'), { timeout: 15000 });
  await snap(bob, 'millennial-беседа');

  // 6. Алиса видит фото и «прочитано»
  await alice.waitForFunction(() => document.querySelector('#chatwin .msg.them .aska-photo img:not(.thumb)'), { timeout: 15000 });
  await alice.waitForFunction(() => [...document.querySelectorAll('#chatwin .msg.me .aska-tick')].every((t) => t.textContent === '✓✓'), { timeout: 10000 });
  await snap(alice, 'zoomer-беседа');

  // 7. Ответ через меню
  await alice.evaluate(() => {
    const t = [...document.querySelectorAll('#chatwin .msg.them')].find((b) => b.textContent.includes('Работает'));
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
  await alice.waitForSelector('.overlay .win.dialog');
  await snap(alice, 'zoomer-меню-сообщения');
  await clickText(alice, 'Ответить', '.overlay button');
  await alice.waitForSelector('#chatwin .aska-reply');
  await send(alice, 'Классное фото!');
  await alice.waitForSelector('#chatwin .msg.me .aska-quote');
  await snap(alice, 'zoomer-ответ');

  // 8. Боря пишет Алисе лично
  await backToList(bob);
  await openChat(bob, 'Алиса');
  await send(bob, 'Это личное, видишь только ты');
  await backToList(alice);
  await alice.waitForFunction(() => [...document.querySelectorAll('#cwin .citem')].some((r) => r.textContent.includes('Боря_98') && r.querySelector('.badge')), { timeout: 10000 });
  await snap(alice, 'zoomer-контакты-личное');
  await snap(bob, 'millennial-личная-беседа');

  // 9. Коды безопасности
  await clickText(alice, 'Ещё', 'nav.tabbar button');
  await alice.waitForFunction(() => document.querySelector('.aska-codes .row .code')?.textContent.trim().length > 0);
  await snap(alice, 'zoomer-настройки');
  const aliceSeesBob = await alice.evaluate(() => [...document.querySelectorAll('.aska-codes .row')].find((r) => r.textContent.includes('Боря_98'))?.querySelector('.code')?.textContent);
  await backToList(bob);
  await clickText(bob, 'Ещё', 'nav.tabbar button');
  await bob.waitForFunction(() => document.querySelector('.aska-codes .row .code')?.textContent.trim().length > 0);
  const bobOwn = await bob.evaluate(() => document.querySelector('.aska-codes .row .code')?.textContent);
  await snap(bob, 'millennial-настройки');
  log('код Бори у Алисы:', aliceSeesBob, '| у самого Бори:', bobOwn, aliceSeesBob === bobOwn ? '— совпадают ✓' : '— НЕ СОВПАДАЮТ ✗');

  // 10. Боря на новом телефоне: история на месте
  const bob2 = await newPhone(browser, 'Боря-2');
  await bob2.goto(BASE, { waitUntil: 'networkidle0' });
  await clickText(bob2, 'Продолжить в браузере');
  await clickText(bob2, 'Уже есть АСЬКА');
  await typeInto(bob2, 'input[autocomplete="username"]', 'bob');
  await bob2.type('input[type="password"]', 'пароль бори 2');
  await clickText(bob2, 'Войти');
  await bob2.waitForSelector('#cwin', { timeout: 20000 });
  await openChat(bob2, 'Общий чат');
  await waitText(bob2, 'Классное фото!');
  await bob2.waitForFunction(() => document.querySelector('#chatwin .aska-photo img:not(.thumb)'), { timeout: 15000 });
  await snap(bob2, 'zoomer-история-на-новом-телефоне');

  // 11. Неверный пароль
  const eve = await newPhone(browser, 'Ева');
  await eve.goto(BASE, { waitUntil: 'networkidle0' });
  await clickText(eve, 'Продолжить в браузере');
  await clickText(eve, 'Уже есть АСЬКА');
  await typeInto(eve, 'input[autocomplete="username"]', 'bob');
  await eve.type('input[type="password"]', 'не тот пароль');
  await clickText(eve, 'Войти');
  await waitText(eve, 'Неверный логин или пароль', 20000);
  log('неверный пароль отклонён ✓');
  log('ГОТОВО');
} catch (e) {
  console.error('ОШИБКА:', e.message);
  for (const p of await browser.pages()) {
    try { await p.screenshot({ path: path.join(OUT, `fail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`) }); } catch { /* пусто */ }
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
