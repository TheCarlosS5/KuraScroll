import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  InkSplatterService,
  INK_SPLATTER_PRESETS,
} from '../../../../src/backend/services/ink-splatter-service.js';

describe('InkSplatterService', () => {
  let db: DatabaseInstance;
  let service: InkSplatterService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new InkSplatterService(db);
  });

  it('returns default shonen_impact_burst profile for non-persisted series', () => {
    const profile = service.getProfile('series-test-is-1');
    expect(profile.seriesId).toBe('series-test-is-1');
    expect(profile.presetName).toBe('shonen_impact_burst');
    expect(profile.strokeVelocity).toBe(750.0);
    expect(profile.bleedRadiusPx).toBe(1.8);
    expect(profile.splatterDensity).toBe(0.70);
    expect(profile.wickingRate).toBe(0.55);
    expect(profile.isEnabled).toBe(true);
  });

  it('saves and updates profile with clamping guards', () => {
    const saved = service.setProfile({
      seriesId: 'series-custom-is-1',
      presetName: 'vintage_gpen_newsprint',
      strokeVelocity: 2500.0, // exceeds 1000.0 -> clamped
      bleedRadiusPx: 12.0, // exceeds 5.0 -> clamped
      splatterDensity: -0.5, // below 0.0 -> clamped
      wickingRate: 1.5, // exceeds 1.0 -> clamped
      isEnabled: true,
    });

    expect(saved.seriesId).toBe('series-custom-is-1');
    expect(saved.presetName).toBe('vintage_gpen_newsprint');
    expect(saved.strokeVelocity).toBe(1000.0);
    expect(saved.bleedRadiusPx).toBe(5.0);
    expect(saved.splatterDensity).toBe(0.0);
    expect(saved.wickingRate).toBe(1.0);

    const fetched = service.getProfile('series-custom-is-1');
    expect(fetched.presetName).toBe('vintage_gpen_newsprint');
  });

  it('applies preset accurately across canonical configurations', () => {
    const p1 = service.applyPreset('series-preset-is', 'deluxe_bristol_clean');
    expect(p1.presetName).toBe('deluxe_bristol_clean');
    expect(p1.strokeVelocity).toBe(300.0);
    expect(p1.bleedRadiusPx).toBe(0.4);
    expect(p1.splatterDensity).toBe(0.10);
    expect(p1.isEnabled).toBe(true);

    const p2 = service.applyPreset('series-preset-is', 'dramatic_blood_splatter');
    expect(p2.presetName).toBe('dramatic_blood_splatter');
    expect(p2.strokeVelocity).toBe(950.0);
    expect(p2.splatterDensity).toBe(0.90);

    const p3 = service.applyPreset('series-preset-is', 'raw_fixed');
    expect(p3.presetName).toBe('raw_fixed');
    expect(p3.isEnabled).toBe(false);
  });

  it('deletes and lists profiles properly', () => {
    service.setProfile({ seriesId: 'series-is-del-1' });
    service.setProfile({ seriesId: 'series-is-del-2' });

    let list = service.listProfiles();
    expect(list.length).toBe(2);

    const deleted = service.deleteProfile('series-is-del-1');
    expect(deleted).toBe(true);

    list = service.listProfiles();
    expect(list.length).toBe(1);
    expect(list[0].seriesId).toBe('series-is-del-2');
  });

  it('generates zero directional droplets when velocity is 0 (static drop)', () => {
    const res = service.evaluateSplatter(100, 100, 0, 0, {
      bleedRadiusPx: 1.5,
      splatterDensity: 0.5,
      wickingRate: 0.4,
      isEnabled: true,
    });

    expect(res.dropletCount).toBe(0);
    expect(res.effectiveBleed).toBeGreaterThan(1.5);
    expect(res.isSuppressed).toBe(false);
  });

  it('ejects directional micro-droplets on high-velocity stroke', () => {
    const res = service.evaluateSplatter(200, 200, Math.PI / 4, 800.0, {
      bleedRadiusPx: 2.0,
      splatterDensity: 0.8,
      wickingRate: 0.6,
      isEnabled: true,
    });

    expect(res.dropletCount).toBeGreaterThan(0);
    expect(res.droplets.length).toBeGreaterThan(0);
    expect(res.droplets[0].x).toBeDefined();
    expect(res.droplets[0].y).toBeDefined();
    expect(res.droplets[0].radius).toBeGreaterThan(0);
    expect(res.isSuppressed).toBe(false);
    expect(res.latencyUs).toBeLessThan(500.0);
  });

  it('bypasses synthesis when isEnabled is false', () => {
    const res = service.evaluateSplatter(50, 50, 0, 500.0, {
      isEnabled: false,
    });

    expect(res.dropletCount).toBe(0);
    expect(res.effectiveBleed).toBe(0.0);
    expect(res.isSuppressed).toBe(true);
  });
});
