/* Досборка самодостаточной папки UPASS: поднимаем index.html на верх,
   кладём иконки, манифест, service worker и шрифты внутрь себя. */
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'dist-upass';
const cp = (from, to) => fs.cpSync(from, to, { recursive: true });

// index.html лежит в подпапке из-за пути входа — поднимаем наверх
const nested = path.join(OUT, 'upass', 'index.html');
if (fs.existsSync(nested)) {
  fs.renameSync(nested, path.join(OUT, 'index.html'));
  fs.rmSync(path.join(OUT, 'upass'), { recursive: true, force: true });
}

// собственные иконки, манифест и офлайн-режим
cp('public/upass/icons', path.join(OUT, 'icons'));
fs.copyFileSync('public/upass/manifest.webmanifest', path.join(OUT, 'manifest.webmanifest'));
fs.copyFileSync('public/upass/sw.js', path.join(OUT, 'sw.js'));

// шрифты кладём внутрь папки и переписываем на них ссылки в стилях
cp('public/fonts', path.join(OUT, 'fonts'));
const cssPath = path.join(OUT, 'app.css');
fs.writeFileSync(cssPath, fs.readFileSync(cssPath, 'utf8').replaceAll('/evaspace/fonts/', '/evaspace/upass/fonts/'));

const files = fs.readdirSync(OUT, { recursive: true }).filter((f) => fs.statSync(path.join(OUT, f)).isFile());
console.log('UPASS собран отдельно:', files.length, 'файлов');
