import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createDatabase, DatabaseInstance, runMigrations } from '../../../src/backend/db/database.js';
import {
  ImageIntegrityService,
  IntegrityScanReport,
} from '../../../src/backend/services/image-integrity-service.js';

describe('ImageIntegrityService (SATA II Bad Block & Truncated File Resilience)', () => {
  let db: DatabaseInstance;
  let testRoot: string;
  let service: ImageIntegrityService;

  beforeEach(async () => {
    testRoot = path.resolve(`./tmp/test-integrity-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testRoot, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    service = new ImageIntegrityService({
      db,
      storageRoot: testRoot,
    });
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('validates a genuine WebP file successfully via fast header check', async () => {
    const validWebpPath = path.join(testRoot, 'valid.webp');
    await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .webp()
      .toFile(validWebpPath);

    const result = await service.verifyWebPFile(validWebpPath, false);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('detects truncated file (< 64 bytes) in microsecond fast check without Sharp', async () => {
    const truncatedPath = path.join(testRoot, 'truncated.webp');
    await fs.writeFile(truncatedPath, 'RIFF\0\0\0\0WEBP'); // only 12 bytes

    const result = await service.verifyWebPFile(truncatedPath, false);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('truncated');
  });

  it('detects corrupted header bytes in fast check', async () => {
    const badMagicPath = path.join(testRoot, 'bad-magic.webp');
    const dummyBuffer = Buffer.alloc(128);
    dummyBuffer.write('FAILING_HEADER_BYTES');
    await fs.writeFile(badMagicPath, dummyBuffer);

    const result = await service.verifyWebPFile(badMagicPath, false);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('magic_bytes_invalid');
  });

  it('scans chapter and logs detected corrupt files into SQLite corrupt_files_log', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s1', 'vagabond', 'Vagabond', 'manga', 'hiatus');

      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES ('c1', 's1', 1, 2, 'series/vagabond/v1/c1');
    `);

    const chapDir = path.join(testRoot, 'series', 'vagabond', 'v1', 'c1');
    await fs.mkdir(chapDir, { recursive: true });

    // Page 1: valid
    await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .webp()
      .toFile(path.join(chapDir, '001.webp'));

    // Page 2: zeroed-out bad sector simulation
    await fs.writeFile(path.join(chapDir, '002.webp'), Buffer.alloc(100)); // zeroes

    const report: IntegrityScanReport = await service.scanChapter('c1');

    expect(report.totalScanned).toBe(2);
    expect(report.validCount).toBe(1);
    expect(report.corruptCount).toBe(1);

    // Verify row was logged in corrupt_files_log
    const rows = service.getCorruptFiles();
    expect(rows.length).toBe(1);
    expect(rows[0].chapter_id).toBe('c1');
    expect(rows[0].status).toBe('pending_repair');
  });

  it('provides a lightweight fallback placeholder WebP for corrupted pages', () => {
    const fallbackBuffer = service.getFallbackPlaceholderWebP();
    expect(fallbackBuffer).toBeInstanceOf(Buffer);
    expect(fallbackBuffer.length).toBeGreaterThan(64);
    expect(fallbackBuffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(fallbackBuffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });
});
