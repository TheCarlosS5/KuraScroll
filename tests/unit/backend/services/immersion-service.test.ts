import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { ImmersionService } from '../../../../src/backend/services/immersion-service.js';

describe('Sprint 56 - ImmersionService Unit Tests', () => {
  let db: DatabaseInstance;
  let service: ImmersionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new ImmersionService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns safe default preferences for a new user', () => {
    const prefs = service.getPreferences('usr_new_1');
    expect(prefs.userId).toBe('usr_new_1');
    expect(prefs.hapticsEnabled).toBe(false);
    expect(prefs.screenRumbleEnabled).toBe(false);
    expect(prefs.maxHapticIntensity).toBe(1);
    expect(prefs.maxRumbleIntensity).toBe(1);
    expect(prefs.hapticsWithReducedMotion).toBe(false);
    expect(prefs.revision).toBe(1);
  });

  it('updates preferences and increments revision correctly', () => {
    const updated = service.updatePreferences('usr_new_1', {
      hapticsEnabled: true,
      screenRumbleEnabled: true,
      maxRumbleIntensity: 2,
    });

    expect(updated.hapticsEnabled).toBe(true);
    expect(updated.screenRumbleEnabled).toBe(true);
    expect(updated.maxRumbleIntensity).toBe(2);
    expect(updated.revision).toBe(2);

    // Retrieve again to verify SQLite persistence
    const saved = service.getPreferences('usr_new_1');
    expect(saved.hapticsEnabled).toBe(true);
    expect(saved.screenRumbleEnabled).toBe(true);
    expect(saved.maxRumbleIntensity).toBe(2);
    expect(saved.revision).toBe(2);
  });

  it('records impact telemetry batches without per-impact disk thrashing', () => {
    const batchId1 = service.recordTelemetryBatch({
      userId: 'usr_bench',
      sessionId: 'sess_1',
      sourceType: 'sfx',
      intensity: 1,
      triggerCount: 32,
      hapticApiAttempts: 32,
      hapticAcceptedCount: 28,
      hapticSuppressedCount: 4,
      rumbleAttemptCount: 32,
      rumbleExecutedCount: 30,
      rumbleSuppressedCount: 2,
    });

    expect(batchId1).toBeDefined();

    const summary = service.getAggregatedTelemetry('usr_bench');
    expect(summary.totalBatches).toBe(1);
    expect(summary.totalTriggers).toBe(32);
    expect(summary.totalHapticAccepted).toBe(28);
    expect(summary.totalRumbleExecuted).toBe(30);
    expect(summary.totalSuppressed).toBe(6);
  });
});
