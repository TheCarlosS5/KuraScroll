import { IOPriority, IOJobOptions, IOContext, IOMetrics } from './io-priority.js';
import { PauseGate } from './pause-gate.js';

interface QueuedJob<T> {
  id: number;
  options: IOJobOptions;
  task: (context: IOContext) => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  queuedAt: number;
}

export class IOCoordinator {
  private activeInteractive = 0;
  private activeBackground = 0;
  private maxConcurrentInteractive = 2;
  private maxConcurrentBackground = 1;
  private nextJobId = 1;
  private queue: QueuedJob<any>[] = [];
  private pauseGate = new PauseGate();

  private totalCompleted = 0;
  private totalErrors = 0;
  private totalWaitTimeMs = 0;

  constructor(options?: {
    maxConcurrentInteractive?: number;
    maxConcurrentBackground?: number;
  }) {
    if (options?.maxConcurrentInteractive) {
      this.maxConcurrentInteractive = options.maxConcurrentInteractive;
    }
    if (options?.maxConcurrentBackground) {
      this.maxConcurrentBackground = options.maxConcurrentBackground;
    }
  }

  get pauseControl(): PauseGate {
    return this.pauseGate;
  }

  getMetrics(): IOMetrics {
    return {
      activeInteractive: this.activeInteractive,
      activeBackground: this.activeBackground,
      queuedCount: this.queue.length,
      pausedBackgroundCount: this.pauseGate.waitingCount,
      totalCompleted: this.totalCompleted,
      totalErrors: this.totalErrors,
      avgWaitTimeMs:
        this.totalCompleted > 0
          ? Math.round((this.totalWaitTimeMs / this.totalCompleted) * 100) / 100
          : 0,
    };
  }

  async run<T>(
    options: IOJobOptions,
    task: (context: IOContext) => Promise<T>
  ): Promise<T> {
    options.signal?.throwIfAborted();

    return new Promise<T>((resolve, reject) => {
      const job: QueuedJob<T> = {
        id: this.nextJobId++,
        options,
        task,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      if (options.signal) {
        const onAbort = () => {
          const idx = this.queue.findIndex((j) => j.id === job.id);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
          }
          this.checkAndSignalPause();
          reject(options.signal?.reason || new Error('Aborted'));
        };

        if (options.signal.aborted) {
          onAbort();
          return;
        }
        options.signal.addEventListener('abort', onAbort, { once: true });
      }

      this.enqueue(job);
      this.checkAndSignalPause();
      this.drain();
    });
  }

  private isInteractive(priority: IOPriority): boolean {
    return priority === IOPriority.CRITICAL || priority === IOPriority.HIGH;
  }

  private hasPendingInteractive(): boolean {
    return (
      this.activeInteractive > 0 ||
      this.queue.some((j) => this.isInteractive(j.options.priority))
    );
  }

  private checkAndSignalPause(): void {
    if (this.hasPendingInteractive()) {
      this.pauseGate.pause();
    } else {
      this.pauseGate.resume();
    }
  }

  private enqueue(job: QueuedJob<any>): void {
    // Priority queue insertion: lowest number (CRITICAL=0) comes first, FIFO within same priority
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (job.options.priority < this.queue[i].options.priority) {
        this.queue.splice(i, 0, job);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(job);
    }
  }

  private async drain(): Promise<void> {
    if (this.queue.length === 0) {
      this.checkAndSignalPause();
      return;
    }

    // Try finding the highest priority job that can execute under concurrency constraints
    for (let i = 0; i < this.queue.length; i++) {
      const candidate = this.queue[i];
      const isInteractive = this.isInteractive(candidate.options.priority);

      if (isInteractive) {
        if (this.activeInteractive < this.maxConcurrentInteractive) {
          this.queue.splice(i, 1);
          this.executeJob(candidate, true);
          return;
        }
      } else {
        // Background / Normal job: only run if no interactive jobs are queued or running
        if (
          !this.hasPendingInteractive() &&
          this.activeBackground < this.maxConcurrentBackground
        ) {
          this.queue.splice(i, 1);
          this.executeJob(candidate, false);
          return;
        }
      }
    }
  }

  private async executeJob(job: QueuedJob<any>, isInteractive: boolean): Promise<void> {
    if (isInteractive) {
      this.activeInteractive++;
    } else {
      this.activeBackground++;
    }

    this.checkAndSignalPause();
    const waitTime = Date.now() - job.queuedAt;
    this.totalWaitTimeMs += waitTime;

    const context: IOContext = {
      signal: job.options.signal,
      checkpoint: async () => {
        await this.pauseGate.checkpoint(job.options.signal);
      },
      yieldIfInteractive: async () => {
        if (this.hasPendingInteractive()) {
          await this.pauseGate.checkpoint(job.options.signal);
        }
      },
    };

    try {
      const result = await job.task(context);
      this.totalCompleted++;
      job.resolve(result);
    } catch (err) {
      this.totalErrors++;
      job.reject(err);
    } finally {
      if (isInteractive) {
        this.activeInteractive--;
      } else {
        this.activeBackground--;
      }

      this.checkAndSignalPause();
      // Schedule next drain
      setImmediate(() => this.drain());
    }
  }
}

// Global Shared Singleton Instance
export const sharedIOCoordinator = new IOCoordinator();
