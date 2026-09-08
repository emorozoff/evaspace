import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/* Самодостаточная сборка UPASS в папку /evaspace/upass/.
   Ничего не берёт из общих ассетов Eva Space, поэтому её можно класть
   на сайт отдельно, не трогая остальное. */
export default defineConfig({
  base: '/evaspace/upass/',
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: 'dist-upass',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(process.cwd(), 'upass/index.html'),
      output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' },
    },
  },
});
