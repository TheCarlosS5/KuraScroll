import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  SmartCropService,
  calculateCropBoundingBox,
  normalizeCropMode,
  clampMarginThreshold,
  clampTargetAspectRatio,
  clampPaddingPx,
  computeSmartCropEtag,
} from '../../../../src/backend/services/smart-crop-service.js';

describe('SmartCropService (Sprint 84)', () => {
  let db: DatabaseInstance;
  let service: SmartCropService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS smart_crop_profiles (
        series_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL DEFAULT 'dialogue_safe' CHECK (mode IN ('conservative', 'aggressive', 'dialogue_safe')),
        margin_threshold REAL NOT NULL DEFAULT 0.96 CHECK (margin_threshold >= 0.80 AND margin_threshold <= 0.99),
        aspect_ratio_lock INTEGER NOT NULL DEFAULT 0 CHECK (aspect_ratio_lock IN (0, 1)),
        target_aspect_ratio REAL NOT NULL DEFAULT 0.70 CHECK (target_aspect_ratio >= 0.40 AND target_aspect_ratio <= 2.0),
        padding_px INTEGER NOT NULL DEFAULT 12 CHECK (padding_px >= 0 AND padding_px <= 64),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
    `);
    service = new SmartCropService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns default fallback profile when series has no profile in DB', () => {
    const profile = service.getProfile('unregistered-crop-series');
    expect(profile.seriesId).toBe('unregistered-crop-series');
    expect(profile.mode).toBe('dialogue_safe');
    expect(profile.marginThreshold).toBe(0.96);
    expect(profile.aspectRatioLock).toBe(false);
    expect(profile.targetAspectRatio).toBe(0.70);
    expect(profile.paddingPx).toBe(12);
    expect(profile.isEnabled).toBe(true);
  });

  it('saves and retrieves customized smart crop profiles with proper clamping', () => {
    const saved = service.saveProfile({
      seriesId: 'series-berserk',
      mode: 'aggressive',
      marginThreshold: 0.92,
      aspectRatioLock: true,
      targetAspectRatio: 0.75,
      paddingPx: 8,
      isEnabled: true,
    });

    expect(saved.seriesId).toBe('series-berserk');
    expect(saved.mode).toBe('aggressive');
    expect(saved.aspectRatioLock).toBe(true);
    expect(saved.paddingPx).toBe(8);

    const retrieved = service.getProfile('series-berserk');
    expect(retrieved.mode).toBe('aggressive');
    expect(retrieved.targetAspectRatio).toBe(0.75);
    expect(retrieved.paddingPx).toBe(8);
  });

  it('clamps invalid or out-of-range numerical fields gracefully', () => {
    expect(clampMarginThreshold(1.5)).toBe(0.99);
    expect(clampMarginThreshold(0.2)).toBe(0.80);
    expect(clampTargetAspectRatio(3.5)).toBe(2.0);
    expect(clampTargetAspectRatio(0.1)).toBe(0.40);
    expect(clampPaddingPx(200)).toBe(64);
    expect(clampPaddingPx(-5)).toBe(0);
    expect(normalizeCropMode('unknown_mode')).toBe('dialogue_safe');
  });

  it('computes stable deterministic ETags', () => {
    const etag1 = computeSmartCropEtag('dialogue_safe', 0.95, false, 0.70, 12, true);
    const etag2 = computeSmartCropEtag('dialogue_safe', 0.95, false, 0.70, 12, true);
    const etag3 = computeSmartCropEtag('conservative', 0.95, false, 0.70, 12, true);

    expect(etag1).toBe(etag2);
    expect(etag1).not.toBe(etag3);
    expect(etag1.startsWith('W/"sc-')).toBe(true);
  });

  describe('calculateCropBoundingBox (SLA 48)', () => {
    it('calculates optimal crop box and computes margin percentage saved', () => {
      // Content covers 10% to 90% horizontally, 5% to 95% vertically
      const bounds = { minX: 0.10, minY: 0.05, maxX: 0.90, maxY: 0.95 };
      const res = calculateCropBoundingBox(1000, 1500, bounds, 'aggressive', 4, false, 0.70);

      expect(res.isCropped).toBe(true);
      expect(res.cropWidth).toBeLessThan(1000);
      expect(res.marginSavedPct).toBeGreaterThan(0);
      expect(res.effectiveAspectRatio).toBeGreaterThan(0);
    });

    it('falls back to full uncropped dimensions for completely blank pages', () => {
      // Blank or zero-extent content bounds
      const bounds = { minX: 0.5, minY: 0.5, maxX: 0.5, maxY: 0.5 };
      const res = calculateCropBoundingBox(1200, 1600, bounds);

      expect(res.isCropped).toBe(false);
      expect(res.cropX).toBe(0);
      expect(res.cropY).toBe(0);
      expect(res.cropWidth).toBe(1200);
      expect(res.cropHeight).toBe(1600);
      expect(res.marginSavedPct).toBe(0);
    });

    it('handles inverted bounds gracefully by sorting coordinates', () => {
      // Inverted bounds minX > maxX
      const bounds = { minX: 0.85, minY: 0.90, maxX: 0.15, maxY: 0.10 };
      const res = calculateCropBoundingBox(1000, 1500, bounds);

      expect(res.cropWidth).toBeGreaterThan(0);
      expect(res.cropHeight).toBeGreaterThan(0);
      expect(res.cropX).toBeGreaterThanOrEqual(0);
      expect(res.cropY).toBeGreaterThanOrEqual(0);
    });

    it('enforces aspect ratio lock when enabled', () => {
      const bounds = { minX: 0.2, minY: 0.2, maxX: 0.8, maxY: 0.8 };
      const res = calculateCropBoundingBox(1000, 1000, bounds, 'conservative', 12, true, 0.5);

      expect(res.effectiveAspectRatio).toBeCloseTo(0.5, 1);
    });
  });
});
