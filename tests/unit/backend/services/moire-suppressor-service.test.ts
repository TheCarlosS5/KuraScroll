import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  MoireSuppressorService,
  calculateMoireSuppression,
  MOIRE_SUPPRESSOR_PRESETS,
} from '../../../../src/backend/services/moire-suppressor-service.js';

describe('MoireSuppressorService', () => {
  let db: DatabaseInstance;
  let service: MoireSuppressorService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new MoireSuppressorService(db);
  });

  it('returns default unpersisted profile with deterministic default parameters', () => {
    const profile = service.getProfile('series-ms-1');
    expect(profile.seriesId).toBe('series-ms-1');
    expect(profile.presetName).toBe('manga_screentone_soften');
    expect(profile.suppressionStrength).toBe(0.45);
    expect(profile.deltaClamp).toBe(16.0);
    expect(profile.edgeThreshold).toBe(32.0);
    expect(profile.filterRadius).toBe(2);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-ms',
      presetName: 'newsprint_despeckle',
      suppressionStrength: 2.5, // clamp to 1.0
      deltaClamp: 120.0, // clamp to 64.0
      edgeThreshold: 2.0, // clamp to 5.0
      filterRadius: 10, // clamp to 5
    });

    expect(updated.suppressionStrength).toBe(1.0);
    expect(updated.deltaClamp).toBe(64.0);
    expect(updated.edgeThreshold).toBe(5.0);
    expect(updated.filterRadius).toBe(5);
    expect(updated.presetName).toBe('newsprint_despeckle');

    const fetched = service.getProfile('series-clamped-ms');
    expect(fetched.suppressionStrength).toBe(1.0);
    expect(fetched.deltaClamp).toBe(64.0);
  });

  it('evaluates moire suppression with smooth halftone de-aliasing', () => {
    // Halftone dot pixel (center=100, local average=140, no edge)
    const res = calculateMoireSuppression(100, 140, 0, 0, 0.6, 0.5, 16.0, 32.0, true);
    expect(res.originalLuminance).toBe(100);
    expect(res.isEdgeProtected).toBe(false);
    expect(res.edgeStrength).toBe(0);
    expect(res.appliedDelta).toBeGreaterThan(0);
    expect(res.filteredLuminance).toBeGreaterThan(100);
    expect(res.filteredLuminance).toBeLessThanOrEqual(100 + 16.0);
  });

  it('strictly protects sharp ink edges and line art', () => {
    // Sharp ink edge: dLdx = 50 >= edgeThreshold (32.0)
    const res = calculateMoireSuppression(20, 160, 50, 0, 0.8, 0.5, 16.0, 32.0, true);
    expect(res.isEdgeProtected).toBe(true);
    expect(res.appliedDelta).toBe(0);
    expect(res.filteredLuminance).toBe(20);
  });

  it('handles disabled state returning untouched pass-through luminance', () => {
    const disabledRes = calculateMoireSuppression(80, 150, 2, 2, 0.7, 0.5, 16.0, 32.0, false);
    expect(disabledRes.filteredLuminance).toBe(80);
    expect(disabledRes.appliedDelta).toBe(0);
  });

  it('returns all defined moire suppressor presets', () => {
    const presets = service.getPresets();
    expect(presets.length).toBe(5);
    const names = presets.map((p) => p.name);
    expect(names).toContain('manga_screentone_soften');
    expect(names).toContain('newsprint_despeckle');
    expect(names).toContain('dense_crosshatch_calm');
    expect(names).toContain('vintage_magazine_smooth');
    expect(names).toContain('raw_fixed');
  });
});
