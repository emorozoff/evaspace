import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// В репозитории живут два приложения:
//   /evaspace/        — Eva Space
//   /evaspace/upass/  — UPASS (клуб, паспорт, UHOME, UHT)
export default defineConfig({
  base: '/evaspace/',
  plugins: [react()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        upass: resolve(process.cwd(), 'upass/index.html'),
      },
    },
  },
});
