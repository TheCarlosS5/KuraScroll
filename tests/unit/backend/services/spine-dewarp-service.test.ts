import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  SpineDewarpService,
  SpineDewarpProfile,
  DEFAULT_SPINE_DEWARP_PROFILE,
} from '../../../../src/backend/services/spine-dewarp-service.js';

describe('SpineDewarpService Unit Tests (Sprint 74)', () => {
  let db: DatabaseInstance;
  let service: SpineDewarpService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new SpineDewarpService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Dewarping Mesh Geometry Calculation (SLA 38)', () => {
    it('returns identity scale and brightness when isEnabled is false or curvatureDepth is 0', () => {
      const disabled = SpineDewarpService.calculateDewarpMesh({
        isEnabled: false,
        curvatureDepth: 0.5,
      });

      expect(disabled.isEnabled).toBe(false);
      expect(disabled.slices).toHaveLength(16);
      for (const s of disabled.slices) {
        expect(s.scaleX).toBe(1.0);
        expect(s.brightness).toBe(1.0);
      }

      const zeroDepth = SpineDewarpService.calculateDewarpMesh({
        isEnabled: true,
        curvatureDepth: 0,
      });
      expect(zeroDepth.slices[0].scaleX).toBe(1.0);
    });

    it('calculates quadratic elongation and brightness boost near the spine gutter', () => {
      const mesh = SpineDewarpService.calculateDewarpMesh({
        isEnabled: true,
        curvatureDepth: 0.30,
        shadowCompensation: 0.20,
        spineWidthPct: 0.25,
      });

      expect(mesh.slices).toHaveLength(16);

      // Slice 0 (at the spine, u = 0): maximum elongation and brightness
      const first = mesh.slices[0];
      expect(first.normPos).toBe(0.0);
      expect(first.scaleX).toBeGreaterThan(1.2);
      expect(first.brightness).toBeCloseTo(1.20, 4);

      // Slice 15 (at the flat boundary, u = 1): zero curvature correction
      const last = mesh.slices[15];
      expect(last.normPos).toBe(1.0);
      expect(last.scaleX).toBe(1.0);
      expect(last.brightness).toBe(1.0);

      // Monotonic descent in elongation factor from spine to flat page
      for (let i = 0; i < 15; i++) {
        expect(mesh.slices[i].scaleX).toBeGreaterThanOrEqual(mesh.slices[i + 1].scaleX);
        expect(mesh.slices[i].brightness).toBeGreaterThanOrEqual(mesh.slices[i + 1].brightness);
      }
    });

    it('supports custom slice counts', () => {
      const mesh8 = SpineDewarpService.calculateDewarpMesh({ sliceCount: 8 });
      expect(mesh8.slices).toHaveLength(8);

      const mesh24 = SpineDewarpService.calculateDewarpMesh({ sliceCount: 24 });
      expect(mesh24.slices).toHaveLength(24);
    });
  });

  describe('Profile Persistence & Hierarchical Resolution', () => {
    it('returns default fallback profile when none exists', () => {
      const prof = service.getProfile('series_tankobon_new');
      expect(prof.seriesId).toBe('series_tankobon_new');
      expect(prof.curvatureDepth).toBe(DEFAULT_SPINE_DEWARP_PROFILE.curvatureDepth);
      expect(prof.spineWidthPct).toBe(0.20);
      expect(prof.shadowCompensation).toBe(0.15);
      expect(prof.gutterSide).toBe('auto');
    });

    it('saves series-wide profile and retrieves it accurately', () => {
      const saved = service.saveProfile({
        seriesId: 'berserk_vol1',
        gutterSide: 'right',
        curvatureDepth: 0.40,
        spineWidthPct: 0.30,
        shadowCompensation: 0.25,
        isEnabled: true,
      });

      expect(saved.id).toBe('berserk_vol1:all:all');
      expect(saved.curvatureDepth).toBe(0.40);

      const retrieved = service.getProfile('berserk_vol1');
      expect(retrieved.curvatureDepth).toBe(0.40);
      expect(retrieved.gutterSide).toBe('right');
      expect(retrieved.spineWidthPct).toBe(0.30);
    });

    it('resolves specific page override over series default', () => {
      // Series default
      service.saveProfile({
        id: 'series_jojo:default',
        seriesId: 'series_jojo',
        gutterSide: 'left',
        curvatureDepth: 0.20,
        spineWidthPct: 0.15,
        shadowCompensation: 0.10,
        isEnabled: true,
      });

      // Page-specific override (e.g. Page 10 is right side)
      service.saveProfile({
        id: 'series_jojo:ch1:p10',
        seriesId: 'series_jojo',
        chapterId: 'ch1',
        pageNumber: 10,
        gutterSide: 'right',
        curvatureDepth: 0.45,
        spineWidthPct: 0.35,
        shadowCompensation: 0.30,
        isEnabled: true,
      });

      // Lookup with pageNumber 10 should return specific override
      const pageProf = service.getProfile('series_jojo', 'ch1', 10);
      expect(pageProf.gutterSide).toBe('right');
      expect(pageProf.curvatureDepth).toBe(0.45);

      // Lookup without pageNumber should fallback to series default
      const generalProf = service.getProfile('series_jojo');
      expect(generalProf.gutterSide).toBe('left');
      expect(generalProf.curvatureDepth).toBe(0.20);
    });

    it('deletes profile by ID', () => {
      service.saveProfile({
        id: 'profile_to_del',
        seriesId: 'series_del',
        gutterSide: 'center',
        curvatureDepth: 0.30,
        spineWidthPct: 0.20,
        shadowCompensation: 0.10,
        isEnabled: true,
      });

      const deleted = service.deleteProfile('profile_to_del');
      expect(deleted).toBe(true);

      const fallback = service.getProfile('series_del');
      expect(fallback.id).toContain('default');
    });
  });
});
