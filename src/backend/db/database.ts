import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

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
  if (fs.existsSync(schemaPath)) {
    const ddl = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(ddl);
  }

  // Versioned migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationsDir = path.resolve(__dirname, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const checkStmt = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');
    const recordStmt = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)');

    for (const file of files) {
      const alreadyApplied = checkStmt.get(file);
      if (!alreadyApplied) {
        const sqlPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        db.exec('BEGIN IMMEDIATE;');
        try {
          const statements = sql
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          for (const stmt of statements) {
            try {
              db.exec(stmt + ';');
            } catch (stmtErr: any) {
              if (stmtErr.message && stmtErr.message.includes('duplicate column name')) {
                continue;
              }
              throw stmtErr;
            }
          }
          recordStmt.run(file);
          db.exec('COMMIT;');
        } catch (err) {
          db.exec('ROLLBACK;');
          throw new Error(`Failed to apply migration ${file}: ${(err as Error).message}`);
        }
      }
    }
  }
}
