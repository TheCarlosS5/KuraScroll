import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  PageProjectionService,
  clampPitch,
  clampYaw,
  clampPerspective,
  clampKeystone,
  computeProjectionEtag,
  calculateProjectionTransform,
  CANONICAL_PROJECTION_PRESETS,
  DEFAULT_PROJECTION_PROFILE,
} from '../../../../src/backend/services/page-projection-service.js';

describe('PageProjectionService Unit Tests (Sprint 81)', () => {
  let db: DatabaseInstance;
  let service: PageProjectionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new PageProjectionService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Mathematical Normalization & Clamping (PRJ-01, 02, 03, 04)', () => {
    it('clamps pitch strictly to [-35.0, 35.0] degrees', () => {
      expect(clampPitch(-90)).toBe(-35.0);
      expect(clampPitch(180)).toBe(35.0);
      expect(clampPitch(18.5)).toBe(18.5);
      expect(clampPitch(-15.2)).toBe(-15.2);
      expect(clampPitch(NaN)).toBe(0.0);
    });

    it('clamps yaw strictly to [-25.0, 25.0] degrees', () => {
      expect(clampYaw(-100)).toBe(-25.0);
      expect(clampYaw(75)).toBe(25.0);
      expect(clampYaw(12.0)).toBe(12.0);
      expect(clampYaw(NaN)).toBe(0.0);
    });

    it('clamps perspective distance strictly to [400, 2000] px', () => {
      expect(clampPerspective(0)).toBe(400);
      expect(clampPerspective(-500)).toBe(400);
      expect(clampPerspective(10000)).toBe(2000);
      expect(clampPerspective(1200)).toBe(1200);
      expect(clampPerspective(NaN)).toBe(1000);
    });

    it('clamps keystone correction ratio strictly to [0.0, 1.0]', () => {
      expect(clampKeystone(-0.5)).toBe(0.0);
      expect(clampKeystone(1.8)).toBe(1.0);
      expect(clampKeystone(0.35)).toBe(0.35);
      expect(clampKeystone(NaN)).toBe(0.0);
    });
  });

  describe('Deterministic ETag Calculation (PRJ-05)', () => {
    it('generates consistent, deterministic hex ETags', () => {
      const etag1 = computeProjectionEtag(18.0, 0.0, 1200, 0.25, 'desk_tilt_20');
      const etag2 = computeProjectionEtag(18.0, 0.0, 1200, 0.25, 'desk_tilt_20');
      const etag3 = computeProjectionEtag(28.0, 0.0, 1400, 0.4, 'easel_stand_15');

      expect(etag1).toBe(etag2);
      expect(etag1).not.toBe(etag3);
      expect(etag1).toMatch(/^"[a-f0-9]+"$/);
    });
  });

  describe('Zero-Allocation Transform Resolution (SLA 45 hot path)', () => {
    it('computes 3D perspective matrix transform without throwing', () => {
      const res = calculateProjectionTransform(18.0, 10.0, 1200, 0.25);
      expect(res.pitch).toBe(18.0);
      expect(res.yaw).toBe(10.0);
      expect(res.perspective).toBe(1200);
      expect(res.keystone).toBe(0.25);
      expect(res.cssTransform).toContain('perspective(1200px)');
      expect(res.cssTransform).toContain('rotateX(18deg)');
      expect(res.cssTransform).toContain('rotateY(10deg)');
      expect(res.matrix3d).toContain('matrix3d(');
      expect(res.quadTrapezoidRatio).toBeGreaterThan(0.6);
      expect(res.quadTrapezoidRatio).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Database Profile Persistence & Defaults', () => {
    it('returns default fallback profile when no record exists', () => {
      const profile = service.getProfile('series-prj-default', 'user-1');
      expect(profile.seriesId).toBe('series-prj-default');
      expect(profile.userId).toBe('user-1');
      expect(profile.pitchDegrees).toBe(0.0);
      expect(profile.yawDegrees).toBe(0.0);
      expect(profile.perspectivePx).toBe(1000);
      expect(profile.keystoneCorrection).toBe(0.0);
      expect(profile.focalPlanePreset).toBe('flat_orthodox');
      expect(profile.isEnabled).toBe(true);
    });

    it('saves and updates profile with boundary clamping', () => {
      const saved = service.saveProfile({
        seriesId: 'vagabond-art',
        userId: 'miyamoto',
        pitchDegrees: 45.0, // Clamped to 35.0
        yawDegrees: -50.0,  // Clamped to -25.0
        perspectivePx: 250, // Clamped to 400
        keystoneCorrection: 1.5, // Clamped to 1.0
        focalPlanePreset: 'easel_stand_15',
      });

      expect(saved.pitchDegrees).toBe(35.0);
      expect(saved.yawDegrees).toBe(-25.0);
      expect(saved.perspectivePx).toBe(400);
      expect(saved.keystoneCorrection).toBe(1.0);
      expect(saved.focalPlanePreset).toBe('easel_stand_15');

      const retrieved = service.getProfile('vagabond-art', 'miyamoto');
      expect(retrieved.pitchDegrees).toBe(35.0);
      expect(retrieved.yawDegrees).toBe(-25.0);
    });

    it('returns neutral transform when isEnabled is false', () => {
      const profile = service.getProfile('monster-series', 'tenma');
      profile.isEnabled = false;
      profile.pitchDegrees = 25.0;

      const eff = service.getEffectiveTransform(profile);
      expect(eff.pitch).toBe(0.0);
      expect(eff.yaw).toBe(0.0);
    });
  });
});
