import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createDatabase, DatabaseInstance, runMigrations } from '../../../src/backend/db/database.js';
import {
  DifferentialMirrorService,
  MirrorReport,
} from '../../../src/backend/services/differential-mirror-service.js';

describe('DifferentialMirrorService (SATA II Anti-Thrash & Differential Mirroring)', () => {
  let db: DatabaseInstance;
  let testRoot: string;
  let destRoot: string;
  let service: DifferentialMirrorService;

  beforeEach(async () => {
    testRoot = path.resolve(`./tmp/test-mirror-src-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    destRoot = path.resolve(`./tmp/test-mirror-dest-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    await fs.mkdir(testRoot, { recursive: true });
    await fs.mkdir(destRoot, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    service = new DifferentialMirrorService({
      db,
      storageRoot: testRoot,
    });
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true }).catch(() => {});
    await fs.rm(destRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('creates initial full snapshot with SQLite VACUUM INTO and manifest', async () => {
    // Populate DB and files
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status, cover_image)
      VALUES ('s1', 'vinland-saga', 'Vinland Saga', 'manga', 'ongoing', 'series/vinland-saga/cover.webp');

      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES ('c1', 's1', 1, 2, 'series/vinland-saga/v1/c1');
    `);

    // Create source files
    const coverPath = path.join(testRoot, 'series', 'vinland-saga', 'cover.webp');
    const chapDir = path.join(testRoot, 'series', 'vinland-saga', 'v1', 'c1');
    await fs.mkdir(path.dirname(coverPath), { recursive: true });
    await fs.mkdir(chapDir, { recursive: true });

    await fs.writeFile(coverPath, 'dummy-cover-bytes');
    await fs.writeFile(path.join(chapDir, '001.webp'), 'page-1');
    await fs.writeFile(path.join(chapDir, '002.webp'), 'page-2');
    await fs.writeFile(path.join(chapDir, 'manifest.json'), '{"chapter":1}');

    const report: MirrorReport = await service.createSnapshot({
      destinationDir: destRoot,
      differential: false,
    });

    expect(report.type).toBe('full');
    expect(report.databaseCopied).toBe(true);
    expect(report.chaptersCopied).toBe(1);
    expect(report.checksum).toBeTruthy();

    // Verify destination files exist
    await expect(fs.access(path.join(destRoot, 'kura-scroll.db'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(destRoot, 'snapshot-manifest.json'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(destRoot, 'series', 'vinland-saga', 'cover.webp'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(destRoot, 'series', 'vinland-saga', 'v1', 'c1', '001.webp'))).resolves.toBeUndefined();

    // Verify record in library_snapshots
    const snapRow: any = db.prepare('SELECT * FROM library_snapshots WHERE id = ?').get(report.snapshotId);
    expect(snapRow).toBeTruthy();
    expect(snapRow.snapshot_type).toBe('full');
  });

  it('differential snapshot skips unmodified chapters and only copies new additions', async () => {
    // 1. Initial state: series 1, chapter 1
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s2', 'berserk', 'Berserk', 'manga', 'ongoing');

      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path, created_at)
      VALUES ('b1', 's2', 1, 1, 'series/berserk/v1/c1', '2026-01-01 10:00:00');
    `);

    const chap1Dir = path.join(testRoot, 'series', 'berserk', 'v1', 'c1');
    await fs.mkdir(chap1Dir, { recursive: true });
    await fs.writeFile(path.join(chap1Dir, '001.webp'), 'b1-page1');

    // Create initial full snapshot
    await service.createSnapshot({
      destinationDir: destRoot,
      differential: false,
    });

    // 2. Add chapter 2 at a later time
    db.exec(`
      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path, created_at)
      VALUES ('b2', 's2', 2, 1, 'series/berserk/v1/c2', '2026-11-01 20:00:00');
    `);
    const chap2Dir = path.join(testRoot, 'series', 'berserk', 'v1', 'c2');
    await fs.mkdir(chap2Dir, { recursive: true });
    await fs.writeFile(path.join(chap2Dir, '001.webp'), 'b2-page1');

    // Run differential snapshot
    const diffReport = await service.createSnapshot({
      destinationDir: destRoot,
      differential: true,
    });

    expect(diffReport.type).toBe('differential');
    expect(diffReport.chaptersCopied).toBe(1); // Only chapter 2 copied!
    expect(diffReport.chaptersSkipped).toBe(1); // Chapter 1 was skipped!

    // Verify chapter 2 was placed in destination
    await expect(fs.access(path.join(destRoot, 'series', 'berserk', 'v1', 'c2', '001.webp'))).resolves.toBeUndefined();
  });
});
