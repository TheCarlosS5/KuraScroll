import EventEmitter from 'node:events';

export type AdaptiveIngestionState = 'RUNNING' | 'THROTTLED' | 'PAUSED';

export interface AdaptiveIngestionOptions {
  windowSize?: number;
  apiP95PauseMs?: number;
  apiP95ThrottleMs?: number;
  apiP95ResumeMs?: number;
  rssMaxBytes?: number;
  rssResumeBytes?: number;
  eventLoopLagMaxMs?: number;
  recoveryHysteresisMs?: number;
  normalSleepMs?: number;
  throttledSleepMs?: number;
  checkIntervalMs?: number;
}

export interface AdaptiveStatus {
  state: AdaptiveIngestionState;
  isPaused: boolean;
  isThrottled: boolean;
  p95Ms: number;
  rssBytes: number;
  rssMb: number;
  eventLoopLagMs: number;
  samplesCount: number;
  forcedState: AdaptiveIngestionState | null;
  healthyDurationMs: number;
}

export class AdaptiveIngestionController extends EventEmitter {
  private readonly windowSize: number;
  private readonly apiP95PauseMs: number;
  private readonly apiP95ThrottleMs: number;
  private readonly apiP95ResumeMs: number;
  private readonly rssMaxBytes: number;
  private readonly rssResumeBytes: number;
  private readonly eventLoopLagMaxMs: number;
  private readonly recoveryHysteresisMs: number;
  private readonly normalSleepMs: number;
  private readonly throttledSleepMs: number;

  private latencySamples: number[] = [];
  private currentRssBytes: number = 0;
  private currentEventLoopLagMs: number = 0;
  private state: AdaptiveIngestionState = 'RUNNING';
  private forcedState: AdaptiveIngestionState | null = null;
  private healthySinceTimestamp: number | null = null;

  private checkTimer: NodeJS.Timeout | null = null;
  private lagCheckTimer: NodeJS.Timeout | null = null;
  private lastLagTick: number = Date.now();

  constructor(options: AdaptiveIngestionOptions = {}) {
    super();
    this.windowSize = options.windowSize ?? 50;
    this.apiP95PauseMs = options.apiP95PauseMs ?? 500;
    this.apiP95ThrottleMs = options.apiP95ThrottleMs ?? 250;
    this.apiP95ResumeMs = options.apiP95ResumeMs ?? 150;
    this.rssMaxBytes = options.rssMaxBytes ?? 380 * 1024 * 1024; // 380MB default for T4500
    this.rssResumeBytes = options.rssResumeBytes ?? 300 * 1024 * 1024;
    this.eventLoopLagMaxMs = options.eventLoopLagMaxMs ?? 100;
    this.recoveryHysteresisMs = options.recoveryHysteresisMs ?? 5000;
    this.normalSleepMs = options.normalSleepMs ?? 15;
    this.throttledSleepMs = options.throttledSleepMs ?? 200;

    this.currentRssBytes = typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage().rss : 50 * 1024 * 1024;

    if (options.checkIntervalMs && options.checkIntervalMs > 0) {
      this.start(options.checkIntervalMs);
    }
  }

  public recordApiLatency(latencyMs: number, timestamp: number = Date.now()): void {
    if (this.latencySamples.length >= this.windowSize) {
      this.latencySamples.shift();
    }
    this.latencySamples.push(latencyMs);
    this.evaluateState(timestamp);
  }

  public recordMemorySample(rssBytes?: number, timestamp: number = Date.now()): void {
    this.currentRssBytes = rssBytes ?? (process.memoryUsage ? process.memoryUsage().rss : 0);
    this.evaluateState(timestamp);
  }

  public recordEventLoopLag(lagMs: number, timestamp: number = Date.now()): void {
    this.currentEventLoopLagMs = lagMs;
    this.evaluateState(timestamp);
  }

