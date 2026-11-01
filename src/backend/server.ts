import { buildApp } from './app.js';
import path from 'node:path';

const PORT = Number.parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.resolve('./data/storage');

const app = buildApp({ storageRoot: STORAGE_ROOT });

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error('Fatal error starting KuraScroll API:', err);
    process.exit(1);
  }
  console.log(`🚀 KuraScroll Backend API active at: ${address}`);
  console.log(`📦 Storage engine mounted at: ${STORAGE_ROOT}`);
});
