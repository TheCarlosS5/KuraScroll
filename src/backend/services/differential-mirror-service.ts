import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseInstance } from '../db/database.js';
import { AdaptiveIngestionController } from './adaptive-ingestion-controller.js';

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
    const destDir = path.resolve(params.destinationDir);
    await fs.mkdir(destDir, { recursive: true });

    // Check last snapshot in database
    const lastSnapshotRow: any = this.db
      .prepare('SELECT * FROM library_snapshots ORDER BY created_at DESC LIMIT 1')
      .get();

    const isDifferential = params.differential !== false && !!lastSnapshotRow;
    const snapshotType: 'full' | 'differential' = isDifferential ? 'differential' : 'full';
    const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. Hot SQLite Database Snapshot using VACUUM INTO
    const targetDbPath = path.join(destDir, 'kura-scroll.db');
    try {
      await fs.unlink(targetDbPath);
    } catch {
      // File may not exist yet
    }

    const sanitizedTargetDbPath = targetDbPath.replace(/'/g, "''");
    this.db.exec(`VACUUM INTO '${sanitizedTargetDbPath}';`);

    const dbStats = await fs.stat(targetDbPath);
    const dbSizeBytes = dbStats.size;

    // Calculate database SHA256 checksum
    const dbBuffer = await fs.readFile(targetDbPath);
    const checksum = crypto.createHash('sha256').update(dbBuffer).digest('hex');

    let filesCopied = 1; // SQLite db counts as file 1
    let bytesCopied = dbSizeBytes;
    let chaptersCopied = 0;
    let chaptersSkipped = 0;

    // 2. Copy Series Covers
    const seriesList: any[] = this.db.prepare('SELECT id, slug, cover_image FROM series').all();
    for (const s of seriesList) {
      if (s.cover_image) {
        const srcCover = path.isAbsolute(s.cover_image)
          ? s.cover_image
          : path.join(this.storageRoot, s.cover_image);

        const destCover = path.join(destDir, s.cover_image);

        try {
          const coverStat = await fs.stat(srcCover);
          let needsCopy = true;
          try {
            const destStat = await fs.stat(destCover);
            if (destStat.size === coverStat.size) {
              needsCopy = false;
            }
          } catch {
            needsCopy = true;
          }

          if (needsCopy) {
            await fs.mkdir(path.dirname(destCover), { recursive: true });
            await fs.copyFile(srcCover, destCover);
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
          const destChapDir = path.join(destDir, chap.storage_path);
          try {
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
      const srcChapDir = path.join(this.storageRoot, chap.storage_path);
      const destChapDir = path.join(destDir, chap.storage_path);

      try {
        const entries = await fs.readdir(srcChapDir);
        await fs.mkdir(destChapDir, { recursive: true });

        for (const entry of entries) {
          const srcFile = path.join(srcChapDir, entry);
          const destFile = path.join(destChapDir, entry);

          const stat = await fs.stat(srcFile);
          if (stat.isFile()) {
            let fileNeedsCopy = true;
            try {
              const dStat = await fs.stat(destFile);
              if (dStat.size === stat.size) {
                fileNeedsCopy = false;
              }
            } catch {
              fileNeedsCopy = true;
            }

            if (fileNeedsCopy) {
              await fs.copyFile(srcFile, destFile);
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

    await fs.writeFile(
      path.join(destDir, 'snapshot-manifest.json'),
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
