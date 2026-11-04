import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import sharp from 'sharp';
import { ChapterIngestionService } from '../services/chapter-ingestion-service.js';
import { DatabaseInstance, createDatabase, runMigrations } from '../db/database.js';
import { SeriesRepository } from '../repositories/series-repository.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { getStorageConfig } from '../config/storage-config.js';

// Disable Sharp internal caching on Windows to prevent file locking issues
sharp.cache(false);

export interface ParsedArchiveInfo {
  chapterNumber: number;
  volumeNumber: number;
  title: string;
}

/**
 * Parses chapter and volume information from an archive filename.
 * Supports patterns like:
 * - c01.cbz -> Ch. 1, Vol. 1
 * - c105.zip -> Ch. 105, Vol. 1
 * - chapter-12.5.cbz -> Ch. 12.5, Vol. 1
 * - v2_c15.cbz -> Ch. 15, Vol. 2
 * - Vol. 3 Ch. 4.cbz -> Ch. 4, Vol. 3
 * - solo-leveling-15.cbz -> Ch. 15, Vol. 1
 */
export function parseArchiveFilename(filename: string): ParsedArchiveInfo | null {
  const baseName = path.parse(filename).name;

  // 1. Look for volume number: vol 2, volume 2, v2, etc.
  let volumeNumber = 1;
  const volMatch = baseName.match(/(?:^|[_\s.-])(?:vol|volume|v)[.\s_-]*([0-9]+(?:\.[0-9]+)?)/i);
  if (volMatch) {
    const parsedVol = Number.parseFloat(volMatch[1]);
    if (!Number.isNaN(parsedVol)) {
      volumeNumber = parsedVol;
    }
  }

  // 2. Look for explicit chapter number: ch 12, c12, chap 12, chapter 12, c12.5
  let chapterNumber: number | null = null;
  const chapMatch = baseName.match(/(?:^|[_\s.-])(?:chapter|chap|ch|c)[.\s_-]*([0-9]+(?:\.[0-9]+)?)/i);
  if (chapMatch) {
    const parsedChap = Number.parseFloat(chapMatch[1]);
    if (!Number.isNaN(parsedChap)) {
      chapterNumber = parsedChap;
    }
  }

  // 3. Fallback: look for standalone numbers in the name (ignoring volume match if found)
  if (chapterNumber === null) {
    let sanitized = baseName;
    if (volMatch) {
      sanitized = sanitized.replace(volMatch[0], ' ');
    }
    const matches = Array.from(sanitized.matchAll(/(?:^|[_\s.-])([0-9]+(?:\.[0-9]+)?)(?:[_\s.-]|$)/g));
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const parsedNum = Number.parseFloat(lastMatch[1]);
      if (!Number.isNaN(parsedNum)) {
        chapterNumber = parsedNum;
      }
    }
  }

  if (chapterNumber === null) {
    return null;
  }

  return {
    chapterNumber,
    volumeNumber,
    title: `Chapter ${chapterNumber}`,
  };
}

export async function moveFileSafe(src: string, dest: string): Promise<void> {
  const destDir = path.dirname(dest);
  await fs.mkdir(destDir, { recursive: true });
  try {
    await fs.rm(dest, { force: true });
    await fs.rename(src, dest);
  } catch (err: any) {
    if (err.code === 'EXDEV' || err.code === 'EPERM' || err.code === 'EBUSY') {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    } else {
      throw err;
    }
  }
}

