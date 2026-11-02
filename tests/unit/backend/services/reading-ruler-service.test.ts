import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  ReadingRulerService,
  ReadingRulerPreferences,
} from '../../../../src/backend/services/reading-ruler-service.js';

describe('ReadingRulerService Unit Tests (Sprint 71)', () => {
  let db: DatabaseInstance;
  let service: ReadingRulerService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new ReadingRulerService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Zero-Allocation Aperture Geometry Math', () => {
    it('calculates aperture and shutter boundaries for horizontal webtoon reading', () => {
      const geo = service.calculateAperture({
        centerCoord: 300,
        slotSize: 80,
        viewportLimit: 1000,
        orientation: 'horizontal',
        dimOpacity: 0.60,
        tintColor: 'amber',
      });

      expect(geo.orientation).toBe('horizontal');
      expect(geo.centerCoord).toBe(300);
      expect(geo.slotSize).toBe(80);
      expect(geo.apertureStart).toBe(260); // 300 - 40
      expect(geo.apertureEnd).toBe(340); // 300 + 40
      expect(geo.shutterBeforeSize).toBe(260);
      expect(geo.shutterAfterSize).toBe(660); // 1000 - 340
      expect(geo.dimOpacity).toBe(0.60);
      expect(geo.tintColor).toBe('amber');

      expect(geo.cssVars['--ruler-aperture-start']).toBe('260px');
      expect(geo.cssVars['--ruler-slot-size']).toBe('80px');
      expect(geo.cssVars['--ruler-tint-color']).toBe('#ffb74d');
    });

    it('calculates aperture for vertical manga RTL reading', () => {
      const geo = service.calculateAperture({
        centerCoord: 500,
        slotSize: 120,
        viewportLimit: 1200,
        orientation: 'vertical',
        dimOpacity: 0.40,
        tintColor: 'mint',
      });

      expect(geo.orientation).toBe('vertical');
      expect(geo.apertureStart).toBe(440); // 500 - 60
      expect(geo.apertureEnd).toBe(560); // 500 + 60
      expect(geo.shutterBeforeSize).toBe(440);
      expect(geo.shutterAfterSize).toBe(640); // 1200 - 560
      expect(geo.cssVars['--ruler-tint-color']).toBe('#81c784');
    });

    it('clamps out-of-bounds cursor coordinates cleanly', () => {
      const geo = service.calculateAperture({
        centerCoord: -500, // Clamps to 0
        slotSize: 300, // Clamps to 240
        viewportLimit: 800,
        dimOpacity: 1.5, // Clamps to 0.90
      });

      expect(geo.centerCoord).toBe(0);
      expect(geo.slotSize).toBe(240);
      expect(geo.apertureStart).toBe(0);
      expect(geo.apertureEnd).toBe(120);
      expect(geo.dimOpacity).toBe(0.90);
    });

    it('handles fallback for invalid optical tint', () => {
      const geo = service.calculateAperture({
        centerCoord: 100,
        viewportLimit: 500,
        tintColor: 'invalid_tint' as any,
      });

      expect(geo.tintColor).toBe('amber');
    });
  });

  describe('SQLite Persistence & Cache Lifecycle', () => {
    it('returns default preferences for new user', () => {
      const prefs = service.getPreferences('new_reader_user');
      expect(prefs.userId).toBe('new_reader_user');
      expect(prefs.isEnabled).toBe(false);
      expect(prefs.mode).toBe('ruler');
      expect(prefs.slotHeightPx).toBe(64);
      expect(prefs.dimOpacity).toBe(0.50);
      expect(prefs.tintColor).toBe('amber');
    });

    it('persists and updates preferences in SQLite with in-memory caching', () => {
      const customPrefs: ReadingRulerPreferences = {
        userId: 'adhd_reader_71',
        isEnabled: true,
        mode: 'shutter',
        orientation: 'horizontal',
        slotHeightPx: 96,
        dimOpacity: 0.75,
        tintColor: 'mint',
        pacerSpeedWpm: 320,
      };

      const saved = service.savePreferences(customPrefs);
      expect(saved.isEnabled).toBe(true);
      expect(saved.mode).toBe('shutter');
      expect(saved.slotHeightPx).toBe(96);
      expect(saved.tintColor).toBe('mint');

      // Verify memory cache hit
      const cached = service.getPreferences('adhd_reader_71');
      expect(cached.dimOpacity).toBe(0.75);

      // Clear memory cache and re-read from SQLite
      service.clearCache();
      const fromDb = service.getPreferences('adhd_reader_71');
      expect(fromDb.isEnabled).toBe(true);
      expect(fromDb.slotHeightPx).toBe(96);
      expect(fromDb.tintColor).toBe('mint');
    });

    it('resets preferences to default when requested', () => {
      service.savePreferences({
        userId: 'reset_user',
        isEnabled: true,
        mode: 'saccadic_pacer',
        orientation: 'vertical',
        slotHeightPx: 120,
        dimOpacity: 0.80,
        tintColor: 'rose',
        pacerSpeedWpm: 400,
      });

      const reset = service.resetPreferences('reset_user');
      expect(reset.isEnabled).toBe(false);
      expect(reset.mode).toBe('ruler');
      expect(reset.slotHeightPx).toBe(64);
    });
  });
});
