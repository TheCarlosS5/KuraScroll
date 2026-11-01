import fs from 'node:fs';
import path from 'node:path';
import { DatabaseInstance } from '../db/database.js';
import { executeMaintenance, MaintenanceReport } from '../db/maintenance.js';
import { globalEventBus, EventBus } from '../events/event-bus.js';
import { SelfHealingIndexer, HealingReport } from '../services/self-healing-indexer.js';
import { AdaptiveIngestionController } from '../services/adaptive-ingestion-controller.js';

export interface MaintenanceDaemonOptions {
  db: DatabaseInstance;
  storageRoot?: string;
  intervalMs?: number; // Default 1 hour (3,600,000 ms)
  eventBus?: EventBus;
  adaptiveController?: AdaptiveIngestionController;
  selfHealingIndexer?: SelfHealingIndexer;
}

export class MaintenanceDaemon {
  private db: DatabaseInstance;
  private storageRoot: string;
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private eventBus: EventBus;
  private isRunning = false;
  private lastReport: MaintenanceReport | null = null;
  private lastHealingReport: HealingReport | null = null;
  private lastRunAt: string | null = null;
  private selfHealingIndexer: SelfHealingIndexer;

  constructor(options: MaintenanceDaemonOptions) {
    this.db = options.db;
    this.storageRoot = options.storageRoot
      ? path.resolve(options.storageRoot)
      : path.resolve(process.env.STORAGE_ROOT || './data/storage');
    this.intervalMs = options.intervalMs ?? 3600000; // 1 hour
    this.eventBus = options.eventBus ?? globalEventBus;
    this.selfHealingIndexer =
      options.selfHealingIndexer ??
      new SelfHealingIndexer({
        db: this.db,
        storageRoot: this.storageRoot,
        adaptiveController: options.adaptiveController,
      });
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(() => {
      this.runMaintenanceCycle().catch((err) => {
        console.error('[MaintenanceDaemon Error]:', err.message);
      });
    }, this.intervalMs);

    // Prevent unref if needed so it doesn't block shutdown
    this.timer.unref();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  public async runMaintenanceCycle(): Promise<{
    maintenance: MaintenanceReport;
    cleanedFilesCount: number;
    healing: HealingReport;
    timestamp: string;
  }> {
    const report = executeMaintenance(this.db);
    this.lastReport = report;
    this.lastRunAt = new Date().toISOString();

    const healingReport = await this.selfHealingIndexer.runFullHealing();
    this.lastHealingReport = healingReport;

    // Clean orphaned files in incoming/.tmp if older than 24h
    let cleanedFilesCount = 0;
    const tmpDir = path.join(this.storageRoot, 'incoming', '.tmp');
    if (fs.existsSync(tmpDir)) {
      try {
        const files = await fs.promises.readdir(tmpDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const file of files) {
          const filePath = path.join(tmpDir, file);
          try {
            const stat = await fs.promises.stat(filePath);
            if (now - stat.mtimeMs > maxAge) {
              await fs.promises.rm(filePath, { recursive: true, force: true });
              cleanedFilesCount++;
            }
          } catch {}
        }
      } catch {}
    }

    this.eventBus.emit('system:maintenance', {
      report,
      cleanedFilesCount,
      healing: healingReport,
      timestamp: this.lastRunAt,
    });

    return {
      maintenance: report,
      cleanedFilesCount,
      healing: healingReport,
      timestamp: this.lastRunAt,
    };
  }

  public getStatus(): {
    active: boolean;
    intervalMs: number;
    lastRunAt: string | null;
    lastReport: MaintenanceReport | null;
    lastHealingReport: HealingReport | null;
  } {
    return {
      active: this.isRunning,
      intervalMs: this.intervalMs,
      lastRunAt: this.lastRunAt,
      lastReport: this.lastReport,
      lastHealingReport: this.lastHealingReport,
    };
  }
}
