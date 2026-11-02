import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  GazeAnchorService,
  calculateGazeTrajectory,
  normalizeGazeMode,
  normalizeHeatmapResolution,
  clampSensitivity,
  clampDwellMs,
  clampDriftTolerance,
  computeGazeAnchorEtag,
} from '../../../../src/backend/services/gaze-anchor-service.js';

describe('GazeAnchorService (Sprint 83)', () => {
  let db: DatabaseInstance;
  let service: GazeAnchorService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS gaze_anchor_profiles (
        series_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL DEFAULT 'manga_rtl' CHECK (mode IN ('webtoon', 'manga_rtl', 'manga_ltr')),
        saccade_sensitivity REAL NOT NULL DEFAULT 1.0 CHECK (saccade_sensitivity >= 0.1 AND saccade_sensitivity <= 3.0),
        dwell_threshold_ms INTEGER NOT NULL DEFAULT 250 CHECK (dwell_threshold_ms >= 50 AND dwell_threshold_ms <= 1000),
        drift_tolerance_px REAL NOT NULL DEFAULT 40.0 CHECK (drift_tolerance_px >= 10.0 AND drift_tolerance_px <= 200.0),
        return_anchor_enabled INTEGER NOT NULL DEFAULT 1 CHECK (return_anchor_enabled IN (0, 1)),
        heatmap_resolution TEXT NOT NULL DEFAULT 'medium' CHECK (heatmap_resolution IN ('low', 'medium', 'high')),
        updated_at INTEGER NOT NULL
      );
    `);
    service = new GazeAnchorService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns default fallback profile when series has no profile in DB', () => {
    const profile = service.getProfile('unregistered-series');
    expect(profile.seriesId).toBe('unregistered-series');
    expect(profile.mode).toBe('manga_rtl');
    expect(profile.saccadeSensitivity).toBe(1.0);
    expect(profile.dwellThresholdMs).toBe(250);
    expect(profile.driftTolerancePx).toBe(40.0);
    expect(profile.returnAnchorEnabled).toBe(true);
    expect(profile.heatmapResolution).toBe('medium');
  });

  it('saves and retrieves customized gaze anchor profiles with proper clamping', () => {
    const saved = service.saveProfile({
      seriesId: 'series-solo-leveling',
      mode: 'webtoon',
      saccadeSensitivity: 2.5,
      dwellThresholdMs: 400,
      driftTolerancePx: 60.0,
      returnAnchorEnabled: true,
      heatmapResolution: 'high',
    });

    expect(saved.seriesId).toBe('series-solo-leveling');
    expect(saved.mode).toBe('webtoon');
    expect(saved.saccadeSensitivity).toBe(2.5);
    expect(saved.dwellThresholdMs).toBe(400);

    const retrieved = service.getProfile('series-solo-leveling');
    expect(retrieved.mode).toBe('webtoon');
    expect(retrieved.saccadeSensitivity).toBe(2.5);
    expect(retrieved.heatmapResolution).toBe('high');
  });

  it('clamps invalid or out-of-range numerical fields gracefully', () => {
    expect(clampSensitivity(99.0)).toBe(3.0);
    expect(clampSensitivity(-5.0)).toBe(0.1);
    expect(clampDwellMs(5000)).toBe(1000);
    expect(clampDwellMs(10)).toBe(50);
    expect(clampDriftTolerance(500.0)).toBe(200.0);
    expect(clampDriftTolerance(2.0)).toBe(10.0);
    expect(normalizeGazeMode('invalid')).toBe('manga_rtl');
    expect(normalizeHeatmapResolution('invalid')).toBe('medium');
  });

  it('computes stable deterministic ETags', () => {
    const etag1 = computeGazeAnchorEtag('webtoon', 1.5, 300, 50, true);
    const etag2 = computeGazeAnchorEtag('webtoon', 1.5, 300, 50, true);
    const etag3 = computeGazeAnchorEtag('manga_rtl', 1.5, 300, 50, true);

    expect(etag1).toBe(etag2);
    expect(etag1).not.toBe(etag3);
    expect(etag1.startsWith('W/"ga-')).toBe(true);
  });

  describe('calculateGazeTrajectory (SLA 47)', () => {
    it('detects micro-jitter drift and locks onto steady previous anchor point', () => {
      // Small distance 5px (<= 40px drift tolerance) and dwellMs = 300ms (>= 150ms)
      const res = calculateGazeTrajectory(105, 202, 100, 200, 0.1, 'manga_rtl', 300, 40.0, 1.0);
      expect(res.isDriftDetected).toBe(true);
      expect(res.isSaccade).toBe(false);
      expect(res.nextAnchorX).toBe(100);
      expect(res.nextAnchorY).toBe(200);
      expect(res.confidence).toBeGreaterThan(0.9);
    });

    it('identifies saccades during rapid horizontal eye movements in manga_rtl', () => {
      // Large rapid gaze jump
      const res = calculateGazeTrajectory(300, 200, 100, 200, 2.5, 'manga_rtl', 50, 40.0, 1.0);
      expect(res.isSaccade).toBe(true);
      expect(res.isDriftDetected).toBe(false);
      expect(res.nextAnchorX).toBeLessThan(300); // Extrapolates RTL
    });

    it('handles webtoon vertical scroll reading dynamics', () => {
      const res = calculateGazeTrajectory(100, 500, 100, 300, 2.0, 'webtoon', 50, 40.0, 1.0);
      expect(res.isSaccade).toBe(true);
      expect(res.nextAnchorY).toBeGreaterThan(500); // Extrapolates downward
    });

    it('handles zero or NaN inputs safely without throwing', () => {
      const res = calculateGazeTrajectory(NaN, NaN, NaN, NaN, NaN, 'manga_rtl');
      expect(res.nextAnchorX).toBeDefined();
      expect(res.nextAnchorY).toBeDefined();
      expect(isNaN(res.nextAnchorX)).toBe(false);
      expect(isNaN(res.nextAnchorY)).toBe(false);
    });
  });
});
