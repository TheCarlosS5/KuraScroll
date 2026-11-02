import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  PageAcousticsService,
  clampVolume,
  clampHaptic,
  normalizeSubstrate,
  computeAcousticsEtag,
  calculateAudioPannerParams,
  CANONICAL_SUBSTRATE_CONFIGS,
  DEFAULT_ACOUSTICS_PROFILE,
} from '../../../../src/backend/services/page-acoustics-service.js';

describe('PageAcousticsService Unit Tests (Sprint 82)', () => {
  let db: DatabaseInstance;
  let service: PageAcousticsService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new PageAcousticsService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Normalization & Clamping (ACS-01, 02, 03)', () => {
    it('clamps volume strictly to [0.0, 1.0]', () => {
      expect(clampVolume(-0.5)).toBe(0.0);
      expect(clampVolume(1.8)).toBe(1.0);
      expect(clampVolume(0.75)).toBe(0.75);
      expect(clampVolume(NaN)).toBe(0.65);
    });

    it('clamps haptic intensity strictly to [0.0, 1.0]', () => {
      expect(clampHaptic(-1.0)).toBe(0.0);
      expect(clampHaptic(2.5)).toBe(1.0);
      expect(clampHaptic(0.4)).toBe(0.4);
      expect(clampHaptic(NaN)).toBe(0.5);
    });

    it('normalizes substrate and falls back to tankobon on invalid input', () => {
      expect(normalizeSubstrate('glossy')).toBe('glossy');
      expect(normalizeSubstrate('newsprint')).toBe('newsprint');
      expect(normalizeSubstrate('tankobon')).toBe('tankobon');
      expect(normalizeSubstrate('silk_ribbon')).toBe('silk_ribbon');
      expect(normalizeSubstrate('invalid_paper')).toBe('tankobon');
    });
  });

  describe('Deterministic ETag Calculation (ACS-04)', () => {
    it('generates consistent, deterministic hex ETags', () => {
      const etag1 = computeAcousticsEtag('tankobon', 0.65, true, true);
      const etag2 = computeAcousticsEtag('tankobon', 0.65, true, true);
      const etag3 = computeAcousticsEtag('glossy', 0.8, false, true);

      expect(etag1).toBe(etag2);
      expect(etag1).not.toBe(etag3);
      expect(etag1).toMatch(/^"[a-f0-9]+"$/);
    });
  });

  describe('Zero-Allocation Binaural Panning & Audio Parameter Synthesis (SLA 46 hot path)', () => {
    it('computes directional stereo panning for RTL manga reader (right to left)', () => {
      const rtlNext = calculateAudioPannerParams('next', 'rtl', 'tankobon', 0.8, true);
      expect(rtlNext.panStart).toBe(0.75);
      expect(rtlNext.panEnd).toBe(-0.75);
      expect(rtlNext.cutoffHz).toBe(2800);
      expect(rtlNext.qFactor).toBe(1.2);
      expect(rtlNext.durationMs).toBe(220);
      expect(rtlNext.hapticDurationMs).toBe(25);
      expect(rtlNext.effectiveGain).toBeGreaterThan(0);

      const rtlPrev = calculateAudioPannerParams('prev', 'rtl', 'tankobon', 0.8, true);
      expect(rtlPrev.panStart).toBe(-0.75);
      expect(rtlPrev.panEnd).toBe(0.75);
    });

    it('computes directional stereo panning for LTR comic reader (left to right)', () => {
      const ltrNext = calculateAudioPannerParams('next', 'ltr', 'newsprint', 0.8, true);
      expect(ltrNext.panStart).toBe(-0.75);
      expect(ltrNext.panEnd).toBe(0.75);
      expect(ltrNext.cutoffHz).toBe(1800);

      const ltrPrev = calculateAudioPannerParams('prev', 'ltr', 'newsprint', 0.8, true);
      expect(ltrPrev.panStart).toBe(0.75);
      expect(ltrPrev.panEnd).toBe(-0.75);
    });

    it('centers pan at 0.0 when stereo panning is disabled', () => {
      const mono = calculateAudioPannerParams('next', 'rtl', 'glossy', 0.8, false);
      expect(mono.panStart).toBe(0.0);
      expect(mono.panEnd).toBe(0.0);
    });
  });

  describe('Database Profile Persistence & Defaults', () => {
    it('returns default fallback profile when no record exists', () => {
      const profile = service.getProfile('series-acs-default', 'user-1');
      expect(profile.seriesId).toBe('series-acs-default');
      expect(profile.userId).toBe('user-1');
      expect(profile.paperSubstrate).toBe('tankobon');
      expect(profile.volumeLevel).toBe(0.65);
      expect(profile.stereoPanningEnabled).toBe(true);
      expect(profile.hapticPulseEnabled).toBe(true);
      expect(profile.isEnabled).toBe(true);
    });

    it('saves and updates profile with boundary clamping', () => {
      const saved = service.saveProfile({
        seriesId: 'deathnote-manga',
        userId: 'light',
        paperSubstrate: 'newsprint',
        volumeLevel: 1.5, // Clamped to 1.0
        hapticIntensity: -0.2, // Clamped to 0.0
        stereoPanningEnabled: false,
      });

      expect(saved.paperSubstrate).toBe('newsprint');
      expect(saved.volumeLevel).toBe(1.0);
      expect(saved.hapticIntensity).toBe(0.0);
      expect(saved.stereoPanningEnabled).toBe(false);

      const retrieved = service.getProfile('deathnote-manga', 'light');
      expect(retrieved.paperSubstrate).toBe('newsprint');
      expect(retrieved.volumeLevel).toBe(1.0);
    });

    it('mutes audio when isEnabled is false', () => {
      const profile = service.getProfile('silent-series', 'shoya');
      profile.isEnabled = false;

      const eff = service.getEffectiveParams(profile, 'next', 'rtl');
      expect(eff.effectiveGain).toBe(0.0);
    });
  });
});
