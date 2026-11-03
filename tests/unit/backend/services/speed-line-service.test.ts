import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  SpeedLineService,
  calculateSpeedLines,
  evaluateImpactPulse,
  hash2D,
  hashUnit,
  SPEED_LINE_PRESETS,
} from '../../../../src/backend/services/speed-line-service.js';

describe('SpeedLineService', () => {
  let db: DatabaseInstance;
  let service: SpeedLineService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new SpeedLineService(db);
  });

  it('returns default unpersisted profile with deterministic default parameters', () => {
    const profile = service.getProfile('series-sl-1');
    expect(profile.seriesId).toBe('series-sl-1');
    expect(profile.presetName).toBe('shonen_radial_climax');
    expect(profile.mode).toBe('radial');
    expect(profile.lineCount).toBe(72);
    expect(profile.focusX).toBe(0.50);
    expect(profile.focusY).toBe(0.50);
    expect(profile.angleJitter).toBe(0.035);
    expect(profile.minLengthRatio).toBe(0.25);
    expect(profile.maxLengthRatio).toBe(0.95);
    expect(profile.minWidthPx).toBe(0.70);
    expect(profile.maxWidthPx).toBe(2.00);
    expect(profile.pulseDurationMs).toBe(320);
    expect(profile.isEnabled).toBe(true);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-sl',
      presetName: 'explosion_burst',
      lineCount: 999, // clamp to 256
      focusX: 1.5, // clamp to 1.0
      focusY: -0.2, // clamp to 0.0
      angleJitter: 0.9, // clamp to 0.50
      minLengthRatio: 0.8,
      maxLengthRatio: 0.2, // min > max -> clamped
      minWidthPx: 20.0, // clamp to 10.0
      maxWidthPx: 0.05, // clamp
      pulseDurationMs: 5000, // clamp to 2000
    });

    expect(updated.lineCount).toBe(256);
    expect(updated.focusX).toBe(1.0);
    expect(updated.focusY).toBe(0.0);
    expect(updated.angleJitter).toBe(0.50);
    expect(updated.minWidthPx).toBe(10.0);
    expect(updated.maxWidthPx).toBe(10.0);
    expect(updated.pulseDurationMs).toBe(2000);

    const fetched = service.getProfile('series-clamped-sl');
    expect(fetched.lineCount).toBe(256);
    expect(fetched.presetName).toBe('explosion_burst');
  });

  it('computes deterministic pseudo-random unit numbers without allocations', () => {
    const val1 = hashUnit(10, 20, 1337);
    const val2 = hashUnit(10, 20, 1337);
    const val3 = hashUnit(10, 21, 1337);

    expect(val1).toBe(val2); // deterministic
    expect(val1).not.toBe(val3); // spatial variation
    expect(val1).toBeGreaterThanOrEqual(0.0);
    expect(val1).toBeLessThan(1.0);
  });

  it('synthesizes radial speed lines buffer correctly', () => {
    const buffer = calculateSpeedLines(
      'radial',
      72,
      0.50,
      0.50,
      0.035,
      0.25,
      0.95,
      0.70,
      2.00,
      1337,
      true
    );

    expect(buffer.count).toBe(72);
    expect(buffer.coordinates.length).toBeGreaterThanOrEqual(72 * 4);
    expect(buffer.widths.length).toBeGreaterThanOrEqual(72);
    expect(buffer.opacities.length).toBeGreaterThanOrEqual(72);

    // Verify first line coordinates are finite numbers
    expect(Number.isFinite(buffer.coordinates[0])).toBe(true);
    expect(Number.isFinite(buffer.coordinates[1])).toBe(true);
    expect(Number.isFinite(buffer.coordinates[2])).toBe(true);
    expect(Number.isFinite(buffer.coordinates[3])).toBe(true);
    expect(buffer.widths[0]).toBeGreaterThanOrEqual(0.70);
    expect(buffer.widths[0]).toBeLessThanOrEqual(2.00);
  });

  it('synthesizes parallel speed lines buffer correctly', () => {
    const buffer = calculateSpeedLines(
      'parallel',
      36,
      0.50,
      0.50,
      0.0,
      0.45,
      0.95,
      0.60,
      1.40,
      1337,
      true
    );

    expect(buffer.count).toBe(36);
    expect(buffer.widths[0]).toBeGreaterThanOrEqual(0.60);
    expect(buffer.widths[0]).toBeLessThanOrEqual(1.40);
  });

  it('handles disabled or raw_fixed mode cleanly with 0 lines', () => {
    const buffer = calculateSpeedLines(
      'none',
      0,
      0.50,
      0.50,
      0.0,
      0.0,
      0.0,
      0.10,
      0.10,
      1337,
      false
    );

    expect(buffer.count).toBe(0);
  });

  it('evaluates impact pulse kinetics in O(1) time', () => {
    const atStart = evaluateImpactPulse(0, 320, 1.0, 0.25);
    expect(atStart.isActive).toBe(true);
    expect(atStart.pulse).toBe(1.0);
    expect(atStart.intensity).toBe(2.0);

    const mid = evaluateImpactPulse(160, 320, 1.0, 0.25);
    expect(mid.isActive).toBe(true);
    expect(mid.pulse).toBeCloseTo(0.25, 2);

    const expired = evaluateImpactPulse(350, 320, 1.0, 0.25);
    expect(expired.isActive).toBe(false);
    expect(expired.pulse).toBe(0.0);
  });
});
