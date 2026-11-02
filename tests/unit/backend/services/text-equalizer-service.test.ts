/**
 * KuraScroll Sprint 97: Text Equalizer Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  TextEqualizerService,
  TEXT_EQUALIZER_PRESETS,
  TextEqualizerProfile,
} from '../../../../src/backend/services/text-equalizer-service.js';

describe('TextEqualizerService', () => {
  let db: DatabaseInstance;
  let service: TextEqualizerService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS text_equalizer_profiles (
        series_id TEXT PRIMARY KEY,
        equalizer_mode TEXT NOT NULL DEFAULT 'newsprint_vintage' CHECK (equalizer_mode IN (
            'newsprint_vintage',
            'glossy_digital',
            'faded_doujin',
            'custom'
        )),
        black_level_boost REAL NOT NULL DEFAULT 0.35 CHECK (black_level_boost >= 0.00 AND black_level_boost <= 1.00),
        white_level_compression REAL NOT NULL DEFAULT 0.20 CHECK (white_level_compression >= 0.00 AND white_level_compression <= 1.00),
        kanji_clarity_factor REAL NOT NULL DEFAULT 1.30 CHECK (kanji_clarity_factor >= 1.00 AND kanji_clarity_factor <= 2.50),
        is_furigana_sharpen_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_furigana_sharpen_enabled IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_text_equalizer_lookup ON text_equalizer_profiles(series_id);
    `);
    service = new TextEqualizerService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateTextEqualizerParams', () => {
    it('synthesizes newsprint vintage profile with standard defaults', () => {
      const res = service.calculateTextEqualizerParams(
        0.35, // blackBoost
        0.20, // whiteCompression
        1.30, // kanjiClarity
        true, // isFuriganaSharpen
        'newsprint_vintage'
      );

      expect(res.equalizerMode).toBe('newsprint_vintage');
      expect(res.effectiveContrast).toBe(1.16); // 1.00 + 0.35 * 0.45 = 1.1575 -> 1.16
      expect(res.effectiveBrightness).toBe(0.98); // 1.00 - 0.20 * 0.12 = 0.976 -> 0.98
      expect(res.edgeSharpenPx).toBe(0.18); // (1.30 - 1.00) * 0.60 = 0.18
      expect(res.compositeFilterCss).toContain('contrast(1.16)');
      expect(res.compositeFilterCss).toContain('brightness(0.98)');
      expect(res.subpixelMatrixCss).toContain('drop-shadow(0.18px');
      expect(res.isHighDensityBoostActive).toBe(true);
    });

    it('clamps out-of-range parameters to safe physical bounds', () => {
      const res = service.calculateTextEqualizerParams(
        -0.5, // blackBoost < 0 -> clamped to 0.00
        2.5,  // whiteCompression > 1 -> clamped to 1.00
        0.5,  // kanjiClarity < 1 -> clamped to 1.00
        false, // furigana disabled
        'custom'
      );

      expect(res.effectiveContrast).toBe(1.00);
      expect(res.effectiveBrightness).toBe(0.88); // 1.00 - 1.00 * 0.12 = 0.88
      expect(res.edgeSharpenPx).toBe(0);
      expect(res.subpixelMatrixCss).toBe('none');
      expect(res.isHighDensityBoostActive).toBe(false);
    });

    it('synthesizes glossy digital without furigana sharpen', () => {
      const res = service.calculateTextEqualizerParams(
        0.15,
        0.10,
        1.15,
        false,
        'glossy_digital'
      );

      expect(res.equalizerMode).toBe('glossy_digital');
      expect(res.edgeSharpenPx).toBe(0);
      expect(res.subpixelMatrixCss).toBe('none');
      expect(res.isHighDensityBoostActive).toBe(false);
    });

    it('synthesizes faded doujin with heavy black overdrive', () => {
      const res = service.calculateTextEqualizerParams(
        0.55,
        0.30,
        1.60,
        true,
        'faded_doujin'
      );

      expect(res.equalizerMode).toBe('faded_doujin');
      expect(res.effectiveContrast).toBe(1.25); // 1.00 + 0.55 * 0.45 = 1.2475 -> 1.25
      expect(res.edgeSharpenPx).toBe(0.36); // (1.60 - 1.00) * 0.60 = 0.36
      expect(res.isHighDensityBoostActive).toBe(true);
    });
  });

  describe('getProfile & setProfile', () => {
    it('returns default newsprint vintage profile when not stored in database', () => {
      const profile = service.getProfile('series-non-existent');
      expect(profile.seriesId).toBe('series-non-existent');
      expect(profile.equalizerMode).toBe('newsprint_vintage');
      expect(profile.blackLevelBoost).toBe(TEXT_EQUALIZER_PRESETS.newsprint_vintage.blackLevelBoost);
      expect(profile.whiteLevelCompression).toBe(TEXT_EQUALIZER_PRESETS.newsprint_vintage.whiteLevelCompression);
      expect(profile.kanjiClarityFactor).toBe(TEXT_EQUALIZER_PRESETS.newsprint_vintage.kanjiClarityFactor);
      expect(profile.isFuriganaSharpenEnabled).toBe(true);
      expect(profile.isEnabled).toBe(true);
      expect(profile.updatedAt).toBe(0);
    });

    it('persists and retrieves custom equalizer profile', () => {
      const newProfile: TextEqualizerProfile = {
        seriesId: 'vagabond-ch-1',
        equalizerMode: 'faded_doujin',
        blackLevelBoost: 0.50,
        whiteLevelCompression: 0.25,
        kanjiClarityFactor: 1.50,
        isFuriganaSharpenEnabled: true,
        isEnabled: true,
        updatedAt: 0,
      };

      const saved = service.setProfile(newProfile);
      expect(saved.seriesId).toBe('vagabond-ch-1');
      expect(saved.equalizerMode).toBe('faded_doujin');
      expect(saved.blackLevelBoost).toBe(0.50);
      expect(saved.whiteLevelCompression).toBe(0.25);
      expect(saved.kanjiClarityFactor).toBe(1.50);
      expect(saved.isFuriganaSharpenEnabled).toBe(true);
      expect(saved.updatedAt).toBeGreaterThan(0);

      const retrieved = service.getProfile('vagabond-ch-1');
      expect(retrieved.equalizerMode).toBe('faded_doujin');
      expect(retrieved.blackLevelBoost).toBe(0.50);
      expect(retrieved.whiteLevelCompression).toBe(0.25);
      expect(retrieved.kanjiClarityFactor).toBe(1.50);
    });

    it('updates existing profile via upsert ON CONFLICT', () => {
      service.setProfile({
        seriesId: 'series-x',
        equalizerMode: 'newsprint_vintage',
        blackLevelBoost: 0.35,
        whiteLevelCompression: 0.20,
        kanjiClarityFactor: 1.30,
        isFuriganaSharpenEnabled: true,
        isEnabled: true,
        updatedAt: 0,
      });

      const updated = service.setProfile({
        seriesId: 'series-x',
        equalizerMode: 'glossy_digital',
        blackLevelBoost: 0.15,
        whiteLevelCompression: 0.10,
        kanjiClarityFactor: 1.10,
        isFuriganaSharpenEnabled: false,
        isEnabled: false,
        updatedAt: 0,
      });

      expect(updated.equalizerMode).toBe('glossy_digital');
      expect(updated.blackLevelBoost).toBe(0.15);
      expect(updated.whiteLevelCompression).toBe(0.10);
      expect(updated.kanjiClarityFactor).toBe(1.10);
      expect(updated.isFuriganaSharpenEnabled).toBe(false);
      expect(updated.isEnabled).toBe(false);

      const retrieved = service.getProfile('series-x');
      expect(retrieved.equalizerMode).toBe('glossy_digital');
      expect(retrieved.blackLevelBoost).toBe(0.15);
      expect(retrieved.isEnabled).toBe(false);
    });
  });
});
