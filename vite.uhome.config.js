import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* UHOME CLUB — самостоятельное приложение в этом же репозитории.
   Всё своё лежит в папке uhome/: разметка, код, шрифты, иконки и
   service worker. На GitHub Pages живёт по адресу /evaspace/uhome/
   и публикуется отдельно, не трогая соседние приложения. */
export default defineConfig({
  root: 'uhome',
  base: '/evaspace/uhome/',
  publicDir: 'public',
  plugins: [react()],
  build: {
    outDir: '../dist-uhome',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  server: { port: 5175 },
});
