import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  LensDistortionService,
  calculateLensDistortion,
  LENS_DISTORTION_PRESETS,
} from '../../../../src/backend/services/lens-distortion-service.js';

describe('LensDistortionService', () => {
  let db: DatabaseInstance;
  let service: LensDistortionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new LensDistortionService(db);
  });

  it('returns default unpersisted profile with deterministic default parameters', () => {
    const profile = service.getProfile('series-ld-1');
    expect(profile.seriesId).toBe('series-ld-1');
    expect(profile.presetName).toBe('tankobon_flatbed_scanner');
    expect(profile.k1).toBe(-0.015);
    expect(profile.k2).toBe(0.002);
    expect(profile.redShift).toBe(0.004);
    expect(profile.blueShift).toBe(-0.004);
    expect(profile.scale).toBe(1.00);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-ld',
      presetName: 'aged_lens_barrel',
      k1: -0.99, // clamp to -0.20
      k2: 0.50, // clamp to 0.05
      redShift: 0.20, // clamp to 0.05
      blueShift: -0.20, // clamp to -0.05
      scale: 2.0, // clamp to 1.20
    });

    expect(updated.k1).toBe(-0.20);
    expect(updated.k2).toBe(0.05);
    expect(updated.redShift).toBe(0.05);
    expect(updated.blueShift).toBe(-0.05);
    expect(updated.scale).toBe(1.20);
    expect(updated.presetName).toBe('aged_lens_barrel');

    const fetched = service.getProfile('series-clamped-ld');
    expect(fetched.k1).toBe(-0.20);
    expect(fetched.scale).toBe(1.20);
  });

  it('evaluates Brown-Conrady radial distortion without square roots', () => {
    // Center point (0.50, 0.50): distance is 0, so distortion factor is exactly 1.0
    const centerRes = calculateLensDistortion(0.50, 0.50, -0.015, 0.002, 0.004, -0.004, 0.50, 0.50, 1.00, true);
    expect(centerRes.distortionFactor).toBe(1.0);
    expect(centerRes.correctedX).toBe(0.50);
    expect(centerRes.correctedY).toBe(0.50);
    expect(centerRes.redOffsetX).toBe(0.0);
    expect(centerRes.blueOffsetX).toBe(0.0);

    // Edge corner point (1.0, 1.0)
    const cornerRes = calculateLensDistortion(1.0, 1.0, -0.015, 0.002, 0.004, -0.004, 0.50, 0.50, 1.00, true);
    expect(cornerRes.distortionFactor).toBeLessThan(1.0); // barrel compression
    expect(cornerRes.redOffsetX).toBeGreaterThanOrEqual(0.0);
    expect(cornerRes.blueOffsetX).toBeLessThanOrEqual(0.0);
  });

  it('handles disabled state returning untouched pass-through coordinates', () => {
    const disabledRes = calculateLensDistortion(0.85, 0.25, -0.015, 0.002, 0.004, -0.004, 0.50, 0.50, 1.00, false);
    expect(disabledRes.correctedX).toBe(0.85);
    expect(disabledRes.correctedY).toBe(0.25);
    expect(disabledRes.distortionFactor).toBe(1.0);
    expect(disabledRes.redOffsetX).toBe(0.0);
    expect(disabledRes.blueOffsetX).toBe(0.0);
  });

  it('quantizes chromatic shifts to quarter-pixel increments Q=4', () => {
    const res = calculateLensDistortion(0.90, 0.90, -0.035, 0.005, 0.008, -0.008, 0.50, 0.50, 1.00, true);
    // Any offset should be an exact multiple of 0.25
    expect(res.redOffsetX % 0.25).toBe(0);
    expect(res.redOffsetY % 0.25).toBe(0);
    expect(res.blueOffsetX % 0.25).toBe(0);
    expect(res.blueOffsetY % 0.25).toBe(0);
  });
});
