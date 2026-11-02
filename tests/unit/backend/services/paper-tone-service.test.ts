import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  PaperToneService,
  VALID_PRESETS,
} from '../../../../src/backend/services/paper-tone-service.js';

describe('PaperToneService (Sprint 64)', () => {
  let db: DatabaseInstance;
  let service: PaperToneService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES 
        ('ser-chainsaw', 'chainsaw-man', 'Chainsaw Man', 'manga', 'ongoing'),
        ('ser-jujutsu', 'jujutsu-kaisen', 'Jujutsu Kaisen', 'manga', 'completed')
    `).run();

    service = new PaperToneService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('sanitizes input parameters and bounds out-of-range values', () => {
    const sanitized = PaperToneService.sanitizeParams({
      preset: 'INVALID_PRESET_XYZ',
      warmth: 5.5, // Exceeds 1.0
      contrast: -1.2, // Below 0.5
      brightness: 10.0, // Exceeds 1.5
    });

    expect(sanitized.preset).toBe('ORIGINAL');
    expect(sanitized.warmth).toBe(1.0);
    expect(sanitized.contrast).toBe(0.5);
    expect(sanitized.brightness).toBe(1.5);
  });

  it('computes 20-float SVG feColorMatrix string for all 6 presets', () => {
    for (const preset of VALID_PRESETS) {
      const matrixStr = PaperToneService.computeSvgMatrix(preset);
      const floats = matrixStr.split(' ').map(Number);
      expect(floats.length).toBe(20);
      expect(floats.every((n) => Number.isFinite(n))).toBe(true);
    }
  });

  it('incorporates warmth, contrast, and brightness modifications into matrix', () => {
    const originalMatrix = PaperToneService.computeSvgMatrix('ORIGINAL', 0, 1.0, 1.0);
    const warmMatrix = PaperToneService.computeSvgMatrix('ORIGINAL', 0.5, 1.0, 1.0);

    expect(warmMatrix).not.toBe(originalMatrix);

    const warmFloats = warmMatrix.split(' ').map(Number);
    // Red row offset should increase with positive warmth
    expect(warmFloats[4]).toBeGreaterThan(0);
    // Blue row offset should decrease with positive warmth
    expect(warmFloats[14]).toBeLessThan(0);

    const highContrastMatrix = PaperToneService.computeSvgMatrix('ORIGINAL', 0, 1.5, 1.0);
    expect(highContrastMatrix).not.toBe(originalMatrix);
  });

  it('returns default ORIGINAL profile when no record exists', () => {
    const profile = service.getProfile('user_test', 'ser-chainsaw');
    expect(profile.preset).toBe('ORIGINAL');
    expect(profile.warmth).toBe(0.0);
    expect(profile.contrast).toBe(1.0);
    expect(profile.brightness).toBe(1.0);
    expect(profile.svgMatrix).toBeDefined();
  });

  it('persists and retrieves user paper tone profile', () => {
    service.setProfile({
      userId: 'user_otaku',
      seriesId: 'ser-chainsaw',
      preset: 'SEPIA_CALIDO',
      warmth: 0.35,
      contrast: 1.15,
      brightness: 0.95,
    });

    const retrieved = service.getProfile('user_otaku', 'ser-chainsaw');
    expect(retrieved.preset).toBe('SEPIA_CALIDO');
    expect(retrieved.warmth).toBe(0.35);
    expect(retrieved.contrast).toBe(1.15);
    expect(retrieved.brightness).toBe(0.95);
  });

  it('prioritizes series-scoped profile over global default', () => {
    // Set global default
    service.setProfile({
      userId: 'user_multi',
      seriesId: null,
      preset: 'PAPEL_E_INK',
      warmth: 0.0,
      contrast: 1.0,
    });

    // Set series override for Chainsaw Man
    service.setProfile({
      userId: 'user_multi',
      seriesId: 'ser-chainsaw',
      preset: 'NOIR_ALTO_CONTRASTE',
      warmth: 0.0,
      contrast: 1.4,
    });

    // Reading Chainsaw Man gets series profile
    const csProfile = service.getProfile('user_multi', 'ser-chainsaw');
    expect(csProfile.preset).toBe('NOIR_ALTO_CONTRASTE');
    expect(csProfile.contrast).toBe(1.4);

    // Reading Jujutsu Kaisen falls back to global default
    const jjkProfile = service.getProfile('user_multi', 'ser-jujutsu');
    expect(jjkProfile.preset).toBe('PAPEL_E_INK');
  });

  it('resets profile back to system default upon deletion', () => {
    service.setProfile({
      userId: 'user_reset',
      seriesId: 'ser-chainsaw',
      preset: 'AMBAR_MEDIANOCHE',
    });

    const resetSuccess = service.resetProfile('user_reset', 'ser-chainsaw');
    expect(resetSuccess).toBe(true);

    const afterReset = service.getProfile('user_reset', 'ser-chainsaw');
    expect(afterReset.preset).toBe('ORIGINAL');
  });

  it('lists all 6 presets with complete metadata and base matrices', () => {
    const presets = service.getPresets();
    expect(presets.length).toBe(6);
    expect(presets.map((p) => p.id)).toEqual(VALID_PRESETS);
    for (const p of presets) {
      expect(p.baseMatrix.length).toBe(20);
      expect(typeof p.name).toBe('string');
      expect(typeof p.blueLightReductionPercent).toBe('number');
    }
  });
});
