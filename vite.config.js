import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Приложение публикуется на GitHub Pages по адресу /evaspace/
export default defineConfig({
  base: '/evaspace/',
  plugins: [react()],
  build: {
    target: 'es2018',
    assetsInlineLimit: 0,
  },
});
