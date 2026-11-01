import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { buildApp } from '../../src/backend/app.js';
import { FastifyInstance } from 'fastify';
import { BackupDaemon } from '../../src/backend/daemon/backup-daemon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Sprint 12 Master Verification & Full System Integration (E2E)', () => {
  const sandbox = path.resolve(__dirname, `../../tmp/sprint12-e2e-${Date.now()}`);
  const storageRoot = path.join(sandbox, 'storage');
  const backupDir = path.join(storageRoot, 'backups');
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let backupDaemon: BackupDaemon;

  beforeAll(async () => {
    sharp.cache(false);
    await fs.promises.mkdir(storageRoot, { recursive: true });
    await fs.promises.mkdir(backupDir, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    backupDaemon = new BackupDaemon({
      db,
      backupDir,
      maxBackups: 5,
    });

    app = await buildApp({
      db,
      storageRoot,
      backupDaemon,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    try {
      db.close();
    } catch {}
    try {
      await fs.promises.rm(sandbox, { recursive: true, force: true });
    } catch {}
  });

  it('1. imports a Tachiyomi backup with multilingual metadata and verifies instant FTS5 indexing', async () => {
    const backupPayload = {
      version: 2,
      mangas: [
        {
          title: 'Chainsaw Man (チェンソーマン)',
          author: 'Tatsuki Fujimoto',
          artist: 'Tatsuki Fujimoto',
          description: 'Denji is a young man living as a Devil Hunter.',
          genre: ['Action', 'Supernatural', 'Manga'],
          status: 1, // Ongoing
          source: 'MangaDex',
          url: 'https://mangadex.org/title/chainsaw-man',
          chapters: [
            { name: 'Chapter 1: Dog & Chainsaw', chapter_number: 1, read: true, last_page_read: 15 },
            { name: 'Chapter 2: The Place Where Pochita Is', chapter_number: 2, read: false, last_page_read: 0 },
          ],
        },
        {
          title: 'Solo Leveling (나 혼자만 레벨업)',
          author: 'Chugong',
          artist: 'DUBU',
          description: 'In a world where hunters must battle deadly monsters.',
          genre: ['Action', 'Fantasy', 'Manhwa'],
          status: 2, // Completed
          source: 'Asura Scans',
          url: 'https://asurascans.com/manga/solo-leveling',
          chapters: [
            { name: 'Chapter 1', chapter_number: 1, read: true, last_page_read: 25 },
          ],
        },
      ],
    };

    const importRes = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/import',
      payload: backupPayload,
    });

    expect(importRes.statusCode).toBe(200);
    const importBody = importRes.json();
    expect(importBody.success).toBe(true);
    expect(importBody.seriesImported).toBe(2);
    expect(importBody.chaptersCreated).toBe(3);

    // Multilingual Search in Japanese Kanji via FTS5
    const kanjiSearch = await app.inject({
      method: 'GET',
      url: '/api/v1/series?q=チェンソーマン',
    });
    expect(kanjiSearch.statusCode).toBe(200);
    const kanjiResults = kanjiSearch.json();
    expect(kanjiResults.items.length).toBeGreaterThanOrEqual(1);
    expect(kanjiResults.items[0].titlePrimary).toContain('Chainsaw Man');

    // Multilingual Search in Korean Hangul via FTS5
    const hangulSearch = await app.inject({
      method: 'GET',
      url: '/api/v1/series?q=레벨업',
    });
    expect(hangulSearch.statusCode).toBe(200);
    const hangulResults = hangulSearch.json();
    expect(hangulResults.items.length).toBeGreaterThanOrEqual(1);
    expect(hangulResults.items[0].titlePrimary).toContain('Solo Leveling');
  });

  it('2. ingests a multi-chapter volume archive (.cbz) without loose disk duplication', async () => {
    const volumeZip = new AdmZip();

    // Chapter 1 pages
    const p1 = await sharp({
      create: { width: 800, height: 1200, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();
    volumeZip.addFile('Chapter 1/001.png', p1);

    // Chapter 2 pages
    const p2 = await sharp({
      create: { width: 800, height: 1200, channels: 3, background: { r: 0, g: 255, b: 0 } },
    }).png().toBuffer();
    volumeZip.addFile('Chapter 2/001.png', p2);

    const volumePath = path.join(sandbox, 'One_Piece_Vol_01.cbz');
    volumeZip.writeZip(volumePath);

    // Ingest volume archive via volume extractor
    const { ingestVolumeArchive } = await import('../../src/backend/services/volume-extractor.js');
    const volResult = await ingestVolumeArchive({
      storageRoot,
      seriesSlug: 'one-piece',
      volumeNumber: 1,
      sourceArchive: volumePath,
      db,
    });

    expect(volResult.isVolume).toBe(true);
    expect(volResult.totalChapters).toBe(2);
    const totalPages = volResult.chapters.reduce((sum, ch) => sum + ch.pageCount, 0);
    expect(totalPages).toBe(2);

    // Verify Chapter 1 Manifest via API
    const chap1Res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/one-piece-c1',
    });
    expect(chap1Res.statusCode).toBe(200);
    const chap1Manifest = chap1Res.json();
    expect(chap1Manifest.pages.length).toBe(1);
    expect(chap1Manifest.pages[0].aspectRatio).toBeCloseTo(0.67, 2);
    expect(chap1Manifest.nextChapterId).toBe('one-piece-c2');

    // Verify Chapter 2 Manifest via API
    const chap2Res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/one-piece-c2',
    });
    expect(chap2Res.statusCode).toBe(200);
    const chap2Manifest = chap2Res.json();
    expect(chap2Manifest.prevChapterId).toBe('one-piece-c1');
  });

  it('3. verifies in-memory ByteLRU cache hit and Zero-CLS static image delivery', async () => {
    const pageUrl = '/storage/series/one-piece/v1/c1/001.webp';

    // Cold request (Disk)
    const coldRes = await app.inject({ method: 'GET', url: pageUrl });
    expect(coldRes.statusCode).toBe(200);
    expect(coldRes.headers['content-type']).toContain('webp');
    expect(coldRes.headers['cache-control']).toContain('immutable');

    // Hot request (ByteLRU RAM)
    const hotRes = await app.inject({ method: 'GET', url: pageUrl });
    expect(hotRes.statusCode).toBe(200);
    expect(hotRes.rawPayload.length).toBe(coldRes.rawPayload.length);

    // Verify Cache Metrics Endpoint
    const cacheMetricsRes = await app.inject({ method: 'GET', url: '/api/v1/metrics/cache' });
    expect(cacheMetricsRes.statusCode).toBe(200);
    const cacheMetrics = cacheMetricsRes.json();
    expect(cacheMetrics.imageCache).toBeDefined();
    expect(cacheMetrics.manifestCache).toBeDefined();
  });

  it('4. persists and updates reading progress cleanly', async () => {
    const progressRes = await app.inject({
      method: 'POST',
      url: '/api/v1/progress',
      payload: {
        userId: 'local_user',
        seriesId: 'one-piece',
        chapterId: 'one-piece-c1',
        pageNumber: 1,
        isCompleted: true,
      },
    });

    expect(progressRes.statusCode).toBe(200);
    const progressBody = progressRes.json();
    expect(progressBody.success).toBe(true);

    const getProgressRes = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/one-piece?userId=local_user',
    });
    expect(getProgressRes.statusCode).toBe(200);
    const currentProgress = getProgressRes.json();
    expect(currentProgress.chapterId).toBe('one-piece-c1');
    expect(Boolean(currentProgress.isCompleted)).toBe(true);
  });

  it('5. verifies system health telemetry, online hot backup snapshot, and export roundtrip', async () => {
    // Health Route
    const healthRes = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(healthRes.statusCode).toBe(200);
    const healthData = healthRes.json();
    expect(healthData.status).toBe('ok');
    expect(healthData.counts.series).toBeGreaterThanOrEqual(3);
    expect(healthData.counts.chapters).toBeGreaterThanOrEqual(5);
    expect(healthData.database.integrity).toBe('ok');
    expect(healthData.disk.freeBytes).toBeGreaterThan(0);

    // Trigger Hot Online SQLite Backup Snapshot
    const backupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/backup',
    });
    expect(backupRes.statusCode).toBe(200);
    const backupResult = backupRes.json();
    expect(backupResult.success).toBe(true);
    expect(backupResult.integrity).toBe('ok');
    expect(backupResult.sizeBytes).toBeGreaterThan(0);

    // Verify All Snapshots Integrity
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/backup/verify',
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifyData = verifyRes.json();
    expect(verifyData.totalChecked).toBeGreaterThanOrEqual(1);
    expect(verifyData.allValid).toBe(true);

    // Export Full Library JSON
    const exportRes = await app.inject({
      method: 'GET',
      url: '/api/v1/backup/export',
    });
    expect(exportRes.statusCode).toBe(200);
    const exportData = exportRes.json();
    expect(exportData.appName).toBe('KuraScroll');
    expect(exportData.series.length).toBeGreaterThanOrEqual(3);
  });
});
