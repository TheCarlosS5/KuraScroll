import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PageBevelService,
  calculatePageBevel,
  PAGE_BEVEL_PRESETS,
} from '../../../../src/backend/services/page-bevel-service.js';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';

describe('Sprint 109 - PageBevelService', () => {
  let db: DatabaseInstance;
  let service: PageBevelService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS page_bevel_profiles (
        series_id TEXT PRIMARY KEY,
        paper_caliper_mode TEXT NOT NULL DEFAULT 'tankobon_silk_110um' CHECK (paper_caliper_mode IN (
            'newsprint_65um',
            'pulp_85um',
            'tankobon_silk_110um',
            'omnibus_coated_130um',
            'custom'
        )),
        max_stack_thickness_px INTEGER NOT NULL DEFAULT 24 CHECK (max_stack_thickness_px >= 4 AND max_stack_thickness_px <= 48),
        page_caliper_um REAL NOT NULL DEFAULT 110.0 CHECK (page_caliper_um >= 40.0 AND page_caliper_um <= 300.0),
        curvature_sag_pct INTEGER NOT NULL DEFAULT 35 CHECK (curvature_sag_pct >= 0 AND curvature_sag_pct <= 100),
        edge_bevel_shading_pct INTEGER NOT NULL DEFAULT 40 CHECK (edge_bevel_shading_pct >= 0 AND edge_bevel_shading_pct <= 100),
        reading_direction TEXT NOT NULL DEFAULT 'rtl' CHECK (reading_direction IN ('rtl', 'ltr', 'vertical')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_page_bevel_lookup ON page_bevel_profiles(series_id);
    `);
    service = new PageBevelService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should return default profile if none exists', () => {
    const profile = service.getProfile('test-series-109');
    expect(profile.seriesId).toBe('test-series-109');
    expect(profile.paperCaliperMode).toBe('tankobon_silk_110um');
    expect(profile.maxStackThicknessPx).toBe(24);
    expect(profile.pageCaliperUm).toBe(110.0);
    expect(profile.readingDirection).toBe('rtl');
    expect(profile.isEnabled).toBe(true);
  });

  it('should upsert and retrieve updated profile', () => {
    const updated = service.upsertProfile({
      seriesId: 'test-series-109',
      paperCaliperMode: 'omnibus_coated_130um',
      maxStackThicknessPx: 36,
      readingDirection: 'ltr',
    });

    expect(updated.seriesId).toBe('test-series-109');
    expect(updated.paperCaliperMode).toBe('omnibus_coated_130um');
    expect(updated.maxStackThicknessPx).toBe(36);
    expect(updated.readingDirection).toBe('ltr');

    const retrieved = service.getProfile('test-series-109');
    expect(retrieved.paperCaliperMode).toBe('omnibus_coated_130um');
    expect(retrieved.readingDirection).toBe('ltr');
  });

  it('should calculate RTL asymmetry correctly across reading progress', () => {
    // Page 1 of 200 in RTL: 0 read pages on left, 199 unread pages on right
    const start = calculatePageBevel(1, 200, 'rtl', 24, 110, 35, 40, true);
    expect(start.leftThicknessPx).toBe(0);
    expect(start.rightThicknessPx).toBe(24);
    expect(start.leftPagesCount).toBe(0);
    expect(start.rightPagesCount).toBe(199);
    expect(start.progressRatio).toBe(0.0);
    expect(start.leftBevelGradient).toBe('none');
    expect(start.rightBevelGradient).toContain('linear-gradient');

    // Page 100 of 200 in RTL: roughly half-way
    const mid = calculatePageBevel(100, 200, 'rtl', 24, 110, 35, 40, true);
    expect(mid.leftThicknessPx).toBeGreaterThan(10);
    expect(mid.rightThicknessPx).toBeGreaterThan(10);
    expect(mid.sagOffsetPx).toBeGreaterThan(0);

    // Page 200 of 200 in RTL: 199 read pages on left, 0 unread on right
    const end = calculatePageBevel(200, 200, 'rtl', 24, 110, 35, 40, true);
    expect(end.leftThicknessPx).toBe(24);
    expect(end.rightThicknessPx).toBe(0);
    expect(end.leftPagesCount).toBe(199);
    expect(end.rightPagesCount).toBe(0);
  });

  it('should calculate LTR asymmetry correctly', () => {
    // Page 1 of 200 in LTR: 199 unread pages on left, 0 read pages on right
    const start = calculatePageBevel(1, 200, 'ltr', 24, 110, 35, 40, true);
    expect(start.leftThicknessPx).toBe(24);
    expect(start.rightThicknessPx).toBe(0);

    // Page 200 of 200 in LTR: 0 unread on left, 199 read on right
    const end = calculatePageBevel(200, 200, 'ltr', 24, 110, 35, 40, true);
    expect(end.leftThicknessPx).toBe(0);
    expect(end.rightThicknessPx).toBe(24);
  });

  it('should return 0 thickness when disabled or single page', () => {
    const disabled = calculatePageBevel(10, 200, 'rtl', 24, 110, 35, 40, false);
    expect(disabled.leftThicknessPx).toBe(0);
    expect(disabled.rightThicknessPx).toBe(0);
    expect(disabled.leftBevelGradient).toBe('none');

    const singlePage = calculatePageBevel(1, 1, 'rtl', 24, 110, 35, 40, true);
    expect(singlePage.leftThicknessPx).toBe(0);
    expect(singlePage.rightThicknessPx).toBe(0);
  });

  it('should return valid presets dictionary', () => {
    const presets = service.getPresets();
    expect(presets.tankobon_silk_110um).toBeDefined();
    expect(presets.newsprint_65um).toBeDefined();
    expect(presets.pulp_85um).toBeDefined();
    expect(presets.omnibus_coated_130um).toBeDefined();
  });

  it('should evaluate in < 50 µs per call after warmup', () => {
    // Warmup
    for (let i = 0; i < 1000; i++) {
      calculatePageBevel(100, 200, 'rtl', 24, 110, 35, 40, true);
    }

    const t0 = process.hrtime.bigint();
    const result = calculatePageBevel(100, 200, 'rtl', 24, 110, 35, 40, true);
    const t1 = process.hrtime.bigint();
    const durationUs = Number(t1 - t0) / 1000;

    expect(result.leftThicknessPx).toBeDefined();
    expect(durationUs).toBeLessThan(50);
  });
});
