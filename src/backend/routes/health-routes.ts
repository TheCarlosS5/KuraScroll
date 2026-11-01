import { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseInstance } from '../db/database.js';
import { imageCache, manifestCache } from '../cache/media-cache.js';
import { BackupDaemon, registerBackupRoutes } from '../daemon/backup-daemon.js';

export interface DiskSpaceInfo {
  storageRoot: string;
  freeBytes: number;
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  freePercentage: number;
}

export interface DatabaseHealthInfo {
  path: string;
  sizeBytes: number;
  walSizeBytes: number;
  pageSize: number;
  pageCount: number;
  integrity: string;
}

export interface BackupFileInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupsTelemetry {
  backupDir: string;
  totalBackups: number;
  latestBackup: BackupFileInfo | null;
}

export interface HealthRoutesOptions {
  db: DatabaseInstance;
  storageRoot?: string;
  folderWatcher?: { active: boolean; incomingDir?: string };
  backupDaemon?: BackupDaemon;
  startTime?: number;
}

let activeFolderWatcherRef: { active: boolean; incomingDir?: string } | null = null;

export function setActiveFolderWatcherRef(watcher: { active: boolean; incomingDir?: string } | null): void {
  activeFolderWatcherRef = watcher;
}

export function getActiveFolderWatcherRef(): { active: boolean; incomingDir?: string } | null {
  return activeFolderWatcherRef;
}

/**
 * Inspects physical disk allocation using fs.promises.statfs on STORAGE_ROOT.
 */
export async function getDiskSpace(storageRoot: string): Promise<DiskSpaceInfo> {
  const resolved = path.resolve(storageRoot);
  try {
    if (fs.existsSync(resolved)) {
      const stats = await fs.promises.statfs(resolved);
      const bsize = stats.bsize || 4096;
      const totalBytes = Number(stats.blocks) * bsize;
      const freeBytes = Number(stats.bfree) * bsize;
      const availableBytes = Number(stats.bavail) * bsize;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const freePercentage = totalBytes > 0 ? (availableBytes / totalBytes) * 100 : 0;

      return {
        storageRoot: resolved,
        freeBytes,
        totalBytes,
        availableBytes,
        usedBytes,
        freePercentage: Number(freePercentage.toFixed(2)),
      };
    }
  } catch {
    // Non-fatal fallback
  }

  return {
    storageRoot: resolved,
    freeBytes: 0,
    totalBytes: 0,
    availableBytes: 0,
    usedBytes: 0,
    freePercentage: 0,
  };
}

/**
 * Calculates physical database size, WAL file size, page configuration, and integrity state.
 */
export function getDatabaseHealth(db: DatabaseInstance): DatabaseHealthInfo {
  let dbPath = ':memory:';
  let sizeBytes = 0;
  let walSizeBytes = 0;

  try {
    const list = db.prepare('PRAGMA database_list;').all() as Array<{ name: string; file: string }>;
    const main = list.find((d) => d.name === 'main');
    if (main && main.file) {
      dbPath = main.file;
      if (fs.existsSync(dbPath)) {
        sizeBytes = fs.statSync(dbPath).size;
      }
      const walPath = `${dbPath}-wal`;
      if (fs.existsSync(walPath)) {
        walSizeBytes = fs.statSync(walPath).size;
      }
    }
  } catch {}

  const pageSize = (db.prepare('PRAGMA page_size;').get() as any)?.page_size ?? 4096;
  const pageCount = (db.prepare('PRAGMA page_count;').get() as any)?.page_count ?? 0;
  if (dbPath === ':memory:' || sizeBytes === 0) {
    sizeBytes = pageSize * pageCount;
  }

  let integrity = 'ok';
  try {
    const check = db.prepare('PRAGMA integrity_check;').all() as Array<{ integrity_check: string }>;
    integrity = check.map((c) => c.integrity_check).join('; ');
  } catch (err: any) {
    integrity = err.message;
  }

  return {
    path: dbPath,
    sizeBytes,
    walSizeBytes,
    pageSize,
    pageCount,
    integrity,
  };
}

/**
 * Returns live metrics from the ByteLRU memory caching layer.
 */
