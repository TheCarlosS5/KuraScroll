/**
 * KuraScroll Sprint 102: Balloon Collision Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  BalloonCollisionService,
  BALLOON_COLLISION_PRESETS,
  calculateBalloonCollisionAvoidance,
  BoundingBox,
} from '../../../../src/backend/services/balloon-collision-service.js';

describe('BalloonCollisionService', () => {
  let db: DatabaseInstance;
  let service: BalloonCollisionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS balloon_collision_profiles (
        series_id TEXT PRIMARY KEY,
        avoidance_strategy TEXT NOT NULL DEFAULT 'minimal_euclidean' CHECK (avoidance_strategy IN (
            'minimal_euclidean',
            'reading_gravity_downward',
            'opposite_margin',
            'clamp_only'
        )),
        safety_margin_px INTEGER NOT NULL DEFAULT 12 CHECK (safety_margin_px >= 0 AND safety_margin_px <= 64),
        max_displacement_px INTEGER NOT NULL DEFAULT 120 CHECK (max_displacement_px >= 20 AND max_displacement_px <= 400),
        prefer_vertical_shift INTEGER NOT NULL DEFAULT 1 CHECK (prefer_vertical_shift IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_balloon_collision_lookup ON balloon_collision_profiles(series_id);
    `);
    service = new BalloonCollisionService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('getProfile & upsertProfile', () => {
    it('returns default fallback profile when series is not stored in DB', () => {
      const profile = service.getProfile('series-nonexistent');
      expect(profile.seriesId).toBe('series-nonexistent');
      expect(profile.avoidanceStrategy).toBe('minimal_euclidean');
      expect(profile.safetyMarginPx).toBe(12);
      expect(profile.maxDisplacementPx).toBe(120);
      expect(profile.preferVerticalShift).toBe(true);
      expect(profile.isEnabled).toBe(true);
      expect(profile.createdAt).toBe(0);
      expect(profile.updatedAt).toBe(0);
    });

    it('upserts and retrieves custom profile', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-custom-102',
        avoidanceStrategy: 'reading_gravity_downward',
        safetyMarginPx: 16,
        maxDisplacementPx: 180,
        preferVerticalShift: true,
        isEnabled: true,
      });

      expect(saved.seriesId).toBe('series-custom-102');
      expect(saved.avoidanceStrategy).toBe('reading_gravity_downward');
      expect(saved.safetyMarginPx).toBe(16);
      expect(saved.maxDisplacementPx).toBe(180);

      const retrieved = service.getProfile('series-custom-102');
      expect(retrieved.avoidanceStrategy).toBe('reading_gravity_downward');
      expect(retrieved.safetyMarginPx).toBe(16);
    });

    it('clamps numerical bounds to safe hardware limits', () => {
      const saved = service.upsertProfile({
        seriesId: 'series-clamped',
        safetyMarginPx: 999, // clamp to 64
        maxDisplacementPx: 10, // clamp to 20
      });

      expect(saved.safetyMarginPx).toBe(64);
      expect(saved.maxDisplacementPx).toBe(20);
    });

    it('returns all system presets', () => {
      const presets = service.getPresets();
      expect(presets.minimal_euclidean).toBeDefined();
      expect(presets.reading_gravity_downward).toBeDefined();
      expect(presets.opposite_margin).toBeDefined();
      expect(presets.clamp_only).toBeDefined();
    });
  });

  describe('calculateBalloonCollisionAvoidance', () => {
    const defaultViewport = { width: 1280, height: 720 };

    it('returns hasCollision: false when overlay does not collide with balloons', () => {
      const overlay: BoundingBox = { x: 100, y: 100, width: 150, height: 80 };
      const balloons: BoundingBox[] = [
        { x: 500, y: 400, width: 200, height: 100 },
      ];

      const res = calculateBalloonCollisionAvoidance(overlay, balloons, defaultViewport);
      expect(res.hasCollision).toBe(false);
      expect(res.dx).toBe(0);
      expect(res.dy).toBe(0);
      expect(res.displacementMagnitude).toBe(0);
      expect(res.displacedBox.x).toBe(100);
      expect(res.displacedBox.y).toBe(100);
      expect(res.latencyUs).toBeLessThan(500);
    });

    it('detects collision and shifts overlay away using minimal_euclidean strategy', () => {
      const overlay: BoundingBox = { x: 200, y: 200, width: 100, height: 60 };
      const balloons: BoundingBox[] = [
        { x: 180, y: 180, width: 140, height: 100 }, // Centers on overlay
      ];

      const res = calculateBalloonCollisionAvoidance(
        overlay,
        balloons,
        defaultViewport,
        'minimal_euclidean',
        12,
        150,
        true
      );

      expect(res.hasCollision).toBe(true);
      expect(res.collidingBalloonIndices.length).toBe(1);
      expect(res.displacementMagnitude).toBeGreaterThan(0);
      // Displaced box must no longer intersect with balloon
      const b = balloons[0];
      const d = res.displacedBox;
      const overlapsX = d.x < b.x + b.width && d.x + d.width > b.x;
      const overlapsY = d.y < b.y + b.height && d.y + d.height > b.y;
      expect(overlapsX && overlapsY).toBe(false);
    });

    it('shifts overlay downwards when reading_gravity_downward is selected', () => {
      const overlay: BoundingBox = { x: 200, y: 200, width: 100, height: 50 };
      const balloons: BoundingBox[] = [
        { x: 180, y: 180, width: 140, height: 90 }, // Bottom is at 270
      ];

      const res = calculateBalloonCollisionAvoidance(
        overlay,
        balloons,
        defaultViewport,
        'reading_gravity_downward',
        12,
        150
      );

      expect(res.hasCollision).toBe(true);
      expect(res.dy).toBeGreaterThan(0);
      expect(res.displacedBox.y).toBeGreaterThanOrEqual(270);
    });

    it('shifts overlay to opposite lateral margin when opposite_margin is selected', () => {
      // Overlay in left half (x = 100, vpW = 1280)
      const overlay: BoundingBox = { x: 100, y: 200, width: 100, height: 50 };
      const balloons: BoundingBox[] = [
        { x: 80, y: 180, width: 140, height: 90 },
      ];

      const res = calculateBalloonCollisionAvoidance(
        overlay,
        balloons,
        defaultViewport,
        'opposite_margin',
        10,
        200
      );

      expect(res.hasCollision).toBe(true);
      expect(res.dx).toBeGreaterThan(0);
      expect(res.displacedBox.x).toBe(300); // 100 + 200
    });

    it('does not shift when clamp_only strategy is active', () => {
      const overlay: BoundingBox = { x: 200, y: 200, width: 100, height: 50 };
      const balloons: BoundingBox[] = [
        { x: 180, y: 180, width: 140, height: 90 },
      ];

      const res = calculateBalloonCollisionAvoidance(
        overlay,
        balloons,
        defaultViewport,
        'clamp_only'
      );

      expect(res.hasCollision).toBe(false);
      expect(res.dx).toBe(0);
      expect(res.dy).toBe(0);
      expect(res.displacedBox.x).toBe(200);
      expect(res.displacedBox.y).toBe(200);
    });

    it('executes in strictly under 20 microseconds for SLA 66 compliance', () => {
      const overlay: BoundingBox = { x: 300, y: 300, width: 120, height: 60 };
      const balloons: BoundingBox[] = [
        { x: 280, y: 270, width: 150, height: 100 },
        { x: 500, y: 400, width: 180, height: 120 },
      ];

      // Warmup JIT
      for (let i = 0; i < 50; i++) {
        calculateBalloonCollisionAvoidance(overlay, balloons, defaultViewport, 'minimal_euclidean');
      }

      const runs = 1000;
      const start = process.hrtime.bigint();
      for (let i = 0; i < runs; i++) {
        calculateBalloonCollisionAvoidance(overlay, balloons, defaultViewport, 'minimal_euclidean');
      }
      const end = process.hrtime.bigint();
      const avgUs = Number(end - start) / (runs * 1000);

      expect(avgUs).toBeLessThan(20);
    });
  });
});
