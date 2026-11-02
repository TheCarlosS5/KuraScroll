import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { UserPreferencesRepository } from '../../../src/backend/repositories/user-preferences-repository';

describe('Sprint 33: UserPreferencesRepository (Indexed Point Lookup & UPSERT)', () => {
  let db: DatabaseInstance;
  let repo: UserPreferencesRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    repo = new UserPreferencesRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns default preferences without requiring an initial database row', () => {
    const prefs = repo.getPreferences('new_reader');
    expect(prefs.userId).toBe('new_reader');
    expect(prefs.readerTheme).toBe('carbon');
    expect(prefs.batterySaverEnabled).toBe(true);
    expect(prefs.adaptivePrefetch).toBe(true);
    expect(prefs.animationsEnabled).toBe(true);
    expect(prefs.version).toBe(1);
  });

  it('performs atomic UPSERT and increments version on updates', () => {
    const updated = repo.updatePreferences('user_1', {
      readerTheme: 'oled',
      batterySaverEnabled: false,
    });

    expect(updated.userId).toBe('user_1');
    expect(updated.readerTheme).toBe('oled');
    expect(updated.batterySaverEnabled).toBe(false);
    expect(updated.adaptivePrefetch).toBe(true); // default maintained
    expect(updated.version).toBe(1);

    // Second update
    const secondUpdate = repo.updatePreferences('user_1', {
      readerTheme: 'sepia',
    });
    expect(secondUpdate.readerTheme).toBe('sepia');
    expect(secondUpdate.batterySaverEnabled).toBe(false); // preserved
    expect(secondUpdate.version).toBe(2);
  });

  it('sanitizes invalid theme strings and preserves valid existing theme', () => {
    repo.updatePreferences('user_2', { readerTheme: 'midnight' });
    const invalidUpdate = repo.updatePreferences('user_2', { readerTheme: 'non-existent-theme' as any });

    expect(invalidUpdate.readerTheme).toBe('midnight');
  });

  it('executes point lookups in sub-millisecond time (< 0.2ms)', () => {
    repo.updatePreferences('bench_user', { readerTheme: 'sepia' });

    // Warm-up query
    repo.getPreferences('bench_user');

    const iterations = 500;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      repo.getPreferences('bench_user');
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(0.2); // SLA < 0.2ms met
  });
});
