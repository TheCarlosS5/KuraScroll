import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { buildApp } from '../../../src/backend/app.js';
import {
  importToSqlite,
  exportFromSqlite,
  ImportReport,
} from '../../../src/backend/backup-import/import/import-to-sqlite.js';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

function printAsciiTable(title: string, rows: [string, string | number][]) {
  console.log(`\n===============================================================`);
  console.log(` BENCHMARK REPORT: ${title}`);
  console.log(`===============================================================`);
  for (const [key, val] of rows) {
    console.log(` ${key.padEnd(38)} : ${val}`);
  }
  console.log(`===============================================================\n`);
}

describe('Transactional Batch Staging & SQLite FTS5 Migration Suite', () => {
  let db: DatabaseInstance;

  beforeAll(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
  });

  afterAll(() => {
    try {
      db.close();
    } catch {}
  });

  // ==========================================================================
  // Test 1: Complete Representative Dataset Import & FTS5 Synchronization
  // ==========================================================================
  it('imports representative multilingual backup and verifies SQLite tables and FTS5 triggers', async () => {
    const representativeBackup = {
      appName: 'Tachiyomi',
      version: 2,
      series: [
        {
          slug: 'solo-leveling',
          titlePrimary: 'Solo Leveling',
          titles: [
            { languageCode: 'en', title: 'Solo Leveling', isPrimary: true },
            { languageCode: 'ko', title: '나 혼자만 레벨업', isPrimary: false },
            { languageCode: 'ja', title: '俺だけレベルアップな件', isPrimary: false },
          ],
          type: 'manhwa',
          status: 'completed',
          author: 'Chugong',
          artist: 'DUBU',
          synopsis: 'Sung Jin-woo becomes the world strongest hunter.',
          genres: ['Action', 'Fantasy', 'Manhwa'],
          chapters: [
            { chapterNumber: 1, title: 'Chapter 01 - E-Rank Hunter', isRead: true, lastPageRead: 20 },
            { chapterNumber: 2, title: 'Chapter 02 - Double Dungeon', isRead: true, lastPageRead: 15 },
            { chapterNumber: 3, title: 'Chapter 03 - The Quest', isRead: false, lastPageRead: 0 },
          ],
        },
        {
          slug: 'berserk',
          titlePrimary: 'Berserk',
          titles: [
            { languageCode: 'en', title: 'Berserk', isPrimary: true },
            { languageCode: 'ja', title: 'ベルセルク', isPrimary: false },
          ],
          type: 'manga',
          status: 'ongoing',
          author: 'Kentarou Miura',
          artist: 'Kentarou Miura',
          synopsis: 'Guts the Black Swordsman seeks vengeance.',
          genres: ['Action', 'Dark Fantasy', 'Seinen'],
          chapters: [
            { chapterNumber: 1, title: 'The Black Swordsman', isRead: true, lastPageRead: 45 },
            { chapterNumber: 2, title: 'The Brand', isRead: false, lastPageRead: 0 },
          ],
        },
      ],
    };

    const report = await importToSqlite({
      db,
      backup: representativeBackup,
      chunkSize: 50,
      strict: true,
    });

    expect(report.success).toBe(true);
    expect(report.seriesImported).toBe(2);
    expect(report.chaptersCreated).toBe(5);
    expect(report.progressRecordsCreated).toBe(2);
    expect(report.errors.length).toBe(0);

    // 1. Verify series master table
    const solo = db.prepare('SELECT * FROM series WHERE slug = ?').get('solo-leveling') as any;
    expect(solo).toBeDefined();
    expect(solo.title_primary).toBe('Solo Leveling');
    expect(solo.type).toBe('manhwa');
    expect(solo.status).toBe('completed');
    expect(solo.author).toBe('Chugong');

    // 2. Verify series_titles table
    const soloTitles = db.prepare('SELECT * FROM series_titles WHERE series_id = ?').all(solo.id) as any[];
    expect(soloTitles.length).toBe(3);
    const titlesSet = new Set(soloTitles.map((t) => t.title));
    expect(titlesSet.has('Solo Leveling')).toBe(true);
    expect(titlesSet.has('나 혼자만 레벨업')).toBe(true);
    expect(titlesSet.has('俺だけレベルアップな件')).toBe(true);

    // 3. Verify FTS5 virtual table synchronization via SQLite triggers
    const ftsEnglish = db.prepare(`
      SELECT series_id FROM series_search_fts WHERE series_search_fts MATCH 'Solo*'
    `).all() as any[];
    expect(ftsEnglish.some((r) => r.series_id === solo.id)).toBe(true);

    const ftsKorean = db.prepare(`
      SELECT series_id FROM series_search_fts WHERE series_search_fts MATCH '레벨업'
    `).all() as any[];
    expect(ftsKorean.some((r) => r.series_id === solo.id)).toBe(true);

    const berserk = db.prepare('SELECT * FROM series WHERE slug = ?').get('berserk') as any;
    const ftsJapanese = db.prepare(`
      SELECT series_id FROM series_search_fts WHERE series_search_fts MATCH 'ベルセルク'
    `).all() as any[];
    expect(ftsJapanese.some((r) => r.series_id === berserk.id)).toBe(true);

    // 4. Verify reading progress synchronization
    const soloProgress = db.prepare('SELECT * FROM user_progress WHERE series_id = ?').get(solo.id) as any;
    expect(soloProgress).toBeDefined();
    expect(soloProgress.chapter_id).toBe(`chap_solo-leveling_2`);
    expect(soloProgress.page_number).toBe(15);
    expect(soloProgress.is_completed).toBe(1);
  });

  // ==========================================================================
  // Test 2: Full-Cycle Round-Trip (Export -> Clean Re-Import)
  // ==========================================================================
  it('exports library snapshot to JSON and re-imports cleanly into a fresh database', async () => {
    // 1. Export current database state
    const exportedSnapshot = exportFromSqlite(db);
    expect(exportedSnapshot.appName).toBe('KuraScroll');
    expect(exportedSnapshot.version).toBe(1);
    expect(exportedSnapshot.seriesCount).toBe(2);
    expect(exportedSnapshot.chapterCount).toBe(5);

    // 2. Create fresh blank database
    const freshDb = createDatabase(':memory:');
    runMigrations(freshDb);

    // Verify fresh database is empty
    const initialCount = (freshDb.prepare('SELECT count(*) as count FROM series').get() as any).count;
    expect(initialCount).toBe(0);

    // 3. Re-import snapshot
    const reimportReport = await importToSqlite({
      db: freshDb,
      backup: exportedSnapshot,
      strict: true,
    });

    expect(reimportReport.success).toBe(true);
    expect(reimportReport.seriesImported).toBe(2);
    expect(reimportReport.chaptersCreated).toBe(5);

    // Verify series, titles, and FTS5 in the restored database
    const restoredCount = (freshDb.prepare('SELECT count(*) as count FROM series').get() as any).count;
    expect(restoredCount).toBe(2);

    const ftsCheck = freshDb.prepare(`
      SELECT series_id FROM series_search_fts WHERE series_search_fts MATCH 'Solo*'
    `).all();
    expect(ftsCheck.length).toBeGreaterThanOrEqual(1);

    freshDb.close();
  });

  // ==========================================================================
  // Test 3: Fastify Endpoints Integration (/api/v1/backup/import & /export)
  // ==========================================================================
  it('handles HTTP POST /api/v1/backup/import and GET /api/v1/backup/export', async () => {
    const testApp = buildApp({ db });

    // 1. Test GET /api/v1/backup/export
    const exportResponse = await testApp.inject({
      method: 'GET',
      url: '/api/v1/backup/export',
    });

    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('application/json');
    expect(exportResponse.headers['content-disposition']).toContain('kurascroll-backup');

    const exportedJson = JSON.parse(exportResponse.body);
    expect(exportedJson.appName).toBe('KuraScroll');
    expect(exportedJson.series.length).toBe(2);

    // 2. Test POST /api/v1/backup/import with new incoming series
    const newBackupPayload = {
      version: 2,
      mangas: [
        {
          title: 'Chainsaw Man (チェンソーマン)',
          author: 'Tatsuki Fujimoto',
          genre: ['Action', 'Horror', 'Supernatural'],
          status: 1,
          chapters: [
            { chapter_number: 1, name: 'Dog & Chainsaw', read: true, last_page_read: 50 },
            { chapter_number: 2, name: 'The Place Where Pochita Is', read: false },
          ],
        },
      ],
    };

    const importResponse = await testApp.inject({
      method: 'POST',
      url: '/api/v1/backup/import',
      payload: {
        backup: newBackupPayload,
        strict: false,
      },
    });

    expect(importResponse.statusCode).toBe(200);
    const importReport: ImportReport = JSON.parse(importResponse.body);
    expect(importReport.success).toBe(true);
    expect(importReport.seriesImported).toBe(1);
    expect(importReport.chaptersCreated).toBe(2);

    // Verify Chainsaw Man in DB
    const csm = db.prepare('SELECT * FROM series WHERE slug = ?').get('chainsaw-man') as any;
    expect(csm).toBeDefined();
    expect(csm.author).toBe('Tatsuki Fujimoto');

    await testApp.close();
  });

  // ==========================================================================
  // Test 4: Mass Ingestion Benchmark: 100 Series + 1,000 Chapters in < 1 Second
  // ==========================================================================
  it('benchmarks mass ingestion of 100 series and 1,000 chapters in < 1 second under SQLite WAL mode', async () => {
    const tempDir = path.resolve(__dirname, `../../../tmp/backup-bench-${Date.now()}`);
    const walDbPath = path.join(tempDir, 'wal-bench.db');

    await fs.mkdir(tempDir, { recursive: true });
    const walDb = createDatabase(walDbPath);
    runMigrations(walDb);

    // Ensure WAL journal mode
    const pragma = walDb.prepare('PRAGMA journal_mode;').get() as { journal_mode: string };
    expect(pragma.journal_mode.toLowerCase()).toBe('wal');

    // Generate synthetic 100-series dataset with 10 chapters each (1,000 chapters total)
    const massSeriesList: any[] = [];
    for (let s = 1; s <= 100; s++) {
      const slug = `mass-series-${String(s).padStart(3, '0')}`;
      const chapters: any[] = [];
      for (let c = 1; c <= 10; c++) {
        chapters.push({
          chapterNumber: c,
          title: `Chapter ${c}`,
          scanlator: 'SpeedScan',
          isRead: c <= 3,
          lastPageRead: c === 3 ? 24 : 0,
        });
      }

      massSeriesList.push({
        slug,
        titlePrimary: `Synthetic Mass Manga Volume ${s}`,
        titles: [
          { languageCode: 'en', title: `Synthetic Mass Manga Volume ${s}`, isPrimary: true },
          { languageCode: 'ja', title: `合成大マンガ第${s}巻`, isPrimary: false },
        ],
        type: s % 2 === 0 ? 'manga' : 'manhwa',
        status: s % 3 === 0 ? 'completed' : 'ongoing',
        author: `Author ${s}`,
        artist: `Artist ${s}`,
        synopsis: `Synthetic synopsis describing the storyline of series number ${s}.`,
        genres: ['Action', 'Fantasy', s % 2 === 0 ? 'Manga' : 'Manhwa'],
        chapters,
      });
    }

    const massBackup = {
      appName: 'KuraScroll',
      version: 1,
      seriesCount: 100,
      series: massSeriesList,
    };

    // Execute mass batch import with chunkSize = 50
    const startBench = performance.now();
    const report = await importToSqlite({
      db: walDb,
      backup: massBackup,
      chunkSize: 50,
      strict: true,
    });
    const totalDurationMs = +(performance.now() - startBench).toFixed(2);

    const seriesThroughput = +((100 / (totalDurationMs / 1000))).toFixed(2);
    const chapterThroughput = +((1000 / (totalDurationMs / 1000))).toFixed(2);

    // Assertions: 100 series & 1,000 chapters in < 1,000 ms (1 second)
    expect(report.success).toBe(true);
    expect(report.seriesImported).toBe(100);
    expect(report.chaptersCreated).toBe(1000);
    expect(report.progressRecordsCreated).toBe(100);
    expect(totalDurationMs).toBeLessThan(1000); // Strict SLA: Under 1 second!

    // Verify database counts
    const dbSeriesCount = (walDb.prepare('SELECT count(*) as count FROM series').get() as any).count;
    const dbChapterCount = (walDb.prepare('SELECT count(*) as count FROM chapters').get() as any).count;
    const dbFtsCount = (walDb.prepare('SELECT count(*) as count FROM series_search_fts').get() as any).count;

    expect(dbSeriesCount).toBe(100);
    expect(dbChapterCount).toBe(1000);
    expect(dbFtsCount).toBeGreaterThanOrEqual(200); // At least 2 titles per series

    printAsciiTable('MASS MIGRATION INGESTION BENCHMARK (100 SERIES / 1,000 CHAPTERS)', [
      ['Total Series Ingested', report.seriesImported],
      ['Total Chapters Ingested', report.chaptersCreated],
      ['Reading Progress Upserts', report.progressRecordsCreated],
      ['SQLite Journal Mode', pragma.journal_mode.toUpperCase()],
      ['Batch Chunk Size', '50 series / transaction'],
      ['Elapsed Time', `${totalDurationMs} ms (< 1000 ms SLA MET)`],
      ['Series Ingestion Throughput', `${seriesThroughput} series/s`],
      ['Chapter Ingestion Throughput', `${chapterThroughput} chapters/s`],
      ['FTS5 Indexed Search Entries', dbFtsCount],
      ['Errors Encountered', report.errors.length],
    ]);

    // Cleanup
    try {
      walDb.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================================================
  // Test 5: Resilient Error Handling (Strict vs Non-Strict Mode)
  // ==========================================================================
  it('isolates faulty series in non-strict mode while strict mode aborts cleanly', async () => {
    const errorDb = createDatabase(':memory:');
    runMigrations(errorDb);

    const corruptBackup = {
      version: 1,
      series: [
        {
          slug: 'valid-series-1',
          titlePrimary: 'Valid Series 1',
          type: 'manga',
          status: 'ongoing',
          chapters: [],
        },
        {
          slug: 'invalid-series',
          titlePrimary: 'Invalid Series with Bad Type',
          type: 'invalid_type_which_violates_check_constraint', // CHECK constraint violation
          status: 'ongoing',
          chapters: [],
        },
        {
          slug: 'valid-series-2',
          titlePrimary: 'Valid Series 2',
          type: 'manhwa',
          status: 'ongoing',
          chapters: [],
        },
      ],
    };

    // 1. In strict mode: throws and rolls back
    await expect(
      importToSqlite({
        db: errorDb,
        backup: corruptBackup,
        strict: true,
      })
    ).rejects.toThrow();

    // 2. In non-strict mode: commits valid series and reports the error
    const nonStrictReport = await importToSqlite({
      db: errorDb,
      backup: corruptBackup,
      strict: false,
    });

    expect(nonStrictReport.success).toBe(false);
    expect(nonStrictReport.seriesImported).toBe(2);
    expect(nonStrictReport.errors.length).toBe(1);
    expect(nonStrictReport.errors[0].seriesSlug).toBe('invalid-series');

    const validCount = (errorDb.prepare('SELECT count(*) as count FROM series').get() as any).count;
    expect(validCount).toBe(2);

    errorDb.close();
  });
});
