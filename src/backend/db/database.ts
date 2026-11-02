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
}
