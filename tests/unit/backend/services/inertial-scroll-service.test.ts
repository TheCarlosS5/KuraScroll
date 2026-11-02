/**
 * KuraScroll Sprint 88: Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  InertialScrollService,
  INERTIAL_SCROLL_PRESETS,
  InertialScrollProfile,
} from '../../../../src/backend/services/inertial-scroll-service.js';

describe('InertialScrollService', () => {
  let db: DatabaseInstance;
  let service: InertialScrollService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS inertial_scroll_profiles (
        series_id TEXT PRIMARY KEY,
        friction_coefficient REAL NOT NULL DEFAULT 0.92 CHECK (friction_coefficient >= 0.70 AND friction_coefficient <= 0.99),
        mass REAL NOT NULL DEFAULT 1.0 CHECK (mass >= 0.2 AND mass <= 5.0),
        spring_tension REAL NOT NULL DEFAULT 120.0 CHECK (spring_tension >= 10.0 AND spring_tension <= 500.0),
        velocity_clamp_px REAL NOT NULL DEFAULT 3500.0 CHECK (velocity_clamp_px >= 500.0 AND velocity_clamp_px <= 10000.0),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inertial_scroll_lookup ON inertial_scroll_profiles(series_id);
    `);
    service = new InertialScrollService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateInertialStep', () => {
    it('returns resting state when deltaTimeMs is <= 0', () => {
      const res = service.calculateInertialStep(100, 100, 0, 0.92, 120.0, 1.0, 0);
      expect(res.nextPosition).toBe(100);
      expect(res.nextVelocity).toBe(0);
      expect(res.isResting).toBe(true);
    });

    it('advances position smoothly towards target position', () => {
      // currentPos = 0, targetPos = 200, initial velocity = 0
      const res = service.calculateInertialStep(0, 200, 0, 0.92, 120.0, 1.0, 16.6667);
      expect(res.nextPosition).toBeGreaterThan(0);
      expect(res.nextVelocity).toBeGreaterThan(0);
      expect(res.acceleration).toBeGreaterThan(0);
      expect(res.isResting).toBe(false);
    });

    it('clamps velocity to velocityClampPx', () => {
      // Large displacement causing huge acceleration
      const res = service.calculateInertialStep(0, 50000, 3000, 0.99, 500.0, 1.0, 16.6667, 2000.0);
      expect(Math.abs(res.nextVelocity)).toBeLessThanOrEqual(2000.0);
    });

    it('detects decay to rest when near target with low velocity', () => {
      // Very close to target with near-zero velocity
      const res = service.calculateInertialStep(199.98, 200, 0.02, 0.92, 120.0, 1.0, 16.6667);
      expect(res.nextPosition).toBe(200);
      expect(res.nextVelocity).toBe(0);
      expect(res.isResting).toBe(true);
    });

    it('bounds dt on tab switch spikes (e.g., 5000ms delay)', () => {
      const res = service.calculateInertialStep(0, 100, 10, 0.92, 120.0, 1.0, 5000);
      expect(Number.isFinite(res.nextPosition)).toBe(true);
      expect(Number.isFinite(res.nextVelocity)).toBe(true);
    });
  });

  describe('getProfile and setProfile', () => {
    it('returns natural_paper default profile when not found in DB', () => {
      const prof = service.getProfile('series-sololeveling');
      expect(prof.seriesId).toBe('series-sololeveling');
      expect(prof.frictionCoefficient).toBe(INERTIAL_SCROLL_PRESETS.natural_paper.frictionCoefficient);
      expect(prof.mass).toBe(1.0);
      expect(prof.springTension).toBe(150.0);
      expect(prof.velocityClampPx).toBe(3000.0);
      expect(prof.isEnabled).toBe(true);
      expect(prof.updatedAt).toBe(0);
    });

    it('persists and updates inertial scroll profile within valid ranges', () => {
      const updated = service.setProfile({
        seriesId: 'series-sololeveling',
        frictionCoefficient: 0.95,
        mass: 1.5,
        springTension: 180.0,
        velocityClampPx: 4500.0,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.seriesId).toBe('series-sololeveling');
      expect(updated.frictionCoefficient).toBe(0.95);
      expect(updated.springTension).toBe(180.0);
      expect(updated.velocityClampPx).toBe(4500.0);

      const fetched = service.getProfile('series-sololeveling');
      expect(fetched.seriesId).toBe('series-sololeveling');
      expect(fetched.frictionCoefficient).toBe(0.95);
      expect(fetched.mass).toBe(1.5);
    });
  });
});
