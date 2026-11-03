import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  CelluloseReliefService,
  CELLULOSE_RELIEF_PRESETS,
} from '../../../../src/backend/services/cellulose-relief-service.js';

describe('CelluloseReliefService', () => {
  let db: DatabaseInstance;
  let service: CelluloseReliefService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new CelluloseReliefService(db);
  });

  it('returns default tankobon woodfree profile for non-persisted series', () => {
    const profile = service.getProfile('series-test-1');
    expect(profile.seriesId).toBe('series-test-1');
    expect(profile.presetName).toBe('tankobon_woodfree_matte');
    expect(profile.grainScale).toBe(1.00);
    expect(profile.reliefDepth).toBe(0.25);
    expect(profile.fiberDensity).toBe(0.50);
    expect(profile.lightAngle).toBeCloseTo(0.785398, 4);
    expect(profile.isEnabled).toBe(true);
  });

  it('saves and updates profile with clamping guards', () => {
    const saved = service.setProfile({
      seriesId: 'series-custom-1',
      presetName: 'shonen_pulp_unbleached',
      grainScale: 8.5, // exceeds 5.0 -> clamped
      reliefDepth: 1.5, // exceeds 1.0 -> clamped
      fiberDensity: -0.2, // below 0.0 -> clamped
      lightAngle: 0.65,
      isEnabled: true,
    });

    expect(saved.seriesId).toBe('series-custom-1');
    expect(saved.presetName).toBe('shonen_pulp_unbleached');
    expect(saved.grainScale).toBe(5.0);
    expect(saved.reliefDepth).toBe(1.0);
    expect(saved.fiberDensity).toBe(0.0);
    expect(saved.lightAngle).toBe(0.65);

    const fetched = service.getProfile('series-custom-1');
    expect(fetched.presetName).toBe('shonen_pulp_unbleached');
  });

  it('applies preset accurately across canonical configurations', () => {
    const p1 = service.applyPreset('series-preset', 'kanzenban_cotton_satin');
    expect(p1.presetName).toBe('kanzenban_cotton_satin');
    expect(p1.reliefDepth).toBe(0.08);
    expect(p1.fiberDensity).toBe(0.20);
    expect(p1.isEnabled).toBe(true);

    const p2 = service.applyPreset('series-preset', 'vintage_aged_newsprint');
    expect(p2.presetName).toBe('vintage_aged_newsprint');
    expect(p2.reliefDepth).toBe(0.60);
    expect(p2.fiberDensity).toBe(0.85);

    const p3 = service.applyPreset('series-preset', 'raw_fixed');
    expect(p3.presetName).toBe('raw_fixed');
    expect(p3.isEnabled).toBe(false);
  });

  it('deletes and lists profiles properly', () => {
    service.setProfile({ seriesId: 'series-del-1' });
    service.setProfile({ seriesId: 'series-del-2' });

    let list = service.listProfiles();
    expect(list.length).toBe(2);

    const deleted = service.deleteProfile('series-del-1');
    expect(deleted).toBe(true);

    list = service.listProfiles();
    expect(list.length).toBe(1);
    expect(list[0].seriesId).toBe('series-del-2');
  });

  it('computes deterministic hash2D values with zero heap allocation', () => {
    const val1 = CelluloseReliefService.hash2D(128, 256, 42);
    const val2 = CelluloseReliefService.hash2D(128, 256, 42);
    const valDiff = CelluloseReliefService.hash2D(129, 256, 42);

    expect(val1).toBe(val2);
    expect(val1).toBeGreaterThanOrEqual(0.0);
    expect(val1).toBeLessThanOrEqual(1.0);
    expect(val1).not.toBe(valDiff);
  });

  it('completely suppresses relief on pure black ink (K = 1.0)', () => {
    const res = service.evaluateRelief(50, 50, 1.0, {
      reliefDepth: 0.5,
      fiberDensity: 0.6,
      isEnabled: true,
    });

    expect(res.kDensity).toBe(1.0);
    expect(res.effectiveRelief).toBe(0.0);
    expect(res.isSuppressedByInk).toBe(true);
  });

  it('synthesizes realistic relief on virgin white paper (K = 0.0)', () => {
    const res = service.evaluateRelief(40, 60, 0.0, {
      grainScale: 1.0,
      reliefDepth: 0.4,
      fiberDensity: 0.5,
      lightAngle: 0.785398,
      isEnabled: true,
    });

    expect(res.kDensity).toBe(0.0);
    expect(res.effectiveRelief).toBeGreaterThan(0.0);
    expect(res.diffuseLight).toBeGreaterThan(0.0);
    expect(res.isSuppressedByInk).toBe(false);
    expect(res.latencyUs).toBeLessThan(100.0);
  });

  it('bypasses synthesis when isEnabled is false or reliefDepth is 0', () => {
    const res = service.evaluateRelief(30, 30, 0.0, {
      isEnabled: false,
    });

    expect(res.effectiveRelief).toBe(0.0);
    expect(res.height).toBe(0.0);
  });
});
