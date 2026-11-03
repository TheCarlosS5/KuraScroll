import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  UnsharpMaskService,
  calculateUnsharpMask,
  UNSHARP_MASK_PRESETS,
} from '../../../../src/backend/services/unsharp-mask-service.js';

describe('UnsharpMaskService', () => {
  let db: DatabaseInstance;
  let service: UnsharpMaskService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new UnsharpMaskService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-unsharp-1');
    expect(profile.seriesId).toBe('series-unsharp-1');
    expect(profile.presetName).toBe('webtoon_ribbon_crisp');
    expect(profile.sharpness).toBe(0.85);
    expect(profile.edgeThreshold).toBe(12.0);
    expect(profile.haloClamp).toBe(0.05);
    expect(profile.maxWeight).toBe(0.35);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-unsharp',
      presetName: 'furigana_edge_guard',
      sharpness: 5.0, // clamp to 2.0
      edgeThreshold: 300.0, // clamp to 255.0
      haloClamp: 1.0, // clamp to 0.50
      maxWeight: 1.0, // clamp to 0.50
    });

    expect(updated.sharpness).toBe(2.0);
    expect(updated.edgeThreshold).toBe(255.0);
    expect(updated.haloClamp).toBe(0.50);
    expect(updated.maxWeight).toBe(0.50);
    expect(updated.presetName).toBe('furigana_edge_guard');

    const fetched = service.getProfile('series-clamped-unsharp');
    expect(fetched.sharpness).toBe(2.0);
    expect(fetched.haloClamp).toBe(0.50);
  });

  it('calculates zero-allocation 5-point unsharp mask accurately on distinct edge features', () => {
    // 1. High contrast step edge (black ink line C=30, white paper N=220, S=220, E=30, W=30)
    const edgeRes = calculateUnsharpMask(30, 220, 220, 30, 30, 0.85, 12.0, 0.05, 0.35, true);
    expect(edgeRes.contrast).toBe(190);
    expect(edgeRes.weight).toBeGreaterThan(0);
    expect(edgeRes.weight).toBeLessThanOrEqual(0.35);
    expect(edgeRes.outValue).toBeGreaterThanOrEqual(0);
    expect(edgeRes.outValue).toBeLessThanOrEqual(255);

    // 2. Flat zone below edgeThreshold (noise filtering)
    const flatRes = calculateUnsharpMask(100, 102, 101, 100, 103, 0.85, 12.0, 0.05, 0.35, true);
    expect(flatRes.contrast).toBeLessThan(12.0);
    expect(flatRes.weight).toBe(0.0);
    expect(flatRes.outValue).toBe(100); // Unaltered pass-through
  });

  it('activates anti-halo clamp when pixel overshoots local neighborhood', () => {
    // Extreme center spike that would ring
    const res = calculateUnsharpMask(10, 240, 240, 240, 240, 2.0, 5.0, 0.02, 0.50, true);
    expect(res.haloSuppressed).toBe(true);
    expect(res.outValue).toBeGreaterThanOrEqual(10);
  });

  it('handles disabled state as pure neutral pass-through', () => {
    const disabled = calculateUnsharpMask(150, 50, 50, 50, 50, 0.85, 12.0, 0.05, 0.35, false);
    expect(disabled.outValue).toBe(150);
    expect(disabled.weight).toBe(0.0);
  });

  it('generates consistent ETags and handles cache clearing', () => {
    const profile = service.getProfile('series-etag-unsharp');
    const etag1 = service.generateETag(profile);
    const etag2 = service.generateETag(profile);
    expect(etag1).toBe(etag2);

    service.clearCache();
    const fetched = service.getProfile('series-etag-unsharp');
    expect(fetched.seriesId).toBe('series-etag-unsharp');
  });

  it('verifies all unsharp mask presets are properly defined', () => {
    expect(Object.keys(UNSHARP_MASK_PRESETS).length).toBe(5);
    for (const [key, preset] of Object.entries(UNSHARP_MASK_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(preset.sharpness).toBeGreaterThanOrEqual(0);
      expect(preset.edgeThreshold).toBeGreaterThanOrEqual(0);
      expect(preset.haloClamp).toBeGreaterThanOrEqual(0);
      expect(preset.maxWeight).toBeGreaterThanOrEqual(0);
    }
  });
});
