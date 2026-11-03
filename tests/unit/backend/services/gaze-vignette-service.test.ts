import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  GazeVignetteService,
  calculateGazeVignette,
  GAZE_VIGNETTE_PRESETS,
} from '../../../../src/backend/services/gaze-vignette-service.js';

describe('GazeVignetteService', () => {
  let db: DatabaseInstance;
  let service: GazeVignetteService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new GazeVignetteService(db);
  });

  it('returns default unpersisted profile with deterministic default parameters', () => {
    const profile = service.getProfile('series-gv-1');
    expect(profile.seriesId).toBe('series-gv-1');
    expect(profile.presetName).toBe('relaxed_reading_calm');
    expect(profile.omega).toBe(8.0);
    expect(profile.deadZonePx).toBe(1.5);
    expect(profile.snapThresholdPx).toBe(120.0);
    expect(profile.vignetteMax).toBe(0.12);
    expect(profile.radiusX).toBe(0.55);
    expect(profile.radiusY).toBe(0.65);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-gv',
      presetName: 'deep_focus_tunnel',
      omega: 100.0, // clamp to 40.0
      deadZonePx: 50.0, // clamp to 20.0
      snapThresholdPx: 1000.0, // clamp to 500.0
      vignetteMax: 1.5, // clamp to 0.80
      radiusX: 5.0, // clamp to 1.50
    });

    expect(updated.omega).toBe(40.0);
    expect(updated.deadZonePx).toBe(20.0);
    expect(updated.snapThresholdPx).toBe(500.0);
    expect(updated.vignetteMax).toBe(0.80);
    expect(updated.radiusX).toBe(1.50);
    expect(updated.presetName).toBe('deep_focus_tunnel');

    const fetched = service.getProfile('series-clamped-gv');
    expect(fetched.omega).toBe(40.0);
    expect(fetched.vignetteMax).toBe(0.80);
  });

  it('evaluates critically-damped stabilization without overshoot or oscillation', () => {
    // Current focus at 100, moving toward target at 140
    const res = calculateGazeVignette(100, 100, 140, 100, 0, 0, 0.016, 8.0, 1.5, 120.0, 0.12, 0.55, 0.65, 0.70, 1.20, true);
    expect(res.stabilizedX).toBeGreaterThan(100);
    expect(res.stabilizedX).toBeLessThanOrEqual(140);
    expect(res.isSnapping).toBe(false);
  });

  it('locks directly to target within jitter dead-zone', () => {
    // Distance dx = 1.0 < deadZonePx (1.5)
    const res = calculateGazeVignette(100.5, 100.2, 100.0, 100.0, 5.0, 5.0, 0.016, 8.0, 1.5, 120.0, 0.12, 0.55, 0.65, 0.70, 1.20, true);
    expect(res.stabilizedX).toBe(100.0);
    expect(res.stabilizedY).toBe(100.0);
    expect(res.velocityX).toBe(0);
    expect(res.velocityY).toBe(0);
    expect(res.isSnapping).toBe(false);
  });

  it('snaps immediately on editorial jump exceeding snapThreshold', () => {
    // Large cut: dx = 200 > snapThresholdPx (120)
    const res = calculateGazeVignette(100, 100, 300, 100, 0, 0, 0.016, 8.0, 1.5, 120.0, 0.12, 0.55, 0.65, 0.70, 1.20, true);
    expect(res.stabilizedX).toBe(300.0);
    expect(res.isSnapping).toBe(true);
    expect(res.velocityX).toBe(0);
  });

  it('handles disabled state returning untouched target focus and zero opacity', () => {
    const disabledRes = calculateGazeVignette(50, 50, 150, 150, 0, 0, 0.016, 8.0, 1.5, 120.0, 0.12, 0.55, 0.65, 0.70, 1.20, false);
    expect(disabledRes.stabilizedX).toBe(150);
    expect(disabledRes.stabilizedY).toBe(150);
    expect(disabledRes.vignetteOpacity).toBe(0);
  });

  it('returns all defined gaze vignette presets', () => {
    const presets = service.getPresets();
    expect(presets.length).toBe(5);
    const names = presets.map((p) => p.name);
    expect(names).toContain('deep_focus_tunnel');
    expect(names).toContain('shonen_action_burst');
    expect(names).toContain('relaxed_reading_calm');
    expect(names).toContain('night_monochrome');
    expect(names).toContain('raw_fixed');
  });
});
