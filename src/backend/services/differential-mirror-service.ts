import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseInstance } from '../db/database.js';
import { AdaptiveIngestionController } from './adaptive-ingestion-controller.js';
import { copyFileWithBackpressure, calculateFileHashStream } from '../utils/stream-copy.js';

export interface DifferentialMirrorOptions {
  db: DatabaseInstance;
  storageRoot: string;
  adaptiveController?: AdaptiveIngestionController;
}

export interface CreateSnapshotParams {
  destinationDir: string;
  differential?: boolean;
}

export interface MirrorReport {
  snapshotId: string;
  type: 'full' | 'differential';
  databaseCopied: boolean;
  dbSizeBytes: number;
  seriesProcessed: number;
  chaptersCopied: number;
  chaptersSkipped: number;
  filesCopied: number;
  bytesCopied: number;
  durationMs: number;
  destination: string;
  checksum: string;
  timestamp: string;
}

function resolveRelativePath(root: string, value: unknown): string | null {
  if (typeof value !== 'string' || !value || path.isAbsolute(value)) return null;
  const normalized = value.replace(/[\\/]+/g, path.sep);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, normalized);
  const relative = path.relative(resolvedRoot, resolved);
  return !relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
    ? null
    : resolved;
}

function isContainedPath(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function ensureSafeDirectory(root: string, target: string): Promise<void> {
  if (!isContainedPath(root, target)) throw new Error('Mirror destination escapes its root');
  const relative = path.relative(path.resolve(root), path.resolve(target));
  let current = path.resolve(root);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      await fs.mkdir(current);
    } catch (err: any) {
      if (err?.code !== 'EEXIST') throw err;
    }
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Mirror destination contains a symlink or non-directory component');
  }
}

