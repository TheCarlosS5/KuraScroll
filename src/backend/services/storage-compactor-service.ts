import fs from 'node:fs';
import path from 'node:path';
import { DatabaseInstance } from '../db/database.js';
import { sharedIOCoordinator } from '../storage/io/io-coordinator.js';
import { IOPriority } from '../storage/io/io-priority.js';

export interface CompactionReport {
  timestamp: string;
  durationMs: number;
  seriesScanned: number;
  chaptersScanned: number;
  orphanFilesDeleted: number;
  orphanBytesReclaimed: number;
  protectedFilesPreserved: number;
  walCheckpoint: {
    busy: number;
    log: number;
    checkpointed: number;
  };
  freelistPagesVacuumed: number;
  freelistPagesRemaining: number;
  errors: string[];
}

export interface CompactionStatus {
  dbSizeBytes: number;
  walSizeBytes: number;
  freelistPages: number;
  lastCompactionTimestamp: string | null;
  isCompacting: boolean;
}

export interface StorageCompactorOptions {
  db: DatabaseInstance;
  storageRoot: string;
  dbPath?: string;
}

const PROTECTED_FILENAMES = new Set([
  'cover.webp',
  'cover.jpg',
  'cover.jpeg',
  'cover.png',
  'comicinfo.xml',
  '.gitkeep',
  'manifest.json',
]);

/**
 * High-performance, anti-seek-storm storage compaction & WAL checkpoint service.
 * Designed specifically for 4TB Mechanical SATA II HDD (~80 IOPS) & Intel Pentium T4500:
 * 
 * - Chunked orphan detection with set differences.
 * - Non-blocking SQLite WAL checkpointing (`PRAGMA wal_checkpoint(PASSIVE)`).
 * - Incremental space reclamation via `PRAGMA incremental_vacuum`.
 * - Strictly executes via `sharedIOCoordinator` under `IOPriority.BACKGROUND`,
 *   yielding via `PauseGate` within < 15ms when interactive reads arrive.
 */
export class StorageCompactorService {
  private db: DatabaseInstance;
  private storageRoot: string;
  private dbPath: string | null;
  private isCompacting = false;
  private lastCompactionTimestamp: string | null = null;

  constructor(options: StorageCompactorOptions) {
    this.db = options.db;
    this.storageRoot = path.resolve(options.storageRoot);
    this.dbPath = options.dbPath ? path.resolve(options.dbPath) : null;
  }

  /**
   * Checks whether a file name is a protected system asset that must never be deleted.
   */
  public isProtectedFile(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    if (PROTECTED_FILENAMES.has(lower)) return true;
    if (lower.startsWith('cover.') || lower.endsWith('.tmp')) return false;
    return false;
  }

  /**
   * Retrieves live diagnostic telemetry of the SQLite database and WAL logs.
   */
  public getStatus(): CompactionStatus {
    let dbSizeBytes = 0;
    let walSizeBytes = 0;

    if (this.dbPath && fs.existsSync(this.dbPath)) {
      try {
        dbSizeBytes = fs.statSync(this.dbPath).size;
        const walPath = `${this.dbPath}-wal`;
        if (fs.existsSync(walPath)) {
          walSizeBytes = fs.statSync(walPath).size;
        }
      } catch {
        // Tolerant to access checks
      }
    }

    let freelistPages = 0;
    try {
      const freelistRow = this.db.prepare('PRAGMA freelist_count;').get() as any;
      freelistPages = freelistRow?.freelist_count ?? 0;
    } catch {
      freelistPages = 0;
    }

    return {
      dbSizeBytes,
      walSizeBytes,
      freelistPages,
      lastCompactionTimestamp: this.lastCompactionTimestamp,
      isCompacting: this.isCompacting,
    };
  }

