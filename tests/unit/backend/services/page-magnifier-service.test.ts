import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  PageMagnifierService,
  DEFAULT_MAGNIFIER_PROFILE,
  CANONICAL_MAGNIFIER_PRESETS,
} from '../../../../src/backend/services/page-magnifier-service.js';

describe('PageMagnifierService Unit Tests (Sprint 78)', () => {
  let db: DatabaseInstance;
  let service: PageMagnifierService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new PageMagnifierService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Profile Persistence & Hierarchy', () => {
    it('returns default fallback profile when no record exists', () => {
      const profile = service.getProfile('series-default', 'c1');
      expect(profile.seriesId).toBe('series-default');
      expect(profile.shape).toBe('circle');
      expect(profile.zoomFactor).toBe(2.0);
      expect(profile.lensRadiusPx).toBe(120);
      expect(profile.smoothingFactor).toBe(0.15);
      expect(profile.borderColor).toBe('#3b82f6');
      expect(profile.isEnabled).toBe(true);
    });

    it('upserts and retrieves series-level and chapter-level profiles', () => {
      // 1. Series-level profile
      service.upsertProfile({
        seriesId: 'vinland-saga',
        shape: 'rectangle',
        zoomFactor: 3.0,
        lensRadiusPx: 140,
        smoothingFactor: 0.10,
        borderColor: '#10b981',
        isEnabled: true,
      });

      const seriesProfile = service.getProfile('vinland-saga');
      expect(seriesProfile.shape).toBe('rectangle');
      expect(seriesProfile.zoomFactor).toBe(3.0);

      // Chapter lookup should inherit series profile
      const chapInherit = service.getProfile('vinland-saga', 'chap-10');
      expect(chapInherit.shape).toBe('rectangle');

      // 2. Override at Chapter-level
      service.upsertProfile({
        seriesId: 'vinland-saga',
        chapterId: 'chap-10',
        shape: 'circle',
        zoomFactor: 4.0,
        lensRadiusPx: 160,
        smoothingFactor: 0.05,
        borderColor: '#f59e0b',
        isEnabled: true,
      });

      const chapOverride = service.getProfile('vinland-saga', 'chap-10');
      expect(chapOverride.shape).toBe('circle');
      expect(chapOverride.zoomFactor).toBe(4.0);

      // Other chapter still gets series default
      const otherChap = service.getProfile('vinland-saga', 'chap-11');
      expect(otherChap.shape).toBe('rectangle');
    });

    it('clamps out-of-range profile values properly', () => {
      const saved = service.upsertProfile({
        seriesId: 'clamped-series',
        shape: 'circle',
        zoomFactor: 10.0, // max 4.0
        lensRadiusPx: 500, // max 250
        smoothingFactor: 1.0, // max 0.5
        borderColor: '#3b82f6',
        isEnabled: true,
      });

      expect(saved.zoomFactor).toBe(4.0);
      expect(saved.lensRadiusPx).toBe(250);
      expect(saved.smoothingFactor).toBe(0.5);
    });
  });

  describe('calculateLoupeTransform Coordinate Generation', () => {
    it('returns isVisible false when cursor is outside container', () => {
      const result = PageMagnifierService.calculateLoupeTransform({
        cursorX: -50,
        cursorY: 100,
        containerWidth: 800,
        containerHeight: 1200,
      });

      expect(result.isVisible).toBe(false);
    });

    it('calculates accurate lens placement and background position when cursor is inside', () => {
      const result = PageMagnifierService.calculateLoupeTransform({
        cursorX: 400,
        cursorY: 600,
        containerWidth: 800,
        containerHeight: 1200,
        zoomFactor: 2.0,
        lensRadiusPx: 120,
        shape: 'circle',
      });

      expect(result.isVisible).toBe(true);
      expect(result.lensLeftPx).toBe(280); // 400 - 120
      expect(result.lensTopPx).toBe(480); // 600 - 120
      expect(result.lensWidthPx).toBe(240); // 120 * 2
      expect(result.lensHeightPx).toBe(240);
      expect(result.bgWidth).toBe(1600); // 800 * 2
      expect(result.bgHeight).toBe(2400); // 1200 * 2
      expect(result.bgPosX).toBe(-680); // -(400 * 2 - 120)
      expect(result.bgPosY).toBe(-1080); // -(600 * 2 - 120)
      expect(result.borderRadius).toBe('50%');
    });

    it('handles rectangular loupe shape correctly', () => {
      const result = PageMagnifierService.calculateLoupeTransform({
        cursorX: 200,
        cursorY: 300,
        containerWidth: 800,
        containerHeight: 1200,
        zoomFactor: 3.0,
        lensRadiusPx: 100,
        shape: 'rectangle',
      });

      expect(result.isVisible).toBe(true);
      expect(result.borderRadius).toBe('8px');
      expect(result.lensHeightPx).toBe(150); // 100 * 1.5
    });

    it('executes calculateLoupeTransform within SLA 42 bounds (< 20µs)', () => {
      const start = performance.now();
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        PageMagnifierService.calculateLoupeTransform({
          cursorX: 300,
          cursorY: 500,
          containerWidth: 1000,
          containerHeight: 1500,
          zoomFactor: 2.5,
          lensRadiusPx: 120,
        });
      }
      const elapsedMs = performance.now() - start;
      const avgUs = (elapsedMs / iterations) * 1000;

      expect(avgUs).toBeLessThan(20.0);
    });
  });
});
