import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type DatabaseInstance = DatabaseSync;
export type Statement = ReturnType<DatabaseSync['prepare']>;

export function createDatabase(dbPath = ':memory:'): DatabaseInstance {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 10000;');
  db.exec('PRAGMA temp_store = MEMORY;');
  db.exec('PRAGMA cache_size = -8000;');
  db.exec('PRAGMA mmap_size = 0;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA wal_autocheckpoint = 1000;');
  }
  return db;
}

export function runMigrations(db: DatabaseInstance): void {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const ddl = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(ddl);

  // Backward-compatible schema evolution for multi-user / community platform
  try {
    const seriesCols = db.prepare('PRAGMA table_info(series)').all() as Array<{ name: string }>;
    const colNames = new Set(seriesCols.map((c) => c.name));

    if (!colNames.has('uploader_user_id')) {
      db.exec("ALTER TABLE series ADD COLUMN uploader_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;");
    }
    if (!colNames.has('visibility')) {
      db.exec("ALTER TABLE series ADD COLUMN visibility TEXT NOT NULL DEFAULT 'published';");
    }
  } catch (err) {
    console.warn('[Database] Column evolution for series:', err);
  }

  try {
    const chapterCols = db.prepare('PRAGMA table_info(chapters)').all() as Array<{ name: string }>;
    const colNames = new Set(chapterCols.map((c) => c.name));

    if (!colNames.has('visibility')) {
      db.exec("ALTER TABLE chapters ADD COLUMN visibility TEXT NOT NULL DEFAULT 'published';");
    }
  } catch (err) {
    console.warn('[Database] Column evolution for chapters:', err);
  }

  try {
    const pageCols = db.prepare('PRAGMA table_info(chapter_pages)').all() as Array<{ name: string }>;
    if (!pageCols.some((column) => column.name === 'file_size_bytes')) {
      db.exec('ALTER TABLE chapter_pages ADD COLUMN file_size_bytes INTEGER NOT NULL DEFAULT 0;');
    }
  } catch (err) {
    console.warn('[Database] Column evolution for chapter_pages:', err);
  }
}
