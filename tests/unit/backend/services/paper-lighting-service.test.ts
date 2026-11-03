import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  PaperLightingService,
  calculatePaperLighting,
  PAPER_LIGHTING_PRESETS,
} from '../../../../src/backend/services/paper-lighting-service.js';

describe('PaperLightingService', () => {
  let db: DatabaseInstance;
  let service: PaperLightingService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new PaperLightingService(db);
  });

  it('returns default profile for non-persisted series', () => {
    const profile = service.getProfile('series-pl-1');
    expect(profile.seriesId).toBe('series-pl-1');
    expect(profile.presetName).toBe('tankobon_deluxe_matte');
    expect(profile.lightX).toBe(0.50);
    expect(profile.lightY).toBe(0.30);
    expect(profile.lightZ).toBe(1.20);
    expect(profile.diffuseKd).toBe(0.85);
    expect(profile.specularKs).toBe(0.12);
    expect(profile.roughness).toBe(0.45);
    expect(profile.inkAbsorption).toBe(0.85);
    expect(profile.ambientKa).toBe(0.20);
    expect(profile.isEnabled).toBe(true);
  });

  it('saves and retrieves updated profile accurately', () => {
    const updated = service.saveProfile('series-pl-custom', {
      presetName: 'doujinshi_satin',
      specularKs: 0.25,
      roughness: 0.20,
    });

    expect(updated.presetName).toBe('doujinshi_satin');
    expect(updated.specularKs).toBe(0.25);
    expect(updated.roughness).toBe(0.20);

    const retrieved = service.getProfile('series-pl-custom');
    expect(retrieved.presetName).toBe('doujinshi_satin');
    expect(retrieved.specularKs).toBe(0.25);
    expect(retrieved.roughness).toBe(0.20);
  });

  it('resets profile to defined preset values', () => {
    service.saveProfile('series-pl-reset', { specularKs: 0.99 });
    const reset = service.resetToPreset('series-pl-reset', 'shonen_pulp_newsprint');

    expect(reset.presetName).toBe('shonen_pulp_newsprint');
    expect(reset.specularKs).toBe(0.05);
    expect(reset.roughness).toBe(0.70);
    expect(reset.inkAbsorption).toBe(0.92);
  });

  it('calculates lighting on white paper with specular sheen', () => {
    const res = calculatePaperLighting(
      0.50,
      0.30,
      255,
      255,
      255,
      0.50,
      0.30,
      1.20,
      0.85,
      0.12,
      0.45,
      0.85,
      0.20,
      true
    );

    expect(res.inR).toBe(255);
    expect(res.diffuseIntensity).toBeGreaterThan(0);
    expect(res.specularIntensity).toBeGreaterThan(0);
    expect(res.inkGuard).toBeGreaterThan(0.9);
    expect(res.outR).toBeGreaterThanOrEqual(200);
  });

  it('suppresses specular reflection on pure black ink', () => {
    const res = calculatePaperLighting(
      0.50,
      0.30,
      0,
      0,
      0,
      0.50,
      0.30,
      1.20,
      0.85,
      0.12,
      0.45,
      0.85,
      0.20,
      true
    );

    expect(res.inR).toBe(0);
    expect(res.inkGuard).toBeLessThanOrEqual(0.20);
    expect(res.outR).toBeLessThanOrEqual(5);
  });

  it('bypasses calculation when isEnabled is false', () => {
    const res = calculatePaperLighting(
      0.50,
      0.50,
      128,
      128,
      128,
      0.50,
      0.30,
      1.20,
      0.85,
      0.12,
      0.45,
      0.85,
      0.20,
      false
    );

    expect(res.outR).toBe(128);
    expect(res.outG).toBe(128);
    expect(res.outB).toBe(128);
    expect(res.specularIntensity).toBe(0);
  });
});
