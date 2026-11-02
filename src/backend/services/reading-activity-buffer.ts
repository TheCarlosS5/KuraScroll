import { ReadingGoalRepository, RecordActivityInput, DailyProgressResult } from '../repositories/reading-goal-repository.js';
import { IOCoordinator } from '../storage/io/io-coordinator.js';
import { IOPriority } from '../storage/io/io-priority.js';

export interface BufferedActivityEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  pagesDelta: number;
  secondsDelta: number;
  firstBufferedAt: number;
  lastBufferedAt: number;
}

export interface BufferTelemetryMetrics {
  dirtyEntriesCount: number;
  lastFlushTimestamp: string | null;
  totalFlushes: number;
  totalBufferedWrites: number;
  averageFlushDurationMs: number;
  warningAlert: boolean;
  alertReason?: string;
}

export interface ReadingActivityBufferOptions {
  flushIntervalMs?: number;
  flushThreshold?: number;
  maxFlushDurationMsWarning?: number;
  maxDirtyCountWarning?: number;
}

export type GoalCompletedCallback = (result: DailyProgressResult) => void;

/**
 * Sprint 30: ReadingActivityBuffer
 * Coalesces rapid reader page turns and reading seconds in-memory,
 * performing atomic batch flushes into SQLite via the shared IOCoordinator.
 * Protects 5400 RPM SATA II HDDs and Intel Pentium T4500 CPUs from I/O thrashing.
 */
export class ReadingActivityBuffer {
  private buffer = new Map<string, BufferedActivityEntry>();
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private totalFlushes = 0;
  private totalBufferedWrites = 0;
  private lastFlushTimestamp: string | null = null;
  private totalFlushDurationMs = 0;
  private goalCompletedCallbacks: GoalCompletedCallback[] = [];

  private readonly flushIntervalMs: number;
  private readonly flushThreshold: number;
  private readonly maxFlushDurationMsWarning: number;
  private readonly maxDirtyCountWarning: number;

  constructor(
    private repository: ReadingGoalRepository,
    private ioCoordinator?: IOCoordinator,
    options: ReadingActivityBufferOptions = {}
  ) {
    this.flushIntervalMs = options.flushIntervalMs ?? 5000;
    this.flushThreshold = options.flushThreshold ?? 10;
    this.maxFlushDurationMsWarning = options.maxFlushDurationMsWarning ?? 20;
    this.maxDirtyCountWarning = options.maxDirtyCountWarning ?? 50;

    this.startPeriodicFlush();

    // Hook process exit for clean flush
    process.once('beforeExit', () => {
      this.flushSync();
    });
  }

  public onGoalCompleted(callback: GoalCompletedCallback): void {
    this.goalCompletedCallbacks.push(callback);
  }

  /**
   * Buffer an activity event. Returns whether a threshold flush was triggered.
   */
  public recordActivity(userId: string, date: string, pagesDelta: number, secondsDelta: number): boolean {
    const key = `${userId}:${date}`;
    const now = Date.now();
    this.totalBufferedWrites++;

    const existing = this.buffer.get(key);
    if (existing) {
      existing.pagesDelta += pagesDelta;
      existing.secondsDelta += secondsDelta;
      existing.lastBufferedAt = now;
    } else {
      this.buffer.set(key, {
        userId,
        date,
        pagesDelta,
        secondsDelta,
        firstBufferedAt: now,
        lastBufferedAt: now,
      });
    }

    if (this.buffer.size >= this.flushThreshold && !this.isFlushing) {
      void this.flush();
      return true;
    }

    return false;
  }

  /**
   * Asynchronously flush all pending buffer entries to SQLite through IOCoordinator.
   */
  public async flush(): Promise<number> {
    if (this.buffer.size === 0 || this.isFlushing) {
      return 0;
    }

    this.isFlushing = true;
    const startTime = performance.now();

    // Snapshot and clear buffer map to continue receiving events
    const snapshot = Array.from(this.buffer.values());
    this.buffer.clear();

    const writeTask = () => {
      for (const item of snapshot) {
        // Query status prior to record to detect newly completed goals
        const prior = this.repository.getDailyProgress(item.userId, item.date);
        const priorCompleted = prior.goalCompleted;

        this.repository.recordActivity({
          userId: item.userId,
          date: item.date,
          pagesDelta: item.pagesDelta,
          secondsDelta: item.secondsDelta,
        });

        const post = this.repository.getDailyProgress(item.userId, item.date);
        if (!priorCompleted && post.goalCompleted) {
          for (const cb of this.goalCompletedCallbacks) {
            try {
              cb(post);
            } catch {
              // Ignore callback errors
            }
          }
        }
      }
    };

    try {
      if (this.ioCoordinator) {
        await this.ioCoordinator.run({ priority: IOPriority.NORMAL, label: 'reading-activity-flush' }, async () => {
          writeTask();
        });
      } else {
        writeTask();
      }

      const durationMs = performance.now() - startTime;
      this.totalFlushes++;
      this.totalFlushDurationMs += durationMs;
      this.lastFlushTimestamp = new Date().toISOString();

      return snapshot.length;
    } catch (err) {
      // Restore failed items back to buffer map
      for (const item of snapshot) {
        const key = `${item.userId}:${item.date}`;
        const existing = this.buffer.get(key);
        if (existing) {
          existing.pagesDelta += item.pagesDelta;
          existing.secondsDelta += item.secondsDelta;
        } else {
          this.buffer.set(key, item);
        }
      }
      throw err;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Synchronous emergency flush for process termination.
   */
  public flushSync(): number {
    if (this.buffer.size === 0) return 0;
    const snapshot = Array.from(this.buffer.values());
    this.buffer.clear();

    for (const item of snapshot) {
      this.repository.recordActivity({
        userId: item.userId,
        date: item.date,
        pagesDelta: item.pagesDelta,
        secondsDelta: item.secondsDelta,
      });
    }

    this.totalFlushes++;
    this.lastFlushTimestamp = new Date().toISOString();
    return snapshot.length;
  }

  public getTelemetry(): BufferTelemetryMetrics {
    const dirtyCount = this.buffer.size;
    const avgDuration = this.totalFlushes > 0 ? this.totalFlushDurationMs / this.totalFlushes : 0;
    const isWarning = dirtyCount > this.maxDirtyCountWarning || avgDuration > this.maxFlushDurationMsWarning;

    let alertReason: string | undefined;
    if (dirtyCount > this.maxDirtyCountWarning) {
      alertReason = `Buffer backlog high: ${dirtyCount} entries exceed threshold ${this.maxDirtyCountWarning}`;
    } else if (avgDuration > this.maxFlushDurationMsWarning) {
      alertReason = `Flush latency slow: ${avgDuration.toFixed(2)}ms exceeds threshold ${this.maxFlushDurationMsWarning}ms`;
    }

    return {
      dirtyEntriesCount: dirtyCount,
      lastFlushTimestamp: this.lastFlushTimestamp,
      totalFlushes: this.totalFlushes,
      totalBufferedWrites: this.totalBufferedWrites,
      averageFlushDurationMs: Number(avgDuration.toFixed(2)),
      warningAlert: isWarning,
      alertReason,
    };
  }

  public getPendingCount(): number {
    return this.buffer.size;
  }

  public dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flushSync();
  }

  private startPeriodicFlush(): void {
    if (this.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        if (this.buffer.size > 0 && !this.isFlushing) {
          void this.flush();
        }
      }, this.flushIntervalMs);
      this.timer.unref?.();
    }
  }
}
