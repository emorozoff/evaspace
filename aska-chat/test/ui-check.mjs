// Прогон интерфейса в невидимом Chrome с экраном iPhone: два друга регистрируются и переписываются.
// Запуск: BASE=http://localhost:8090 INVITE=XXXX-XXXX OUT=/папка/для/скриншотов node test/ui-check.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8090';
const OUT = process.env.OUT || 'ui-shots';
const INVITE = process.env.INVITE;
const PHOTO = process.env.PHOTO || 'client/public/icons/icon-512.png';
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
  await sleep(250);
  await page.screenshot({ path: file });
  log('скрин', file);
}

async function clickText(page, text, selector = 'button') {
  const ok = await page.evaluate((text, selector) => {
    const el = [...document.querySelectorAll(selector)].find((b) => b.textContent.trim().includes(text));
    if (el) { el.click(); return true; }
    return false;
  }, text, selector);
  if (!ok) throw new Error(`не нашёл кнопку «${text}»`);
}

async function waitText(page, text, timeout = 15000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

async function typeInto(page, selector, value) {
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
}

async function newPhone(browser, dark = false) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.emulate(IPHONE);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
  page.on('pageerror', (e) => console.log('  [ошибка страницы]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console]', m.text()); });
  return page;
}

async function registerFlow(page, invite, name, username, password, shots) {
  await page.goto(`${BASE}/#invite=${invite}`, { waitUntil: 'networkidle0' });
  await waitText(page, 'Установи');
  if (shots) await snap(page, 'установка');
  await clickText(page, 'Продолжить в браузере');
  await page.waitForSelector('input');
  if (shots) await snap(page, 'код-приглашения');
  await clickText(page, 'Дальше');
  await waitText(page, 'Знакомство');
  await typeInto(page, 'input[autocomplete="name"]', name);
  await typeInto(page, 'input[autocomplete="username"]', username);
  const pw = await page.$$('input[type="password"]');
  await pw[0].type(password);
  await pw[1].type(password);
  if (shots) await snap(page, 'регистрация');
  await clickText(page, 'Создать аккаунт');
  await waitText(page, 'Общий чат', 20000);
}

async function openChat(page, title) {
  await page.evaluate((t) => {
    const row = [...document.querySelectorAll('.chat-row')].find((r) => r.querySelector('.chat-name')?.textContent === t);
    row.click();
  }, title);
  await page.waitForSelector('.composer textarea');
}

async function send(page, text) {
  await page.type('.composer textarea', text);
  await page.click('.send-btn');
  await page.waitForFunction((t) => [...document.querySelectorAll('.msg.out .text')].some((e) => e.textContent === t), {}, text);
}

async function back(page) {
  await page.click('.header .icon-btn');
  await page.waitForSelector('.chat-row, .profile, .person-row');
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--lang=ru-RU'],
});

