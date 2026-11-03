import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  CJKKerningService,
  calculateCJKKerning,
  CJK_KERNING_PRESETS,
} from '../../../../src/backend/services/cjk-kerning-service.js';

describe('CJKKerningService', () => {
  let db: DatabaseInstance;
  let service: CJKKerningService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new CJKKerningService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-cjk-1');
    expect(profile.seriesId).toBe('series-cjk-1');
    expect(profile.presetName).toBe('manga_dense_kanji');
    expect(profile.baseKerningEm).toBe(0.04);
    expect(profile.trackingRatio).toBe(0.015);
    expect(profile.minKerningEm).toBe(-0.02);
    expect(profile.maxKerningEm).toBe(0.20);
    expect(profile.opticalWeightRatio).toBe(0.25);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-cjk',
      presetName: 'webtoon_hangul_flow',
      baseKerningEm: 1.0, // clamp to 0.50
      trackingRatio: 0.5, // clamp to 0.10
      minKerningEm: -0.5, // clamp to -0.20
      maxKerningEm: 2.5, // clamp to 1.0
      opticalWeightRatio: 2.0, // clamp to 1.0
    });

    expect(updated.baseKerningEm).toBe(0.50);
    expect(updated.trackingRatio).toBe(0.10);
    expect(updated.minKerningEm).toBe(-0.20);
    expect(updated.maxKerningEm).toBe(1.0);
    expect(updated.opticalWeightRatio).toBe(1.0);
    expect(updated.presetName).toBe('webtoon_hangul_flow');

    const fetched = service.getProfile('series-clamped-cjk');
    expect(fetched.baseKerningEm).toBe(0.50);
    expect(fetched.trackingRatio).toBe(0.10);
  });

  it('classifies Unicode codepoints and computes balanced kerning accurately', () => {
    // 1. Dense Kanji: '龍' (Dragon, U+9F8D)
    const kanjiRes = calculateCJKKerning(0x9f8d, 0.04, 0.015, -0.02, 0.20, 0.25, true);
    expect(kanjiRes.densityType).toBe('kanji');
    expect(kanjiRes.strokeComplexity).toBe(12.0);
    expect(kanjiRes.kerningEm).toBeGreaterThan(0.04); // Expanded spacing for dense kanji
    expect(kanjiRes.opticalWeightRatio).toBeLessThan(1.0); // Compensated thinner stroke

    // 2. Light Kana: 'あ' (Hiragana A, U+3042)
    const kanaRes = calculateCJKKerning(0x3042, 0.04, 0.015, -0.02, 0.20, 0.25, true);
    expect(kanaRes.densityType).toBe('kana');
    expect(kanaRes.strokeComplexity).toBe(2.5);
    expect(kanaRes.kerningEm).toBeLessThan(0.04); // Tightened spacing

    // 3. Hangul Syllable: '한' (U+D55C)
    const hangulRes = calculateCJKKerning(0xd55c, 0.04, 0.015, -0.02, 0.20, 0.25, true);
    expect(hangulRes.densityType).toBe('hangul');
    expect(hangulRes.strokeComplexity).toBe(6.0);

    // 4. Basic Latin: 'A' (U+0041)
    const latinRes = calculateCJKKerning(0x0041, 0.04, 0.015, -0.02, 0.20, 0.25, true);
    expect(latinRes.densityType).toBe('latin');
    expect(latinRes.strokeComplexity).toBe(1.5);
  });

  it('handles disabled state as neutral pass-through', () => {
    const disabled = calculateCJKKerning(0x9f8d, 0.04, 0.015, -0.02, 0.20, 0.25, false);
    expect(disabled.kerningEm).toBe(0.0);
    expect(disabled.cssLetterSpacing).toBe('0em');
    expect(disabled.opticalWeightRatio).toBe(1.0);
  });

  it('generates consistent ETags and handles cache clearing', () => {
    const profile = service.getProfile('series-etag-cjk');
    const etag1 = service.generateETag(profile);
    const etag2 = service.generateETag(profile);
    expect(etag1).toBe(etag2);

    service.clearCache();
    const fetched = service.getProfile('series-etag-cjk');
    expect(fetched.seriesId).toBe('series-etag-cjk');
  });

  it('verifies all CJK kerning presets are properly configured', () => {
    expect(Object.keys(CJK_KERNING_PRESETS).length).toBe(5);
    for (const [key, preset] of Object.entries(CJK_KERNING_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(preset.maxKerningEm).toBeGreaterThanOrEqual(preset.minKerningEm);
      expect(preset.trackingRatio).toBeGreaterThanOrEqual(0);
      expect(preset.opticalWeightRatio).toBeGreaterThanOrEqual(0);
    }
  });
});
