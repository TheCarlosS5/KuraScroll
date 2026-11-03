import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  MotionDeblurService,
  calculateMotionDeblur,
  MOTION_DEBLUR_PRESETS,
} from '../../../../src/backend/services/motion-deblur-service.js';

describe('MotionDeblurService', () => {
  let db: DatabaseInstance;
  let service: MotionDeblurService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new MotionDeblurService(db);
  });

  it('returns default profile for non-persisted series', () => {
    const profile = service.getProfile('series-md-1');
    expect(profile.seriesId).toBe('series-md-1');
    expect(profile.presetName).toBe('tn_slow_panel_compensation');
    expect(profile.kod).toBe(1.35);
    expect(profile.vHalf).toBe(650.0);
    expect(profile.maxDelta).toBe(45.0);
    expect(profile.gammaFall).toBe(1.30);
    expect(profile.gammaRise).toBe(1.00);
    expect(profile.isEnabled).toBe(true);
  });

  it('saves and retrieves updated profile accurately', () => {
    const updated = service.saveProfile('series-md-custom', {
      presetName: 'webtoon_high_speed_flick',
      kod: 2.1,
      maxDelta: 60.0,
    });

    expect(updated.presetName).toBe('webtoon_high_speed_flick');
    expect(updated.kod).toBe(2.1);
    expect(updated.maxDelta).toBe(60.0);

    const retrieved = service.getProfile('series-md-custom');
    expect(retrieved.presetName).toBe('webtoon_high_speed_flick');
    expect(retrieved.kod).toBe(2.1);
    expect(retrieved.maxDelta).toBe(60.0);
  });

  it('resets profile to defined preset values', () => {
    service.saveProfile('series-md-reset', { kod: 0.1 });
    const reset = service.resetToPreset('series-md-reset', 'extreme_ghosting_killer');

    expect(reset.presetName).toBe('extreme_ghosting_killer');
    expect(reset.kod).toBe(2.20);
    expect(reset.vHalf).toBe(400.0);
    expect(reset.maxDelta).toBe(75.0);
  });

  it('passes through exact luminance when velocity is zero (rest state)', () => {
    const res = calculateMotionDeblur(
      180,
      120,
      0, // velocity = 0
      1.35,
      650.0,
      45.0,
      1.30,
      1.00,
      true
    );

    expect(res.inL).toBe(180);
    expect(res.outL).toBe(180);
    expect(res.boost).toBe(0);
    expect(res.isOverdriven).toBe(false);
  });

  it('applies positive overdrive during high-speed brightening transition', () => {
    // Current is brighter than previous (120 -> 200 at 1200 px/s)
    const res = calculateMotionDeblur(
      200,
      120,
      1200,
      1.35,
      650.0,
      45.0,
      1.30,
      1.00,
      true
    );

    expect(res.boost).toBeGreaterThan(0);
    expect(res.outL).toBeGreaterThan(200);
    expect(res.isOverdriven).toBe(true);
    expect(res.latencyUs).toBeDefined();
  });

  it('applies negative overdrive during high-speed darkening transition', () => {
    // Current is darker than previous (200 -> 100 at 1200 px/s)
    const res = calculateMotionDeblur(
      100,
      200,
      1200,
      1.35,
      650.0,
      45.0,
      1.30,
      1.00,
      true
    );

    expect(res.boost).toBeLessThan(0);
    expect(res.outL).toBeLessThan(100);
    expect(res.isOverdriven).toBe(true);
  });

  it('protects pure black ink from positive overshoot halos', () => {
    // Target is pure black ink (inL = 0)
    const res = calculateMotionDeblur(
      0,
      100,
      1500,
      1.35,
      650.0,
      45.0,
      1.30,
      1.00,
      true
    );

    expect(res.outL).toBe(0);
  });

  it('bypasses calculation when isEnabled is false', () => {
    const res = calculateMotionDeblur(
      150,
      80,
      1500,
      1.35,
      650.0,
      45.0,
      1.30,
      1.00,
      false
    );

    expect(res.outL).toBe(150);
    expect(res.boost).toBe(0);
    expect(res.isOverdriven).toBe(false);
  });
});
