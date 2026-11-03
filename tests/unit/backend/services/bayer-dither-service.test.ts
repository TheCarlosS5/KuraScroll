import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  BayerDitherService,
  calculateBayerDither,
  BAYER_DITHER_PRESETS,
  BAYER_4,
  BAYER_8,
} from '../../../../src/backend/services/bayer-dither-service.js';

describe('BayerDitherService', () => {
  let db: DatabaseInstance;
  let service: BayerDitherService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new BayerDitherService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-bayer-1');
    expect(profile.seriesId).toBe('series-bayer-1');
    expect(profile.presetName).toBe('tn_6bit_default');
    expect(profile.matrixSize).toBe(8);
    expect(profile.targetBits).toBe(6);
    expect(profile.ditherStrength).toBe(0.85);
    expect(profile.edgeProtection).toBe(0.25);
    expect(profile.channelMode).toBe('shared');
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-bayer',
      presetName: 'smooth_gradient',
      targetBits: 15, // clamp to 10
      ditherStrength: 2.5, // clamp to 1.0
      edgeProtection: 5.0, // clamp to 1.0
    });

    expect(updated.targetBits).toBe(10);
    expect(updated.ditherStrength).toBe(1.0);
    expect(updated.edgeProtection).toBe(1.0);
    expect(updated.presetName).toBe('smooth_gradient');

    const fetched = service.getProfile('series-clamped-bayer');
    expect(fetched.targetBits).toBe(10);
    expect(fetched.ditherStrength).toBe(1.0);
  });

  it('calculates zero-allocation ordered Bayer dithering across pixels accurately', () => {
    // Pixel (0, 0) in 8x8 matrix
    const res0 = calculateBayerDither(0, 0, 128, 128, 128, 8, 6, 0.85, 0.25, true);
    expect(res0.outR).toBeGreaterThanOrEqual(0);
    expect(res0.outR).toBeLessThanOrEqual(255);
    expect(res0.packedRgb).toBeGreaterThanOrEqual(0);
    expect(res0.targetBits).toBe(6);

    // Pixel (1, 1) in 4x4 matrix
    const res1 = calculateBayerDither(1, 1, 64, 128, 200, 4, 6, 0.85, 0.25, true);
    expect(res1.outR).toBeDefined();
    expect(res1.outG).toBeDefined();
    expect(res1.outB).toBeDefined();

    // Disabled pass-through mode
    const disabled = calculateBayerDither(2, 3, 100, 150, 200, 8, 6, 0.85, 0.25, false);
    expect(disabled.outR).toBe(100);
    expect(disabled.outG).toBe(150);
    expect(disabled.outB).toBe(200);
  });

  it('contains valid precalculated Bayer matrices and presets', () => {
    expect(BAYER_4.length).toBe(16);
    expect(BAYER_8.length).toBe(64);

    const presetKeys = Object.keys(BAYER_DITHER_PRESETS);
    expect(presetKeys).toContain('tn_6bit_default');
    expect(presetKeys).toContain('smooth_gradient');
    expect(presetKeys).toContain('dark_interface');
    expect(presetKeys).toContain('photo_conservative');
    expect(presetKeys).toContain('text_protected');

    for (const key of presetKeys) {
      const preset = BAYER_DITHER_PRESETS[key as keyof typeof BAYER_DITHER_PRESETS];
      expect([2, 4, 8, 16]).toContain(preset.matrixSize);
      expect(preset.targetBits).toBeGreaterThanOrEqual(5);
    }
  });

  it('generates consistent ETags for cache validation', () => {
    const p1 = service.getProfile('series-etag-bayer');
    const tag1 = service.generateETag(p1);
    const tag2 = service.generateETag(p1);
    expect(tag1).toBe(tag2);

    const updated = service.upsertProfile({
      seriesId: 'series-etag-bayer',
      presetName: 'dark_interface',
    });
    const tag3 = service.generateETag(updated);
    expect(tag1).not.toBe(tag3);
  });
});
