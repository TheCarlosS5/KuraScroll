/**
 * KuraScroll Sprint 95: Motion Stabilizer Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  MotionStabilizerService,
  MOTION_STABILIZER_PRESETS,
  MotionStabilizerProfile,
} from '../../../../src/backend/services/motion-stabilizer-service.js';

describe('MotionStabilizerService', () => {
  let db: DatabaseInstance;
  let service: MotionStabilizerService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS motion_stabilizer_profiles (
        series_id TEXT PRIMARY KEY,
        stabilizer_mode TEXT NOT NULL DEFAULT 'smooth_spring' CHECK (stabilizer_mode IN (
            'smooth_spring',
            'high_inertia_damping',
            'esports_raw',
            'custom'
        )),
        damping_coefficient REAL NOT NULL DEFAULT 0.75 CHECK (damping_coefficient >= 0.10 AND damping_coefficient <= 0.99),
        velocity_threshold_px REAL NOT NULL DEFAULT 350.0 CHECK (velocity_threshold_px >= 50.0 AND velocity_threshold_px <= 2000.0),
        contrast_boost_factor REAL NOT NULL DEFAULT 1.25 CHECK (contrast_boost_factor >= 1.00 AND contrast_boost_factor <= 2.00),
        is_anti_ghosting_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_anti_ghosting_enabled IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_motion_stabilizer_lookup ON motion_stabilizer_profiles(series_id);
    `);
    service = new MotionStabilizerService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateStabilizerKinematics', () => {
    it('applies spring-damper velocity smoothing and dampens micro-pan jitter', () => {
      const res = service.calculateStabilizerKinematics(
        400, // raw velocity px/s
        100, // prev velocity px/s
        20,  // delta Y px
        0.75, // damping
        350.0,
        1.25,
        true,
        'smooth_spring'
      );

      expect(res.stabilizerMode).toBe('smooth_spring');
      expect(res.rawVelocityPx).toBe(400);
      // Smoothed velocity = 100 * 0.75 + 400 * 0.25 = 75 + 100 = 175
      expect(res.smoothedVelocityPx).toBe(175);
      expect(res.stabilizedDeltaY).toBeLessThan(20);
      expect(res.isHighSpeedDrag).toBe(false);
      expect(res.contrastScale).toBeGreaterThan(1.00);
      expect(res.motionDeblurFilterCss).toContain('contrast(');
    });

    it('triggers high speed drag flag when velocity exceeds threshold', () => {
      const res = service.calculateStabilizerKinematics(
        800,
        600,
        50,
        0.75,
        350.0,
        1.30,
        true,
        'smooth_spring'
      );

      expect(res.isHighSpeedDrag).toBe(true);
      expect(res.contrastScale).toBeGreaterThanOrEqual(1.25);
    });

    it('returns "none" contrast filter when anti-ghosting is disabled or speed is low', () => {
      const res = service.calculateStabilizerKinematics(
        20,
        10,
        5,
        0.75,
        350.0,
        1.25,
        false,
        'esports_raw'
      );

      expect(res.contrastScale).toBe(1.00);
      expect(res.motionDeblurFilterCss).toBe('none');
    });
  });

  describe('getProfile / setProfile', () => {
    it('returns default fallback profile when series does not exist', () => {
      const prof = service.getProfile('series-unregistered');
      expect(prof.seriesId).toBe('series-unregistered');
      expect(prof.stabilizerMode).toBe('smooth_spring');
      expect(prof.dampingCoefficient).toBe(0.75);
      expect(prof.velocityThresholdPx).toBe(350.0);
      expect(prof.contrastBoostFactor).toBe(1.25);
      expect(prof.isAntiGhostingEnabled).toBe(true);
      expect(prof.isEnabled).toBe(true);
    });

    it('persists and retrieves updated profile in SQLite', () => {
      const updated = service.setProfile({
        seriesId: 'solo-leveling',
        stabilizerMode: 'high_inertia_damping',
        dampingCoefficient: 0.88,
        velocityThresholdPx: 250.0,
        contrastBoostFactor: 1.40,
        isAntiGhostingEnabled: true,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.stabilizerMode).toBe('high_inertia_damping');
      expect(updated.dampingCoefficient).toBe(0.88);
      expect(updated.contrastBoostFactor).toBe(1.40);

      const retrieved = service.getProfile('solo-leveling');
      expect(retrieved.stabilizerMode).toBe('high_inertia_damping');
      expect(retrieved.dampingCoefficient).toBe(0.88);
    });
  });
});
