import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Fastify Static Storage & Health Routes', () => {
  const testStorage = path.resolve(__dirname, 'tmp-static-test');
  let app: any;

  beforeAll(async () => {
    await fs.mkdir(testStorage, { recursive: true });
    await fs.writeFile(path.join(testStorage, 'test.webp'), 'dummy-webp-binary-payload');
    app = buildApp({ storageRoot: testStorage });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(testStorage, { recursive: true, force: true });
  });

  it('GET /health returns 200 OK with status and service identity', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('kura-scroll-backend');
  });

  it('GET /storage/test.webp streams static files with immutable cache header', async () => {
    const res = await app.inject({ method: 'GET', url: '/storage/test.webp' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.body).toBe('dummy-webp-binary-payload');
  });
});
