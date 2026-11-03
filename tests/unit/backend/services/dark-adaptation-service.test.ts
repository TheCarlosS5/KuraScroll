import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  DarkAdaptationService,
  calculateDarkAdaptation,
  DARK_ADAPTATION_PRESETS,
} from '../../../../src/backend/services/dark-adaptation-service.js';

describe('DarkAdaptationService', () => {
  let db: DatabaseInstance;
  let service: DarkAdaptationService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new DarkAdaptationService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-da-1');
    expect(profile.seriesId).toBe('series-da-1');
    expect(profile.presetName).toBe('midnight_reader');
    expect(profile.tauDarkMs).toBe(1800);
    expect(profile.tauBrightMs).toBe(450);
    expect(profile.comfortLuminance).toBe(0.22);
    expect(profile.glareThreshold).toBe(0.70);
    expect(profile.baseWhitePoint).toBe(0.92);
    expect(profile.glareAttenuation).toBe(0.35);
    expect(profile.contrastBase).toBe(1.05);
    expect(profile.contrastCompensation).toBe(0.20);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-da',
      presetName: 'night_shonen',
      tauDarkMs: 8000, // clamp to 5000
      tauBrightMs: 50, // clamp to 100
      comfortLuminance: 0.99, // clamp to 0.80
      glareThreshold: 0.20, // clamp to 0.40
      baseWhitePoint: 1.5, // clamp to 1.0
      glareAttenuation: 0.95, // clamp to 0.80
      contrastBase: 2.0, // clamp to 1.50
      contrastCompensation: 0.90, // clamp to 0.50
    });

    expect(updated.tauDarkMs).toBe(5000);
    expect(updated.tauBrightMs).toBe(100);
    expect(updated.comfortLuminance).toBe(0.80);
    expect(updated.glareThreshold).toBe(0.40);
    expect(updated.baseWhitePoint).toBe(1.0);
    expect(updated.glareAttenuation).toBe(0.80);
    expect(updated.contrastBase).toBe(1.50);
    expect(updated.contrastCompensation).toBe(0.50);
    expect(updated.presetName).toBe('night_shonen');

    const fetched = service.getProfile('series-clamped-da');
    expect(fetched.tauDarkMs).toBe(5000);
    expect(fetched.comfortLuminance).toBe(0.80);
  });

  it('calculates zero-allocation dark adaptation and glare suppression accurately', () => {
    // 1. Sudden flash of light (dark to bright: 0.10 -> 0.95)
    const flash = calculateDarkAdaptation(0.95, 0.10, 16.67, 1800, 450, 0.22, 0.70, 0.92, 0.35);
    expect(flash.adaptedLuminance).toBeGreaterThan(0.10);
    expect(flash.adaptedLuminance).toBeLessThan(0.95);
    expect(flash.whitePoint).toBeLessThanOrEqual(0.92);
    expect(flash.contrast).toBeGreaterThanOrEqual(0.80);
    expect(flash.effectiveBrightness).toBeGreaterThanOrEqual(0.50);

    // 2. Disabled mode returns 1:1 pass-through
    const disabled = calculateDarkAdaptation(
      0.95,
      0.10,
      16.67,
      1800,
      450,
      0.22,
      0.70,
      0.92,
      0.35,
      1.05,
      0.20,
      false
    );
    expect(disabled.adaptedLuminance).toBe(0.95);
    expect(disabled.whitePoint).toBe(1.0);
    expect(disabled.contrast).toBe(1.0);
  });

  it('contains valid presets across all dark reading modes', () => {
    const presetKeys = Object.keys(DARK_ADAPTATION_PRESETS);
    expect(presetKeys).toContain('midnight_reader');
    expect(presetKeys).toContain('night_shonen');
    expect(presetKeys).toContain('daylight_crisp');
    expect(presetKeys).toContain('paper_sepia');

    for (const key of presetKeys) {
      const preset = DARK_ADAPTATION_PRESETS[key as keyof typeof DARK_ADAPTATION_PRESETS];
      expect(preset.tauDarkMs).toBeGreaterThanOrEqual(500);
      expect(preset.tauBrightMs).toBeGreaterThanOrEqual(100);
      expect(preset.glareThreshold).toBeGreaterThanOrEqual(0.40);
    }
  });

  it('generates consistent ETags for cache validation', () => {
    const p1 = service.getProfile('series-etag-da');
    const tag1 = service.generateETag(p1);
    const tag2 = service.generateETag(p1);
    expect(tag1).toBe(tag2);

    const updated = service.upsertProfile({
      seriesId: 'series-etag-da',
      presetName: 'paper_sepia',
    });
    const tag3 = service.generateETag(updated);
    expect(tag1).not.toBe(tag3);
  });
});
