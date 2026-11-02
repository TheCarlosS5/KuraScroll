/**
 * KuraScroll Sprint 96: Crease Shadow Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  CreaseShadowService,
  CREASE_SHADOW_PRESETS,
  CreaseShadowProfile,
} from '../../../../src/backend/services/crease-shadow-service.js';

describe('CreaseShadowService', () => {
  let db: DatabaseInstance;
  let service: CreaseShadowService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS crease_shadow_profiles (
        series_id TEXT PRIMARY KEY,
        spread_binding_mode TEXT NOT NULL DEFAULT 'tankobon_tight' CHECK (spread_binding_mode IN (
            'tankobon_tight',
            'magazine_wide',
            'flat_lay',
            'custom'
        )),
        spine_shadow_intensity REAL NOT NULL DEFAULT 0.65 CHECK (spine_shadow_intensity >= 0.00 AND spine_shadow_intensity <= 1.00),
        gutter_width_px INTEGER NOT NULL DEFAULT 24 CHECK (gutter_width_px >= 8 AND gutter_width_px <= 64),
        asymmetry_ratio REAL NOT NULL DEFAULT 0.50 CHECK (asymmetry_ratio >= 0.00 AND asymmetry_ratio <= 1.00),
        is_rtl INTEGER NOT NULL DEFAULT 1 CHECK (is_rtl IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_crease_shadow_lookup ON crease_shadow_profiles(series_id);
    `);
    service = new CreaseShadowService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateCreaseShadowParams', () => {
    it('synthesizes symmetric spine crease shadow at volume midpoint (progress 0.5)', () => {
      const res = service.calculateCreaseShadowParams(
        0.50, // progress midpoint
        0.65, // intensity
        24,   // gutter width
        0.50, // asymmetry
        true, // isRtl
        'tankobon_tight'
      );

      expect(res.spreadBindingMode).toBe('tankobon_tight');
      expect(res.effectiveAsymmetry).toBe(0.00);
      expect(res.leftGutterWidthPx).toBe(res.rightGutterWidthPx);
      expect(res.leftShadowOpacity).toBe(res.rightShadowOpacity);
      expect(res.leftPageShadowCss).toContain('linear-gradient(to left');
      expect(res.rightPageShadowCss).toContain('linear-gradient(to right');
      expect(res.spineCurvatureTransformCss).toContain('perspective(800px)');
    });

    it('asymmetrically shifts page block thickness for RTL manga at volume start (progress 0.0)', () => {
      const res = service.calculateCreaseShadowParams(
        0.00, // volume start
        0.65,
        24,
        0.50,
        true, // RTL
        'tankobon_tight'
      );

      // In RTL start: normalizedProgress = 1.0 - 0 = 1.0, progressShift > 0
      // Left block is thicker than right block
      expect(res.leftGutterWidthPx).toBeGreaterThan(res.rightGutterWidthPx);
      expect(res.leftShadowOpacity).toBeGreaterThan(res.rightShadowOpacity);
    });

    it('asymmetrically shifts page block thickness for LTR comics at volume start (progress 0.0)', () => {
      const res = service.calculateCreaseShadowParams(
        0.00,
        0.65,
        24,
        0.50,
        false, // LTR
        'magazine_wide'
      );

      // In LTR start: normalizedProgress = 0.0, progressShift < 0
      // Right block is thicker than left block
      expect(res.rightGutterWidthPx).toBeGreaterThan(res.leftGutterWidthPx);
      expect(res.rightShadowOpacity).toBeGreaterThan(res.leftShadowOpacity);
    });

    it('returns "none" gradient strings when intensity is 0', () => {
      const res = service.calculateCreaseShadowParams(
        0.50,
        0.00, // 0 intensity
        24,
        0.50,
        true,
        'flat_lay'
      );

      expect(res.leftPageShadowCss).toBe('none');
      expect(res.rightPageShadowCss).toBe('none');
    });
  });

  describe('getProfile / setProfile', () => {
    it('returns default fallback profile when series does not exist', () => {
      const prof = service.getProfile('series-nonexistent');
      expect(prof.seriesId).toBe('series-nonexistent');
      expect(prof.spreadBindingMode).toBe('tankobon_tight');
      expect(prof.spineShadowIntensity).toBe(0.65);
      expect(prof.gutterWidthPx).toBe(24);
      expect(prof.asymmetryRatio).toBe(0.50);
      expect(prof.isRtl).toBe(true);
      expect(prof.isEnabled).toBe(true);
    });

    it('persists and retrieves updated profile in SQLite', () => {
      const updated = service.setProfile({
        seriesId: 'monster-kanzenban',
        spreadBindingMode: 'flat_lay',
        spineShadowIntensity: 0.20,
        gutterWidthPx: 12,
        asymmetryRatio: 0.30,
        isRtl: true,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.spreadBindingMode).toBe('flat_lay');
      expect(updated.spineShadowIntensity).toBe(0.20);
      expect(updated.gutterWidthPx).toBe(12);

      const retrieved = service.getProfile('monster-kanzenban');
      expect(retrieved.spreadBindingMode).toBe('flat_lay');
      expect(retrieved.gutterWidthPx).toBe(12);
    });
  });
});