export async function waitForFileReady(filePath: string, maxWaitMs = 2000, intervalMs = 100): Promise<boolean> {
  let prevSize = -1;
  const start = Date.now();

  while (Date.now() - start <= maxWaitMs) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 0 && stat.size === prevSize) {
        return true;
      }
      prevSize = stat.size;
    } catch {
      // file may still be transferring or locked
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  try {
    const stat = await fs.stat(filePath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

export interface IngestionSummary {
  seriesSlug: string;
  chapterNumber: number;
  volumeNumber: number;
  chapterId: string;
  pageCount: number;
  totalBytes: number;
  sourceFile: string;
  destinationFile: string | null;
  deleted: boolean;
}

export interface FolderWatcherOptions {
  incomingDir?: string;
  storageRoot?: string;
  db?: DatabaseInstance;
  dbPath?: string;
  pollIntervalMs?: number;
  deleteAfterIngest?: boolean;
  processedDir?: string;
  debounceMs?: number;
  logger?: {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
  } | boolean;
}

export class FolderWatcher extends EventEmitter {
  public readonly incomingDir: string;
  public readonly storageRoot: string;
  public readonly processedDir: string;
  public readonly deleteAfterIngest: boolean;
  public readonly debounceMs: number;
  public readonly pollIntervalMs: number;

  private db: DatabaseInstance;
  private seriesRepo: SeriesRepository;
  private chapterRepo: ChapterRepository;
  private fsWatcher: fsSync.FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private processingFiles: Set<string> = new Set();
  private loggerOption: FolderWatcherOptions['logger'];
  private isRunning = false;

  constructor(options: FolderWatcherOptions = {}) {
    super();

    const env = process.env;
    this.storageRoot = options.storageRoot ?? (env.STORAGE_ROOT ? path.resolve(env.STORAGE_ROOT) : path.resolve('./data/storage'));
    this.incomingDir = options.incomingDir ?? (env.INCOMING_DIR || env.INCOMING_ROOT
      ? path.resolve(env.INCOMING_DIR || env.INCOMING_ROOT!)
      : path.resolve(this.storageRoot, 'incoming'));

    this.processedDir = options.processedDir ?? path.join(this.incomingDir, '.processed');
    this.deleteAfterIngest = options.deleteAfterIngest ?? false;
    this.debounceMs = options.debounceMs ?? 300;
    this.pollIntervalMs = options.pollIntervalMs ?? 0;
    this.loggerOption = options.logger ?? false;

    if (options.db) {
      this.db = options.db;
    } else {
      const dbPath = options.dbPath ?? (env.DB_PATH ? path.resolve(env.DB_PATH) : path.resolve('./data/kura-scroll.db'));
      this.db = createDatabase(dbPath);
      runMigrations(this.db);
    }

    this.seriesRepo = new SeriesRepository(this.db);
    this.chapterRepo = new ChapterRepository(this.db);
  }

  public get active(): boolean {
    return this.isRunning;
  }

  private logInfo(...args: any[]) {
    if (this.loggerOption === true) {
      console.log('\x1b[36m[FolderWatcher]\x1b[0m', ...args);
    } else if (typeof this.loggerOption === 'object' && this.loggerOption.info) {
      this.loggerOption.info(...args);
    }
  }

  private logWarn(...args: any[]) {
    if (this.loggerOption === true) {
      console.warn('\x1b[33m[FolderWatcher WARN]\x1b[0m', ...args);
    } else if (typeof this.loggerOption === 'object' && this.loggerOption.warn) {
      this.loggerOption.warn(...args);
    }
  }

  private logError(...args: any[]) {
    if (this.loggerOption === true) {
      console.error('\x1b[31m[FolderWatcher ERROR]\x1b[0m', ...args);
    } else if (typeof this.loggerOption === 'object' && this.loggerOption.error) {
      this.loggerOption.error(...args);
    }
  }

  public async processFile(filePath: string): Promise<IngestionSummary | null> {
    const resolvedPath = path.resolve(filePath);
    if (!fsSync.existsSync(resolvedPath)) {
      return null;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext !== '.cbz' && ext !== '.zip') {
      return null;
    }

    const rel = path.relative(this.incomingDir, resolvedPath);
    const parts = rel.split(/[\\/]/).filter(Boolean);

    // Require incoming/<series-slug>/<filename>
    if (parts.length < 2) {
      this.logWarn(`Skipping archive placed in root of incoming (expected incoming/<series-slug>/<filename>): ${resolvedPath}`);
      return null;
    }

    // Ignore any path containing hidden parts (e.g. .processed, .tmp)
    if (parts.some((p) => p.startsWith('.'))) {
      return null;
    }

    const seriesSlug = parts[0];
    const fileName = path.basename(resolvedPath);
    const parsed = parseArchiveFilename(fileName);

    if (!parsed) {
      this.logWarn(`Could not parse chapter number from archive name '${fileName}'. Skipping.`);
      this.emit('skipped', { filePath: resolvedPath, reason: 'unparseable_filename' });
      return null;
    }

    if (this.processingFiles.has(resolvedPath)) {
      return null;
    }

    this.processingFiles.add(resolvedPath);

    try {
      this.logInfo(`Detected archive for '${seriesSlug}': ${fileName}. Verifying write stability...`);
      await waitForFileReady(resolvedPath);

      // 1. Ensure series entry exists in database
      let series = this.seriesRepo.getSeriesBySlug(seriesSlug);
      if (!series) {
        const titlePrimary = seriesSlug
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        this.seriesRepo.createSeries({
          id: seriesSlug,
          slug: seriesSlug,
          titlePrimary,
          type: 'manhwa',
          status: 'ongoing',
        });
        this.seriesRepo.addSeriesTitles(seriesSlug, [
          { languageCode: 'en', title: titlePrimary, isPrimary: true },
        ]);
        series = this.seriesRepo.getSeriesBySlug(seriesSlug);
      }

      const storageConfig = getStorageConfig();

      // 2. Trigger Sharp WebP Chapter Ingestion
      this.logInfo(`Ingesting chapter ${parsed.chapterNumber} for '${seriesSlug}'...`);
      const ingestResult = await ChapterIngestionService.ingestChapter({
        storageRoot: this.storageRoot,
        seriesSlug,
        volumeNumber: parsed.volumeNumber,
        chapterNumber: parsed.chapterNumber,
        sourcePath: resolvedPath,
        maxImageWidth: storageConfig.maxImageWidth,
        webpQuality: storageConfig.webpQuality,
      });

      // 3. Register Chapter and Pages in Database
      const chapterId = `${seriesSlug}-c${parsed.chapterNumber}`;
      const existing = this.chapterRepo.getChapterWithPages(chapterId);
      if (existing) {
        this.db.prepare('DELETE FROM chapters WHERE id = ?').run(chapterId);
      }

      this.chapterRepo.createChapter({
        id: chapterId,
        seriesId: series!.id,
        volumeId: null,
        chapterNumber: parsed.chapterNumber,
        title: parsed.title,
        pageCount: ingestResult.pageCount,
        storagePath: ingestResult.relativeStorageDir,
      });

      this.chapterRepo.addPages(chapterId, ingestResult.pages);

      // 4. Archive Post-Processing: Move to .processed/ or Delete
      let destinationFile: string | null = null;
      if (this.deleteAfterIngest) {
        await fs.unlink(resolvedPath);
        this.logInfo(`Cleaned up source archive: ${resolvedPath}`);
      } else {
        destinationFile = path.join(this.processedDir, seriesSlug, fileName);
        await moveFileSafe(resolvedPath, destinationFile);
        this.logInfo(`Moved archive to: ${destinationFile}`);
      }

      const summary: IngestionSummary = {
        seriesSlug,
        chapterNumber: parsed.chapterNumber,
        volumeNumber: parsed.volumeNumber,
        chapterId,
        pageCount: ingestResult.pageCount,
        totalBytes: ingestResult.totalBytes,
        sourceFile: resolvedPath,
        destinationFile,
        deleted: this.deleteAfterIngest,
      };

      this.emit('ingested', summary);
      return summary;
    } finally {
      this.processingFiles.delete(resolvedPath);
    }
  }

  public async scanIncoming(): Promise<IngestionSummary[]> {
    const results: IngestionSummary[] = [];
    if (!fsSync.existsSync(this.incomingDir)) {
      return results;
    }

    const findArchives = async (dir: string, depth = 0): Promise<string[]> => {
      if (depth > 4) return [];
      let entries: fsSync.Dirent[] = [];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return [];
      }

      let files: string[] = [];
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(await findArchives(full, depth + 1));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.cbz' || ext === '.zip') {
            files.push(full);
          }
        }
      }
      return files;
    };

    const archives = await findArchives(this.incomingDir);
    for (const archivePath of archives) {
      try {
        const summary = await this.processFile(archivePath);
        if (summary) {
          results.push(summary);
        }
      } catch (err: any) {
        this.logError(`Error processing archive '${archivePath}': ${err.message}`);
        this.emit('error', err);
      }
    }

    return results;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    await fs.mkdir(this.incomingDir, { recursive: true });
    await fs.mkdir(this.storageRoot, { recursive: true });
    if (!this.deleteAfterIngest) {
      await fs.mkdir(this.processedDir, { recursive: true });
    }

    // Process any files already pending in incoming
    await this.scanIncoming();

    try {
      this.fsWatcher = fsSync.watch(this.incomingDir, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        this.handleFileChangeEvent(filename);
      });
    } catch (err: any) {
      this.logError(`Recursive fs.watch unavailable on this platform: ${err.message}. Relying on polling.`);
    }

    if (this.pollIntervalMs > 0) {
      this.pollTimer = setInterval(() => {
        this.scanIncoming().catch((err) => {
          this.logError(`Polling scan error: ${err.message}`);
        });
      }, this.pollIntervalMs);
    }

    this.isRunning = true;
    this.emit('start');
  }

  public async stop(): Promise<void> {
    if (this.fsWatcher) {
      this.fsWatcher.close();
      this.fsWatcher = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.isRunning = false;
    this.emit('stop');
  }

  private handleFileChangeEvent(filename: string): void {
    const fullPath = path.resolve(this.incomingDir, filename);
    const ext = path.extname(filename).toLowerCase();
    if (ext !== '.cbz' && ext !== '.zip') return;

    const parts = filename.split(/[\\/]/).filter(Boolean);
    if (parts.some((p) => p.startsWith('.'))) return;

    if (this.debounceTimers.has(fullPath)) {
      clearTimeout(this.debounceTimers.get(fullPath)!);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(fullPath);
      try {
        if (fsSync.existsSync(fullPath)) {
          await this.processFile(fullPath);
        }
      } catch (err: any) {
        this.logError(`Error processing event for '${fullPath}': ${err.message}`);
        this.emit('error', err);
      }
    }, this.debounceMs);

    this.debounceTimers.set(fullPath, timer);
  }
}

