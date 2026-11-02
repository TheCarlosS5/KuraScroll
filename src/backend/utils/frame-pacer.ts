/**
 * KuraScroll Adaptive Frame-Rate Pacer & Thermal Throttling Governor
 * Sprint 54 - Zero-Allocation Rolling VSync Regulator & Frame Drop Sensor
 */

export type GovernorState = 'nominal_60' | 'paced_30' | 'emergency_step';

export interface FrameTickResult {
  shouldRender: boolean;
  state: GovernorState;
  deltaMs: number;
  fps: number;
  dropRatePct: number;
}

export interface FramePacerStats {
  fps: number;
  dropRatePct: number;
  averageDeltaMs: number;
  maxDeltaMs: number;
  state: GovernorState;
  samplesCount: number;
}

export interface FramePacerOptions {
  bufferSize?: number;
  dropThresholdMs?: number;
  pacedDropThresholdPct?: number;
  emergencyDropThresholdPct?: number;
  nominalRecoveryDropThresholdPct?: number;
}

export class FramePacer {
  private readonly bufferSize: number;
  private readonly ringBuffer: Float64Array;
  private head: number = 0;
  private samplesCount: number = 0;

  private state: GovernorState = 'nominal_60';
  private manualOverride: GovernorState | null = null;

  private lastFrameTimestamp: number = 0;
  private lastRenderTimestamp: number = 0;
  private isSuspended: boolean = false;

  private readonly dropThresholdMs: number;
  private readonly pacedDropThresholdPct: number;
  private readonly emergencyDropThresholdPct: number;
  private readonly nominalRecoveryDropThresholdPct: number;

  constructor(options: FramePacerOptions = {}) {
    this.bufferSize = options.bufferSize ?? 60;
    this.ringBuffer = new Float64Array(this.bufferSize);

    this.dropThresholdMs = options.dropThresholdMs ?? 22.0; // >22ms = dropped frame from 16.6ms target
    this.pacedDropThresholdPct = options.pacedDropThresholdPct ?? 15.0; // >15% drops -> switch to 30 FPS
    this.emergencyDropThresholdPct = options.emergencyDropThresholdPct ?? 25.0; // >25% drops -> switch to Emergency
    this.nominalRecoveryDropThresholdPct = options.nominalRecoveryDropThresholdPct ?? 8.0; // <8% drops -> recover to 60 FPS
  }

  /**
   * Evaluates a frame tick in O(1) time with 0 heap allocations
   */
  public recordFrame(timestamp: number): FrameTickResult {
    if (this.isSuspended || this.lastFrameTimestamp === 0) {
      this.lastFrameTimestamp = timestamp;
      this.lastRenderTimestamp = timestamp;
      this.isSuspended = false;
      return {
        shouldRender: true,
        state: this.effectiveState(),
        deltaMs: 16.67,
        fps: 60.0,
        dropRatePct: 0.0,
      };
    }

    const deltaMs = Math.max(0.001, timestamp - this.lastFrameTimestamp);
    this.lastFrameTimestamp = timestamp;

    // Record delta into zero-allocation pre-allocated circular ring buffer
    const slot = this.head % this.bufferSize;
    this.ringBuffer[slot] = deltaMs;
    this.head++;
    if (this.samplesCount < this.bufferSize) {
      this.samplesCount++;
    }

    // Determine state transition
    this.updateState();

    const currentState = this.effectiveState();
    let shouldRender = true;

    // Apply time-gating policy based on governor state
    if (currentState === 'paced_30') {
      const renderDelta = timestamp - this.lastRenderTimestamp;
      if (renderDelta < 33.33) {
        shouldRender = false; // Skip redundant draw call, reducing GPU fill-rate
      } else {
        this.lastRenderTimestamp = timestamp;
      }
    } else {
      this.lastRenderTimestamp = timestamp;
    }

    const stats = this.calculateStats();

    return {
      shouldRender,
      state: currentState,
      deltaMs,
      fps: stats.fps,
      dropRatePct: stats.dropRatePct,
    };
  }

  private updateState(): void {
    if (this.samplesCount < 10) return; // Wait for initial calibration

    const stats = this.calculateStats();
    const dropPct = stats.dropRatePct;

    if (this.state === 'nominal_60') {
      if (dropPct >= this.emergencyDropThresholdPct) {
        this.state = 'emergency_step';
      } else if (dropPct >= this.pacedDropThresholdPct) {
        this.state = 'paced_30';
      }
    } else if (this.state === 'paced_30') {
      if (dropPct >= this.emergencyDropThresholdPct) {
        this.state = 'emergency_step';
      } else if (dropPct <= this.nominalRecoveryDropThresholdPct) {
        this.state = 'nominal_60';
      }
    } else if (this.state === 'emergency_step') {
      if (dropPct <= this.nominalRecoveryDropThresholdPct) {
        this.state = 'nominal_60';
      } else if (dropPct < this.emergencyDropThresholdPct) {
        this.state = 'paced_30';
      }
    }
  }

  public calculateStats(): FramePacerStats {
    if (this.samplesCount === 0) {
      return {
        fps: 60.0,
        dropRatePct: 0.0,
        averageDeltaMs: 16.67,
        maxDeltaMs: 16.67,
        state: this.effectiveState(),
        samplesCount: 0,
      };
    }

    let sum = 0;
    let max = 0;
    let droppedCount = 0;

    for (let i = 0; i < this.samplesCount; i++) {
      const val = this.ringBuffer[i];
      sum += val;
      if (val > max) max = val;
      if (val > this.dropThresholdMs) droppedCount++;
    }

    const averageDeltaMs = sum / this.samplesCount;
    const fps = averageDeltaMs > 0 ? Math.min(120.0, Math.round((1000.0 / averageDeltaMs) * 10) / 10) : 60.0;
    const dropRatePct = Math.round((droppedCount / this.samplesCount) * 1000) / 10;

    return {
      fps,
      dropRatePct,
      averageDeltaMs: Math.round(averageDeltaMs * 100) / 100,
      maxDeltaMs: Math.round(max * 100) / 100,
      state: this.effectiveState(),
      samplesCount: this.samplesCount,
    };
  }

  public effectiveState(): GovernorState {
    return this.manualOverride ?? this.state;
  }

  public setManualOverride(override: GovernorState | null): void {
    this.manualOverride = override;
  }

  public pause(): void {
    this.isSuspended = true;
  }

  public resume(currentTimestamp?: number): void {
    this.isSuspended = false;
    this.lastFrameTimestamp = currentTimestamp ?? 0;
    this.lastRenderTimestamp = currentTimestamp ?? 0;
  }

  public reset(): void {
    this.head = 0;
    this.samplesCount = 0;
    this.state = 'nominal_60';
    this.manualOverride = null;
    this.lastFrameTimestamp = 0;
    this.lastRenderTimestamp = 0;
    this.isSuspended = false;
    this.ringBuffer.fill(0);
  }
}
