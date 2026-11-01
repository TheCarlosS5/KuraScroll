import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseInstance } from '../db/database.js';
import { AdaptiveIngestionController } from './adaptive-ingestion-controller.js';

export interface SelfHealingOptions {
  db: DatabaseInstance;
  storageRoot: string;
  adaptiveController?: AdaptiveIngestionController;
}

export interface CleanupReport {
  cleanedCount: number;
  freedBytes: number;
}

export interface IntegrityReport {
  checkpointOk: boolean;
  quickCheckOk: boolean;
  message: string;
}

export interface CoverHealingReport {
  missingCoversFound: number;
  healedCovers: number;
}

export interface ChapterReconciliationReport {
  scannedFolders: number;
  chaptersRecovered: number;
  orphanedChaptersPruned: number;
}

export interface HealingReport {
  timestamp: string;
  durationMs: number;
  cleanup: CleanupReport;
  integrity: IntegrityReport;
  covers: CoverHealingReport;
  chapters: ChapterReconciliationReport;
}

export class SelfHealingIndexer {
  private readonly db: DatabaseInstance;
  private readonly storageRoot: string;
  private readonly adaptiveController?: AdaptiveIngestionController;

  constructor(options: SelfHealingOptions) {
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
   * Cleans orphaned .tmp and .part files older than maxAgeMs (default: 5 minutes)
   */
  public async cleanOrphanedFiles(maxAgeMs: number = 300000): Promise<CleanupReport> {
    let cleanedCount = 0;
    let freedBytes = 0;
    const now = Date.now();

    // 1. Inspect .tmp folder in storage root
    const tmpDir = path.join(this.storageRoot, '.tmp');
    try {
      const entries = await fs.readdir(tmpDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(tmpDir, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          if (now - stats.mtimeMs >= maxAgeMs) {
            freedBytes += stats.size;
            if (entry.isDirectory()) {
              await fs.rm(fullPath, { recursive: true, force: true });
            } else {
              await fs.unlink(fullPath);
            }
            cleanedCount++;
          }
        } catch {
          // Ignore transient locks during stat/unlink
        }
      }
    } catch {
      // .tmp dir may not exist yet
    }

    // 2. Scan series folder for orphaned .tmp or .part files
    const seriesDir = path.join(this.storageRoot, 'series');
    try {
      const seriesFolders = await fs.readdir(seriesDir);
      for (const seriesSlug of seriesFolders) {
        const targetSeriesPath = path.join(seriesDir, seriesSlug);
        try {
          const stats = await fs.stat(targetSeriesPath);
          if (!stats.isDirectory()) continue;

          const files = await fs.readdir(targetSeriesPath, { recursive: true });
          for (const subFile of files) {
            const fileName = String(subFile);
            if (fileName.endsWith('.part') || fileName.endsWith('.tmp')) {
              const fullFilePath = path.join(targetSeriesPath, fileName);
              try {
                const fStat = await fs.stat(fullFilePath);
                if (now - fStat.mtimeMs >= maxAgeMs) {
                  freedBytes += fStat.size;
                  await fs.unlink(fullFilePath);
                  cleanedCount++;
                }
              } catch {
                // Ignore transient unlink failure
              }
            }
          }
        } catch {
          // Ignore series folder read errors
        }
      }
    } catch {
      // series dir may not exist yet
    }

    return { cleanedCount, freedBytes };
  }

  /**
   * Executes SQLite WAL checkpoint and integrity check
   */
  public async verifySqliteIntegrity(): Promise<IntegrityReport> {
    let checkpointOk = false;
    let quickCheckOk = false;
    let message = 'Integrity check passed';

    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      checkpointOk = true;
    } catch (err: any) {
      checkpointOk = false;
      message = `Checkpoint failed: ${err.message}`;
    }

    try {
      const result: any = this.db.prepare('PRAGMA quick_check;').get();
      if (result && (result.quick_check === 'ok' || Object.values(result)[0] === 'ok')) {
        quickCheckOk = true;
      } else {
        quickCheckOk = false;
        message = `Quick check failed: ${JSON.stringify(result)}`;
      }
    } catch (err: any) {
      quickCheckOk = false;
      message = `Integrity check error: ${err.message}`;
    }

    return { checkpointOk, quickCheckOk, message };
  }