async function ensureSafeFileDestination(root: string, target: string): Promise<void> {
  if (!isContainedPath(root, target)) throw new Error('Mirror file destination escapes its root');
  await ensureSafeDirectory(root, path.dirname(target));
  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Mirror file destination is not a regular file');
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

async function filesMatch(sourcePath: string, destinationPath: string, sourceSize: number): Promise<boolean> {
  try {
    const destination = await fs.lstat(destinationPath);
    if (!destination.isFile() || destination.isSymbolicLink() || destination.size !== sourceSize) return false;
    const [sourceHash, destinationHash] = await Promise.all([
      calculateFileHashStream(sourcePath),
      calculateFileHashStream(destinationPath),
    ]);
    return sourceHash === destinationHash;
  } catch {
    return false;
  }
}

export class DifferentialMirrorService {
  private readonly db: DatabaseInstance;
  private readonly storageRoot: string;
  private readonly adaptiveController?: AdaptiveIngestionController;

  constructor(options: DifferentialMirrorOptions) {
    this.db = options.db;
    this.storageRoot = path.resolve(options.storageRoot);
    this.adaptiveController = options.adaptiveController;
  }

  private async yieldSlice(): Promise<void> {
    if (this.adaptiveController) {
      await this.adaptiveController.acquireYieldSlice();
    } else {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  /**
   * Generates a full or differential library snapshot to a destination directory
   */
  public async createSnapshot(params: CreateSnapshotParams): Promise<MirrorReport> {
    const startTime = Date.now();
    const requestedDestDir = path.resolve(params.destinationDir);
    await fs.mkdir(path.dirname(requestedDestDir), { recursive: true });
    const destParent = await fs.realpath(path.dirname(requestedDestDir));
    const destDir = path.join(destParent, path.basename(requestedDestDir));
    try {
      const destStat = await fs.lstat(destDir);
      if (destStat.isSymbolicLink() || !destStat.isDirectory()) throw new Error('Mirror destination must be a regular directory');
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
    await fs.mkdir(destDir, { recursive: true });
    const realDestDir = await fs.realpath(destDir);
    if (path.resolve(realDestDir).toLowerCase() !== path.resolve(destDir).toLowerCase()) {
      throw new Error('Mirror destination resolves through a symlink');
    }

    // Check last snapshot in database
    const lastSnapshotRow: any = this.db
      .prepare('SELECT * FROM library_snapshots ORDER BY created_at DESC LIMIT 1')
      .get();

    const isDifferential = params.differential !== false && !!lastSnapshotRow;
    const snapshotType: 'full' | 'differential' = isDifferential ? 'differential' : 'full';
    const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Hot SQLite Database Snapshot using VACUUM INTO via atomic temporary file
    const targetDbPath = path.join(destDir, 'kura-scroll.db');
    const tempDbPath = path.join(destDir, `kura-scroll.db.tmp.${Date.now()}`);
    try {
      await fs.unlink(tempDbPath);
    } catch {}

    const sanitizedTempDbPath = tempDbPath.replace(/'/g, "''");
    this.db.exec(`VACUUM INTO '${sanitizedTempDbPath}';`);

    const dbStats = await fs.stat(tempDbPath);
    const dbSizeBytes = dbStats.size;

    // Calculate database SHA256 checksum using 64KB chunked stream (SATA II & low RAM optimization)
    const checksum = await calculateFileHashStream(tempDbPath);

    // Atomic move to target destination
    try {
      await fs.unlink(targetDbPath);
    } catch {}
    await fs.rename(tempDbPath, targetDbPath);

    let filesCopied = 1; // SQLite db counts as file 1
    let bytesCopied = dbSizeBytes;
    let chaptersCopied = 0;
    let chaptersSkipped = 0;

    // 2. Copy Series Covers
    const seriesList: any[] = this.db.prepare('SELECT id, slug, cover_image FROM series').all();
    for (const s of seriesList) {
      if (s.cover_image) {
        const srcCover = resolveRelativePath(this.storageRoot, s.cover_image);
        const destCover = resolveRelativePath(destDir, s.cover_image);
        if (!srcCover || !destCover) continue;

        try {
          const coverLstat = await fs.lstat(srcCover);
          if (!coverLstat.isFile() || coverLstat.isSymbolicLink()) continue;
          const realCover = await fs.realpath(srcCover);
          if (!resolveRelativePath(this.storageRoot, path.relative(this.storageRoot, realCover))) continue;
          const coverStat = await fs.stat(srcCover);
          const needsCopy = !(await filesMatch(srcCover, destCover, coverStat.size));

          if (needsCopy) {
            await ensureSafeFileDestination(destDir, destCover);
            await copyFileWithBackpressure(srcCover, destCover);
            filesCopied++;
            bytesCopied += coverStat.size;
          }
        } catch {
          // Cover file may not exist on disk, skip safely
        }
      }
    }

    // 3. Process Chapters
    const chapters: any[] = this.db.prepare('SELECT id, series_id, storage_path, created_at FROM chapters').all();

    for (const chap of chapters) {
      await this.yieldSlice();

      let shouldCopy = true;
      if (isDifferential && lastSnapshotRow) {
        // If chapter was created before last snapshot, check if target directory already has files
        if (chap.created_at && chap.created_at <= lastSnapshotRow.created_at) {
          const destChapDir = resolveRelativePath(destDir, chap.storage_path);
          if (!destChapDir) continue;
          try {
            await ensureSafeDirectory(destDir, destChapDir);
            const destEntries = await fs.readdir(destChapDir);
            if (destEntries.length > 0) {
              shouldCopy = false;
            }
          } catch {
            shouldCopy = true;
          }
        }
      }

      if (!shouldCopy) {
        chaptersSkipped++;
        continue;
      }

      // Copy chapter directory contents
      const srcChapDir = resolveRelativePath(this.storageRoot, chap.storage_path);
      const destChapDir = resolveRelativePath(destDir, chap.storage_path);
      if (!srcChapDir || !destChapDir) {
        chaptersSkipped++;
        continue;
      }

      try {
        const chapterLstat = await fs.lstat(srcChapDir);
        if (!chapterLstat.isDirectory() || chapterLstat.isSymbolicLink()) {
          chaptersSkipped++;
          continue;
        }
        const realChapterDir = await fs.realpath(srcChapDir);
        if (!resolveRelativePath(this.storageRoot, path.relative(this.storageRoot, realChapterDir))) {
          chaptersSkipped++;
          continue;
        }
        const entries = await fs.readdir(srcChapDir);
        await ensureSafeDirectory(destDir, destChapDir);

        for (const entry of entries) {
          const srcFile = path.join(srcChapDir, entry);
          const destFile = path.join(destChapDir, entry);

          const entryLstat = await fs.lstat(srcFile);
          if (!entryLstat.isFile() || entryLstat.isSymbolicLink()) continue;
          const stat = await fs.stat(srcFile);
          if (stat.isFile()) {
            const fileNeedsCopy = !isDifferential || !(await filesMatch(srcFile, destFile, stat.size));

            if (fileNeedsCopy) {
              await ensureSafeFileDestination(destDir, destFile);
              await copyFileWithBackpressure(srcFile, destFile);
              filesCopied++;
              bytesCopied += stat.size;
            }
          }
        }
        chaptersCopied++;
      } catch {
        // Missing chapter directory on disk, skip safely
      }
    }

    const durationMs = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    // 4. Write snapshot-manifest.json
    const manifest = {
      snapshotId,
      snapshotType,
      createdAt: timestamp,
      databaseChecksumSha256: checksum,
      dbSizeBytes,
      totalSeries: seriesList.length,
      totalChapters: chapters.length,
      chaptersCopied,
      chaptersSkipped,
      filesCopied,
      totalBytesCopied: bytesCopied,
      durationMs,
      parentSnapshotId: lastSnapshotRow?.id || null,
    };

    const manifestPath = path.join(destDir, 'snapshot-manifest.json');
    await ensureSafeFileDestination(destDir, manifestPath);
    await fs.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // 5. Register in library_snapshots SQLite table
    this.db.prepare(`
      INSERT INTO library_snapshots (id, snapshot_type, created_at, total_series, total_chapters, file_count, total_bytes, destination_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshotId,
      snapshotType,
      timestamp,
      seriesList.length,
      chapters.length,
      filesCopied,
      bytesCopied,
      destDir
    );

    return {
      snapshotId,
      type: snapshotType,
      databaseCopied: true,
      dbSizeBytes,
      seriesProcessed: seriesList.length,
      chaptersCopied,
      chaptersSkipped,
      filesCopied,
      bytesCopied,
      durationMs,
      destination: destDir,
      checksum,
      timestamp,
    };
  }

  /**
   * Retrieves snapshot history from database
   */
  public getSnapshotHistory(): any[] {
    return this.db.prepare('SELECT * FROM library_snapshots ORDER BY created_at DESC').all();
  }
}
