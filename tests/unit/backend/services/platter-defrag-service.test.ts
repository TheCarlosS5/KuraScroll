import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  PlatterDefragService,
  ChapterDiskMetadata,
} from '../../../../src/backend/services/platter-defrag-service.js';

describe('PlatterDefragService (Sprint 63)', () => {
  let db: DatabaseInstance;
  let service: PlatterDefragService;
  let testDir: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platter-defrag-test-'));

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-berserk', 'berserk', 'Berserk', 'manga', 'ongoing')
    `).run();

    service = new PlatterDefragService(db);
  });

  afterEach(() => {
    db.close();
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('returns optimal PLI = 1.0 for single or empty chapter lists', () => {
    const report0 = service.calculateChaptersPli([]);
    expect(report0.pli).toBe(1.0);
    expect(report0.fragmentationPercent).toBe(0);
    expect(report0.isFragmented).toBe(false);
    expect(report0.recommendation).toBe('OPTIMAL');

    const report1 = service.calculateChaptersPli([
      { id: 'c1', chapterNumber: 1, filePath: '/fake/c1.cbz' },
    ]);
    expect(report1.pli).toBe(1.0);
    expect(report1.recommendation).toBe('OPTIMAL');
  });

  it('calculates optimal PLI for monotonically adjacent cluster sequences', () => {
    const chapters: ChapterDiskMetadata[] = [
      { id: 'c1', chapterNumber: 1, filePath: '/fake/c1.cbz', clusterRef: 1000 },
      { id: 'c2', chapterNumber: 2, filePath: '/fake/c2.cbz', clusterRef: 2000 },
      { id: 'c3', chapterNumber: 3, filePath: '/fake/c3.cbz', clusterRef: 3000 },
      { id: 'c4', chapterNumber: 4, filePath: '/fake/c4.cbz', clusterRef: 4000 },
    ];

    const report = service.calculateChaptersPli(chapters);
    expect(report.pli).toBe(1.0);
    expect(report.fragmentationPercent).toBe(0);
    expect(report.isFragmented).toBe(false);
    expect(report.recommendation).toBe('OPTIMAL');
    expect(report.estimatedSeekReductionPercent).toBe(0);
  });

  it('detects backward arm travel and penalizes PLI accordingly', () => {
    const chapters: ChapterDiskMetadata[] = [
      { id: 'c1', chapterNumber: 1, filePath: '/fake/c1.cbz', clusterRef: 5000 },
      { id: 'c2', chapterNumber: 2, filePath: '/fake/c2.cbz', clusterRef: 2000 }, // Backward seek! Penalty 1.0
      { id: 'c3', chapterNumber: 3, filePath: '/fake/c3.cbz', clusterRef: 8000 },
      { id: 'c4', chapterNumber: 4, filePath: '/fake/c4.cbz', clusterRef: 1000 }, // Backward seek! Penalty 1.0
    ];

    const report = service.calculateChaptersPli(chapters);
    expect(report.pli).toBeLessThan(0.70);
    expect(report.isFragmented).toBe(true);
    expect(report.recommendation).toBe('DEFRAGMENTATION_RECOMMENDED');
    expect(report.fragmentationPercent).toBeGreaterThan(30);
    expect(report.estimatedSeekReductionPercent).toBeGreaterThan(0);
  });

  it('performs atomic 64KB-chunked zero-thrash stream rewrite on real file', async () => {
    const filePath = path.join(testDir, 'sample_chapter.cbz');
    const content = Buffer.alloc(128 * 1024, 0x5a); // 128KB payload
    fs.writeFileSync(filePath, content);

    const { bytesRewritten, elapsedMs } = await service.defragFileContiguous(filePath);
    expect(bytesRewritten).toBe(128 * 1024);
    expect(elapsedMs).toBeGreaterThanOrEqual(0);

    // Verify content integrity
    const readBack = fs.readFileSync(filePath);
    expect(readBack.length).toBe(128 * 1024);
    expect(readBack.equals(content)).toBe(true);
  });

  it('optimizes series platter layout sequentially and logs defrag run history', async () => {
    // Seed 3 chapters with physical files
    const chapFiles = [
      path.join(testDir, 'c1.cbz'),
      path.join(testDir, 'c2.cbz'),
      path.join(testDir, 'c3.cbz'),
    ];

    for (let i = 0; i < 3; i++) {
      fs.writeFileSync(chapFiles[i], Buffer.alloc(32 * 1024, i + 1));
      db.prepare(`
        INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
        VALUES (?, 'ser-berserk', ?, ?, ?, 10)
      `).run(`chap-${i + 1}`, i + 1, `Capítulo ${i + 1}`, chapFiles[i]);
    }

    const initialReport = service.calculateSeriesPli('ser-berserk');
    expect(initialReport.totalChapters).toBe(3);

    const optResult = await service.optimizeSeriesPlatter('ser-berserk');
    expect(optResult.seriesId).toBe('ser-berserk');
    expect(optResult.chaptersProcessed).toBe(3);
    expect(optResult.bytesReordered).toBe(96 * 1024);
    expect(optResult.optimizedPli).toBeGreaterThanOrEqual(0.95);

    // Check history
    const history = service.getDefragHistory('ser-berserk');
    expect(history.length).toBe(1);
    expect(history[0].seriesId).toBe('ser-berserk');
    expect(history[0].bytesReordered).toBe(96 * 1024);
    expect(history[0].chaptersProcessed).toBe(3);

    // Check stats
    const stats = service.getStats();
    expect(stats.totalRuns).toBe(1);
    expect(stats.totalBytesOptimized).toBe(96 * 1024);
  });
});
