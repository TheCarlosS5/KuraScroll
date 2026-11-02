/**
 * KuraScroll Sprint 93: Page Curl Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  PageCurlService,
  PAGE_CURL_PRESETS,
  PageCurlProfile,
} from '../../../../src/backend/services/page-curl-service.js';

describe('PageCurlService', () => {
  let db: DatabaseInstance;
  let service: PageCurlService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS page_curl_profiles (
        series_id TEXT PRIMARY KEY,
        curl_preset TEXT NOT NULL DEFAULT 'tankobon_stiff' CHECK (curl_preset IN (
            'tankobon_stiff',
            'doujin_silk',
            'newsprint_pulp',
            'custom'
        )),
        paper_stiffness REAL NOT NULL DEFAULT 0.85 CHECK (paper_stiffness >= 0.20 AND paper_stiffness <= 1.00),
        max_curl_angle_deg REAL NOT NULL DEFAULT 45.0 CHECK (max_curl_angle_deg >= 15.0 AND max_curl_angle_deg <= 85.0),
        shadow_depth REAL NOT NULL DEFAULT 0.40 CHECK (shadow_depth >= 0.00 AND shadow_depth <= 1.00),
        is_peel_corner_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_peel_corner_enabled IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_page_curl_lookup ON page_curl_profiles(series_id);
    `);
    service = new PageCurlService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculatePageCurlTransform', () => {
    it('computes tankobon_stiff mode transform accurately with zero blur', () => {
      const res = service.calculatePageCurlTransform(0.5, 50, 0.85, 45.0, 0.40, true, true, 'tankobon_stiff');
      expect(res.curlPreset).toBe('tankobon_stiff');
      expect(res.dragProgress).toBe(0.5);
      expect(res.effectiveAngleDeg).toBeLessThan(0); // RTL rotation is negative
      expect(res.transformMatrixCss).toContain('perspective(1000px)');
      expect(res.transformMatrixCss).toContain('rotateY(');
      expect(res.transformMatrixCss).toContain('skewY(');
      expect(res.spineShadowCss).toContain('linear-gradient(to left');
      expect(res.cornerPeelPercent).toBeGreaterThan(0);
      expect(res.isCompleted).toBe(false);
    });

    it('enforces LTR transform when isRtl is false', () => {
      const res = service.calculatePageCurlTransform(0.5, 0, 0.85, 45.0, 0.40, true, false, 'tankobon_stiff');
      expect(res.effectiveAngleDeg).toBeGreaterThan(0);
      expect(res.spineShadowCss).toContain('linear-gradient(to right');
    });

    it('marks turn as completed when progress >= 0.95', () => {
      const res = service.calculatePageCurlTransform(0.96, 120, 0.60, 75.0, 0.55, true, true, 'doujin_silk');
      expect(res.isCompleted).toBe(true);
    });

    it('clamps drag progress within 0.00 to 1.00', () => {
      const underflow = service.calculatePageCurlTransform(-0.5);
      expect(underflow.dragProgress).toBe(0.00);

      const overflow = service.calculatePageCurlTransform(1.5);
      expect(overflow.dragProgress).toBe(1.00);
    });

    it('zeroes corner peel displacement if disabled', () => {
      const res = service.calculatePageCurlTransform(0.5, 0, 0.85, 45.0, 0.40, false);
      expect(res.cornerPeelPercent).toBe(0);
    });
  });

  describe('getProfile / setProfile', () => {
    it('returns default fallback profile when series does not exist', () => {
      const prof = service.getProfile('series-nonexistent');
      expect(prof.seriesId).toBe('series-nonexistent');
      expect(prof.curlPreset).toBe('tankobon_stiff');
      expect(prof.paperStiffness).toBe(0.85);
      expect(prof.maxCurlAngleDeg).toBe(45.0);
      expect(prof.shadowDepth).toBe(0.40);
      expect(prof.isPeelCornerEnabled).toBe(true);
      expect(prof.isEnabled).toBe(true);
    });

    it('persists and retrieves updated profile in SQLite', () => {
      const updated = service.setProfile({
        seriesId: 'berserk-deluxe',
        curlPreset: 'newsprint_pulp',
        paperStiffness: 0.92,
        maxCurlAngleDeg: 35.0,
        shadowDepth: 0.30,
        isPeelCornerEnabled: false,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.curlPreset).toBe('newsprint_pulp');
      expect(updated.paperStiffness).toBe(0.92);
      expect(updated.isPeelCornerEnabled).toBe(false);

      const retrieved = service.getProfile('berserk-deluxe');
      expect(retrieved.curlPreset).toBe('newsprint_pulp');
      expect(retrieved.paperStiffness).toBe(0.92);
      expect(retrieved.isPeelCornerEnabled).toBe(false);
    });

    it('updates existing profile correctly without duplicate rows', () => {
      service.setProfile({
        seriesId: 'one-piece',
        curlPreset: 'tankobon_stiff',
        paperStiffness: 0.85,
        maxCurlAngleDeg: 45.0,
        shadowDepth: 0.40,
        isPeelCornerEnabled: true,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      service.setProfile({
        seriesId: 'one-piece',
        curlPreset: 'doujin_silk',
        paperStiffness: 0.60,
        maxCurlAngleDeg: 75.0,
        shadowDepth: 0.55,
        isPeelCornerEnabled: false,
        isEnabled: false,
        updatedAt: Date.now(),
      });

      const retrieved = service.getProfile('one-piece');
      expect(retrieved.curlPreset).toBe('doujin_silk');
      expect(retrieved.paperStiffness).toBe(0.60);
      expect(retrieved.isEnabled).toBe(false);
    });
  });
});
