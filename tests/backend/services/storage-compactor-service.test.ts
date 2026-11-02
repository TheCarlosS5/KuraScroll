import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository.js';
import { StorageCompactorService } from '../../../src/backend/services/storage-compactor-service.js';

describe('StorageCompactorService Unit & Resilience Suite (Sprint 42)', () => {
  let db: DatabaseInstance;
  let tempDir: string;
  let compactor: StorageCompactorService;
  let chapRepo: ChapterRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-compactor-test-'));
    db = createDatabase(':memory:');
    runMigrations(db);
    chapRepo = new ChapterRepository(db);

    compactor = new StorageCompactorService({
      db,
      storageRoot: tempDir,
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('preserves registered chapter pages and critical protected files while deleting orphan images', async () => {
    const chapterDir = path.join(tempDir, 'series', 'chainsaw-man', 'c1');
    fs.mkdirSync(chapterDir, { recursive: true });

    // 1. Registered pages
    const p1Path = path.join(chapterDir, 'p01.webp');
    const p2Path = path.join(chapterDir, 'p02.webp');
    fs.writeFileSync(p1Path, Buffer.alloc(1024, 0xaa));
    fs.writeFileSync(p2Path, Buffer.alloc(2048, 0xbb));

    // 2. Protected system files
    const coverPath = path.join(chapterDir, 'cover.webp');
    const comicInfoPath = path.join(chapterDir, 'ComicInfo.xml');
    fs.writeFileSync(coverPath, Buffer.alloc(512, 0xcc));
    fs.writeFileSync(comicInfoPath, '<ComicInfo></ComicInfo>');

    // 3. Orphan garbage files
    const orphan1Path = path.join(chapterDir, 'orphan-draft.webp');
    const orphan2Path = path.join(chapterDir, 'temp_corrupted.png');
    fs.writeFileSync(orphan1Path, Buffer.alloc(4096, 0xdd));
    fs.writeFileSync(orphan2Path, Buffer.alloc(1024, 0xee));

    // Register series and chapter in SQLite
    db.exec(`INSERT INTO series (id, slug, title_primary, type, status) 
             VALUES ('s1', 'chainsaw-man', 'Chainsaw Man', 'manga', 'ongoing');`);

    chapRepo.createChapter({
      id: 'c1',
      seriesId: 's1',
      chapterNumber: 1,
      storagePath: 'series/chainsaw-man/c1',
    });

    chapRepo.addPages('c1', [
      { pageNumber: 1, fileName: 'p01.webp', width: 1000, height: 1500, aspectRatio: 0.666, fileSizeBytes: 1024 },
      { pageNumber: 2, fileName: 'p02.webp', width: 1000, height: 1500, aspectRatio: 0.666, fileSizeBytes: 2048 },
    ]);

    // Run compaction pass
    const report = await compactor.runCompaction();

    expect(report.seriesScanned).toBe(1);
    expect(report.chaptersScanned).toBe(1);
    expect(report.orphanFilesDeleted).toBe(2);
    expect(report.orphanBytesReclaimed).toBe(4096 + 1024);
    expect(report.protectedFilesPreserved).toBeGreaterThanOrEqual(4); // 2 pages + cover + ComicInfo
    expect(report.errors).toEqual([]);

    // Verify disk state
    expect(fs.existsSync(p1Path)).toBe(true);
    expect(fs.existsSync(p2Path)).toBe(true);
    expect(fs.existsSync(coverPath)).toBe(true);
    expect(fs.existsSync(comicInfoPath)).toBe(true);
    expect(fs.existsSync(orphan1Path)).toBe(false);
    expect(fs.existsSync(orphan2Path)).toBe(false);
  });

  it('prevents concurrent compaction runs with conflict guard', async () => {
    const chapterDir = path.join(tempDir, 'series', 'solo-leveling', 'c1');
    fs.mkdirSync(chapterDir, { recursive: true });

    const p1 = compactor.runCompaction();
    // Immediate concurrent trigger should reject
    await expect(compactor.runCompaction()).rejects.toThrow('already in progress');
    await p1;
  });

  it('correctly identifies protected file names', () => {
    expect(compactor.isProtectedFile('cover.webp')).toBe(true);
    expect(compactor.isProtectedFile('COVER.JPG')).toBe(true);
    expect(compactor.isProtectedFile('ComicInfo.xml')).toBe(true);
    expect(compactor.isProtectedFile('.gitkeep')).toBe(true);
    expect(compactor.isProtectedFile('manifest.json')).toBe(true);

    expect(compactor.isProtectedFile('orphan_page.webp')).toBe(false);
    expect(compactor.isProtectedFile('test_scan.png')).toBe(false);
  });
});