  /**
   * Reconciles missing series covers using chapter 1 page 1 or available art
   */
  public async reconcileSeriesCovers(): Promise<CoverHealingReport> {
    let missingCoversFound = 0;
    let healedCovers = 0;

    const seriesList: any[] = this.db
      .prepare('SELECT id, slug, cover_image FROM series')
      .all();

    for (const item of seriesList) {
      let isMissing = false;
      if (!item.cover_image || item.cover_image.trim() === '') {
        isMissing = true;
      } else {
        const coverPath = path.isAbsolute(item.cover_image)
          ? item.cover_image
          : path.join(this.storageRoot, item.cover_image);
        try {
          await fs.access(coverPath);
        } catch {
          isMissing = true;
        }
      }

      if (isMissing) {
        missingCoversFound++;
        await this.yieldSlice();

        // Attempt to find a suitable candidate from series directory
        const seriesPath = path.join(this.storageRoot, 'series', item.slug);
        let healed = false;

        try {
          // Look for chapter 1 page 1 (v1/c1/001.webp or c1/001.webp)
          const candidatePaths = [
            path.join(seriesPath, 'v1', 'c1', '001.webp'),
            path.join(seriesPath, 'c1', '001.webp'),
            path.join(seriesPath, 'v1', 'c01', '001.webp'),
          ];

          for (const cand of candidatePaths) {
            try {
              await fs.access(cand);
              const targetCoverPath = path.join(seriesPath, 'cover.webp');
              await fs.copyFile(cand, targetCoverPath);

              const relativeCoverPath = path.relative(this.storageRoot, targetCoverPath).replace(/\\/g, '/');
              this.db.prepare('UPDATE series SET cover_image = ? WHERE id = ?').run(relativeCoverPath, item.id);
              healed = true;
              healedCovers++;
              break;
            } catch {
              // Try next candidate
            }
          }
        } catch {
          // Ignore series directory traverse error
        }
      }
    }

    return { missingCoversFound, healedCovers };
  }

  /**
   * Incremental directory scan with folder_sync_state to reconcile missing or orphaned chapters
   */
  public async reconcileOrphanedChapters(): Promise<ChapterReconciliationReport> {
    let scannedFolders = 0;
    let chaptersRecovered = 0;
    let orphanedChaptersPruned = 0;

    const seriesList: any[] = this.db
      .prepare('SELECT id, slug FROM series')
      .all();

    for (const s of seriesList) {
      const seriesDir = path.join(this.storageRoot, 'series', s.slug);
      let seriesStat: any;
      try {
        seriesStat = await fs.stat(seriesDir);
        if (!seriesStat.isDirectory()) continue;
      } catch {
        continue;
      }

      // Check sync state
      const row: any = this.db
        .prepare('SELECT last_mtime FROM folder_sync_state WHERE folder_path = ?')
        .get(seriesDir);

      const lastMtime = row ? Number(row.last_mtime) : 0;
      const currentMtime = Math.round(seriesStat.mtimeMs);

      if (lastMtime && currentMtime <= lastMtime) {
        // Folder hasn't changed since last scan! Skip to save 4TB HDD head movement
        continue;
      }

      scannedFolders++;
      await this.yieldSlice();

      // Scan subfolders looking for manifest.json
      try {
        const subItems = await fs.readdir(seriesDir, { recursive: true });
        for (const item of subItems) {
          const itemPath = String(item);
          if (path.basename(itemPath) === 'manifest.json') {
            const manifestFullPath = path.join(seriesDir, itemPath);
            const chapterDir = path.dirname(manifestFullPath);

            try {
              const content = await fs.readFile(manifestFullPath, 'utf-8');
              const manifest = JSON.parse(content);
              const chapNum = Number(manifest.chapterNumber);

              if (!Number.isNaN(chapNum)) {
                // Check if already in chapters table
                const existing: any = this.db
                  .prepare('SELECT id FROM chapters WHERE series_id = ? AND chapter_number = ?')
                  .get(s.id, chapNum);

                if (!existing) {
                  // Recover chapter into database
                  const chapId = `chap_${s.slug}_${chapNum}_${Date.now()}`;
                  const relStoragePath = path.relative(this.storageRoot, chapterDir).replace(/\\/g, '/');
                  const pageCount = Array.isArray(manifest.pages) ? manifest.pages.length : (manifest.pageCount || 0);

                  this.db.prepare(`
                    INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
                    VALUES (?, ?, ?, ?, ?)
                  `).run(chapId, s.id, chapNum, pageCount, relStoragePath);

                  // Insert pages
                  if (Array.isArray(manifest.pages)) {
                    const insertPage = this.db.prepare(`
                      INSERT INTO chapter_pages (chapter_id, page_number, file_name, width, height, aspect_ratio, blurhash)
                      VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);
                    for (const page of manifest.pages) {
                      insertPage.run(
                        chapId,
                        page.pageNumber,
                        page.fileName,
                        page.width || 1000,
                        page.height || 1500,
                        page.aspectRatio || 0.667,
                        page.blurhash || null
                      );
                    }
                  }

                  chaptersRecovered++;
                }
              }
            } catch {
              // Corrupt or unreadable manifest, continue
            }
          }
        }
      } catch {
        // Ignore read directory error
      }

      // Update sync watermark
      this.db.prepare(`
        INSERT INTO folder_sync_state (folder_path, last_mtime, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(folder_path) DO UPDATE SET last_mtime = excluded.last_mtime, updated_at = datetime('now');
      `).run(seriesDir, currentMtime);
    }

    return { scannedFolders, chaptersRecovered, orphanedChaptersPruned };
  }

  /**
   * Executes a complete self-healing cycle
   */
  public async runFullHealing(): Promise<HealingReport> {
    const start = Date.now();

    const cleanup = await this.cleanOrphanedFiles();
    await this.yieldSlice();

    const integrity = await this.verifySqliteIntegrity();
    await this.yieldSlice();

    const covers = await this.reconcileSeriesCovers();
    await this.yieldSlice();

    const chapters = await this.reconcileOrphanedChapters();

    return {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      cleanup,
      integrity,
      covers,
      chapters,
    };
  }
}
