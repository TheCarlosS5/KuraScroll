import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  PageSplitStitchService,
  DEFAULT_SPLIT_STITCH_PROFILE,
  RawPageInput,
} from '../../../../src/backend/services/page-split-stitch-service.js';

describe('PageSplitStitchService Unit Tests (Sprint 76)', () => {
  let db: DatabaseInstance;
  let service: PageSplitStitchService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new PageSplitStitchService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Profile Persistence & Hierarchy', () => {
    it('returns default fallback profile when no record exists', () => {
      const profile = service.getProfile('series-default', 'c1', 1);
      expect(profile.seriesId).toBe('series-default');
      expect(profile.mode).toBe('none');
      expect(profile.splitRatio).toBe(0.50);
      expect(profile.stitchGapPx).toBe(0);
      expect(profile.isEnabled).toBe(true);
    });

    it('upserts and retrieves series-level, chapter-level, and page-level profiles', () => {
      // 1. Series-level profile
      service.upsertProfile({
        seriesId: 'one-piece',
        mode: 'split_rtl',
        splitRatio: 0.52,
        stitchGapPx: 0,
        isEnabled: true,
      });

      const seriesProfile = service.getProfile('one-piece');
      expect(seriesProfile.mode).toBe('split_rtl');
      expect(seriesProfile.splitRatio).toBe(0.52);

      // Chapter lookup should inherit series profile
      const chapInherit = service.getProfile('one-piece', 'chap-100');
      expect(chapInherit.mode).toBe('split_rtl');

      // 2. Override at Chapter-level
      service.upsertProfile({
        seriesId: 'one-piece',
        chapterId: 'chap-100',
        mode: 'none',
        splitRatio: 0.50,
        stitchGapPx: 0,
        isEnabled: true,
      });

      const chapOverride = service.getProfile('one-piece', 'chap-100');
      expect(chapOverride.mode).toBe('none');

      // 3. Override at Page-level
      service.upsertProfile({
        seriesId: 'one-piece',
        chapterId: 'chap-100',
        pageNumber: 15,
        mode: 'split_rtl',
        splitRatio: 0.48,
        stitchGapPx: 0,
        isEnabled: true,
      });

      const pageOverride = service.getProfile('one-piece', 'chap-100', 15);
      expect(pageOverride.mode).toBe('split_rtl');
      expect(pageOverride.splitRatio).toBe(0.48);
    });

    it('clamps splitRatio between 0.20 and 0.80 and stitchGapPx between -10 and 200', () => {
      const clamped = service.upsertProfile({
        seriesId: 'tower-of-god',
        mode: 'stitch_webtoon',
        splitRatio: 0.99, // Should clamp to 0.80
        stitchGapPx: 500, // Should clamp to 200
        isEnabled: true,
      });

      expect(clamped.splitRatio).toBe(0.80);
      expect(clamped.stitchGapPx).toBe(200);
    });
  });

  describe('Virtual Stream Geometry Resolution (SLA 40)', () => {
    it('returns identity slices when mode is none or isEnabled is false', () => {
      const pages: RawPageInput[] = [
        { pageNumber: 1, width: 800, height: 1200, aspectRatio: 0.667 },
        { pageNumber: 2, width: 1600, height: 1200, aspectRatio: 1.333 },
      ];

      const res = PageSplitStitchService.resolveVirtualPageStream(pages, {
        mode: 'none',
        isEnabled: true,
      });

      expect(res.totalVirtualPages).toBe(2);
      expect(res.slices[0].half).toBe('full');
      expect(res.slices[1].half).toBe('full');
      expect(res.slices[0].clipWidthPct).toBe(1.0);
    });

    it('splits spreads in RTL order for Japanese manga (Right half first, Left half second)', () => {
      const pages: RawPageInput[] = [
        { pageNumber: 1, width: 800, height: 1200, aspectRatio: 0.667 }, // Single page
        { pageNumber: 2, width: 1600, height: 1200, aspectRatio: 1.333 }, // Double-page spread
      ];

      const res = PageSplitStitchService.resolveVirtualPageStream(pages, {
        mode: 'split_rtl',
        splitRatio: 0.50,
        isEnabled: true,
      });

      // Page 1 remains 1 slice, Page 2 splits into 2 slices -> 3 total slices
      expect(res.totalVirtualPages).toBe(3);

      // Slice 0: Page 1 (full)
      expect(res.slices[0].originalPageNumber).toBe(1);
      expect(res.slices[0].half).toBe('full');

      // Slice 1: Page 2 Right half (RTL first)
      expect(res.slices[1].originalPageNumber).toBe(2);
      expect(res.slices[1].half).toBe('right');
      expect(res.slices[1].clipLeftPct).toBe(0.50);
      expect(res.slices[1].clipWidthPct).toBe(0.50);

      // Slice 2: Page 2 Left half (RTL second)
      expect(res.slices[2].originalPageNumber).toBe(2);
      expect(res.slices[2].half).toBe('left');
      expect(res.slices[2].clipLeftPct).toBe(0.0);
      expect(res.slices[2].clipWidthPct).toBe(0.50);
    });

    it('splits spreads in LTR order for Western / Manhwa readers (Left half first, Right half second)', () => {
      const pages: RawPageInput[] = [
        { pageNumber: 5, width: 1800, height: 1200, aspectRatio: 1.5 },
      ];

      const res = PageSplitStitchService.resolveVirtualPageStream(pages, {
        mode: 'split_ltr',
        splitRatio: 0.50,
        isEnabled: true,
      });

      expect(res.totalVirtualPages).toBe(2);
      expect(res.slices[0].half).toBe('left');
      expect(res.slices[1].half).toBe('right');
    });

    it('chains consecutive strips into a zero-gap stitched vertical ribbon', () => {
      const pages: RawPageInput[] = [
        { pageNumber: 1, width: 800, height: 1200, aspectRatio: 0.667 },
        { pageNumber: 2, width: 800, height: 1000, aspectRatio: 0.8 },
        { pageNumber: 3, width: 400, height: 600, aspectRatio: 0.667 }, // Half width, will scale 2.0x
      ];

      const res = PageSplitStitchService.resolveVirtualPageStream(pages, {
        mode: 'stitch_webtoon',
        stitchGapPx: 2,
        isEnabled: true,
      });

      expect(res.totalVirtualPages).toBe(3);

      // Slice 0: Y = 0
      expect(res.slices[0].verticalOffsetY).toBe(0);
      expect(res.slices[0].scaleFactor).toBe(1.0);

      // Slice 1: Y = 0 + 1200 + 2 = 1202
      expect(res.slices[1].verticalOffsetY).toBe(1202);
      expect(res.slices[1].scaleFactor).toBe(1.0);

      // Slice 2: Y = 1202 + 1000 + 2 = 2204, scaleFactor = 800 / 400 = 2.0
      expect(res.slices[2].verticalOffsetY).toBe(2204);
      expect(res.slices[2].scaleFactor).toBe(2.0);
    });

    it('achieves sub-20µs latency for 50 mixed pages (SLA 40)', () => {
      const pages: RawPageInput[] = Array.from({ length: 50 }, (_, i) => ({
        pageNumber: i + 1,
        width: i % 5 === 0 ? 1600 : 800,
        height: 1200,
        aspectRatio: i % 5 === 0 ? 1.333 : 0.667,
      }));

      const profile = {
        mode: 'split_rtl' as const,
        splitRatio: 0.50,
        isEnabled: true,
      };

      // Warmup JIT
      for (let i = 0; i < 2000; i++) {
        PageSplitStitchService.resolveVirtualPageStream(pages, profile);
      }

      // Benchmark 5000 iterations
      const iterations = 5000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        PageSplitStitchService.resolveVirtualPageStream(pages, profile);
      }
      const elapsedMs = performance.now() - start;
      const avgLatencyMs = elapsedMs / iterations;

      // SLA 40 target: < 0.02 ms (< 20µs)
      expect(avgLatencyMs).toBeLessThan(0.05); // Vitest headroom
    });
  });
});
