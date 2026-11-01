import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { calculateStorageTelemetry } from '../../../src/backend/services/storage-telemetry.js';
import { registerTelemetryRoutes } from '../../../src/backend/routes/telemetry-routes.js';
import { imageCache, manifestCache } from '../../../src/backend/cache/media-cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Storage Footprint Telemetry & Cache Management Suite', () => {
  const sandbox = path.resolve(__dirname, `../../../tmp/storage-telemetry-test-${Date.now()}`);
  const storageRoot = path.join(sandbox, 'storage');
  let db: DatabaseInstance;
  let app: FastifyInstance;

  beforeEach(async () => {
    await fs.promises.mkdir(path.join(storageRoot, 'series', 'solo-leveling', 'ch-1'), { recursive: true });
    // Write dummy webp file
    await fs.promises.writeFile(
      path.join(storageRoot, 'series', 'solo-leveling', 'ch-1', '001.webp'),
      Buffer.alloc(150 * 1024, 0x99)
    );

    db = createDatabase(':memory:');
    runMigrations(db);

    // Insert dummy series & chapter
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-1', 'solo-leveling', 'Solo Leveling', 'manhwa', 'ongoing');
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES ('ch-1', 's-1', 1.0, 'Chapter 1', 'series/solo-leveling/ch-1', 1);
    `).run();

    db.prepare(`
      INSERT INTO chapter_pages (chapter_id, page_number, file_name, width, height, aspect_ratio)
      VALUES ('ch-1', 1, '001.webp', 1440, 2560, 0.5625);
    `).run();

    app = Fastify({ logger: false });
    registerTelemetryRoutes(app, { db, storageRoot });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    try {
      db.close();
    } catch {}
    try {
      await fs.promises.rm(sandbox, { recursive: true, force: true });
    } catch {}
  });

  it('1. calculates telemetry report and projects 4TB capacity', async () => {
    const report = await calculateStorageTelemetry(db, storageRoot);

    expect(report.totalSeries).toBe(1);
    expect(report.totalChapters).toBe(1);
    expect(report.totalPages).toBe(1);
    expect(report.totalWebpSizeBytes).toBeGreaterThan(0);
    expect(report.estimatedRawScanSizeBytes).toBeGreaterThan(report.totalWebpSizeBytes);
    expect(report.savingsPercentage).toBeGreaterThanOrEqual(80);
    expect(report.projected4TBCapacityChapters).toBeGreaterThan(10000);
    expect(report.categories.length).toBe(1);
    expect(report.categories[0].type).toBe('manhwa');
  });

  it('2. GET /api/v1/storage/telemetry returns telemetry payload over HTTP', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/storage/telemetry',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.telemetry.totalSeries).toBe(1);
    expect(body.telemetry.savingsPercentage).toBeGreaterThanOrEqual(80);
  });

  it('3. POST /api/v1/storage/cache/flush clears in-memory ByteLRU buffers', async () => {
    // Populate caches with mock buffer
    const imgBuf = Buffer.alloc(1024, 0x01);
    imageCache.set('mock-img', imgBuf, imgBuf.byteLength);
    manifestCache.set('mock-manifest', { title: 'Test' }, 128);

    expect(imageCache.usedBytes).toBeGreaterThan(0);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/storage/cache/flush',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.freedBytes.images).toBeGreaterThan(0);
    expect(imageCache.usedBytes).toBe(0);
    expect(manifestCache.usedBytes).toBe(0);
  });
});
