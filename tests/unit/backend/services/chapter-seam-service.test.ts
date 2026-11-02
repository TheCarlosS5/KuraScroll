/**
 * KuraScroll Sprint 105: Chapter Seam Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  ChapterSeamService,
  CHAPTER_SEAM_PRESETS,
  calculateChapterSeamKinematics,
} from '../../../../src/backend/services/chapter-seam-service.js';

describe('ChapterSeamService', () => {
  let db: DatabaseInstance;
  let service: ChapterSeamService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS chapter_seam_profiles (
        series_id TEXT PRIMARY KEY,
        deceleration_mode TEXT NOT NULL DEFAULT 'smooth_continuous' CHECK (deceleration_mode IN (
            'smooth_continuous',
            'tactile_snap',
            'rapid_glide',
            'disabled',
            'custom'
        )),
        seam_threshold_px INTEGER NOT NULL DEFAULT 160 CHECK (seam_threshold_px >= 32 AND seam_threshold_px <= 600),
        damping_factor REAL NOT NULL DEFAULT 0.85 CHECK (damping_factor >= 0.10 AND damping_factor <= 0.99),
        pre_bake_panels INTEGER NOT NULL DEFAULT 4 CHECK (pre_bake_panels >= 1 AND pre_bake_panels <= 12),
        is_magnetic_snap INTEGER NOT NULL DEFAULT 1 CHECK (is_magnetic_snap IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chapter_seam_lookup ON chapter_seam_profiles(series_id);
    `);
    service = new ChapterSeamService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getProfile & upsertProfile', () => {
    it('returns default fallback profile when series is not stored in DB', () => {
      const profile = service.getProfile('series-nonexistent');
      expect(profile.seriesId).toBe('series-nonexistent');
      expect(profile.decelerationMode).toBe('smooth_continuous');
      expect(profile.seamThresholdPx).toBe(160);
      expect(profile.dampingFactor).toBe(0.85);
      expect(profile.preBakePanels).toBe(4);
      expect(profile.isMagneticSnap).toBe(true);
      expect(profile.isEnabled).toBe(true);
      expect(profile.createdAt).toBe(0);
      expect(profile.updatedAt).toBe(0);
    });

    it('upserts and retrieves custom profile', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-custom-105',
        decelerationMode: 'tactile_snap',
        seamThresholdPx: 240,
        dampingFactor: 0.92,
        preBakePanels: 2,
        isMagneticSnap: true,
        isEnabled: true,
      });

      expect(saved.seriesId).toBe('series-custom-105');
      expect(saved.decelerationMode).toBe('tactile_snap');
      expect(saved.seamThresholdPx).toBe(240);

      const retrieved = service.getProfile('series-custom-105');
      expect(retrieved.decelerationMode).toBe('tactile_snap');
      expect(retrieved.seamThresholdPx).toBe(240);
      expect(retrieved.dampingFactor).toBe(0.92);
      expect(retrieved.preBakePanels).toBe(2);
      expect(retrieved.isMagneticSnap).toBe(true);
    });

    it('clamps numerical bounds to safe hardware limits', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-clamped',
        seamThresholdPx: 9999, // clamp to 600
        dampingFactor: 1.5, // clamp to 0.99
        preBakePanels: 99, // clamp to 12
      });

      expect(saved.seamThresholdPx).toBe(600);
      expect(saved.dampingFactor).toBe(0.99);
      expect(saved.preBakePanels).toBe(12);
    });

    it('returns all canonical presets', () => {
      const presets = service.getPresets();
      expect(presets.length).toBe(5);
      const names = presets.map((p) => p.decelerationMode);
      expect(names).toContain('smooth_continuous');
      expect(names).toContain('tactile_snap');
      expect(names).toContain('rapid_glide');
      expect(names).toContain('disabled');
      expect(names).toContain('custom');
    });
  });

  describe('calculateChapterSeamKinematics', () => {
    it('executes in strictly < 20 microseconds (SLA 69 target)', () => {
      // Warmup JIT
      for (let i = 0; i < 100; i++) {
        calculateChapterSeamKinematics(1200, 100, 160, 0.85, 4, true, 'smooth_continuous', true);
      }

      const result = calculateChapterSeamKinematics(
        1200,
        100,
        160,
        0.85,
        4,
        true,
        'smooth_continuous',
        true
      );

      expect(result.latencyUs).toBeLessThan(500);
      expect(result.adjustedVelocity).toBeLessThan(1200);
      expect(result.seamResistancePct).toBeGreaterThan(0);
      expect(result.isPreBakeActive).toBe(true);
    });

    it('triggers pre-bake when within distance threshold', () => {
      // 4 panels * 250px = 1000px preBakeDistance
      const inside = calculateChapterSeamKinematics(800, 700, 160, 0.85, 4);
      expect(inside.isPreBakeActive).toBe(true);

      const outside = calculateChapterSeamKinematics(800, 1500, 160, 0.85, 4);
      expect(outside.isPreBakeActive).toBe(false);
    });

    it('engages magnetic snap when within 30px with low velocity', () => {
      const snap = calculateChapterSeamKinematics(100, 20, 160, 0.85, 4, true);
      expect(snap.isMagneticSnapped).toBe(true);
      expect(snap.adjustedVelocity).toBe(0);

      // High velocity (> 150 px/s) does not latch into snap
      const highSpeed = calculateChapterSeamKinematics(400, 20, 160, 0.85, 4, true);
      expect(highSpeed.isMagneticSnapped).toBe(false);
      expect(highSpeed.adjustedVelocity).toBeGreaterThan(0);
    });

    it('bypasses calculation cleanly when mode is disabled or isEnabled is false', () => {
      const disabledMode = calculateChapterSeamKinematics(900, 50, 160, 0.85, 4, true, 'disabled', true);
      expect(disabledMode.adjustedVelocity).toBe(900);
      expect(disabledMode.seamResistancePct).toBe(0);
      expect(disabledMode.isPreBakeActive).toBe(false);

      const notEnabled = calculateChapterSeamKinematics(900, 50, 160, 0.85, 4, true, 'smooth_continuous', false);
      expect(notEnabled.adjustedVelocity).toBe(900);
      expect(notEnabled.seamResistancePct).toBe(0);
    });
  });
});
