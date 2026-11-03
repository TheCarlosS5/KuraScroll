import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  ADRToneService,
  calculateADRTone,
  ADR_TONE_PRESETS,
} from '../../../../src/backend/services/adr-tone-service.js';

describe('ADRToneService', () => {
  let db: DatabaseInstance;
  let service: ADRToneService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new ADRToneService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-adr-1');
    expect(profile.seriesId).toBe('series-adr-1');
    expect(profile.presetName).toBe('berserk_night_recovery');
    expect(profile.shadowLift).toBe(0.55);
    expect(profile.gamma).toBe(1.25);
    expect(profile.shoulderClamp).toBe(0.95);
    expect(profile.whitePoint).toBe(1.00);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-adr',
      presetName: 'shonen_deep_black',
      shadowLift: 2.0, // clamp to 1.0
      gamma: 5.0, // clamp to 3.0
      shoulderClamp: 0.2, // clamp to 0.50
      whitePoint: 1.5, // clamp to 1.0
    });

    expect(updated.shadowLift).toBe(1.0);
    expect(updated.gamma).toBe(3.0);
    expect(updated.shoulderClamp).toBe(0.50);
    expect(updated.whitePoint).toBe(1.0);
    expect(updated.presetName).toBe('shonen_deep_black');

    const fetched = service.getProfile('series-clamped-adr');
    expect(fetched.shadowLift).toBe(1.0);
    expect(fetched.gamma).toBe(3.0);
  });

  it('calculates zero-allocation tone mapping preserving true black at 0', () => {
    // Pure black (0) should stay 0
    const blackRes = calculateADRTone(0, 0.55, 1.25, 0.95, 1.00, true);
    expect(blackRes.outLuminance).toBe(0);
    expect(blackRes.liftDelta).toBe(0);

    // Dark crushed shadow (e.g. 25/255 ~ 10% luminance) should be lifted
    const shadowRes = calculateADRTone(25, 0.55, 1.25, 0.95, 1.00, true);
    expect(shadowRes.outLuminance).toBeGreaterThan(25);
    expect(shadowRes.liftDelta).toBeGreaterThan(0);

    // Pure white (255) clamped by shoulder
    const whiteRes = calculateADRTone(255, 0.55, 1.25, 0.95, 1.00, true);
    expect(whiteRes.outLuminance).toBeLessThanOrEqual(255);
    expect(whiteRes.outLuminance).toBeGreaterThan(200);
  });

  it('guarantees strict mathematical monotonicity without gradient inversion', () => {
    let prevOut = -1;
    for (let lum = 0; lum <= 255; lum += 5) {
      const res = calculateADRTone(lum, 0.55, 1.25, 0.95, 1.00, true);
      expect(res.outLuminance).toBeGreaterThanOrEqual(prevOut);
      prevOut = res.outLuminance;
    }
  });

  it('handles disabled state as pure neutral pass-through', () => {
    const disabled = calculateADRTone(120, 0.55, 1.25, 0.95, 1.00, false);
    expect(disabled.outLuminance).toBe(120);
    expect(disabled.liftDelta).toBe(0);
  });

  it('generates consistent ETags and handles cache clearing', () => {
    const profile = service.getProfile('series-etag-adr');
    const etag1 = service.generateETag(profile);
    const etag2 = service.generateETag(profile);
    expect(etag1).toBe(etag2);

    service.clearCache();
    const fetched = service.getProfile('series-etag-adr');
    expect(fetched.seriesId).toBe('series-etag-adr');
  });

  it('verifies all ADR tone presets are properly defined', () => {
    expect(Object.keys(ADR_TONE_PRESETS).length).toBe(5);
    for (const [key, preset] of Object.entries(ADR_TONE_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(preset.shadowLift).toBeGreaterThanOrEqual(0);
      expect(preset.gamma).toBeGreaterThan(0);
      expect(preset.shoulderClamp).toBeGreaterThan(0);
      expect(preset.whitePoint).toBeGreaterThan(0);
    }
  });
});