export async function runDaemon(): Promise<void> {
  console.log('\x1b[36m[KuraScroll Ingestion Daemon]\x1b[0m Starting background folder watcher...');
  const env = process.env;
  const storageRoot = env.STORAGE_ROOT ? path.resolve(env.STORAGE_ROOT) : path.resolve('./data/storage');
  const incomingDir = env.INCOMING_DIR || env.INCOMING_ROOT
    ? path.resolve(env.INCOMING_DIR || env.INCOMING_ROOT!)
    : path.resolve(storageRoot, 'incoming');
  const dbPath = env.DB_PATH ? path.resolve(env.DB_PATH) : path.resolve('./data/kura-scroll.db');

  console.log(`[Incoming] Directory:    ${incomingDir}`);
  console.log(`[Storage]  Root:         ${storageRoot}`);
  console.log(`[Database] File:         ${dbPath}`);

  const db = createDatabase(dbPath);
  runMigrations(db);

  const watcher = new FolderWatcher({
    incomingDir,
    storageRoot,
    db,
    pollIntervalMs: 5000,
    logger: true,
  });

  watcher.on('ingested', (summary: IngestionSummary) => {
    console.log(`\x1b[32m[OK] [Ingested]\x1b[0m ${summary.seriesSlug} - Chapter ${summary.chapterNumber} (${summary.pageCount} pages, ${(summary.totalBytes / (1024 * 1024)).toFixed(2)} MB)`);
    if (summary.destinationFile) {
      console.log(`   ↳ Moved to: ${summary.destinationFile}`);
    } else if (summary.deleted) {
      console.log(`   ↳ Source archive cleaned up`);
    }
  });

  watcher.on('error', (err) => {
    console.error(`\x1b[31m[ERROR] [Daemon Error]\x1b[0m ${err.message}`);
  });

  await watcher.start();
  console.log('\x1b[32m[OK] Watching for incoming chapters (.cbz, .zip). Press Ctrl+C to stop.\x1b[0m');

  const shutdown = async () => {
    console.log('\nShutting down folder watcher daemon...');
    await watcher.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1]?.endsWith('folder-watcher.ts') || process.argv[1]?.endsWith('folder-watcher.js')) {
  runDaemon().catch((err) => {
    console.error('Fatal Daemon Error:', err);
    process.exit(1);
  });
}
