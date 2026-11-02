/**
 * KuraScroll Sprint 92: Ambient Glow Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  AmbientGlowService,
  AMBIENT_GLOW_CONFIGS,
  AmbientGlowProfile,
} from '../../../../src/backend/services/ambient-glow-service.js';

describe('AmbientGlowService', () => {
  let db: DatabaseInstance;
  let service: AmbientGlowService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ambient_glow_profiles (
        series_id TEXT PRIMARY KEY,
        glow_mode TEXT NOT NULL DEFAULT 'cinematic_reactive' CHECK (glow_mode IN (
            'cinematic_reactive',
            'dark_monochrome_dim',
            'vibrant_manhwa_bleed',
            'custom'
        )),
        glow_spread_px INTEGER NOT NULL DEFAULT 64 CHECK (glow_spread_px >= 16 AND glow_spread_px <= 256),
        glow_opacity REAL NOT NULL DEFAULT 0.45 CHECK (glow_opacity >= 0.00 AND glow_opacity <= 1.00),
        feather_smoothness REAL NOT NULL DEFAULT 1.20 CHECK (feather_smoothness >= 0.50 AND feather_smoothness <= 3.00),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ambient_glow_lookup ON ambient_glow_profiles(series_id);
    `);
    service = new AmbientGlowService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateGlowDispersionGradients', () => {
    it('computes cinematic_reactive mode gradients accurately with zero blur', () => {
      const res = service.calculateGlowDispersionGradients('cinematic_reactive', 64, 0.45, 1.20, '40, 40, 50');
      expect(res.glowMode).toBe('cinematic_reactive');
      expect(res.glowSpreadPx).toBe(64);
      expect(res.glowOpacity).toBe(0.45);
      expect(res.featherSmoothness).toBe(1.20);
      expect(res.topGradientCss).toContain('linear-gradient(to top');
      expect(res.topGradientCss).toContain('rgba(40, 40, 50, 0.45)');
      expect(res.bottomGradientCss).toContain('linear-gradient(to bottom');
      expect(res.leftGradientCss).toContain('linear-gradient(to left');
      expect(res.rightGradientCss).toContain('linear-gradient(to right');
      expect(res.combinedBoxGlowCss).toContain('inset 0 0');
    });

    it('enforces deep feathering in dark_monochrome_dim mode', () => {
      const res = service.calculateGlowDispersionGradients('dark_monochrome_dim', 48, 0.25, 1.50);
      expect(res.glowMode).toBe('dark_monochrome_dim');
      expect(res.glowOpacity).toBe(0.25);
      expect(res.featherSmoothness).toBe(1.50);
    });

    it('clamps out-of-range spread, opacity, and smoothness bounds', () => {
      const resLow = service.calculateGlowDispersionGradients('cinematic_reactive', 5, -0.2, 0.1);
      expect(resLow.glowSpreadPx).toBe(16);
      expect(resLow.glowOpacity).toBe(0.00);
      expect(resLow.featherSmoothness).toBe(0.50);

      const resHigh = service.calculateGlowDispersionGradients('cinematic_reactive', 500, 1.5, 5.0);
      expect(resHigh.glowSpreadPx).toBe(256);
      expect(resHigh.glowOpacity).toBe(1.00);
      expect(resHigh.featherSmoothness).toBe(3.00);
    });
  });

  describe('getProfile and setProfile', () => {
    it('returns default cinematic_reactive profile when not found in DB', () => {
      const prof = service.getProfile('series-omniscient-reader');
      expect(prof.seriesId).toBe('series-omniscient-reader');
      expect(prof.glowMode).toBe('cinematic_reactive');
      expect(prof.glowSpreadPx).toBe(64);
      expect(prof.glowOpacity).toBe(0.45);
      expect(prof.featherSmoothness).toBe(1.20);
      expect(prof.isEnabled).toBe(true);
      expect(prof.updatedAt).toBe(0);
    });

    it('persists and updates ambient glow profile with bounds checking', () => {
      const updated = service.setProfile({
        seriesId: 'series-omniscient-reader',
        glowMode: 'vibrant_manhwa_bleed',
        glowSpreadPx: 96,
        glowOpacity: 0.60,
        featherSmoothness: 1.10,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.seriesId).toBe('series-omniscient-reader');
      expect(updated.glowMode).toBe('vibrant_manhwa_bleed');
      expect(updated.glowSpreadPx).toBe(96);

      const fetched = service.getProfile('series-omniscient-reader');
      expect(fetched.seriesId).toBe('series-omniscient-reader');
      expect(fetched.glowMode).toBe('vibrant_manhwa_bleed');
      expect(fetched.glowOpacity).toBe(0.60);
    });
  });
});
