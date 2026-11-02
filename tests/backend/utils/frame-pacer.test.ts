import { describe, it, expect, beforeEach } from 'vitest';
import { FramePacer } from '../../../src/backend/utils/frame-pacer.js';

describe('Sprint 54: FramePacer Unit Tests', () => {
  let pacer: FramePacer;

  beforeEach(() => {
    pacer = new FramePacer({
      bufferSize: 60,
      dropThresholdMs: 22.0,
      pacedDropThresholdPct: 15.0,
      emergencyDropThresholdPct: 25.0,
      nominalRecoveryDropThresholdPct: 8.0,
    });
  });

  it('maintains nominal_60 state under clean 60 FPS cadence', () => {
    let t = 1000;
    // Simulate 30 clean frames at 16.6ms
    for (let i = 0; i < 30; i++) {
      const res = pacer.recordFrame(t);
      expect(res.shouldRender).toBe(true);
      expect(res.state).toBe('nominal_60');
      t += 16.67;
    }

    const stats = pacer.calculateStats();
    expect(stats.state).toBe('nominal_60');
    expect(stats.dropRatePct).toBe(0.0);
    expect(stats.fps).toBeGreaterThanOrEqual(58.0);
  });

  it('transitions to paced_30 under sustained frame drops', () => {
    let t = 1000;
    // Exactly 4 dropped frames (>22ms) out of 20 frames = 20.0% drop rate (15% <= 20% < 25%)
    for (let i = 0; i < 20; i++) {
      const isDrop = i < 4;
      pacer.recordFrame(t);
      t += isDrop ? 30.0 : 16.67;
    }

    const stats = pacer.calculateStats();
    expect(stats.dropRatePct).toBeGreaterThanOrEqual(15.0);
    expect(stats.dropRatePct).toBeLessThan(25.0);
    expect(stats.state).toBe('paced_30');
  });

  it('skips redundant draw calls when paced_30 is active', () => {
    pacer.setManualOverride('paced_30');

    let t = 1000;
    // First frame rendered
    const res1 = pacer.recordFrame(t);
    expect(res1.shouldRender).toBe(true);

    // Second frame after only 16.6ms -> must be skipped (time-gated < 33.3ms)
    t += 16.67;
    const res2 = pacer.recordFrame(t);
    expect(res2.shouldRender).toBe(false);

    // Third frame after another 17ms (total 33.67ms) -> should render
    t += 17.0;
    const res3 = pacer.recordFrame(t);
    expect(res3.shouldRender).toBe(true);
  });

  it('transitions to emergency_step under severe drops and recovers', () => {
    let t = 1000;
    // Simulate 20 severe drops (>25% threshold)
    for (let i = 0; i < 25; i++) {
      pacer.recordFrame(t);
      t += 50.0;
    }

    expect(pacer.effectiveState()).toBe('emergency_step');

    // Simulate recovery: 60 clean fast frames
    for (let i = 0; i < 60; i++) {
      pacer.recordFrame(t);
      t += 16.67;
    }

    expect(pacer.effectiveState()).toBe('nominal_60');
  });

  it('handles pause and resume cleanly without timestamp burst', () => {
    let t = 1000;
    pacer.recordFrame(t);
    t += 16.67;
    pacer.recordFrame(t);

    // Tab hidden for 10 seconds
    pacer.pause();
    t += 10000;

    // Tab foregrounded
    pacer.resume(t);
    const res = pacer.recordFrame(t);
    expect(res.shouldRender).toBe(true);
    expect(res.deltaMs).toBeLessThanOrEqual(16.7);
  });
});
