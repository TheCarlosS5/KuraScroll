import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type DatabaseInstance = DatabaseSync;

export function createDatabase(dbPath = ':memory:'): DatabaseInstance {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  return db;
}

export function runMigrations(db: DatabaseInstance): void {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const ddl = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(ddl);
}
