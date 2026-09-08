import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/* Сборка UPASS в один файл — для публикации отдельной страницей,
   независимой от GitHub Pages. Пути относительные, всё в одном чанке. */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist-artifact',
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
