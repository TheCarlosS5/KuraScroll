import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Sprint 50: Eye Care Routes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/preferences/eye-care/:userId returns preferences and cssFilter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/preferences/eye-care/carlos',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.preferences.userId).toBe('carlos');
    expect(body.preferences.filterMode).toBe('default');
    expect(body.cssFilter).toBe('none');
  });

  it('PUT /api/v1/preferences/eye-care/:userId updates preferences and computes filter', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/preferences/eye-care/carlos',
      payload: {
        filterMode: 'oled_dark',
        brightnessPct: 85,
        contrastPct: 110,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.preferences.filterMode).toBe('oled_dark');
    expect(body.preferences.brightnessPct).toBe(85);
    expect(body.cssFilter).toContain('contrast(1.05)');
    expect(body.cssFilter).toContain('brightness(0.90)');
  });

  it('POST /api/v1/analysis/classify-page-chroma returns zero-allocation chroma analysis', async () => {
    // Generate 64 neutral pixels (256 bytes)
    const bytes = new Array(256).fill(128);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/analysis/classify-page-chroma',
      payload: {
        rgbaBytes: bytes,
        chromaThreshold: 14,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.classification.isMonochrome).toBe(true);
    expect(body.classification.neutralPixelCount).toBe(64);
  });

  it('POST /api/v1/filters/compute-css generates client cssFilter string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/filters/compute-css',
      payload: {
        filterMode: 'e_ink_high_contrast',
        brightnessPct: 100,
        contrastPct: 120,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.cssFilter).toContain('grayscale(1)');
    expect(body.cssFilter).toContain('contrast(1.45)');
    expect(body.cssFilter).toContain('contrast(1.20)');
  });
});
