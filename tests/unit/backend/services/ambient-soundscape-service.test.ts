import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  AmbientSoundscapeService,
  CANONICAL_SOUNDSCAPE_PRESETS,
  DEFAULT_USER_SOUNDSCAPE_PREFS,
} from '../../../../src/backend/services/ambient-soundscape-service.js';

describe('AmbientSoundscapeService Unit Tests (Sprint 73)', () => {
  let db: DatabaseInstance;
  let service: AmbientSoundscapeService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new AmbientSoundscapeService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Equal-Power Cross-Fade Gain Math (SLA 37)', () => {
    it('calculates exact boundary values for t = 0 and t = 1', () => {
      const atZero = AmbientSoundscapeService.calculateEqualPowerCrossFade(0);
      expect(atZero.t).toBe(0);
      expect(atZero.gainOut).toBeCloseTo(1.0, 5);
      expect(atZero.gainIn).toBeCloseTo(0.0, 5);

      const atOne = AmbientSoundscapeService.calculateEqualPowerCrossFade(1);
      expect(atOne.t).toBe(1);
      expect(atOne.gainOut).toBeCloseTo(0.0, 5);
      expect(atOne.gainIn).toBeCloseTo(1.0, 5);
    });

    it('conserves acoustic power across the entire cross-fade curve (gainOut^2 + gainIn^2 = 1)', () => {
      for (let step = 0; step <= 10; step++) {
        const t = step / 10;
        const res = AmbientSoundscapeService.calculateEqualPowerCrossFade(t);
        const powerSum = res.gainOut * res.gainOut + res.gainIn * res.gainIn;
        expect(powerSum).toBeCloseTo(1.0, 5);
      }
    });

    it('produces symmetric gains at midpoint t = 0.5 (~0.7071)', () => {
      const mid = AmbientSoundscapeService.calculateEqualPowerCrossFade(0.5);
      expect(mid.gainOut).toBeCloseTo(Math.SQRT1_2, 4);
      expect(mid.gainIn).toBeCloseTo(Math.SQRT1_2, 4);
    });

    it('clamps out-of-range t inputs gracefully', () => {
      const below = AmbientSoundscapeService.calculateEqualPowerCrossFade(-0.5);
      expect(below.t).toBe(0);
      expect(below.gainOut).toBeCloseTo(1.0, 5);

      const above = AmbientSoundscapeService.calculateEqualPowerCrossFade(1.5);
      expect(above.t).toBe(1);
      expect(above.gainIn).toBeCloseTo(1.0, 5);
    });
  });

  describe('Presets Catalog & Filtering', () => {
    it('seeds canonical 8 presets automatically upon initialization', () => {
      const presets = service.getPresets();
      expect(presets.length).toBeGreaterThanOrEqual(8);
      const ids = presets.map((p) => p.id);
      expect(ids).toContain('rain_night');
      expect(ids).toContain('medieval_tavern');
      expect(ids).toContain('epic_combat');
      expect(ids).toContain('mist_mystery');
      expect(ids).toContain('shrine_breeze');
      expect(ids).toContain('lofi_zen');
      expect(ids).toContain('cyber_subterranean');
      expect(ids).toContain('silence_pure');
    });

    it('filters presets by genre string', () => {
      const shonenPresets = service.getPresets('Shōnen');
      expect(shonenPresets.length).toBeGreaterThanOrEqual(1);
      expect(shonenPresets[0].id).toBe('epic_combat');

      const romancePresets = service.getPresets('Romance');
      expect(romancePresets.length).toBeGreaterThanOrEqual(1);
      expect(romancePresets[0].id).toBe('rain_night');
    });

    it('retrieves single preset by ID or returns null if not found', () => {
      const preset = service.getPresetById('medieval_tavern');
      expect(preset).not.toBeNull();
      expect(preset?.title).toBe('Taberna Medieval & Campamento');
      expect(preset?.fadeDurationMs).toBe(1500);

      const missing = service.getPresetById('non_existent_preset');
      expect(missing).toBeNull();
    });
  });

  describe('User Preferences Management', () => {
    it('returns default preferences for a new user', () => {
      const prefs = service.getUserPreferences('user_sound_new');
      expect(prefs.userId).toBe('user_sound_new');
      expect(prefs.masterVolume).toBe(DEFAULT_USER_SOUNDSCAPE_PREFS.masterVolume);
      expect(prefs.isMuted).toBe(false);
      expect(prefs.autoPlayOnReader).toBe(false);
      expect(prefs.activePresetId).toBe('silence_pure');
    });

    it('persists and updates user soundscape preferences', () => {
      const updated = service.updateUserPreferences({
        userId: 'user_sound_custom',
        masterVolume: 0.85,
        isMuted: true,
        autoPlayOnReader: true,
        activePresetId: 'rain_night',
      });

      expect(updated.masterVolume).toBe(0.85);
      expect(updated.isMuted).toBe(true);
      expect(updated.autoPlayOnReader).toBe(true);

      const fetched = service.getUserPreferences('user_sound_custom');
      expect(fetched.masterVolume).toBe(0.85);
      expect(fetched.isMuted).toBe(true);
      expect(fetched.autoPlayOnReader).toBe(true);
      expect(fetched.activePresetId).toBe('rain_night');
    });
  });
});
