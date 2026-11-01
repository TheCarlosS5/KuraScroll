import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { DatabaseInstance } from '../db/database.js';
import { AdaptiveIngestionController } from './adaptive-ingestion-controller.js';

export interface ImageIntegrityOptions {
  db: DatabaseInstance;
  storageRoot: string;
  adaptiveController?: AdaptiveIngestionController;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  fileSizeBytes?: number;
}

export interface CorruptFileRecord {
  id: string;
  file_path: string;
  chapter_id: string | null;
  error_reason: string;
  detected_at: string;
  status: 'pending_repair' | 'repaired' | 'quarantined';
}

export interface IntegrityScanReport {
  totalScanned: number;
  validCount: number;
  corruptCount: number;
  corruptFiles: Array<{ filePath: string; reason: string }>;
  durationMs: number;
}

// Built-in static fallback 100x100 dark placeholder WebP (RIFF....WEBPVP8...)
// Generated with Sharp for zero-latency crash prevention
const STATIC_FALLBACK_WEBP = Buffer.from(
  'UklGRk4AAABXRUJQVlA4IEIAAACwBQCdASpkAGQAPm02mUmkIqKhIKgAgA2JaW7hc+AAY2upvcReWAa6m9xF5YBrqb3EXlgGngAA/v9T+z1HAAAAAAA=',
  'base64'
);

export class ImageIntegrityService {
  private readonly db: DatabaseInstance;
  private readonly storageRoot: string;
  private readonly adaptiveController?: AdaptiveIngestionController;

  constructor(options: ImageIntegrityOptions) {
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
   * Fast two-phase verification:
   * Phase 1: Microsecond 16-byte magic header test (Zero CPU/libvips cost)
   * Phase 2: Deep Sharp metadata decode (only if requested)
   */
  public async verifyWebPFile(filePath: string, deep: boolean = false): Promise<VerificationResult> {
    let fileHandle: any = null;
    try {
      const stats = await fs.stat(filePath);
      if (stats.size < 64) {
        return {
          valid: false,
          reason: `file_truncated_under_64_bytes (size: ${stats.size}b)`,
          fileSizeBytes: stats.size,
        };
      }

      fileHandle = await fs.open(filePath, 'r');
      const headerBuf = Buffer.alloc(16);
      const { bytesRead } = await fileHandle.read(headerBuf, 0, 16, 0);

      if (bytesRead < 16) {
        return {
          valid: false,
          reason: 'header_read_truncated',
          fileSizeBytes: stats.size,
        };
      }

      const riff = headerBuf.subarray(0, 4).toString('ascii');
      const webp = headerBuf.subarray(8, 12).toString('ascii');

      if (riff !== 'RIFF' || webp !== 'WEBP') {
        return {
          valid: false,
          reason: `magic_bytes_invalid (expected RIFF/WEBP, got '${riff}'/'${webp}')`,
          fileSizeBytes: stats.size,
        };
      }

      await fileHandle.close();
      fileHandle = null;

      // Deep verification with Sharp if requested
      if (deep) {
        await sharp(filePath).metadata();
      }

      return {
        valid: true,
        fileSizeBytes: stats.size,
      };
    } catch (err: any) {
      if (fileHandle) {
        try {
          await fileHandle.close();
        } catch {}
      }

      const isBadBlock = err.code === 'EIO' || err.code === 'EBADF';
      return {
        valid: false,
        reason: isBadBlock ? 'disk_bad_block_eio' : `read_error: ${err.message}`,
      };
    }
  }

  /**
   * Scans all pages in a given chapter and logs corrupt entries
   */
  public async scanChapter(chapterId: string, deep: boolean = false): Promise<IntegrityScanReport> {
    const startTime = Date.now();
    const chapterRow: any = this.db
      .prepare('SELECT id, storage_path FROM chapters WHERE id = ?')
      .get(chapterId);

    if (!chapterRow) {
      throw new Error(`Chapter '${chapterId}' not found in database`);
    }

    const chapDir = path.join(this.storageRoot, chapterRow.storage_path);
    let totalScanned = 0;
    let validCount = 0;
    let corruptCount = 0;
    const corruptFiles: Array<{ filePath: string; reason: string }> = [];

    try {
      const entries = await fs.readdir(chapDir);
      for (const entry of entries) {
        if (!entry.toLowerCase().endsWith('.webp')) continue;

        const fullPath = path.join(chapDir, entry);
        totalScanned++;

        const check = await this.verifyWebPFile(fullPath, deep);
        if (check.valid) {
          validCount++;
        } else {
          corruptCount++;
          const reason = check.reason || 'unknown_corruption';
          corruptFiles.push({ filePath: fullPath, reason });

          // Log into SQLite
          this.logCorruptFile(fullPath, chapterId, reason);
        }
      }
    } catch (err: any) {
      // Entire directory may be unreadable
      corruptCount++;
      const reason = `directory_unreadable: ${err.message}`;
      corruptFiles.push({ filePath: chapDir, reason });
      this.logCorruptFile(chapDir, chapterId, reason);
    }

    return {
      totalScanned,
      validCount,
      corruptCount,
      corruptFiles,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Logs a damaged file to SQLite corrupt_files_log
   */
  public logCorruptFile(filePath: string, chapterId: string | null, reason: string): void {
    const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(`
      INSERT INTO corrupt_files_log (id, file_path, chapter_id, error_reason, detected_at, status)
      VALUES (?, ?, ?, ?, datetime('now'), 'pending_repair')
    `).run(id, filePath, chapterId, reason);
  }

  /**
   * Retrieves all detected corrupt files
   */
  public getCorruptFiles(): CorruptFileRecord[] {
    return this.db.prepare('SELECT * FROM corrupt_files_log ORDER BY detected_at DESC').all() as any[];
  }

  /**
   * Returns graceful fallback WebP placeholder image buffer
   */
  public getFallbackPlaceholderWebP(): Buffer {
    return STATIC_FALLBACK_WEBP;
  }
}
