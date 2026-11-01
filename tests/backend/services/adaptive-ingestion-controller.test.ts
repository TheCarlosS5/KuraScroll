import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AdaptiveIngestionController,
  AdaptiveIngestionState,
} from '../../../src/backend/services/adaptive-ingestion-controller.js';

describe('AdaptiveIngestionController (Pentium T4500 Backpressure & Hysteresis)', () => {
  let controller: AdaptiveIngestionController;

  beforeEach(() => {
    controller = new AdaptiveIngestionController({
      windowSize: 10,
      apiP95PauseMs: 500,
      apiP95ThrottleMs: 250,
      apiP95ResumeMs: 150,
      rssMaxBytes: 380 * 1024 * 1024,
      rssResumeBytes: 300 * 1024 * 1024,
      recoveryHysteresisMs: 2000,
      normalSleepMs: 5,
      throttledSleepMs: 50,
    });
  });

  afterEach(() => {
    controller.stop();
  });

  it('starts in RUNNING state with low latencies and memory', () => {
    const status = controller.getStatus();
    expect(status.state).toBe('RUNNING');
    expect(status.isPaused).toBe(false);
    expect(status.isThrottled).toBe(false);
  });

  it('calculates P95 accurately from circular window', () => {
    // 10 samples: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
    for (let i = 1; i <= 10; i++) {
      controller.recordApiLatency(i * 10);
    }
    const status = controller.getStatus();
    // 95th percentile of 10 items is item 10 (100) or high interpolation
    expect(status.p95Ms).toBeGreaterThanOrEqual(90);
    expect(status.state).toBe('RUNNING');
  });

  it('transitions to THROTTLED when P95 exceeds throttle threshold (250ms)', () => {
    for (let i = 0; i < 10; i++) {
      controller.recordApiLatency(300);
    }
    const status = controller.getStatus();
    expect(status.state).toBe('THROTTLED');
    expect(status.isThrottled).toBe(true);
    expect(status.isPaused).toBe(false);
  });

  it('transitions immediately to PAUSED when P95 exceeds pause threshold (500ms)', () => {
    for (let i = 0; i < 10; i++) {
      controller.recordApiLatency(550);
    }
    const status = controller.getStatus();
    expect(status.state).toBe('PAUSED');
    expect(status.isPaused).toBe(true);
  });

  it('transitions to PAUSED when RSS exceeds 380MB limit', () => {
    // Latencies are low
    for (let i = 0; i < 10; i++) {
      controller.recordApiLatency(50);
    }
    // High memory usage
    controller.recordMemorySample(400 * 1024 * 1024); // 400MB
    const status = controller.getStatus();
    expect(status.state).toBe('PAUSED');
    expect(status.isPaused).toBe(true);
  });

  it('applies hysteresis: stays PAUSED until recovery time elapses even if metrics improve', () => {
    const now = 10000;
    // Step 1: Cause pause
    for (let i = 0; i < 10; i++) {
      controller.recordApiLatency(600, now);
    }
    expect(controller.getStatus().state).toBe('PAUSED');

    // Step 2: Metrics suddenly become good at now + 500ms
    for (let i = 0; i < 10; i++) {
      controller.recordApiLatency(50, now + 500);
    }
    controller.recordMemorySample(200 * 1024 * 1024, now + 500);
    controller.evaluateState(now + 500);

    // Should STILL be paused because recoveryHysteresisMs (2000ms) has not elapsed
    expect(controller.getStatus().state).toBe('PAUSED');

    // Step 3: Advance time beyond hysteresis (now + 2500ms)
    controller.evaluateState(now + 2500);
    expect(controller.getStatus().state).toBe('RUNNING');
  });

  it('yields slice with appropriate delay based on state', async () => {
    // Normal RUNNING delay
    const startRunning = Date.now();
    await controller.acquireYieldSlice();
    const elapsedRunning = Date.now() - startRunning;
    expect(elapsedRunning).toBeGreaterThanOrEqual(4);

    // Switch to THROTTLED
    for (let i = 0; i < 10; i++) {
      controller.recordApiLatency(300);
    }
    const startThrottled = Date.now();
    await controller.acquireYieldSlice();
    const elapsedThrottled = Date.now() - startThrottled;
    expect(elapsedThrottled).toBeGreaterThanOrEqual(40);
  });

  it('supports manual forcePause and forceResume overrides', () => {
    controller.forcePause();
    expect(controller.getStatus().state).toBe('PAUSED');
    expect(controller.getStatus().forcedState).toBe('PAUSED');

    controller.clearForce();
    expect(controller.getStatus().forcedState).toBeNull();
    expect(controller.getStatus().state).toBe('RUNNING');

    controller.forceResume();
    expect(controller.getStatus().forcedState).toBe('RUNNING');
    expect(controller.getStatus().state).toBe('RUNNING');
  });

  it('aborts acquireYieldSlice if AbortSignal fires while paused', async () => {
    controller.forcePause();
    const abortController = new AbortController();

    setTimeout(() => {
      abortController.abort();
    }, 50);

    await expect(controller.acquireYieldSlice(abortController.signal)).rejects.toThrow('aborted');
  });
});