  public calculateP95(): number {
    if (this.latencySamples.length === 0) return 0;
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const index = Math.ceil(0.95 * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  public evaluateState(now: number = Date.now()): AdaptiveIngestionState {
    if (this.forcedState) {
      this.state = this.forcedState;
      return this.state;
    }

    const p95 = this.calculateP95();
    const isMemoryOverload = this.currentRssBytes > this.rssMaxBytes;
    const isLagOverload = this.currentEventLoopLagMs > this.eventLoopLagMaxMs;
    const isP95Overload = p95 > this.apiP95PauseMs;

    const previousState = this.state;

    // Direct transition to PAUSED if any critical metric is breached
    if (isMemoryOverload || isP95Overload || isLagOverload) {
      this.state = 'PAUSED';
      this.healthySinceTimestamp = null;
      if (previousState !== 'PAUSED') {
        this.emit('stateChange', this.state, { reason: 'critical_load', p95, rss: this.currentRssBytes, lag: this.currentEventLoopLagMs });
      }
      return this.state;
    }

    // Direct transition to THROTTLED if P95 is moderately elevated
    const isThrottleCondition = p95 > this.apiP95ThrottleMs || (this.currentRssBytes > this.rssResumeBytes && previousState === 'PAUSED');
    if (isThrottleCondition && this.state !== 'PAUSED') {
      this.state = 'THROTTLED';
      this.healthySinceTimestamp = null;
      if (previousState !== 'THROTTLED') {
        this.emit('stateChange', this.state, { reason: 'moderate_load', p95 });
      }
      return this.state;
    }

    // Checking healthy conditions for recovery
    const isFullyHealthy = p95 <= this.apiP95ResumeMs && this.currentRssBytes <= this.rssResumeBytes && this.currentEventLoopLagMs <= 50;

    if (isFullyHealthy) {
      if (this.healthySinceTimestamp === null) {
        this.healthySinceTimestamp = now;
      }

      const healthyDuration = now - this.healthySinceTimestamp;
      if (this.state === 'PAUSED' || this.state === 'THROTTLED') {
        if (healthyDuration >= this.recoveryHysteresisMs) {
          this.state = 'RUNNING';
          this.emit('stateChange', this.state, { reason: 'recovered', healthyDuration });
          this.emit('resume');
        }
      } else {
        this.state = 'RUNNING';
      }
    } else {
      // Not fully healthy, keep hysteresis reset
      this.healthySinceTimestamp = null;
    }

    return this.state;
  }

  public async acquireYieldSlice(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    // If currently paused, await resumption with backoff polling & signal observation
    while (this.state === 'PAUSED') {
      if (signal?.aborted) {
        throw new Error('Operation aborted while waiting for pause to release');
      }
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          resolve();
        }, 50);

        const onAbort = () => {
          cleanup();
          reject(new Error('Operation aborted'));
        };

        const onResume = () => {
          cleanup();
          resolve();
        };

        const cleanup = () => {
          clearTimeout(timeout);
          if (signal) signal.removeEventListener('abort', onAbort);
          this.removeListener('resume', onResume);
        };

        if (signal) signal.addEventListener('abort', onAbort, { once: true });
        this.once('resume', onResume);
      });

      this.evaluateState();
    }

    // Apply sleep slice based on active throttled or running state
    const delay = this.state === 'THROTTLED' ? this.throttledSleepMs : this.normalSleepMs;
    if (delay > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error('Operation aborted during sleep'));
            },
            { once: true }
          );
        }
      });
    }
  }

  public forcePause(): void {
    this.forcedState = 'PAUSED';
    this.state = 'PAUSED';
    this.emit('stateChange', this.state, { reason: 'forced_pause' });
  }

  public forceResume(): void {
    this.forcedState = 'RUNNING';
    this.state = 'RUNNING';
    this.emit('stateChange', this.state, { reason: 'forced_resume' });
    this.emit('resume');
  }

  public clearForce(): void {
    this.forcedState = null;
    this.healthySinceTimestamp = Date.now() - this.recoveryHysteresisMs;
    this.state = 'RUNNING';
    this.evaluateState();
  }

  public getStatus(): AdaptiveStatus {
    const p95 = this.calculateP95();
    const now = Date.now();
    const healthyDurationMs = this.healthySinceTimestamp ? Math.max(0, now - this.healthySinceTimestamp) : 0;

    return {
      state: this.state,
      isPaused: this.state === 'PAUSED',
      isThrottled: this.state === 'THROTTLED',
      p95Ms: p95,
      rssBytes: this.currentRssBytes,
      rssMb: Math.round(this.currentRssBytes / (1024 * 1024)),
      eventLoopLagMs: this.currentEventLoopLagMs,
      samplesCount: this.latencySamples.length,
      forcedState: this.forcedState,
      healthyDurationMs,
    };
  }

  public start(intervalMs: number = 1000): void {
    this.stop();

    // Event loop drift monitor
    this.lastLagTick = Date.now();
    this.lagCheckTimer = setInterval(() => {
      const now = Date.now();
      const drift = Math.max(0, now - this.lastLagTick - 100);
      this.currentEventLoopLagMs = drift;
      this.lastLagTick = now;
    }, 100);

    // Periodic memory & evaluation
    this.checkTimer = setInterval(() => {
      this.recordMemorySample();
    }, intervalMs);
  }

  public stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    if (this.lagCheckTimer) {
      clearInterval(this.lagCheckTimer);
      this.lagCheckTimer = null;
    }
  }
}
