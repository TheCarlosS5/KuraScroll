import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      'fake-indexeddb': path.resolve(__dirname, 'frontend/node_modules/fake-indexeddb'),
      'idb': path.resolve(__dirname, 'frontend/node_modules/idb'),
    }
  }
});