try {
  // 1. Алиса по первому приглашению
  const alice = await newPhone(browser);
  await registerFlow(alice, INVITE, 'Алиса', 'alice', 'пароль алисы 1', true);
  await snap(alice, 'список-чатов-алиса');

  // 2. Алиса приглашает Борю
  await alice.click('.header .icon-btn[aria-label="Настройки"]');
  await waitText(alice, 'Мой код');
  await clickText(alice, 'Пригласить друга');
  await alice.waitForSelector('.invite-code');
  const code = await alice.$eval('.invite-code', (e) => e.textContent.trim());
  log('приглашение для Бори', code);
  await snap(alice, 'приглашение');
  await clickText(alice, 'Отмена');
  await back(alice);

  // 3. Боря (тёмная тема) регистрируется
  const bob = await newPhone(browser, true);
  await registerFlow(bob, code, 'Боря Петров', 'bob', 'пароль бори 2', false);

  // 4. Алиса пишет в общий чат
  await openChat(alice, 'Общий чат');
  await snap(alice, 'пустой-чат');
  await send(alice, 'Привет! Это наш мессенджер 👋');
  await send(alice, 'Проверяем шифрование и пуши. Ссылка: https://tytproai.ru');

  // 5. Боря видит непрочитанные, открывает, отвечает
  await bob.waitForFunction(() => document.querySelector('.badge')?.textContent === '2', { timeout: 10000 });
  await snap(bob, 'боря-непрочитанные-тёмная');
  await openChat(bob, 'Общий чат');
  await waitText(bob, 'Это наш мессенджер');
  await send(bob, 'О, работает! Сейчас скину фотку');

  // 6. Боря отправляет фото
  const input = await bob.$('input[type="file"]');
  await input.uploadFile(PHOTO);
  await bob.waitForFunction(() => document.querySelector('.msg.out .photo img:not(.photo-thumb)'), { timeout: 15000 });
  await bob.waitForFunction(() => !document.querySelector('.msg.out .meta svg circle'), { timeout: 15000 }); // часики исчезли
  await snap(bob, 'боря-чат-тёмная');

  // 7. Алиса получила фото и видит, что прочитано
  await alice.waitForFunction(() => document.querySelector('.msg.in .photo img:not(.photo-thumb)'), { timeout: 15000 });
  await alice.waitForFunction(() => document.querySelectorAll('.msg.out .meta svg path').length >= 4, { timeout: 10000 }); // двойные галочки
  await snap(alice, 'алиса-чат');

  // 8. Ответ на сообщение через меню
  await alice.evaluate(() => {
    const t = [...document.querySelectorAll('.msg.in .bubble')].find((b) => b.textContent.includes('работает'));
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
  await alice.waitForSelector('.sheet');
  await snap(alice, 'меню-сообщения');
  await clickText(alice, 'Ответить', '.sheet-btn');
  await alice.waitForSelector('.reply-bar');
  await send(alice, 'Классная фотка!');
  await alice.waitForSelector('.msg.out .quote');
  await snap(alice, 'ответ-с-цитатой');

  // 9. Открыть фото на весь экран
  await alice.click('.msg.in .photo');
  await alice.waitForSelector('.viewer');
  await snap(alice, 'фото-на-весь-экран');
  await alice.click('.viewer');

  // 10. Боря пишет Алисе лично
  await back(bob);
  await bob.click('.header .icon-btn[aria-label="Новый чат"]');
  await waitText(bob, 'Пригласить друга');
  await snap(bob, 'новый-чат-тёмная');
  await clickText(bob, 'Алиса', '.person-row');
  await bob.waitForSelector('.composer textarea');
  await send(bob, 'Это личное сообщение, его видишь только ты');
  await back(alice);
  await alice.waitForFunction(() => [...document.querySelectorAll('.chat-name')].some((e) => e.textContent === 'Боря Петров'), { timeout: 10000 });
  await snap(alice, 'список-с-личным-чатом');

  // 11. Настройки с кодами безопасности
  await alice.click('.header .icon-btn[aria-label="Настройки"]');
  await alice.waitForFunction(() => document.querySelector('.row.column .code')?.textContent.trim().length > 0);
  await snap(alice, 'настройки');
  const aliceSeesBob = await alice.evaluate(() => [...document.querySelectorAll('.row.column')].find((r) => r.textContent.includes('Боря'))?.querySelector('.code')?.textContent);
  await bob.click('.header .icon-btn');
  await bob.click('.header .icon-btn[aria-label="Настройки"]');
  await bob.waitForFunction(() => document.querySelector('.row.column .code')?.textContent.trim().length > 0);
  const bobOwn = await bob.evaluate(() => document.querySelector('.row.column .code')?.textContent);
  log('код Бори у Алисы:', aliceSeesBob, '| свой код у Бори:', bobOwn, aliceSeesBob === bobOwn ? '— совпадают ✓' : '— НЕ СОВПАДАЮТ ✗');

  // 12. Боря «потерял телефон»: вход на новом устройстве по паролю, история на месте
  const bob2 = await newPhone(browser);
  await bob2.goto(BASE, { waitUntil: 'networkidle0' });
  await clickText(bob2, 'Продолжить в браузере');
  await clickText(bob2, 'У меня уже есть аккаунт');
  await waitText(bob2, 'Вход');
  await typeInto(bob2, 'input[autocomplete="username"]', 'bob');
  await bob2.type('input[type="password"]', 'пароль бори 2');
  await snap(bob2, 'вход-новый-телефон');
  await clickText(bob2, 'Войти');
  await waitText(bob2, 'Общий чат', 20000);
  await openChat(bob2, 'Общий чат');
  await waitText(bob2, 'Классная фотка!');
  await bob2.waitForFunction(() => document.querySelector('.photo img:not(.photo-thumb)'), { timeout: 15000 });
  await snap(bob2, 'история-восстановлена');

  // 13. Неверный пароль
  const eve = await newPhone(browser);
  await eve.goto(BASE, { waitUntil: 'networkidle0' });
  await clickText(eve, 'Продолжить в браузере');
  await clickText(eve, 'У меня уже есть аккаунт');
  await typeInto(eve, 'input[autocomplete="username"]', 'bob');
  await eve.type('input[type="password"]', 'не тот пароль');
  await clickText(eve, 'Войти');
  await waitText(eve, 'Неверный логин или пароль', 20000);
  log('неверный пароль отклонён ✓');

  log('ГОТОВО');
} catch (e) {
  console.error('ОШИБКА:', e.message);
  for (const p of await browser.pages()) {
    try { await p.screenshot({ path: path.join(OUT, `fail-${Date.now()}.png`) }); } catch { /* пусто */ }
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
