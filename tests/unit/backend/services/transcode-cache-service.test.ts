import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  TranscodeCacheService,
  snapToValidTier,
  TranscodedPageRecord,
} from '../../../../src/backend/services/transcode-cache-service.js';

describe('Sprint 58 - TranscodeCacheService Unit Tests', () => {
  let db: DatabaseInstance;
  let service: TranscodeCacheService;
  let tmpDir: string;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Insert dummy series and chapter for foreign key integrity
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_tc_1', 'transcode-series', 'Transcode Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES ('ch_tc_1', 'ser_tc_1', 1, 'Chapter 1', '/tmp/fake', 10)
    `).run();

    tmpDir = path.join(os.tmpdir(), `kura_tc_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tmpDir, { recursive: true });

    service = new TranscodeCacheService(db, tmpDir, 1024 * 1024); // 1MB quota for testing
  });

  afterEach(async () => {
    db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('correctly snaps requested dimensions to valid discrete tiers', () => {
    expect(snapToValidTier(undefined)).toBe(800);
    expect(snapToValidTier(0)).toBe(800);
    expect(snapToValidTier(480)).toBe(800);
    expect(snapToValidTier(900)).toBe(800);
    expect(snapToValidTier(901)).toBe(1200);
    expect(snapToValidTier(1200)).toBe(1200);
    expect(snapToValidTier(1400)).toBe(1200);
    expect(snapToValidTier(1401)).toBe(1600);
    expect(snapToValidTier(2400)).toBe(1600);
  });

  it('records and retrieves cached transcoded pages via memory and SQLite', () => {
    const record: TranscodedPageRecord = {
      id: 'tc_rec_1',
      chapterId: 'ch_tc_1',
      pageNumber: 1,
      targetWidth: 1200,
      targetHeight: 1700,
      filePath: path.join(tmpDir, 'page1_1200.webp'),
      fileSizeBytes: 125000,
      quality: 80,
      etag: '"test_etag_1"',
    };

    service.recordCachedPage(record);

    // Hot memory hit
    const hit1 = service.lookupCachedPage('ch_tc_1', 1, 1200);
    expect(hit1).toBeDefined();
    expect(hit1?.id).toBe('tc_rec_1');
    expect(hit1?.etag).toBe('"test_etag_1"');

    // SQLite fallback with fresh service instance
    const service2 = new TranscodeCacheService(db, tmpDir);
    const hit2 = service2.lookupCachedPage('ch_tc_1', 1, 1200);
    expect(hit2).toBeDefined();
    expect(hit2?.id).toBe('tc_rec_1');
    expect(hit2?.fileSizeBytes).toBe(125000);

    // Non-existent tier
    expect(service.lookupCachedPage('ch_tc_1', 1, 1600)).toBeNull();
  });

  it('transcodes synthetic image ahead of time to WebP and deduplicates concurrent jobs', async () => {
    // Generate a 2000x3000 test image buffer with Sharp
    const rawImage = await sharp({
      create: {
        width: 2000,
        height: 3000,
        channels: 3,
        background: { r: 180, g: 40, b: 60 },
      },
    })
      .png()
      .toBuffer();

    // Trigger 3 concurrent requests for the exact same page & resolution
    const [p1, p2, p3] = await Promise.all([
      service.getOrTranscode('ch_tc_1', 2, rawImage, { width: 1200 }),
      service.getOrTranscode('ch_tc_1', 2, rawImage, { width: 1200 }),
      service.getOrTranscode('ch_tc_1', 2, rawImage, { width: 1200 }),
    ]);

    expect(p1.id).toBe(p2.id);
    expect(p2.id).toBe(p3.id);
    expect(p1.targetWidth).toBe(1200);
    expect(p1.targetHeight).toBe(1800); // Maintained 2:3 aspect ratio
    expect(p1.fileSizeBytes).toBeGreaterThan(0);
    expect(await fs.stat(p1.filePath)).toBeDefined();

    // Verify it's a valid WebP
    const metadata = await sharp(p1.filePath).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(1800);
  });

  it('prunes oldest cached files when cache exceeds high watermark (85%) down to low watermark (70%)', async () => {
    const filePath1 = path.join(tmpDir, 'p1.webp');
    const filePath2 = path.join(tmpDir, 'p2.webp');
    await fs.writeFile(filePath1, Buffer.alloc(500 * 1024, 0xaa)); // 500KB
    await fs.writeFile(filePath2, Buffer.alloc(450 * 1024, 0xbb)); // 450KB
    // Total: 950KB (exceeds 85% of 1MB quota = 870KB)

    service.recordCachedPage({
      id: 'tc_old',
      chapterId: 'ch_tc_1',
      pageNumber: 1,
      targetWidth: 800,
      targetHeight: 1200,
      filePath: filePath1,
      fileSizeBytes: 500 * 1024,
      quality: 80,
      etag: '"etag_old"',
    });

    service.recordCachedPage({
      id: 'tc_new',
      chapterId: 'ch_tc_1',
      pageNumber: 2,
      targetWidth: 800,
      targetHeight: 1200,
      filePath: filePath2,
      fileSizeBytes: 450 * 1024,
      quality: 80,
      etag: '"etag_new"',
    });

    // Artificially age the first record in SQLite
    db.prepare(`
      UPDATE cached_transcoded_pages
      SET last_accessed_at = '2020-01-01 00:00:00'
      WHERE id = 'tc_old'
    `).run();

    const statsBefore = service.getStats();
    expect(statsBefore.totalSizeBytes).toBe(950 * 1024);

    const result = await service.pruneCacheIfNeeded();
    expect(result.prunedCount).toBe(1);
    expect(result.freedBytes).toBe(500 * 1024);

    // Old file unlinked
    await expect(fs.stat(filePath1)).rejects.toThrow();
    // Newer file preserved
    expect(await fs.stat(filePath2)).toBeDefined();

    const statsAfter = service.getStats();
    expect(statsAfter.totalSizeBytes).toBe(450 * 1024);
  });
});
