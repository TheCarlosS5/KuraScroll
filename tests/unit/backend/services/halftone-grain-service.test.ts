import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  HalftoneGrainService,
  calculateHalftoneGrain,
  HALFTONE_GRAIN_PRESETS,
} from '../../../../src/backend/services/halftone-grain-service.js';

describe('HalftoneGrainService', () => {
  let db: DatabaseInstance;
  let service: HalftoneGrainService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new HalftoneGrainService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-grain-1');
    expect(profile.seriesId).toBe('series-grain-1');
    expect(profile.grainMode).toBe('shonen_jump_pulp');
    expect(profile.stippleDensity).toBe(0.16);
    expect(profile.grainOpacity).toBe(0.055);
    expect(profile.particleRadiusPx).toBe(0.8);
    expect(profile.paperTintHex).toBe('#FAF6EE');
    expect(profile.blendMode).toBe('multiply');
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-grain',
      grainMode: 'doujin_matte_offset',
      stippleDensity: 0.99, // Should clamp to 0.40
      grainOpacity: 0.85, // Should clamp to 0.20
      particleRadiusPx: 10.0, // Should clamp to 2.0
      blendMode: 'darken',
    });

    expect(updated.stippleDensity).toBe(0.4);
    expect(updated.grainOpacity).toBe(0.2);
    expect(updated.particleRadiusPx).toBe(2.0);
    expect(updated.blendMode).toBe('darken');

    const fetched = service.getProfile('series-clamped-grain');
    expect(fetched.stippleDensity).toBe(0.4);
    expect(fetched.grainOpacity).toBe(0.2);
  });

  it('evaluates calculateHalftoneGrain with zero-allocation performance', () => {
    const res = calculateHalftoneGrain(
      0.18,
      0.065,
      0.9,
      1337,
      'shonen_jump_pulp',
      '#FAF3E0',
      'multiply',
      true
    );

    expect(res.grainMode).toBe('shonen_jump_pulp');
    expect(res.stippleDensity).toBe(0.18);
    expect(res.grainOpacity).toBe(0.065);
    expect(res.cssBackgroundRepeat).toBe('repeat');
    expect(res.cssMixBlendMode).toBe('multiply');
    expect(res.estimatedMemoryKiB).toBe(16);
  });

  it('evaluates disabled state cleanly without background repeat', () => {
    const res = calculateHalftoneGrain(0.18, 0.065, 0.9, 1337, 'shonen_jump_pulp', '#FAF3E0', 'multiply', false);
    expect(res.stippleDensity).toBe(0);
    expect(res.grainOpacity).toBe(0);
    expect(res.cssBackgroundRepeat).toBe('no-repeat');
    expect(res.cssMixBlendMode).toBe('normal');
  });

  it('contains valid predefined halftone presets', () => {
    const presets = Object.keys(HALFTONE_GRAIN_PRESETS);
    expect(presets).toContain('shonen_jump_pulp');
    expect(presets).toContain('tankobon_newsprint');
    expect(presets).toContain('doujin_matte_offset');
    expect(presets).toContain('archival_acid_free');

    expect(HALFTONE_GRAIN_PRESETS.shonen_jump_pulp.stippleDensity).toBe(0.18);
    expect(HALFTONE_GRAIN_PRESETS.archival_acid_free.grainOpacity).toBe(0.025);
  });

  it('generates consistent MD5 ETags for caching', () => {
    const profile = service.getProfile('series-etag-grain');
    const etag1 = service.generateETag(profile);
    const etag2 = service.generateETag(profile);
    expect(etag1).toBe(etag2);
    expect(etag1).toHaveLength(32);
  });
});
