/**
 * KuraScroll Sprint 98: Reading Dwell Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  ReadingDwellService,
  READING_DWELL_PRESETS,
  ReadingDwellProfile,
} from '../../../../src/backend/services/reading-dwell-service.js';

describe('ReadingDwellService', () => {
  let db: DatabaseInstance;
  let service: ReadingDwellService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS reading_dwell_profiles (
        series_id TEXT PRIMARY KEY,
        prediction_mode TEXT NOT NULL DEFAULT 'cadence_adaptive' CHECK (prediction_mode IN (
            'cadence_adaptive',
            'action_heavy',
            'dialogue_dense',
            'custom'
        )),
        base_dwell_ms INTEGER NOT NULL DEFAULT 4500 CHECK (base_dwell_ms >= 1000 AND base_dwell_ms <= 30000),
        complexity_weight REAL NOT NULL DEFAULT 1.25 CHECK (complexity_weight >= 0.50 AND complexity_weight <= 3.00),
        urgency_threshold_ms INTEGER NOT NULL DEFAULT 800 CHECK (urgency_threshold_ms >= 200 AND urgency_threshold_ms <= 3000),
        is_prefetch_trigger_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_prefetch_trigger_enabled IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reading_dwell_lookup ON reading_dwell_profiles(series_id);
    `);
    service = new ReadingDwellService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateDwellPrediction', () => {
    it('synthesizes standard cadence adaptive prediction with proper progress metrics', () => {
      const res = service.calculateDwellPrediction(
        2000, // elapsedMs
        4500, // baseDwellMs
        1.25, // complexityWeight
        800,  // urgencyThresholdMs
        'cadence_adaptive'
      );

      expect(res.predictionMode).toBe('cadence_adaptive');
      expect(res.predictedTotalDwellMs).toBe(5625); // 4500 * 1.25 = 5625
      expect(res.elapsedMs).toBe(2000);
      expect(res.remainingDwellMs).toBe(3625);
      expect(res.progressPct).toBe(36); // 2000 / 5625 = 35.5% -> 36%
      expect(res.isUrgentPrefetchTriggered).toBe(false);
      expect(res.urgencyRatio).toBe(0.36);
    });

    it('triggers urgent prefetch when remaining dwell drops below threshold', () => {
      const res = service.calculateDwellPrediction(
        5000, // elapsedMs
        4500,
        1.25, // 5625ms total
        800,  // remaining = 625ms <= 800ms
        'cadence_adaptive'
      );

      expect(res.remainingDwellMs).toBe(625);
      expect(res.isUrgentPrefetchTriggered).toBe(true);
      expect(res.progressPct).toBe(89);
    });

    it('saturates progress to 100% and remaining to 0 when elapsed exceeds predicted dwell', () => {
      const res = service.calculateDwellPrediction(
        8000, // elapsedMs > 5625ms
        4500,
        1.25,
        800,
        'cadence_adaptive'
      );

      expect(res.remainingDwellMs).toBe(0);
      expect(res.progressPct).toBe(100);
      expect(res.isUrgentPrefetchTriggered).toBe(true);
      expect(res.urgencyRatio).toBe(1.0);
    });

    it('clamps out-of-range parameters to safe physical bounds', () => {
      const res = service.calculateDwellPrediction(
        -500,  // elapsed < 0 -> clamped to 0
        500,   // base < 1000 -> clamped to 1000
        5.0,   // weight > 3.00 -> clamped to 3.00
        5000,  // urgency > 3000 -> clamped to 3000
        'custom'
      );

      expect(res.baseDwellMs).toBe(1000);
      expect(res.complexityWeight).toBe(3.00);
      expect(res.predictedTotalDwellMs).toBe(3000); // 1000 * 3.00
      expect(res.elapsedMs).toBe(0);
      expect(res.remainingDwellMs).toBe(3000);
    });

    it('handles action heavy mode with accelerated turnaround', () => {
      const res = service.calculateDwellPrediction(
        1500,
        2500,
        0.85,
        600,
        'action_heavy'
      );

      expect(res.predictionMode).toBe('action_heavy');
      expect(res.predictedTotalDwellMs).toBe(2125); // 2500 * 0.85 = 2125
      expect(res.remainingDwellMs).toBe(625);
      expect(res.isUrgentPrefetchTriggered).toBe(false); // 625 > 600
    });
  });

  describe('getProfile & setProfile', () => {
    it('returns default cadence adaptive profile when not stored in database', () => {
      const profile = service.getProfile('series-not-found');
      expect(profile.seriesId).toBe('series-not-found');
      expect(profile.predictionMode).toBe('cadence_adaptive');
      expect(profile.baseDwellMs).toBe(READING_DWELL_PRESETS.cadence_adaptive.baseDwellMs);
      expect(profile.complexityWeight).toBe(READING_DWELL_PRESETS.cadence_adaptive.complexityWeight);
      expect(profile.urgencyThresholdMs).toBe(READING_DWELL_PRESETS.cadence_adaptive.urgencyThresholdMs);
      expect(profile.isPrefetchTriggerEnabled).toBe(true);
      expect(profile.isEnabled).toBe(true);
      expect(profile.updatedAt).toBe(0);
    });

    it('persists and retrieves custom reading dwell profile', () => {
      const newProfile: ReadingDwellProfile = {
        seriesId: 'monster-ch-1',
        predictionMode: 'dialogue_dense',
        baseDwellMs: 8000,
        complexityWeight: 2.00,
        urgencyThresholdMs: 1200,
        isPrefetchTriggerEnabled: true,
        isEnabled: true,
        updatedAt: 0,
      };

      const saved = service.setProfile(newProfile);
      expect(saved.seriesId).toBe('monster-ch-1');
      expect(saved.predictionMode).toBe('dialogue_dense');
      expect(saved.baseDwellMs).toBe(8000);
      expect(saved.complexityWeight).toBe(2.00);
      expect(saved.urgencyThresholdMs).toBe(1200);
      expect(saved.updatedAt).toBeGreaterThan(0);

      const retrieved = service.getProfile('monster-ch-1');
      expect(retrieved.predictionMode).toBe('dialogue_dense');
      expect(retrieved.baseDwellMs).toBe(8000);
      expect(retrieved.complexityWeight).toBe(2.00);
    });

    it('updates existing profile via upsert ON CONFLICT', () => {
      service.setProfile({
        seriesId: 'series-dwell-x',
        predictionMode: 'cadence_adaptive',
        baseDwellMs: 4500,
        complexityWeight: 1.25,
        urgencyThresholdMs: 800,
        isPrefetchTriggerEnabled: true,
        isEnabled: true,
        updatedAt: 0,
      });

      const updated = service.setProfile({
        seriesId: 'series-dwell-x',
        predictionMode: 'action_heavy',
        baseDwellMs: 2200,
        complexityWeight: 0.80,
        urgencyThresholdMs: 500,
        isPrefetchTriggerEnabled: false,
        isEnabled: false,
        updatedAt: 0,
      });

      expect(updated.predictionMode).toBe('action_heavy');
      expect(updated.baseDwellMs).toBe(2200);
      expect(updated.complexityWeight).toBe(0.80);
      expect(updated.isPrefetchTriggerEnabled).toBe(false);
      expect(updated.isEnabled).toBe(false);

      const retrieved = service.getProfile('series-dwell-x');
      expect(retrieved.predictionMode).toBe('action_heavy');
      expect(retrieved.baseDwellMs).toBe(2200);
      expect(retrieved.isEnabled).toBe(false);
    });
  });
});
