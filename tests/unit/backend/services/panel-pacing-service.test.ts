/**
 * KuraScroll Sprint 99: Panel Pacing Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  PanelPacingService,
  PANEL_PACING_PRESETS,
  PanelPacingProfile,
} from '../../../../src/backend/services/panel-pacing-service.js';

describe('PanelPacingService', () => {
  let db: DatabaseInstance;
  let service: PanelPacingService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS panel_pacing_profiles (
        series_id TEXT PRIMARY KEY,
        pacing_mode TEXT NOT NULL DEFAULT 'cinematic_smooth' CHECK (pacing_mode IN (
            'cinematic_smooth',
            'dynamic_action',
            'instant_cut',
            'custom'
        )),
        transition_duration_ms INTEGER NOT NULL DEFAULT 280 CHECK (transition_duration_ms >= 100 AND transition_duration_ms <= 1000),
        zoom_overshoot_ratio REAL NOT NULL DEFAULT 1.05 CHECK (zoom_overshoot_ratio >= 1.00 AND zoom_overshoot_ratio <= 1.30),
        edge_padding_px INTEGER NOT NULL DEFAULT 16 CHECK (edge_padding_px >= 0 AND edge_padding_px <= 64),
        is_motion_reduced INTEGER NOT NULL DEFAULT 0 CHECK (is_motion_reduced IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_panel_pacing_lookup ON panel_pacing_profiles(series_id);
    `);
    service = new PanelPacingService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculatePanelFramingTransform', () => {
    it('synthesizes cinematic smooth framing at completion (progress 1.0)', () => {
      const source = { x: 0, y: 0, width: 800, height: 600 };
      const target = { x: 200, y: 400, width: 600, height: 450 };

      const res = service.calculatePanelFramingTransform(
        source,
        target,
        1280, // viewportWidth
        720,  // viewportHeight
        1.0,  // progress
        1.05, // overshoot
        16,   // edgePadding
        false,// isMotionReduced
        280,  // durationMs
        'cinematic_smooth'
      );

      expect(res.pacingMode).toBe('cinematic_smooth');
      expect(res.scale).toBeGreaterThan(1.0);
      expect(res.transformCss).toContain('translate3d');
      expect(res.transformCss).toContain('scale');
      expect(res.transitionCss).toContain('transform 280ms');
      expect(res.isOvershootActive).toBe(true);
    });

    it('interpolates intermediate framing at midpoint (progress 0.5)', () => {
      const source = { x: 0, y: 0, width: 800, height: 600 };
      const target = { x: 200, y: 400, width: 600, height: 450 };

      const resStart = service.calculatePanelFramingTransform(source, target, 1280, 720, 0.0);
      const resMid = service.calculatePanelFramingTransform(source, target, 1280, 720, 0.5);
      const resEnd = service.calculatePanelFramingTransform(source, target, 1280, 720, 1.0);

      expect(resMid.scale).toBeGreaterThanOrEqual(Math.min(resStart.scale, resEnd.scale));
    });

    it('disables animation and overshoot when isMotionReduced is true', () => {
      const source = { x: 0, y: 0, width: 800, height: 600 };
      const target = { x: 200, y: 400, width: 600, height: 450 };

      const res = service.calculatePanelFramingTransform(
        source,
        target,
        1280,
        720,
        1.0,
        1.15,
        16,
        true, // isMotionReduced
        280,
        'instant_cut'
      );

      expect(res.transitionCss).toBe('none');
      expect(res.isOvershootActive).toBe(false);
    });

    it('handles zero or negative dimensions on AABB safely without crashing', () => {
      const source = { x: 0, y: 0, width: 0, height: 0 };
      const target = { x: 0, y: 0, width: -10, height: -20 };

      const res = service.calculatePanelFramingTransform(
        source,
        target,
        1280,
        720,
        1.0
      );

      expect(res.scale).toBeGreaterThan(0);
      expect(isNaN(res.scale)).toBe(false);
      expect(isNaN(res.translateX)).toBe(false);
      expect(isNaN(res.translateY)).toBe(false);
    });

    it('clamps out-of-range parameters to safe physical bounds', () => {
      const res = service.calculatePanelFramingTransform(
        { x: 0, y: 0, width: 500, height: 500 },
        { x: 100, y: 100, width: 500, height: 500 },
        1280,
        720,
        2.5,  // progress > 1 -> clamped to 1.0
        2.0,  // overshoot > 1.30 -> clamped to 1.30
        100,  // padding > 64 -> clamped to 64
        false,
        5000, // duration > 1000 -> clamped to 1000
        'custom'
      );

      expect(res.transitionDurationMs).toBe(1000);
      expect(res.transitionCss).toContain('1000ms');
    });
  });

  describe('getProfile & setProfile', () => {
    it('returns default cinematic smooth profile when not stored in database', () => {
      const profile = service.getProfile('series-panel-none');
      expect(profile.seriesId).toBe('series-panel-none');
      expect(profile.pacingMode).toBe('cinematic_smooth');
      expect(profile.transitionDurationMs).toBe(PANEL_PACING_PRESETS.cinematic_smooth.transitionDurationMs);
      expect(profile.zoomOvershootRatio).toBe(PANEL_PACING_PRESETS.cinematic_smooth.zoomOvershootRatio);
      expect(profile.edgePaddingPx).toBe(PANEL_PACING_PRESETS.cinematic_smooth.edgePaddingPx);
      expect(profile.isMotionReduced).toBe(false);
      expect(profile.isEnabled).toBe(true);
      expect(profile.updatedAt).toBe(0);
    });

    it('persists and retrieves custom panel pacing profile', () => {
      const newProfile: PanelPacingProfile = {
        seriesId: 'solo-leveling-ch-10',
        pacingMode: 'dynamic_action',
        transitionDurationMs: 180,
        zoomOvershootRatio: 1.15,
        edgePaddingPx: 8,
        isMotionReduced: false,
        isEnabled: true,
        updatedAt: 0,
      };

      const saved = service.setProfile(newProfile);
      expect(saved.seriesId).toBe('solo-leveling-ch-10');
      expect(saved.pacingMode).toBe('dynamic_action');
      expect(saved.transitionDurationMs).toBe(180);
      expect(saved.zoomOvershootRatio).toBe(1.15);
      expect(saved.edgePaddingPx).toBe(8);
      expect(saved.updatedAt).toBeGreaterThan(0);

      const retrieved = service.getProfile('solo-leveling-ch-10');
      expect(retrieved.pacingMode).toBe('dynamic_action');
      expect(retrieved.transitionDurationMs).toBe(180);
      expect(retrieved.zoomOvershootRatio).toBe(1.15);
    });

    it('updates existing profile via upsert ON CONFLICT', () => {
      service.setProfile({
        seriesId: 'series-pacing-x',
        pacingMode: 'cinematic_smooth',
        transitionDurationMs: 280,
        zoomOvershootRatio: 1.05,
        edgePaddingPx: 16,
        isMotionReduced: false,
        isEnabled: true,
        updatedAt: 0,
      });

      const updated = service.setProfile({
        seriesId: 'series-pacing-x',
        pacingMode: 'instant_cut',
        transitionDurationMs: 100,
        zoomOvershootRatio: 1.00,
        edgePaddingPx: 0,
        isMotionReduced: true,
        isEnabled: false,
        updatedAt: 0,
      });

      expect(updated.pacingMode).toBe('instant_cut');
      expect(updated.transitionDurationMs).toBe(100);
      expect(updated.isMotionReduced).toBe(true);
      expect(updated.isEnabled).toBe(false);

      const retrieved = service.getProfile('series-pacing-x');
      expect(retrieved.pacingMode).toBe('instant_cut');
      expect(retrieved.isMotionReduced).toBe(true);
      expect(retrieved.isEnabled).toBe(false);
    });
  });
});
