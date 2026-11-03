import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  InkTrappingService,
  calculateInkTrapping,
  INK_TRAPPING_PRESETS,
} from '../../../../src/backend/services/ink-trapping-service.js';

describe('InkTrappingService', () => {
  let db: DatabaseInstance;
  let service: InkTrappingService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new InkTrappingService(db);
  });

  it('returns default profile for non-persisted series', () => {
    const profile = service.getProfile('series-it-1');
    expect(profile.seriesId).toBe('series-it-1');
    expect(profile.presetName).toBe('vintage_rotary_offset_80s');
    expect(profile.shiftCx).toBe(0.60);
    expect(profile.shiftCy).toBe(-0.40);
    expect(profile.shiftMx).toBe(-0.30);
    expect(profile.shiftMy).toBe(0.50);
    expect(profile.shiftYx).toBe(0.20);
    expect(profile.shiftYy).toBe(0.40);
    expect(profile.trapWidth).toBe(0.35);
    expect(profile.trapMode).toBe('auto');
    expect(profile.isEnabled).toBe(true);
  });

  it('saves and retrieves updated profile accurately', () => {
    const updated = service.saveProfile('series-it-custom', {
      presetName: 'misregistered_retro_fringe',
      shiftCx: 1.5,
      trapWidth: 0.8,
    });

    expect(updated.presetName).toBe('misregistered_retro_fringe');
    expect(updated.shiftCx).toBe(1.5);
    expect(updated.trapWidth).toBe(0.8);

    const retrieved = service.getProfile('series-it-custom');
    expect(retrieved.presetName).toBe('misregistered_retro_fringe');
    expect(retrieved.shiftCx).toBe(1.5);
    expect(retrieved.trapWidth).toBe(0.8);
  });

  it('resets profile to defined preset values', () => {
    service.saveProfile('series-it-reset', { trapWidth: 1.9 });
    const reset = service.resetToPreset('series-it-reset', 'modern_cmyk_tight');

    expect(reset.presetName).toBe('modern_cmyk_tight');
    expect(reset.shiftCx).toBe(0.05);
    expect(reset.trapWidth).toBe(0.10);
  });

  it('preserves exact colors when plate shifts are zero and edge is flat', () => {
    const res = calculateInkTrapping(
      200,
      100,
      50,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      'auto',
      0.15,
      true
    );

    expect(res.inR).toBe(200);
    expect(res.outR).toBe(200);
    expect(res.outG).toBe(100);
    expect(res.outB).toBe(50);
    expect(res.trapIntensity).toBe(0);
  });

  it('applies ink trapping dilation across high-contrast edge', () => {
    const res = calculateInkTrapping(
      180,
      60,
      40,
      0.8, // strong edge gradient
      0.5,
      0.60,
      -0.40,
      -0.30,
      0.50,
      0.20,
      0.40,
      0.0,
      0.0,
      0.35,
      'spread',
      0.15,
      true
    );

    expect(res.trapIntensity).toBeGreaterThan(0);
    expect(res.cEff).toBeGreaterThan(0);
    expect(res.latencyUs).toBeDefined();
  });

  it('bypasses calculation when isEnabled is false', () => {
    const res = calculateInkTrapping(
      150,
      120,
      90,
      0.9,
      0.9,
      1.0,
      1.0,
      1.0,
      1.0,
      1.0,
      1.0,
      0.0,
      0.0,
      0.5,
      'auto',
      0.15,
      false
    );

    expect(res.outR).toBe(150);
    expect(res.outG).toBe(120);
    expect(res.outB).toBe(90);
    expect(res.trapIntensity).toBe(0);
  });
});
