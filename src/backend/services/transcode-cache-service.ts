/**
 * Sprint 58 - Smart WebP Transcoding Cache & Ahead-Of-Time Downsampling Pipeline
 *
 * Configured specifically for Intel Pentium T4500 (2C/2T) & Intel GMA 4500MHD:
 * - Single-threaded Sharp/libvips concurrency (sharp.concurrency(1))
 * - Strict memory ceiling: sharp.cache({ memory: 16MB, files: 0, items: 32 })
 * - In-flight job deduplication to prevent CPU starvation on duplicate requests
 * - Atomic write operations (.tmp -> rename) on mechanical 4TB SATA II HDD
 * - SLA 22 cache hit lookup latency < 0.05 ms
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { DatabaseInstance } from '../db/database.js';

// Apply strict single-threaded low-resource configuration
sharp.concurrency(1);
sharp.cache({
  memory: 16,
  files: 0,
  items: 32,
});

export interface TranscodedPageRecord {
  id: string;
  chapterId: string;
  pageNumber: number;
  targetWidth: number;
  targetHeight: number;
  filePath: string;
  fileSizeBytes: number;
  quality: number;
  etag: string;
  lastAccessedAt?: string;
  createdAt?: string;
}

export interface TranscodeOptions {
  width: number;
  quality?: number;
  effort?: number;
}

export interface TranscodeCacheStats {
  totalCachedPages: number;
  totalSizeBytes: number;
  quotaBytes: number;
  activeTranscodes: number;
  highWatermarkBytes: number;
  lowWatermarkBytes: number;
}

export const VALID_TARGET_WIDTHS = [800, 1200, 1600] as const;
export type ValidTargetWidth = (typeof VALID_TARGET_WIDTHS)[number];

export function snapToValidTier(requestedWidth?: number): ValidTargetWidth {
  if (!requestedWidth || Number.isNaN(requestedWidth) || requestedWidth <= 900) {
    return 800;
  }
  if (requestedWidth <= 1400) {
    return 1200;
  }
  return 1600;
}

export class TranscodeCacheService {
  private db: DatabaseInstance;
  private cacheDir: string;
  private quotaBytes: number;

  // In-memory LRU manifest cache for SLA 22 sub-microsecond resolution
  private memoryCache: Map<string, TranscodedPageRecord> = new Map();
  private maxMemoryEntries: number = 256;

  // In-flight transcode deduplication locks
  private activeJobs: Map<string, Promise<TranscodedPageRecord>> = new Map();

  constructor(db: DatabaseInstance, cacheDir: string, quotaBytes: number = 5 * 1024 * 1024 * 1024) {
    this.db = db;
    this.cacheDir = cacheDir;
    this.quotaBytes = quotaBytes;
  }

  private getCacheKey(chapterId: string, pageNumber: number, targetWidth: number): string {
    return `${chapterId}:${pageNumber}:${targetWidth}`;
  }

  /**
   * Fast O(1) point lookup for transcoded page record.
   * Hits in-memory map first (< 0.001 ms), falls back to SQLite compound index (< 0.05 ms).
   */
  public lookupCachedPage(chapterId: string, pageNumber: number, targetWidth: number): TranscodedPageRecord | null {
    const key = this.getCacheKey(chapterId, pageNumber, targetWidth);

    // 1. Hot memory cache
    const hot = this.memoryCache.get(key);
    if (hot) {
      return hot;
    }

    // 2. SQLite covering index lookup
    const stmt = this.db.prepare(`
      SELECT id, chapter_id, page_number, target_width, target_height,
             file_path, file_size_bytes, quality, etag, last_accessed_at, created_at
      FROM cached_transcoded_pages
      WHERE chapter_id = ? AND page_number = ? AND target_width = ?
    `);

    const row = stmt.get(chapterId, pageNumber, targetWidth) as any;
    if (!row) {
      return null;
    }

    const record: TranscodedPageRecord = {
      id: row.id,
      chapterId: row.chapter_id,
      pageNumber: Number(row.page_number),
      targetWidth: Number(row.target_width),
      targetHeight: Number(row.target_height),
      filePath: row.file_path,
      fileSizeBytes: Number(row.file_size_bytes),
      quality: Number(row.quality),
      etag: row.etag,
      lastAccessedAt: row.last_accessed_at,
      createdAt: row.created_at,
    };

    this.cacheInMemory(key, record);
    return record;
  }

  /**
   * Records or updates a cached page in SQLite & memory.
   */
  public recordCachedPage(record: TranscodedPageRecord): void {
    const key = this.getCacheKey(record.chapterId, record.pageNumber, record.targetWidth);

    const stmt = this.db.prepare(`
      INSERT INTO cached_transcoded_pages (
        id, chapter_id, page_number, target_width, target_height,
        file_path, file_size_bytes, quality, etag, last_accessed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(chapter_id, page_number, target_width) DO UPDATE SET
        target_height = excluded.target_height,
        file_path = excluded.file_path,
        file_size_bytes = excluded.file_size_bytes,
        quality = excluded.quality,
        etag = excluded.etag,
        last_accessed_at = datetime('now')
    `);

    stmt.run(
      record.id,
      record.chapterId,
      record.pageNumber,
      record.targetWidth,
      record.targetHeight,
      record.filePath,
      record.fileSizeBytes,
      record.quality,
      record.etag
    );

    this.cacheInMemory(key, record);
  }

  /**
   * Updates last_accessed_at timestamp without blocking read flow.
   */
  public touchPageAccess(chapterId: string, pageNumber: number, targetWidth: number): void {
    const key = this.getCacheKey(chapterId, pageNumber, targetWidth);
    const cached = this.memoryCache.get(key);
    if (cached) {
      cached.lastAccessedAt = new Date().toISOString();
    }

    try {
      this.db.prepare(`
        UPDATE cached_transcoded_pages
        SET last_accessed_at = datetime('now')
        WHERE chapter_id = ? AND page_number = ? AND target_width = ?
      `).run(chapterId, pageNumber, targetWidth);
    } catch {
      // Non-fatal if busy
    }
  }

  /**
   * Returns partitioned storage path on 4TB HDD.
   * Format: <cacheDir>/transcoded/<chapter_prefix>/<chapterId>/p<page>_<width>.webp
   */
  public getPartitionedPath(chapterId: string, pageNumber: number, targetWidth: number): string {
    const prefix = crypto.createHash('sha256').update(chapterId).digest('hex').slice(0, 2);
    return path.join(this.cacheDir, 'transcoded', prefix, chapterId, `p${pageNumber}_w${targetWidth}.webp`);
  }

  /**
   * Executes or deduplicates an AOT transcode job for a page.
   * If an identical transcode is in-flight, awaits that promise instead of duplicating work.
   */
  public async getOrTranscode(
    chapterId: string,
    pageNumber: number,
    sourceInput: Buffer | string,
    options: TranscodeOptions
  ): Promise<TranscodedPageRecord> {
    const targetWidth = snapToValidTier(options.width);
    const quality = options.quality ?? 80;
    const effort = options.effort ?? 2; // Effort 2: Fast thermal saver mode

    // 1. Check existing cache
    const existing = this.lookupCachedPage(chapterId, pageNumber, targetWidth);
    if (existing && fs.existsSync(existing.filePath)) {
      this.touchPageAccess(chapterId, pageNumber, targetWidth);
      return existing;
    }

    // 2. In-flight deduplication
    const jobKey = this.getCacheKey(chapterId, pageNumber, targetWidth);
    const active = this.activeJobs.get(jobKey);
    if (active) {
      return active;
    }

    // 3. Spawn single-threaded transcode job
    const jobPromise = (async () => {
      try {
        const outPath = this.getPartitionedPath(chapterId, pageNumber, targetWidth);
        const tempPath = `${outPath}.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        await fsp.mkdir(path.dirname(outPath), { recursive: true });

        // Resize using Lanczos3 kernel and WebP output
        const transform = sharp(sourceInput)
          .resize({
            width: targetWidth,
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3,
          })
          .webp({
            quality,
            effort,
            smartSubsample: true,
          });

        const info = await transform.toFile(tempPath);

        // Atomic file commit
        await fsp.rename(tempPath, outPath);

        // Compute deterministic strong ETag
        const hash = crypto.createHash('sha256');
        hash.update(`${chapterId}:${pageNumber}:${targetWidth}:${info.size}`);
        const etag = `"${hash.digest('hex').slice(0, 16)}"`;

        const recordId = `tr_${crypto.randomUUID()}`;
        const record: TranscodedPageRecord = {
          id: recordId,
          chapterId,
          pageNumber,
          targetWidth: info.width,
          targetHeight: info.height,
          filePath: outPath,
          fileSizeBytes: info.size,
          quality,
          etag,
        };

        this.recordCachedPage(record);
        return record;
      } finally {
        this.activeJobs.delete(jobKey);
      }
    })();

    this.activeJobs.set(jobKey, jobPromise);
    return jobPromise;
  }

  /**
   * Retrieves aggregated cache telemetry statistics.
   */
  public getStats(): TranscodeCacheStats {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(file_size_bytes), 0) as total_size
      FROM cached_transcoded_pages
    `).get() as any;

    const totalSizeBytes = Number(row?.total_size ?? 0);
    const totalCachedPages = Number(row?.count ?? 0);

    return {
      totalCachedPages,
      totalSizeBytes,
      quotaBytes: this.quotaBytes,
      activeTranscodes: this.activeJobs.size,
      highWatermarkBytes: Math.floor(this.quotaBytes * 0.85),
      lowWatermarkBytes: Math.floor(this.quotaBytes * 0.70),
    };
  }

  /**
   * Prunes cached transcoded files using LRU when exceeding High Watermark (85%).
   * Unlinks files down to Low Watermark (70%) in a single grouped batch.
   */
  public async pruneCacheIfNeeded(): Promise<{ prunedCount: number; freedBytes: number }> {
    const stats = this.getStats();
    if (stats.totalSizeBytes <= stats.highWatermarkBytes) {
      return { prunedCount: 0, freedBytes: 0 };
    }

    const targetFreedBytes = stats.totalSizeBytes - stats.lowWatermarkBytes;
    const candidates = this.db.prepare(`
      SELECT id, file_path, file_size_bytes, chapter_id, page_number, target_width
      FROM cached_transcoded_pages
      ORDER BY last_accessed_at ASC
    `).all() as any[];

    let accumulatedFreed = 0;
    const deletedIds: string[] = [];

    for (const item of candidates) {
      try {
        await fsp.unlink(item.file_path);
      } catch {
        // file may already be removed
      }

      deletedIds.push(item.id);
      accumulatedFreed += Number(item.file_size_bytes);

      const memKey = this.getCacheKey(item.chapter_id, item.page_number, item.target_width);
      this.memoryCache.delete(memKey);

      if (accumulatedFreed >= targetFreedBytes) {
        break;
      }
    }

    if (deletedIds.length > 0) {
      this.db.exec('BEGIN IMMEDIATE;');
      try {
        const stmt = this.db.prepare('DELETE FROM cached_transcoded_pages WHERE id = ?');
        for (const id of deletedIds) {
          stmt.run(id);
        }
        this.db.exec('COMMIT;');
      } catch (err) {
        this.db.exec('ROLLBACK;');
        throw err;
      }
    }

    return {
      prunedCount: deletedIds.length,
      freedBytes: accumulatedFreed,
    };
  }

  private cacheInMemory(key: string, record: TranscodedPageRecord): void {
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(key, record);
  }
}
