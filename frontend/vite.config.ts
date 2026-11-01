import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/storage': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'service-worker': path.resolve(__dirname, 'src/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});

