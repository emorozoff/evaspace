/* Собирает UPASS в одну страницу для публикации отдельной ссылкой.
   Шрифты берутся из Google Fonts (свои woff2 в один файл не вложить),
   service worker и приглашение установить приложение выключены флагом
   __UPASS_EMBED__ — на чужой странице им нечего делать. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist-artifact');
const css = readFileSync(resolve(dist, 'app.css'), 'utf8').replace(/@font-face\{[^}]*\}/g, '');
const js = readFileSync(resolve(dist, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');

const FONTS =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700' +
  '&family=Manrope:wght@400;500;600;700;800&display=swap';

const page = `<title>UPASS</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${FONTS}" />
<style>${css}</style>
<div id="root"></div>
<script>window.__UPASS_EMBED__ = true;</script>
<script type="module">${js}</script>
`;

mkdirSync(resolve(process.cwd(), 'dist-artifact'), { recursive: true });
const out = resolve(dist, 'upass-page.html');
writeFileSync(out, page);
console.log(`Страница собрана: ${out}, ${(page.length / 1024).toFixed(0)} КБ`);