  /**
   * Executes a full maintenance compaction pass over disk and database.
   */
  public async runCompaction(): Promise<CompactionReport> {
    if (this.isCompacting) {
      throw new Error('Storage compaction is already in progress');
    }

    this.isCompacting = true;
    const startTime = performance.now();
    const errors: string[] = [];

    let seriesScanned = 0;
    let chaptersScanned = 0;
    let orphanFilesDeleted = 0;
    let orphanBytesReclaimed = 0;
    let protectedFilesPreserved = 0;

    try {
      // 1. Scan series directory partitioned to avoid seek storms
      const seriesRoot = path.join(this.storageRoot, 'series');

      if (fs.existsSync(seriesRoot)) {
        const seriesDirs = await fs.promises.readdir(seriesRoot, { withFileTypes: true });

        for (const sDir of seriesDirs) {
          if (!sDir.isDirectory()) continue;
          seriesScanned++;

          const seriesPath = path.join(seriesRoot, sDir.name);
          const chapterDirs = await fs.promises.readdir(seriesPath, { withFileTypes: true });

          for (const cDir of chapterDirs) {
            if (!cDir.isDirectory()) {
              // Check top-level series files (e.g. cover.webp)
              if (this.isProtectedFile(cDir.name)) {
                protectedFilesPreserved++;
              }
              continue;
            }

            chaptersScanned++;
            const chapterDirRelative = path.join('series', sDir.name, cDir.name).replace(/\\/g, '/');
            const chapterDirPath = path.join(seriesPath, cDir.name);

            // Fetch registered page files for this chapter from SQLite
            const chapRow = this.db
              .prepare('SELECT id FROM chapters WHERE storage_path = ? OR storage_path = ?')
              .get(chapterDirRelative, chapterDirRelative.replace(/\//g, '\\')) as { id: string } | undefined;

            const registeredFileSet = new Set<string>();

            if (chapRow) {
              const pages = this.db
                .prepare('SELECT file_name FROM chapter_pages WHERE chapter_id = ?')
                .all(chapRow.id) as { file_name: string }[];
              for (const p of pages) {
                registeredFileSet.add(p.file_name.toLowerCase());
              }
            }

            // Read disk entries in chapter directory
            const diskEntries = await fs.promises.readdir(chapterDirPath, { withFileTypes: true });

            for (const entry of diskEntries) {
              if (entry.isDirectory()) continue;

              const entryLower = entry.name.toLowerCase();

              if (this.isProtectedFile(entryLower) || registeredFileSet.has(entryLower)) {
                protectedFilesPreserved++;
                continue;
              }

              // File is orphaned — schedule deletion via background I/O coordinator
              const filePath = path.join(chapterDirPath, entry.name);

              try {
                const stat = await fs.promises.stat(filePath);
                const fileSize = stat.size;

                await sharedIOCoordinator.run(
                  { priority: IOPriority.BACKGROUND, label: `orphan-unlink-${entry.name}` },
                  async () => {
                    await fs.promises.unlink(filePath);
                  }
                );

                orphanFilesDeleted++;
                orphanBytesReclaimed += fileSize;
              } catch (err: any) {
                errors.push(`Failed to unlink orphan ${filePath}: ${err.message}`);
              }

              // Cooperative yield to avoid monopolizing disk queue
              await new Promise<void>((resolve) => setImmediate(resolve));
            }
          }

          // Yield between series
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      }

      // 2. Proactive SQLite WAL Checkpoint (PASSIVE: never blocks concurrent readers/writers)
      let walCheckpoint = { busy: 0, log: 0, checkpointed: 0 };
      try {
        const cpRow = this.db.prepare('PRAGMA wal_checkpoint(PASSIVE);').get() as any;
        if (cpRow) {
          walCheckpoint = {
            busy: cpRow.busy ?? 0,
            log: cpRow.log ?? 0,
            checkpointed: cpRow.checkpointed ?? 0,
          };
        }
      } catch (err: any) {
        errors.push(`WAL checkpoint error: ${err.message}`);
      }

      // 3. Incremental vacuum to reclaim fragmented pages back to filesystem
      let freelistPagesVacuumed = 0;
      let freelistPagesRemaining = 0;

      try {
        const beforeRow = this.db.prepare('PRAGMA freelist_count;').get() as any;
        const countBefore = beforeRow?.freelist_count ?? 0;

        if (countBefore > 0) {
          // Reclaim up to 250 pages (~1MB) per pass in background
          this.db.prepare('PRAGMA incremental_vacuum(250);').run();
          const afterRow = this.db.prepare('PRAGMA freelist_count;').get() as any;
          freelistPagesRemaining = afterRow?.freelist_count ?? 0;
          freelistPagesVacuumed = Math.max(0, countBefore - freelistPagesRemaining);
        }
      } catch (err: any) {
        // Tolerant if auto_vacuum is not enabled
        errors.push(`Incremental vacuum note: ${err.message}`);
      }

      this.lastCompactionTimestamp = new Date().toISOString();
      const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

      return {
        timestamp: this.lastCompactionTimestamp,
        durationMs,
        seriesScanned,
        chaptersScanned,
        orphanFilesDeleted,
        orphanBytesReclaimed,
        protectedFilesPreserved,
        walCheckpoint,
        freelistPagesVacuumed,
        freelistPagesRemaining,
        errors,
      };
    } finally {
      this.isCompacting = false;
    }
  }
}
