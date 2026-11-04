import { buildApp } from './app.js';
import path from 'node:path';

const PORT = Number(process.env.PORT || '4000');
const HOST = process.env.HOST || '127.0.0.1';
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.resolve('./data/storage');
const INCOMING_ROOT = process.env.INCOMING_DIR || path.resolve(STORAGE_ROOT, 'incoming');
const API_TOKEN = process.env.API_TOKEN;
const isLoopbackHost = HOST === 'localhost' || HOST === '127.0.0.1' || HOST === '::1';

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

if (!isLoopbackHost && (!API_TOKEN || API_TOKEN.length < 32)) {
  throw new Error('A random API_TOKEN of at least 32 characters is required when HOST exposes the API beyond loopback');
}

const app = buildApp({
  storageRoot: STORAGE_ROOT,
  incomingRoot: INCOMING_ROOT,
  apiToken: API_TOKEN,
});

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error('Fatal error starting KuraScroll API:', err);
    process.exit(1);
  }
  console.log(`[KuraScroll] Backend API active at: ${address}`);
  console.log(`[KuraScroll] Storage engine mounted at: ${STORAGE_ROOT}`);
});

let shuttingDown = false;
const shutdown = (signal: string): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing KuraScroll API...`);
  void app.close().then(() => {
    process.exitCode = 0;
  }).catch((err: unknown) => {
    console.error('Error while closing KuraScroll API:', err);
    process.exitCode = 1;
  });
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
