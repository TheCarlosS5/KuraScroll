import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  PageHalftoneService,
  DEFAULT_HALFTONE_PROFILE,
  CANONICAL_HALFTONE_PRESETS,
} from '../../../../src/backend/services/page-halftone-service.js';

describe('PageHalftoneService Unit Tests (Sprint 77)', () => {
  let db: DatabaseInstance;
  let service: PageHalftoneService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new PageHalftoneService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Profile Persistence & Hierarchy', () => {
    it('returns default fallback profile when no record exists', () => {
      const profile = service.getProfile('series-default', 'c1');
      expect(profile.seriesId).toBe('series-default');
      expect(profile.presetName).toBe('pristine');
      expect(profile.dotPitchLpi).toBe(60);
      expect(profile.dotAngleDeg).toBe(45.0);
      expect(profile.dotIntensity).toBe(0.0);
      expect(profile.paperAgePct).toBe(0.0);
      expect(profile.foxingIntensity).toBe(0.0);
      expect(profile.isEnabled).toBe(false);
    });

    it('upserts and retrieves series-level and chapter-level profiles', () => {
      // 1. Series-level profile
      service.upsertProfile({
        seriesId: 'berserk',
        presetName: 'shonen_90s',
        dotPitchLpi: 60,
        dotAngleDeg: 45.0,
        dotIntensity: 0.35,
        paperAgePct: 0.20,
        foxingIntensity: 0.05,
        isEnabled: true,
      });

      const seriesProfile = service.getProfile('berserk');
      expect(seriesProfile.presetName).toBe('shonen_90s');
      expect(seriesProfile.dotIntensity).toBe(0.35);

      // Chapter lookup should inherit series profile
      const chapInherit = service.getProfile('berserk', 'chap-50');
      expect(chapInherit.presetName).toBe('shonen_90s');

      // 2. Override at Chapter-level
      service.upsertProfile({
        seriesId: 'berserk',
        chapterId: 'chap-50',
        presetName: 'pulp_press',
        dotPitchLpi: 45,
        dotAngleDeg: 45.0,
        dotIntensity: 0.55,
        paperAgePct: 0.50,
        foxingIntensity: 0.25,
        isEnabled: true,
      });

      const chapOverride = service.getProfile('berserk', 'chap-50');
      expect(chapOverride.presetName).toBe('pulp_press');
      expect(chapOverride.dotPitchLpi).toBe(45);

      // Other chapter still gets series default
      const otherChap = service.getProfile('berserk', 'chap-51');
      expect(otherChap.presetName).toBe('shonen_90s');
    });

    it('clamps out-of-range profile values properly', () => {
      const saved = service.upsertProfile({
        seriesId: 'clamped-series',
        presetName: 'custom',
        dotPitchLpi: 500, // max 150
        dotAngleDeg: 180, // max 90
        dotIntensity: 5.0, // max 1.0
        paperAgePct: -1.0, // min 0.0
        foxingIntensity: 2.0, // max 1.0
        isEnabled: true,
      });

      expect(saved.dotPitchLpi).toBe(150);
      expect(saved.dotAngleDeg).toBe(90.0);
      expect(saved.dotIntensity).toBe(1.0);
      expect(saved.paperAgePct).toBe(0.0);
      expect(saved.foxingIntensity).toBe(1.0);
    });
  });

  describe('calculateHalftoneMatrix Parameter Generation', () => {
    it('returns bypass identity values when disabled or zero intensity', () => {
      const result = PageHalftoneService.calculateHalftoneMatrix({
        isEnabled: false,
        dotIntensity: 0.5,
        paperAgePct: 0.5,
      });

      expect(result.isEnabled).toBe(false);
      expect(result.dotSizePx).toBe(0);
      expect(result.colorMatrix).toBe('1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0');
      expect(result.paperBgColor).toBe('#ffffff');
    });

    it('calculates accurate matrix and spacing for shonen_90s profile', () => {
      const result = PageHalftoneService.calculateHalftoneMatrix({
        isEnabled: true,
        dotPitchLpi: 60,
        dotAngleDeg: 45.0,
        dotIntensity: 0.35,
        paperAgePct: 0.20,
      });

      expect(result.isEnabled).toBe(true);
      expect(result.dotSpacingPx).toBe(6.4);
      expect(result.dotSizePx).toBeGreaterThan(0.5);
      expect(result.dotAngleDeg).toBe(45.0);
      expect(result.dotOpacity).toBe(0.3); // 0.35 * 0.85 = 0.2975 -> 0.3
      expect(result.colorMatrix).toContain('0 0 0 1 0');
      expect(result.paperBgColor).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('executes calculateHalftoneMatrix within SLA 41 bounds (< 20µs)', () => {
      const start = performance.now();
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        PageHalftoneService.calculateHalftoneMatrix(CANONICAL_HALFTONE_PRESETS.tankobon_retro);
      }
      const elapsedMs = performance.now() - start;
      const avgUs = (elapsedMs / iterations) * 1000;

      expect(avgUs).toBeLessThan(20.0);
    });
  });
});
