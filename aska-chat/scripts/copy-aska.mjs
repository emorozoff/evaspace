// Берёт дизайн «Аськи» из соседней папки ../aska (стили, цветочки, звуки, иконки) и кладёт
// в client/public/aska перед сборкой. Так правки дизайна в «Аське» сами попадают в мессенджер.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.resolve(root, '../aska');
const dst = path.join(root, 'client/public/aska');
const files = ['styles.css', 'aero.css', 'art.js', 'sounds.js'];

if (!fs.existsSync(path.join(src, 'aero.css'))) {
  console.error(`Нет дизайна «Аськи» в ${src}`);
  process.exit(1);
}
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(path.join(dst, 'icons'), { recursive: true });
for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dst, f));
for (const f of fs.readdirSync(path.join(src, 'icons'))) fs.copyFileSync(path.join(src, 'icons', f), path.join(dst, 'icons', f));
console.log('Дизайн «Аськи» скопирован в client/public/aska');
