import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  VignetteApertureService,
  calculateVignetteAperture,
  VIGNETTE_APERTURE_PRESETS,
} from '../../../../src/backend/services/vignette-aperture-service.js';

describe('VignetteApertureService', () => {
  let db: DatabaseInstance;
  let service: VignetteApertureService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new VignetteApertureService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-vignette-1');
    expect(profile.seriesId).toBe('series-vignette-1');
    expect(profile.presetName).toBe('subtle_vignette');
    expect(profile.innerRadius).toBe(0.45);
    expect(profile.outerRadius).toBe(1.10);
    expect(profile.vignetteStrength).toBe(0.40);
    expect(profile.dofBlurFactor).toBe(0.35);
    expect(profile.focusXPct).toBe(50.0);
    expect(profile.focusYPct).toBe(50.0);
    expect(profile.aspectRatio).toBe(1.0);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-vignette',
      presetName: 'cinematic_macro',
      innerRadius: 1.5, // clamp to 1.0
      outerRadius: 3.5, // clamp to 2.5
      vignetteStrength: 2.0, // clamp to 1.0
      dofBlurFactor: 1.5, // clamp to 1.0
      focusXPct: 120.0, // clamp to 100.0
      focusYPct: -20.0, // clamp to 0.0
      aspectRatio: 10.0, // clamp to 5.0
    });

    expect(updated.innerRadius).toBe(1.0);
    expect(updated.outerRadius).toBe(2.5);
    expect(updated.vignetteStrength).toBe(1.0);
    expect(updated.dofBlurFactor).toBe(1.0);
    expect(updated.focusXPct).toBe(100.0);
    expect(updated.focusYPct).toBe(0.0);
    expect(updated.aspectRatio).toBe(5.0);
    expect(updated.presetName).toBe('cinematic_macro');

    const fetched = service.getProfile('series-clamped-vignette');
    expect(fetched.innerRadius).toBe(1.0);
    expect(fetched.outerRadius).toBe(2.5);
  });

  it('calculates zero-allocation vignette falloff and DoF contrast accurately', () => {
    // 1. Center of focus -> exactly 0 distance, 0 vignette alpha, 1.0 edge contrast
    const centerRes = calculateVignetteAperture(
      400,
      300,
      800,
      600,
      50.0,
      50.0,
      0.45,
      1.10,
      0.40,
      0.35,
      1.0,
      true
    );
    expect(centerRes.normalizedDistance).toBe(0);
    expect(centerRes.vignetteAlpha).toBe(0);
    expect(centerRes.edgeContrast).toBe(1.0);
    expect(centerRes.cssGradient).toContain('radial-gradient');

    // 2. Far peripheral edge -> non-zero distance, high vignette alpha, attenuated contrast
    const edgeRes = calculateVignetteAperture(
      800,
      600,
      800,
      600,
      50.0,
      50.0,
      0.45,
      1.10,
      0.40,
      0.35,
      1.0,
      true
    );
    expect(edgeRes.normalizedDistance).toBeGreaterThan(0.45);
    expect(edgeRes.vignetteAlpha).toBeGreaterThan(0);
    expect(edgeRes.edgeContrast).toBeLessThan(1.0);
  });

  it('handles disabled state as pure pass-through', () => {
    const disabled = calculateVignetteAperture(
      800,
      600,
      800,
      600,
      50.0,
      50.0,
      0.45,
      1.10,
      0.40,
      0.35,
      1.0,
      false
    );
    expect(disabled.normalizedDistance).toBe(0);
    expect(disabled.vignetteAlpha).toBe(0);
    expect(disabled.edgeContrast).toBe(1.0);
    expect(disabled.cssGradient).toBe('none');
  });

  it('generates consistent ETags and handles cache clearing', () => {
    const profile = service.getProfile('series-etag-vignette');
    const etag1 = service.generateETag(profile);
    const etag2 = service.generateETag(profile);
    expect(etag1).toBe(etag2);

    service.clearCache();
    const fetched = service.getProfile('series-etag-vignette');
    expect(fetched.seriesId).toBe('series-etag-vignette');
  });

  it('verifies all vignette aperture presets are properly defined', () => {
    expect(Object.keys(VIGNETTE_APERTURE_PRESETS).length).toBe(5);
    for (const [key, preset] of Object.entries(VIGNETTE_APERTURE_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(preset.innerRadius).toBeGreaterThanOrEqual(0);
      expect(preset.outerRadius).toBeGreaterThanOrEqual(preset.innerRadius);
      expect(preset.vignetteStrength).toBeGreaterThanOrEqual(0);
      expect(preset.dofBlurFactor).toBeGreaterThanOrEqual(0);
    }
  });
});
