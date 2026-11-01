import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase, runMigrations } from '../../../src/backend/db/database';
import { BackupDaemon } from '../../../src/backend/daemon/backup-daemon';

const TEST_DIR = path.resolve(__dirname, 'tmp-backup-test');
const DB_PATH = path.join(TEST_DIR, 'source.db');
const BACKUP_DIR = path.join(TEST_DIR, 'backups');

describe('BackupDaemon (Hot Online SQLite VACUUM INTO)', () => {
  let db: ReturnType<typeof createDatabase>;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    db = createDatabase(DB_PATH);
    runMigrations(db);

    // Populate data across tables
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('chainsaw-man', 'chainsaw-man', 'Chainsaw Man', 'manga', 'ongoing');

      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES ('chainsaw-man-c1', 'chainsaw-man', 1, 40, 'series/chainsaw-man/v1/c1');
    `);
  });

  afterEach(async () => {
    try {
      db.close();
    } catch {}
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('creates hot backup with VACUUM INTO and verifies integrity with PRAGMA integrity_check', async () => {
    const daemon = new BackupDaemon({
      db,
      backupDir: BACKUP_DIR,
      retentionCount: 5,
    });

    const result = await daemon.createBackup();

    expect(result.success).toBe(true);
    expect(result.backupPath).toBeDefined();
    expect(result.integrity).toBe('ok');
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(fsSync.existsSync(result.backupPath)).toBe(true);

    // Verify backup independently by opening it as a separate SQLite connection
    const backupDb = new DatabaseSync(result.backupPath);
    try {
      const integrityRows = backupDb.prepare('PRAGMA integrity_check;').all() as Array<{ integrity_check: string }>;
      expect(integrityRows).toEqual([{ integrity_check: 'ok' }]);

      // Verify records exist in backup
      const seriesRow = backupDb.prepare('SELECT * FROM series WHERE id = ?;').get('chainsaw-man') as any;
      expect(seriesRow).not.toBeNull();
      expect(seriesRow.title_primary).toBe('Chainsaw Man');

      const chapterRow = backupDb.prepare('SELECT * FROM chapters WHERE id = ?;').get('chainsaw-man-c1') as any;
      expect(chapterRow).not.toBeNull();
      expect(chapterRow.page_count).toBe(40);
    } finally {
      backupDb.close();
    }
  });

  it('enforces retention policy keeping only the latest N backups', async () => {
    const retentionLimit = 3;
    const daemon = new BackupDaemon({
      db,
      backupDir: BACKUP_DIR,
      retentionCount: retentionLimit,
    });

    // Create 5 backups in sequence with manual timestamps to ensure distinct mtimes
    for (let i = 1; i <= 5; i++) {
      const filename = `kura-scroll-backup-00${i}.db`;
      await daemon.createBackup(filename);
      // Wait a slight tick so filesystem mtime changes
      await new Promise((r) => setTimeout(r, 20));
    }

    const files = await fs.readdir(BACKUP_DIR);
    const dbFiles = files.filter((f) => f.endsWith('.db'));

    expect(dbFiles.length).toBe(retentionLimit);

    // The oldest two (001 and 002) should have been pruned
    expect(dbFiles).not.toContain('kura-scroll-backup-001.db');
    expect(dbFiles).not.toContain('kura-scroll-backup-002.db');

    // The 3 newest should be retained
    expect(dbFiles).toContain('kura-scroll-backup-003.db');
    expect(dbFiles).toContain('kura-scroll-backup-004.db');
    expect(dbFiles).toContain('kura-scroll-backup-005.db');
  });

  it('starts and stops background interval timer cleanly', () => {
    const daemon = new BackupDaemon({
      db,
      backupDir: BACKUP_DIR,
      intervalMs: 60000,
    });

    expect(daemon.active).toBe(false);
    daemon.start();
    expect(daemon.active).toBe(true);
    daemon.stop();
    expect(daemon.active).toBe(false);
  });
});
