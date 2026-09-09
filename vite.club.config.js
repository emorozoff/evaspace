import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* И АЙ КЛАБ — отдельное приложение в этом же репозитории.
   На GitHub Pages живёт по адресу /evaspace/club/, а при сборке
   мобильной обёртки (CLUB_BASE=./) пути становятся относительными. */
export default defineConfig({
  root: 'club',
  base: process.env.CLUB_BASE || '/evaspace/club/',
  plugins: [react()],
  build: {
    outDir: '../dist/club',
    emptyOutDir: true,
    target: 'es2018',
  },
  server: { port: 5174 },
});
