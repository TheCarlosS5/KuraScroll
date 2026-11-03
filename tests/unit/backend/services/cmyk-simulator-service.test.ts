import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  CmykSimulatorService,
  calculateCmykSimulation,
  CMYK_SIMULATOR_PRESETS,
} from '../../../../src/backend/services/cmyk-simulator-service.js';

describe('CmykSimulatorService', () => {
  let db: DatabaseInstance;
  let service: CmykSimulatorService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new CmykSimulatorService(db);
  });

  it('returns default unpersisted profile with deterministic default parameters', () => {
    const profile = service.getProfile('series-cmyk-1');
    expect(profile.seriesId).toBe('series-cmyk-1');
    expect(profile.presetName).toBe('tankobon_four_color');
    expect(profile.tacLimit).toBe(2.80);
    expect(profile.dotGain).toBe(0.10);
    expect(profile.blackAbsorption).toBe(0.10);
    expect(profile.gamutCompression).toBe(0.15);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-cmyk',
      presetName: 'vintage_faded_pulp',
      tacLimit: 6.0, // clamp to 4.00
      dotGain: 0.99, // clamp to 0.50
      blackAbsorption: -0.10, // clamp to 0.0
      gamutCompression: 1.50, // clamp to 1.00
    });

    expect(updated.tacLimit).toBe(4.00);
    expect(updated.dotGain).toBe(0.50);
    expect(updated.blackAbsorption).toBe(0.0);
    expect(updated.gamutCompression).toBe(1.00);
    expect(updated.presetName).toBe('vintage_faded_pulp');

    const fetched = service.getProfile('series-clamped-cmyk');
    expect(fetched.tacLimit).toBe(4.00);
    expect(fetched.dotGain).toBe(0.50);
  });

  it('evaluates CMYK separation and reconstruction for pure colors', () => {
    // Pure Red (255, 0, 0) -> Cyan=0, Magenta=1, Yellow=1, Black=0 before dot gain
    const resRed = calculateCmykSimulation(255, 0, 0, 3.0, 0.0, 0.0, 0.0, true);
    expect(resRed.cyan).toBe(0);
    expect(resRed.magenta).toBe(1.0);
    expect(resRed.yellow).toBe(1.0);
    expect(resRed.black).toBe(0);
    expect(resRed.outR).toBe(255);
    expect(resRed.outG).toBe(0);
    expect(resRed.outB).toBe(0);
  });

  it('handles pure black protection branch without division by zero', () => {
    // Pure Black (0, 0, 0) -> K=1.0, C=M=Y=0
    const resBlack = calculateCmykSimulation(0, 0, 0, 2.80, 0.10, 0.10, 0.15, true);
    expect(resBlack.black).toBe(1.0);
    expect(resBlack.cyan).toBe(0);
    expect(resBlack.magenta).toBe(0);
    expect(resBlack.yellow).toBe(0);
    expect(resBlack.outR).toBe(0);
    expect(resBlack.outG).toBe(0);
    expect(resBlack.outB).toBe(0);
  });

  it('clamps Total Area Coverage (TAC) when exceeding limit', () => {
    // Dark brown/gray with high ink density
    const res = calculateCmykSimulation(30, 20, 20, 2.00, 0.20, 0.10, 0.10, true);
    expect(res.totalAreaCoverage).toBeLessThanOrEqual(2.00);
  });

  it('handles disabled state returning untouched pass-through RGB', () => {
    const disabledRes = calculateCmykSimulation(128, 64, 32, 2.80, 0.10, 0.10, 0.15, false);
    expect(disabledRes.outR).toBe(128);
    expect(disabledRes.outG).toBe(64);
    expect(disabledRes.outB).toBe(32);
    expect(disabledRes.isTacClamped).toBe(false);
  });

  it('returns all defined CMYK simulator presets', () => {
    const presets = service.getPresets();
    expect(presets.length).toBe(5);
    const names = presets.map((p) => p.name);
    expect(names).toContain('shonen_color_spread');
    expect(names).toContain('tankobon_four_color');
    expect(names).toContain('vintage_faded_pulp');
    expect(names).toContain('cyberpunk_cmyk_boost');
    expect(names).toContain('raw_fixed');
  });
});
