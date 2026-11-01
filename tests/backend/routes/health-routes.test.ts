import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository';
import { BackupDaemon } from '../../../src/backend/daemon/backup-daemon';

const TEST_DIR = path.resolve(__dirname, 'tmp-health-test');
const STORAGE_ROOT = path.join(TEST_DIR, 'storage');
const BACKUP_DIR = path.join(TEST_DIR, 'backups');

describe('Health Routes (/api/v1/health & /api/v1/admin/backup)', () => {
  let db: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    const seriesRepo = new SeriesRepository(db);
    const chapterRepo = new ChapterRepository(db);

    seriesRepo.createSeries({
      id: 'solo-leveling',
      slug: 'solo-leveling',
      titlePrimary: 'Solo Leveling',
      type: 'manhwa',
      status: 'ongoing',
    });

    chapterRepo.createChapter({
      id: 'solo-leveling-c1',
      seriesId: 'solo-leveling',
      chapterNumber: 1,
      title: 'Chapter 1',
      pageCount: 15,
      storagePath: 'series/solo-leveling/v1/c1',
    });

    app = buildApp({
      db,
      storageRoot: STORAGE_ROOT,
      backupDaemon: new BackupDaemon({
        db,
        backupDir: BACKUP_DIR,
      }),
      folderWatcher: {
        active: true,
        incomingDir: path.join(STORAGE_ROOT, 'incoming'),
      },
    });
  });

  afterEach(async () => {
    await app.close();
    try {
      db.close();
    } catch {}
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('GET /api/v1/health returns 200 with disk, database, cache, counts, and uptime', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);

    // 1. Status & Uptime
    expect(data.status).toBe('ok');
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data.timestamp).toBeDefined();

    // 2. Disk metrics
    expect(data.disk).toBeDefined();
    expect(data.disk.storageRoot).toBe(STORAGE_ROOT);
    expect(typeof data.disk.freeBytes).toBe('number');
    expect(typeof data.disk.totalBytes).toBe('number');
    expect(typeof data.disk.freePercentage).toBe('number');

    // 3. Database metrics
    expect(data.database).toBeDefined();
    expect(data.database.integrity).toBe('ok');
    expect(data.database.sizeBytes).toBeGreaterThan(0);
    expect(data.database.pageSize).toBeGreaterThan(0);
    expect(data.database.pageCount).toBeGreaterThan(0);

    // 4. Cache metrics
    expect(data.cache).toBeDefined();
    expect(typeof data.cache.usedBytes).toBe('number');
    expect(typeof data.cache.maxBytes).toBe('number');
    expect(typeof data.cache.hits).toBe('number');
    expect(typeof data.cache.misses).toBe('number');
    expect(typeof data.cache.hitRatio).toBe('number');
    expect(data.cache.imageCache).toBeDefined();
    expect(data.cache.manifestCache).toBeDefined();

    // 5. Aggregated Counts
    expect(data.counts).toBeDefined();
    expect(data.counts.series).toBe(1);
    expect(data.counts.chapters).toBe(1);
    expect(typeof data.counts.pages).toBe('number');

    // 6. FolderWatcher state
    expect(data.watcher).toBeDefined();
    expect(data.watcher.active).toBe(true);
    expect(data.watcher.incomingDir).toBe(path.join(STORAGE_ROOT, 'incoming'));
  });

  it('POST /api/v1/admin/backup triggers consistent hot backup and returns details', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/backup',
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);

    expect(data.success).toBe(true);
    expect(data.backupPath).toBeDefined();
    expect(data.sizeBytes).toBeGreaterThan(0);
    expect(data.integrity).toBe('ok');
    expect(data.timestamp).toBeDefined();

    expect(fsSync.existsSync(data.backupPath)).toBe(true);
  });
});
