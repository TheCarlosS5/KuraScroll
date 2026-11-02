/**
 * KuraScroll Sprint 90: Bi-Directional History Scrubber Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  HistoryScrubberService,
  SCRUBBER_MODE_CONFIGS,
  HistoryScrubberProfile,
} from '../../../../src/backend/services/history-scrubber-service.js';

describe('HistoryScrubberService', () => {
  let db: DatabaseInstance;
  let service: HistoryScrubberService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS history_scrubber_profiles (
        series_id TEXT PRIMARY KEY,
        scrubber_mode TEXT NOT NULL DEFAULT 'webtoon_continuous' CHECK (scrubber_mode IN (
            'webtoon_continuous',
            'manga_rtl_continuous',
            'manga_ltr_continuous'
        )),
        tape_thickness_px INTEGER NOT NULL DEFAULT 48 CHECK (tape_thickness_px >= 24 AND tape_thickness_px <= 120),
        heatmap_intensity REAL NOT NULL DEFAULT 0.65 CHECK (heatmap_intensity >= 0.00 AND heatmap_intensity <= 1.00),
        velocity_multiplier REAL NOT NULL DEFAULT 1.20 CHECK (velocity_multiplier >= 0.50 AND velocity_multiplier <= 3.00),
        is_snap_to_chapter INTEGER NOT NULL DEFAULT 1 CHECK (is_snap_to_chapter IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_scrubber_lookup ON history_scrubber_profiles(series_id);
    `);
    service = new HistoryScrubberService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateTapeProjection', () => {
    it('projects webtoon vertical positions accurately', () => {
      const res = service.calculateTapeProjection(100, 50, 1000, 'webtoon_continuous');
      expect(res.totalItems).toBe(100);
      expect(res.clampedIndex).toBe(50);
      expect(res.isVertical).toBe(true);
      expect(res.isRtl).toBe(false);
      expect(res.normalizedPosition).toBeCloseTo(50 / 99, 2);
      expect(res.pixelOffset).toBeCloseTo((50 / 99) * 1000, 1);
      expect(res.isAtStart).toBe(false);
      expect(res.isAtEnd).toBe(false);
    });

    it('inverts positions in manga_rtl_continuous mode', () => {
      const res = service.calculateTapeProjection(10, 0, 1000, 'manga_rtl_continuous');
      expect(res.isRtl).toBe(true);
      expect(res.isVertical).toBe(false);
      expect(res.normalizedPosition).toBe(1.0); // RTL start is right side (100%)
      expect(res.pixelOffset).toBe(1000);
      expect(res.isAtStart).toBe(true);

      const resEnd = service.calculateTapeProjection(10, 9, 1000, 'manga_rtl_continuous');
      expect(resEnd.normalizedPosition).toBe(0.0); // RTL end is left side (0%)
      expect(resEnd.pixelOffset).toBe(0);
      expect(resEnd.isAtEnd).toBe(true);
    });

    it('calculates chapter snapping indices when interval is provided', () => {
      const res = service.calculateTapeProjection(100, 48, 1000, 'webtoon_continuous', 20);
      expect(res.nearestChapterSnapIndex).toBe(40);

      const resSnapNear = service.calculateTapeProjection(100, 52, 1000, 'webtoon_continuous', 20);
      expect(resSnapNear.nearestChapterSnapIndex).toBe(60);
    });

    it('handles boundary edge cases with clamping and single items', () => {
      const resUnder = service.calculateTapeProjection(50, -10, 800);
      expect(resUnder.clampedIndex).toBe(0);
      expect(resUnder.isAtStart).toBe(true);

      const resOver = service.calculateTapeProjection(50, 999, 800);
      expect(resOver.clampedIndex).toBe(49);
      expect(resOver.isAtEnd).toBe(true);

      const resSingle = service.calculateTapeProjection(1, 0, 800);
      expect(resSingle.normalizedPosition).toBe(0);
      expect(resSingle.pixelOffset).toBe(0);
    });
  });

  describe('getProfile and setProfile', () => {
    it('returns default webtoon_continuous profile when not found in DB', () => {
      const prof = service.getProfile('series-solo-leveling');
      expect(prof.seriesId).toBe('series-solo-leveling');
      expect(prof.scrubberMode).toBe('webtoon_continuous');
      expect(prof.tapeThicknessPx).toBe(48);
      expect(prof.heatmapIntensity).toBe(0.65);
      expect(prof.velocityMultiplier).toBe(1.20);
      expect(prof.isSnapToChapter).toBe(true);
      expect(prof.isEnabled).toBe(true);
      expect(prof.updatedAt).toBe(0);
    });

    it('persists and updates history scrubber profile with bounds checking', () => {
      const updated = service.setProfile({
        seriesId: 'series-solo-leveling',
        scrubberMode: 'manga_rtl_continuous',
        tapeThicknessPx: 64,
        heatmapIntensity: 0.80,
        velocityMultiplier: 1.5,
        isSnapToChapter: true,
        isEnabled: true,
        updatedAt: Date.now(),
      });

      expect(updated.seriesId).toBe('series-solo-leveling');
      expect(updated.scrubberMode).toBe('manga_rtl_continuous');
      expect(updated.tapeThicknessPx).toBe(64);
      expect(updated.heatmapIntensity).toBe(0.80);

      const fetched = service.getProfile('series-solo-leveling');
      expect(fetched.seriesId).toBe('series-solo-leveling');
      expect(fetched.scrubberMode).toBe('manga_rtl_continuous');
      expect(fetched.tapeThicknessPx).toBe(64);
    });
  });
});
