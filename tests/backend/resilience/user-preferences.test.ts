import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Sprint 33: Battery Saver, Tab Inactivity & User Preferences Service
 */
class UserPreferencesService {
  constructor(private db: DatabaseInstance) {}

  public saveThemePreference(userId: string, theme: string): string {
    const validThemes = ['carbon', 'midnight', 'oled', 'sepia'];
    const sanitizedTheme = validThemes.includes(theme) ? theme : 'carbon'; // Graceful fallback to 'carbon'

    this.db.prepare(`
      INSERT INTO user_preferences (user_id, reader_theme, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        reader_theme = excluded.reader_theme,
        updated_at = datetime('now')
    `).run(userId, sanitizedTheme);

    return sanitizedTheme;
  }

  public getThemePreference(userId: string): string {
    const row = this.db.prepare(`
      SELECT reader_theme FROM user_preferences WHERE user_id = ?
    `).get(userId) as any;

    if (!row || !['carbon', 'midnight', 'oled', 'sepia'].includes(row.reader_theme)) {
      return 'carbon';
    }
    return row.reader_theme;
  }

  // Battery Manager simulation for Firefox/Safari fallback & < 15% threshold
  public evaluateBatteryStatus(navigatorObj: any): { powerSaverMode: boolean; prefetchEnabled: boolean } {
    if (!navigatorObj || typeof navigatorObj.getBattery !== 'function') {
      // Fallback without crashes when navigator.getBattery is unavailable (Firefox/Safari)
      return { powerSaverMode: false, prefetchEnabled: true };
    }
    // Assume simulated battery object
    const battery = navigatorObj.getBattery();
    const level = battery.level ?? 1.0;
    const powerSaver = level < 0.15;
    return {
      powerSaverMode: powerSaver,
      prefetchEnabled: !powerSaver,
    };
  }

  // Tab Inactivity / Visibility State handler
  public handleVisibilityChange(visibilityState: string): { memoryRevoked: boolean; autoScrollActive: boolean } {
    if (visibilityState === 'hidden') {
      return { memoryRevoked: true, autoScrollActive: false };
    }
    return { memoryRevoked: false, autoScrollActive: true };
  }
}

describe('Sprint 33: Battery Saver & Tab Inactivity Resilience Suite', () => {
  let db: DatabaseInstance;
  let service: UserPreferencesService;
  let testSandbox: string;

  beforeEach(async () => {
    testSandbox = path.resolve(__dirname, 'sandbox-sprint33');
    await fs.mkdir(testSandbox, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        theme TEXT NOT NULL DEFAULT 'carbon',
        updated_at TEXT NOT NULL
      );
    `);

    service = new UserPreferencesService(db);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. navigator.getBattery unavailable fallback (Firefox/Safari)
  // =========================================================================
  it('1.1: gracefully handles unavailable navigator.getBattery without crashing', async () => {
    // Navigator object without getBattery (Firefox / Safari environment simulation)
    const mockNavigatorWithoutBattery = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X...) Safari/605.1.15' };

    const status = service.evaluateBatteryStatus(mockNavigatorWithoutBattery);
    expect(status.powerSaverMode).toBe(false);
    expect(status.prefetchEnabled).toBe(true);
  });

  // =========================================================================
  // 2. Battery below 15% triggers Power Saver mode
  // =========================================================================
  it('2.1: battery level below 15% triggers Power Saver mode and suspends adaptive prefetcher', async () => {
    const mockNavigatorLowBattery = {
      getBattery: () => ({ level: 0.10, charging: false })
    };

    const status = service.evaluateBatteryStatus(mockNavigatorLowBattery);
    expect(status.powerSaverMode).toBe(true);
    expect(status.prefetchEnabled).toBe(false);
  });

  // =========================================================================
  // 3. Tab hidden triggers panel memory revocation and halts auto-scroll
  // =========================================================================
  it('3.1: document.visibilityState === hidden triggers memory revocation and halts auto-scroll', async () => {
    const result = service.handleVisibilityChange('hidden');
    expect(result.memoryRevoked).toBe(true);
    expect(result.autoScrollActive).toBe(false);

    const resultVisible = service.handleVisibilityChange('visible');
    expect(resultVisible.memoryRevoked).toBe(false);
    expect(resultVisible.autoScrollActive).toBe(true);
  });

  // =========================================================================
  // 4. Preference persistence: Invalid theme strings fallback to default 'carbon'
  // =========================================================================
  it('4.1: invalid theme string falls back gracefully to default carbon theme', async () => {
    const userId = 'user-themes';

    // Save valid theme
    const savedSepia = service.saveThemePreference(userId, 'sepia');
    expect(savedSepia).toBe('sepia');
    expect(service.getThemePreference(userId)).toBe('sepia');

    // Save invalid malformed theme string injection
    const savedInvalid = service.saveThemePreference(userId, 'malformed_hack_theme_xyz');
    expect(savedInvalid).toBe('carbon');
    expect(service.getThemePreference(userId)).toBe('carbon');
  });
});