export function getLiveCacheMetrics() {
  const img = imageCache.getMetrics();
  const man = manifestCache.getMetrics();
  const totalRequests = (img.hits + man.hits) + (img.misses + man.misses);
  const totalHits = img.hits + man.hits;

  return {
    usedBytes: img.usedBytes + man.usedBytes,
    maxBytes: img.maxBytes + man.maxBytes,
    hits: totalHits,
    misses: img.misses + man.misses,
    hitRatio: totalRequests > 0 ? Number((totalHits / totalRequests).toFixed(4)) : 0,
    imageCache: img,
    manifestCache: man,
  };
}

/**
 * Queries aggregate catalog counts from SQLite tables.
 */
export function getAggregatedCounts(db: DatabaseInstance): { series: number; chapters: number; pages: number } {
  let series = 0;
  let chapters = 0;
  let pages = 0;

  try {
    series = (db.prepare('SELECT COUNT(*) as count FROM series;').get() as any)?.count ?? 0;
  } catch {}
  try {
    chapters = (db.prepare('SELECT COUNT(*) as count FROM chapters;').get() as any)?.count ?? 0;
  } catch {}
  try {
    pages = (db.prepare('SELECT COUNT(*) as count FROM chapter_pages;').get() as any)?.count ?? 0;
  } catch {}

  return { series, chapters, pages };
}

/**
 * Scans the backups directory and returns summary telemetry of existing database snapshots.
 */
export async function getBackupsTelemetry(backupDir: string): Promise<BackupsTelemetry> {
  const resolved = path.resolve(backupDir);
  if (!fs.existsSync(resolved)) {
    return {
      backupDir: resolved,
      totalBackups: 0,
      latestBackup: null,
    };
  }

  try {
    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    const dbFiles: Array<{ filename: string; sizeBytes: number; mtimeMs: number; createdAt: string }> = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.db')) {
        const fullPath = path.join(resolved, entry.name);
        try {
          const stat = await fs.promises.stat(fullPath);
          dbFiles.push({
            filename: entry.name,
            sizeBytes: stat.size,
            mtimeMs: stat.mtimeMs,
            createdAt: stat.birthtime ? stat.birthtime.toISOString() : new Date(stat.mtimeMs).toISOString(),
          });
        } catch {}
      }
    }

    if (dbFiles.length === 0) {
      return {
        backupDir: resolved,
        totalBackups: 0,
        latestBackup: null,
      };
    }

    // Sort newest first
    dbFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const newest = dbFiles[0];

    return {
      backupDir: resolved,
      totalBackups: dbFiles.length,
      latestBackup: {
        filename: newest.filename,
        sizeBytes: newest.sizeBytes,
        createdAt: newest.createdAt,
      },
    };
  } catch {
    return {
      backupDir: resolved,
      totalBackups: 0,
      latestBackup: null,
    };
  }
}

/**
 * Registers GET /api/v1/health and administrative backup routes.
 */
export function registerHealthRoutes(app: FastifyInstance, options: HealthRoutesOptions): void {
  const { db } = options;
  const storageRoot = options.storageRoot
    ? path.resolve(options.storageRoot)
    : path.resolve(process.env.STORAGE_ROOT || './data/storage');
  const serverStartTime = options.startTime ?? Date.now();
  const backupDir = options.backupDaemon?.backupDir ?? path.resolve(storageRoot, 'backups');

  if (options.backupDaemon) {
    registerBackupRoutes(app, options.backupDaemon);
  }

  // GET /api/v1/health
  app.get('/api/v1/health', async () => {
    const disk = await getDiskSpace(storageRoot);
    const database = getDatabaseHealth(db);
    const cache = getLiveCacheMetrics();
    const counts = getAggregatedCounts(db);
    const backups = await getBackupsTelemetry(backupDir);

    const uptime = Number(((Date.now() - serverStartTime) / 1000).toFixed(2));
    const watcherRef = options.folderWatcher ?? activeFolderWatcherRef;
    const watcher = {
      active: watcherRef?.active ?? false,
      incomingDir: watcherRef?.incomingDir,
    };

    return {
      status: 'ok',
      uptime,
      timestamp: new Date().toISOString(),
      disk,
      database,
      cache,
      counts,
      watcher,
      backups,
    };
  });
}
