import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { runDatabaseMaintenance } from '../../../src/backend/db/maintenance';

describe('runDatabaseMaintenance', () => {
  const tmpDir = path.resolve(__dirname, 'tmp-maintenance-test');
  const tmpDbPath = path.join(tmpDir, 'test-maintenance.db');
  let activeDb: DatabaseInstance | null = null;

  beforeEach(() => {
    if (activeDb) {
      try {
        activeDb.close();
      } catch {
        // ignore
      }
      activeDb = null;
    }
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (activeDb) {
      try {
        activeDb.close();
      } catch {
        // ignore
      }
      activeDb = null;
    }
    if (fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error if lock persists momentarily
      }
    }
  });

  it('runs maintenance cleanly on an in-memory database', () => {
    activeDb = createDatabase(':memory:');
    runMigrations(activeDb);

    const result = runDatabaseMaintenance(activeDb);

    expect(result.ok).toBe(true);
    expect(result.integrity).toEqual(['ok']);
    expect(result.walCheckpoint).toBeDefined();
    expect(typeof result.walCheckpoint.busy).toBe('number');
    expect(result.metrics.pageSize).toBeGreaterThan(0);
    expect(result.metrics.pageCount).toBeGreaterThan(0);
    expect(result.metrics.totalSizeBytes).toBeGreaterThan(0);
    expect(result.metrics.filePath).toBeNull();
    expect(result.timestamp).toBeDefined();
  });

  it('runs WAL truncation, checkpointing, and metric gathering on a physical disk database', () => {
    activeDb = createDatabase(tmpDbPath);
    runMigrations(activeDb);

    // Insert records to generate WAL write activity
    const insertStmt = activeDb.prepare('INSERT INTO genres (name, slug) VALUES (?, ?)');
    for (let i = 1; i <= 20; i++) {
      insertStmt.run(`Genre ${i}`, `genre-${i}`);
    }

    const result = runDatabaseMaintenance(activeDb);

    expect(result.ok).toBe(true);
    expect(result.integrity).toEqual(['ok']);
    expect(result.walCheckpoint.busy).toBe(0);
    expect(result.walCheckpoint.checkpointed).toBeGreaterThanOrEqual(0);
    expect(result.metrics.filePath).toBe(tmpDbPath);
    expect(result.metrics.dbFileSizeBytes).toBeGreaterThan(0);

    // WAL file should be truncated to 0 by PRAGMA wal_checkpoint(TRUNCATE)
    const walPath = `${tmpDbPath}-wal`;
    if (fs.existsSync(walPath)) {
      const walSize = fs.statSync(walPath).size;
      expect(walSize).toBe(0);
    }

    expect(result.metrics.totalSizeBytes).toBe(result.metrics.pageSize * result.metrics.pageCount);
  });

  it('executes PRAGMA optimize without errors and keeps database responsive', () => {
    activeDb = createDatabase(':memory:');
    runMigrations(activeDb);

    activeDb.exec(`
      CREATE TABLE IF NOT EXISTS test_perf (id INTEGER PRIMARY KEY, val TEXT);
      CREATE INDEX IF NOT EXISTS idx_test_perf ON test_perf(val);
      INSERT INTO test_perf (val) VALUES ('a'), ('b'), ('c');
    `);

    const result = runDatabaseMaintenance(activeDb);
    expect(result.ok).toBe(true);

    // Database should continue executing queries normally after optimize
    const row = activeDb.prepare('SELECT COUNT(*) as count FROM test_perf').get() as { count: number };
    expect(row.count).toBe(3);
  });
});
