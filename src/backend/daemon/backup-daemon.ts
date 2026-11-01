import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';

export interface BackupResult {
  success: boolean;
  backupPath: string;
  filename: string;
  sizeBytes: number;
  integrity: string;
  timestamp: string;
}

export interface BackupDaemonOptions {
  db: DatabaseInstance;
  backupDir?: string;
  retentionCount?: number; // default: 5
  intervalMs?: number;     // automated interval in ms, default 0 (manual or external)
  logger?: boolean | {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
  };
}

export class BackupDaemon {
  public readonly db: DatabaseInstance;
  public readonly backupDir: string;
  public readonly retentionCount: number;
  public readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private loggerOption: BackupDaemonOptions['logger'];
  private isRunning = false;

  constructor(options: BackupDaemonOptions) {
    this.db = options.db;
    this.backupDir = options.backupDir
      ? path.resolve(options.backupDir)
      : path.resolve(process.env.STORAGE_ROOT ? path.resolve(process.env.STORAGE_ROOT, 'backups') : './data/backups');
    this.retentionCount = Math.max(1, options.retentionCount ?? 5);
    this.intervalMs = options.intervalMs ?? 0;
    this.loggerOption = options.logger ?? false;
  }

  public get active(): boolean {
    return this.isRunning;
  }

  private logInfo(...args: any[]) {
    if (this.loggerOption === true) {
      console.log('\x1b[36m[BackupDaemon]\x1b[0m', ...args);
    } else if (typeof this.loggerOption === 'object' && this.loggerOption.info) {
      this.loggerOption.info(...args);
    }
  }

  private logError(...args: any[]) {
    if (this.loggerOption === true) {
      console.error('\x1b[31m[BackupDaemon ERROR]\x1b[0m', ...args);
    } else if (typeof this.loggerOption === 'object' && this.loggerOption.error) {
      this.loggerOption.error(...args);
    }
  }

  /**
   * Creates an atomic, online, consistent SQLite backup using `VACUUM INTO ?`.
   * Automatically validates integrity of the resulting backup and applies retention policy.
   */
  public async createBackup(customFilename?: string): Promise<BackupResult> {
    await fs.mkdir(this.backupDir, { recursive: true });

    const timestamp = new Date().toISOString();
    const formattedDate = timestamp.replace(/[:.]/g, '-');
    const filename = customFilename || `kura-scroll-backup-${formattedDate}.db`;
    const targetPath = path.resolve(this.backupDir, filename);

    // If file already exists, delete it first (SQLite requires target file not exist)
    if (fsSync.existsSync(targetPath)) {
      await fs.unlink(targetPath);
    }

    this.logInfo(`Executing hot backup via VACUUM INTO to: ${targetPath}`);

    // Execute SQLite VACUUM INTO
    this.db.prepare('VACUUM INTO ?;').run(targetPath);

    // Validate B-Tree and index integrity on the resulting backup file
    const integrity = this.verifyBackupIntegrity(targetPath);
    if (integrity !== 'ok') {
      try {
        await fs.unlink(targetPath);
      } catch {}
      throw new Error(`Backup integrity check failed: ${integrity}`);
    }

    const stat = await fs.stat(targetPath);
    const sizeBytes = stat.size;

    this.logInfo(`Backup created successfully: ${filename} (${(sizeBytes / 1024).toFixed(1)} KB, integrity: ${integrity})`);

    // Enforce retention policy
    await this.applyRetentionPolicy();

    return {
      success: true,
      backupPath: targetPath,
      filename,
      sizeBytes,
      integrity,
      timestamp,
    };
  }

  /**
   * Validates integrity on a backup SQLite file using `PRAGMA integrity_check`.
   */
  public verifyBackupIntegrity(backupPath: string): string {
    const backupDb = new DatabaseSync(backupPath);
    try {
      const rows = backupDb.prepare('PRAGMA integrity_check;').all() as Array<{ integrity_check: string }>;
      if (rows.length === 1 && rows[0].integrity_check === 'ok') {
        return 'ok';
      }
      return rows.map((r) => r.integrity_check).join('; ');
    } finally {
      backupDb.close();
    }
  }

  /**
   * Enforces retention policy: keeps only the newest N backups and unlinks older ones.
   */
  public async applyRetentionPolicy(): Promise<string[]> {
    if (!fsSync.existsSync(this.backupDir)) {
      return [];
    }

    const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
    const backupFiles: Array<{ name: string; fullPath: string; mtimeMs: number }> = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.db')) {
        const fullPath = path.join(this.backupDir, entry.name);
        try {
          const stat = await fs.stat(fullPath);
          backupFiles.push({
            name: entry.name,
            fullPath,
            mtimeMs: stat.mtimeMs,
          });
        } catch {
          // ignore stat errors
        }
      }
    }

    // Sort newest first
    backupFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

    const deletedPaths: string[] = [];
    if (backupFiles.length > this.retentionCount) {
      const toDelete = backupFiles.slice(this.retentionCount);
      for (const item of toDelete) {
        try {
          await fs.unlink(item.fullPath);
          deletedPaths.push(item.fullPath);
          this.logInfo(`Purged expired backup: ${item.name}`);
        } catch (err: any) {
          this.logError(`Failed to delete expired backup '${item.name}': ${err.message}`);
        }
      }
    }

    return deletedPaths;
  }

  /**
   * Starts periodic automated backup schedule.
   */
  public start(): void {
    if (this.isRunning) return;

    if (this.intervalMs > 0) {
      this.timer = setInterval(async () => {
        try {
          await this.createBackup();
        } catch (err: any) {
          this.logError(`Scheduled backup failed: ${err.message}`);
        }
      }, this.intervalMs);
    }

    this.isRunning = true;
  }

  /**
   * Stops periodic schedule.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}

/**
 * Registers administrative endpoint for manual backup trigger:
 * POST /api/v1/admin/backup -> { success: true, backupPath, sizeBytes, integrity, timestamp }
 */
export function registerBackupRoutes(app: FastifyInstance, daemon: BackupDaemon): void {
  app.post('/api/v1/admin/backup', async (_req, reply) => {
    try {
      const result = await daemon.createBackup();
      return {
        success: true,
        backupPath: result.backupPath,
        sizeBytes: result.sizeBytes,
        integrity: result.integrity,
        timestamp: result.timestamp,
      };
    } catch (err: any) {
      reply.status(500);
      return {
        success: false,
        error: 'BackupFailed',
        message: err.message,
      };
    }
  });
}
