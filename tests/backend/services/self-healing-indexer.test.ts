import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createDatabase, DatabaseInstance, runMigrations } from '../../../src/backend/db/database.js';
import {
  SelfHealingIndexer,
  HealingReport,
} from '../../../src/backend/services/self-healing-indexer.js';

describe('SelfHealingIndexer (Autonomous Recovery & Anti-Saturación 4TB)', () => {
  let db: DatabaseInstance;
  let testRoot: string;
  let indexer: SelfHealingIndexer;

  beforeEach(async () => {
    testRoot = path.resolve(`./tmp/test-self-healing-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testRoot, { recursive: true });
    db = createDatabase(':memory:');
    runMigrations(db);
    indexer = new SelfHealingIndexer({ db, storageRoot: testRoot });
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('cleans orphaned .tmp and .part files in storage root and .tmp directory', async () => {
    const tmpDir = path.join(testRoot, '.tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    const orphanTmp = path.join(tmpDir, 'extract-123.tmp');
    const orphanPart = path.join(testRoot, 'series', 'berserk', '001.webp.part');
    await fs.mkdir(path.dirname(orphanPart), { recursive: true });

    await fs.writeFile(orphanTmp, 'corrupt extraction buffer', 'utf-8');
    await fs.writeFile(orphanPart, 'half-written webp bytes', 'utf-8');

    // Make file timestamps older than 1 second
    const pastTime = new Date(Date.now() - 5000);
    await fs.utimes(orphanTmp, pastTime, pastTime);
    await fs.utimes(orphanPart, pastTime, pastTime);

    const report = await indexer.cleanOrphanedFiles(1000);

    expect(report.cleanedCount).toBe(2);
    await expect(fs.access(orphanTmp)).rejects.toThrow();
    await expect(fs.access(orphanPart)).rejects.toThrow();
  });

  it('runs SQLite integrity check and WAL checkpoint verification', async () => {
    const checkResult = await indexer.verifySqliteIntegrity();
    expect(checkResult.checkpointOk).toBe(true);
    expect(checkResult.quickCheckOk).toBe(true);
  });

  it('heals missing series covers from chapter 1 page 1 if cover is missing', async () => {
    // Insert series without cover
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s1', 'sololeveling', 'Solo Leveling', 'manhwa', 'ongoing');
    `);

    // Create chapter 1 directory with 001.webp
    const chapDir = path.join(testRoot, 'series', 'sololeveling', 'v1', 'c1');
    await fs.mkdir(chapDir, { recursive: true });
    const dummyWebp = Buffer.from('RIFF....WEBPVP8 ...');
    await fs.writeFile(path.join(chapDir, '001.webp'), dummyWebp);

    const result = await indexer.reconcileSeriesCovers();

    expect(result.missingCoversFound).toBe(1);
    expect(result.healedCovers).toBe(1);

    // Verify series row now has cover_image set
    const seriesRow: any = db.prepare('SELECT cover_image FROM series WHERE id = ?').get('s1');
    expect(seriesRow.cover_image).toBeTruthy();
    expect(seriesRow.cover_image).toContain('cover.webp');
  });

  it('incremental scan skips series folder if filesystem mtime matches folder_sync_state', async () => {
    // Insert series
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s2', 'onepiece', 'One Piece', 'manga', 'ongoing');
    `);

    const seriesDir = path.join(testRoot, 'series', 'onepiece');
    await fs.mkdir(seriesDir, { recursive: true });

    // Initial healing scan
    const firstScan = await indexer.reconcileOrphanedChapters();
    expect(firstScan.scannedFolders).toBe(1);

    // Second scan without modifying directory
    const secondScan = await indexer.reconcileOrphanedChapters();
    // Because mtime was unchanged, folder was skipped via folder_sync_state
    expect(secondScan.scannedFolders).toBe(0);
  });

  it('recovers unindexed chapter with manifest into SQLite database', async () => {
    // Insert series
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s3', 'naruto', 'Naruto', 'manga', 'completed');
    `);

    // Create chapter on disk that is not in database
    const chapDir = path.join(testRoot, 'series', 'naruto', 'v1', 'c1');
    await fs.mkdir(chapDir, { recursive: true });
    await fs.writeFile(path.join(chapDir, '001.webp'), 'page 1');
    await fs.writeFile(path.join(chapDir, '002.webp'), 'page 2');

    const manifest = {
      seriesSlug: 'naruto',
      volumeNumber: 1,
      chapterNumber: 1,
      pageCount: 2,
      totalBytes: 5000,
      pages: [
        { pageNumber: 1, fileName: '001.webp', width: 1000, height: 1500, aspectRatio: 0.666, fileSizeBytes: 2500 },
        { pageNumber: 2, fileName: '002.webp', width: 1000, height: 1500, aspectRatio: 0.666, fileSizeBytes: 2500 },
      ],
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(chapDir, 'manifest.json'), JSON.stringify(manifest), 'utf-8');

    const result = await indexer.reconcileOrphanedChapters();
    expect(result.chaptersRecovered).toBe(1);

    // Verify DB has the chapter
    const chapterRow: any = db.prepare('SELECT * FROM chapters WHERE series_id = ?').get('s3');
    expect(chapterRow).toBeTruthy();
    expect(chapterRow.chapter_number).toBe(1);
    expect(chapterRow.page_count).toBe(2);

    // Verify pages were inserted
    const pages: any = db.prepare('SELECT * FROM chapter_pages WHERE chapter_id = ?').all(chapterRow.id);
    expect(pages.length).toBe(2);
  });

  it('runs full self-healing cycle cleanly and produces complete report', async () => {
    const report: HealingReport = await indexer.runFullHealing();
    expect(report.integrity.checkpointOk).toBe(true);
    expect(report.timestamp).toBeTruthy();
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });
});
