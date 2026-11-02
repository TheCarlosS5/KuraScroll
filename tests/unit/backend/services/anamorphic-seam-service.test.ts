import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  AnamorphicSeamService,
  calculateAnamorphicSeam,
  ANAMORPHIC_SEAM_PRESETS,
} from '../../../../src/backend/services/anamorphic-seam-service.js';

describe('Sprint 111 - AnamorphicSeamService', () => {
  let db: DatabaseInstance;
  let service: AnamorphicSeamService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS anamorphic_seam_profiles (
        series_id TEXT PRIMARY KEY,
        aspect_ratio_mode TEXT NOT NULL DEFAULT 'native' CHECK (aspect_ratio_mode IN (
            'native',
            'anamorphic_4_3_to_16_9',
            'anamorphic_4_3_to_16_10',
            'custom_unsqueeze'
        )),
        unsqueeze_factor REAL NOT NULL DEFAULT 1.0 CHECK (unsqueeze_factor >= 0.70 AND unsqueeze_factor <= 1.50),
        seam_overlap_px REAL NOT NULL DEFAULT 0.75 CHECK (seam_overlap_px >= 0.0 AND seam_overlap_px <= 2.0),
        subpixel_snapping_mode TEXT NOT NULL DEFAULT 'cumulative_origin' CHECK (subpixel_snapping_mode IN (
            'cumulative_origin',
            'round',
            'floor',
            'ceil'
        )),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_anamorphic_seam_lookup ON anamorphic_seam_profiles(series_id);
    `);

    service = new AnamorphicSeamService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('retrieves default native profile for unconfigured series', () => {
    const profile = service.getProfile('series-new');
    expect(profile.seriesId).toBe('series-new');
    expect(profile.aspectRatioMode).toBe('native');
    expect(profile.unsqueezeFactor).toBe(1.0);
    expect(profile.seamOverlapPx).toBe(0.75);
    expect(profile.subpixelSnappingMode).toBe('cumulative_origin');
    expect(profile.isEnabled).toBe(true);
  });

  it('upserts and retrieves custom anamorphic seam profile', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-webtoon',
      aspectRatioMode: 'anamorphic_4_3_to_16_9',
      unsqueezeFactor: 1.3333,
      seamOverlapPx: 1.25,
      subpixelSnappingMode: 'floor',
      isEnabled: true,
    });

    expect(updated.seriesId).toBe('series-webtoon');
    expect(updated.aspectRatioMode).toBe('anamorphic_4_3_to_16_9');
    expect(updated.seamOverlapPx).toBe(1.25);
    expect(updated.subpixelSnappingMode).toBe('floor');

    const fetched = service.getProfile('series-webtoon');
    expect(fetched.aspectRatioMode).toBe('anamorphic_4_3_to_16_9');
    expect(fetched.seamOverlapPx).toBe(1.25);
    expect(fetched.subpixelSnappingMode).toBe('floor');
  });

  it('computes native 1:1 slice seam alignment with micro-overlap', () => {
    const result = calculateAnamorphicSeam(0, 0, 1200, 'native', 1.0, 0.75, 'cumulative_origin', true);
    expect(result.aspectRatioMode).toBe('native');
    expect(result.unsqueezeFactor).toBe(1.0);
    expect(result.rawStartY).toBe(0);
    expect(result.rawEndY).toBe(1200);
    expect(result.renderedStartY).toBe(0);
    expect(result.renderedEndY).toBe(1200);
    expect(result.renderedHeight).toBe(1200);
    expect(result.transformCss).toBe('none');
    expect(result.marginBottomCss).toBe('-0.75px');
    expect(result.latencyUs).toBeLessThan(100);
  });

  it('computes anamorphic 4:3 to 16:9 un-squeeze transformation and height compensation', () => {
    const result = calculateAnamorphicSeam(1, 1200, 1000, 'anamorphic_4_3_to_16_9', 1.0, 0.75, 'cumulative_origin', true);
    expect(result.aspectRatioMode).toBe('anamorphic_4_3_to_16_9');
    expect(result.unsqueezeFactor).toBe(1.3333);
    expect(result.rawStartY).toBe(1200);
    expect(result.rawEndY).toBe(2200);
    // 1200 * 1.3333 = 1599.96 -> round = 1600
    expect(result.renderedStartY).toBe(1600);
    // 2200 * 1.3333 = 2933.26 -> round = 2933
    expect(result.renderedEndY).toBe(2933);
    expect(result.renderedHeight).toBe(1333);
    expect(result.transformCss).toBe('scaleY(1.3333)');
    expect(result.marginBottomCss).toBe('-0.75px');
  });

  it('computes custom un-squeeze with clamping within bounds [0.70, 1.50]', () => {
    const resultHigh = calculateAnamorphicSeam(0, 0, 800, 'custom_unsqueeze', 2.0, 1.5, 'round', true);
    expect(resultHigh.unsqueezeFactor).toBe(1.50);

    const resultLow = calculateAnamorphicSeam(0, 0, 800, 'custom_unsqueeze', 0.5, 1.5, 'round', true);
    expect(resultLow.unsqueezeFactor).toBe(0.70);
  });

  it('handles disabled state cleanly with no transform and 0px margin', () => {
    const result = calculateAnamorphicSeam(2, 2000, 1000, 'anamorphic_4_3_to_16_9', 1.3333, 0.75, 'cumulative_origin', false);
    expect(result.transformCss).toBe('none');
    expect(result.marginBottomCss).toBe('0px');
    expect(result.renderedStartY).toBe(2000);
    expect(result.renderedEndY).toBe(3000);
    expect(result.renderedHeight).toBe(1000);
  });

  it('returns valid presets catalogue matching hardware specifications', () => {
    const presets = service.getPresets();
    expect(presets.native.unsqueezeFactor).toBe(1.0);
    expect(presets.anamorphic_4_3_to_16_9.unsqueezeFactor).toBe(1.3333);
    expect(presets.anamorphic_4_3_to_16_10.unsqueezeFactor).toBe(1.2000);
    expect(presets.custom_unsqueeze.aspectRatioMode).toBe('custom_unsqueeze');
  });
});
