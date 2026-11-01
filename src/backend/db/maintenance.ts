import fs from 'node:fs';
import path from 'node:path';
import { DatabaseInstance, createDatabase } from './database.js';

export interface WalCheckpointResult {
  busy: number;
  log: number;
  checkpointed: number;
}

export interface DatabaseMetrics {
  pageSize: number;
  pageCount: number;
  freelistCount: number;
  totalSizeBytes: number;
  filePath: string | null;
  dbFileSizeBytes?: number;
  walFileSizeBytes?: number;
}

export interface DatabaseMaintenanceResult {
  ok: boolean;
  integrity: string[];
  walCheckpoint: WalCheckpointResult;
  metrics: DatabaseMetrics;
  timestamp: string;
}

/**
 * Runs automated autonomous maintenance on a SQLite database instance:
 * 1. PRAGMA integrity_check to verify B-Tree integrity and index health.
 * 2. PRAGMA optimize to analyze query statistics and update table planner stats.
 * 3. PRAGMA wal_checkpoint(TRUNCATE) to sync dirty pages and truncate the WAL file to 0.
 * 4. Gathers size and storage metrics.
 */
export function runDatabaseMaintenance(db: DatabaseInstance): DatabaseMaintenanceResult {
  // 1. Run Integrity Check
  const integrityRows = db.prepare('PRAGMA integrity_check;').all() as Array<{ integrity_check: string }>;
  const integrity = integrityRows.map((r) => r.integrity_check);
  const ok = integrity.length === 1 && integrity[0] === 'ok';

  // 2. Optimize query planner statistics
  db.exec('PRAGMA optimize;');

  // 3. Run WAL Checkpoint (TRUNCATE) to sync & truncate WAL log
  const checkpointRow = db.prepare('PRAGMA wal_checkpoint(TRUNCATE);').get() as
    | { busy: number; log: number; checkpointed: number }
    | undefined;

  const walCheckpoint: WalCheckpointResult = {
    busy: checkpointRow?.busy ?? 0,
    log: checkpointRow?.log ?? 0,
    checkpointed: checkpointRow?.checkpointed ?? 0,
  };

  // 4. Gather metrics on pages and disk footprint
  const pageSizeRow = db.prepare('PRAGMA page_size;').get() as { page_size: number } | undefined;
  const pageCountRow = db.prepare('PRAGMA page_count;').get() as { page_count: number } | undefined;
  const freelistRow = db.prepare('PRAGMA freelist_count;').get() as { freelist_count: number } | undefined;

  const pageSize = pageSizeRow?.page_size ?? 4096;
  const pageCount = pageCountRow?.page_count ?? 0;
  const freelistCount = freelistRow?.freelist_count ?? 0;
  const totalSizeBytes = pageSize * pageCount;

  let filePath: string | null = null;
  let dbFileSizeBytes: number | undefined;
  let walFileSizeBytes: number | undefined;

  try {
    const dbListRows = db.prepare('PRAGMA database_list;').all() as Array<{ name: string; file: string }>;
    const mainDb = dbListRows.find((d) => d.name === 'main');
    if (mainDb && mainDb.file) {
      filePath = mainDb.file;
      if (fs.existsSync(filePath)) {
        dbFileSizeBytes = fs.statSync(filePath).size;
      }
      const walPath = `${filePath}-wal`;
      if (fs.existsSync(walPath)) {
        walFileSizeBytes = fs.statSync(walPath).size;
      }
    }
  } catch {
    // Non-fatal if filesystem stat unavailable (e.g. in-memory database)
  }

  return {
    ok,
    integrity,
    walCheckpoint,
    metrics: {
      pageSize,
      pageCount,
      freelistCount,
      totalSizeBytes,
      filePath,
      dbFileSizeBytes,
      walFileSizeBytes,
    },
    timestamp: new Date().toISOString(),
  };
}

if (process.argv[1]?.endsWith('maintenance.ts') || process.argv[1]?.endsWith('maintenance.js')) {
  const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.resolve('./data/kura-scroll.db');
  console.log(`\x1b[36m[DB Maintenance]\x1b[0m Executing maintenance on: ${dbPath}`);
  const db = createDatabase(dbPath);
  const result = runDatabaseMaintenance(db);
  console.log(`\x1b[32m✔ Maintenance completed.\x1b[0m Integrity: ${result.ok ? 'OK' : 'FAILED'}`);
  console.log(JSON.stringify(result, null, 2));
  db.close();
}
