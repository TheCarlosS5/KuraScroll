/**
 * Sprint 56 - User Immersion Preferences & Batch Telemetry Service
 *
 * Implemented with node:sqlite DatabaseSync for zero native compilation dependencies.
 * Avoids per-impact SATA II HDD write amplification by handling batch telemetry.
 */

import { DatabaseInstance } from '../db/database.js';
import { ImpactIntensity } from '../utils/impact-router.js';

export interface ImmersionPreferences {
  userId: string;
  hapticsEnabled: boolean;
  screenRumbleEnabled: boolean;
  maxHapticIntensity: ImpactIntensity;
  maxRumbleIntensity: ImpactIntensity;
  hapticsWithReducedMotion: boolean;
  updatedAt: number;
  revision: number;
}

export interface ImmersionPreferencesInput {
  hapticsEnabled?: boolean;
  screenRumbleEnabled?: boolean;
  maxHapticIntensity?: ImpactIntensity;
  maxRumbleIntensity?: ImpactIntensity;
  hapticsWithReducedMotion?: boolean;
}

export interface ImpactTelemetryBatchInput {
  batchId?: string;
  userId: string;
  sessionId: string;
  sourceType: 'sfx' | 'onomatopoeia' | 'manual';
  intensity: ImpactIntensity;
  triggerCount: number;
  hapticApiAttempts?: number;
  hapticAcceptedCount?: number;
  hapticSuppressedCount?: number;
  rumbleAttemptCount?: number;
  rumbleExecutedCount?: number;
  rumbleSuppressedCount?: number;
}

export interface ImpactTelemetrySummary {
  totalBatches: number;
  totalTriggers: number;
  totalHapticAccepted: number;
  totalRumbleExecuted: number;
  totalSuppressed: number;
}

export class ImmersionService {
  private db: DatabaseInstance;

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  public getPreferences(userId: string): ImmersionPreferences {
    const stmt = this.db.prepare(`
      SELECT user_id, haptics_enabled, screen_rumble_enabled,
             max_haptic_intensity, max_rumble_intensity,
             haptics_with_reduced_motion, updated_at, revision
      FROM user_immersion_preferences
      WHERE user_id = ?
    `);

    const row = stmt.get(userId) as any;
    if (!row) {
      return {
        userId,
        hapticsEnabled: false,
        screenRumbleEnabled: false,
        maxHapticIntensity: 1,
        maxRumbleIntensity: 1,
        hapticsWithReducedMotion: false,
        updatedAt: Date.now(),
        revision: 1,
      };
    }

    return {
      userId: row.user_id,
      hapticsEnabled: Boolean(row.haptics_enabled),
      screenRumbleEnabled: Boolean(row.screen_rumble_enabled),
      maxHapticIntensity: row.max_haptic_intensity as ImpactIntensity,
      maxRumbleIntensity: row.max_rumble_intensity as ImpactIntensity,
      hapticsWithReducedMotion: Boolean(row.haptics_with_reduced_motion),
      updatedAt: Number(row.updated_at),
      revision: Number(row.revision),
    };
  }

  public updatePreferences(userId: string, input: ImmersionPreferencesInput): ImmersionPreferences {
    const current = this.getPreferences(userId);
    const updated: ImmersionPreferences = {
      userId,
      hapticsEnabled: input.hapticsEnabled !== undefined ? input.hapticsEnabled : current.hapticsEnabled,
      screenRumbleEnabled: input.screenRumbleEnabled !== undefined ? input.screenRumbleEnabled : current.screenRumbleEnabled,
      maxHapticIntensity: input.maxHapticIntensity !== undefined ? input.maxHapticIntensity : current.maxHapticIntensity,
      maxRumbleIntensity: input.maxRumbleIntensity !== undefined ? input.maxRumbleIntensity : current.maxRumbleIntensity,
      hapticsWithReducedMotion: input.hapticsWithReducedMotion !== undefined ? input.hapticsWithReducedMotion : current.hapticsWithReducedMotion,
      updatedAt: Date.now(),
      revision: current.revision + 1,
    };

    const stmt = this.db.prepare(`
      INSERT INTO user_immersion_preferences (
        user_id, haptics_enabled, screen_rumble_enabled,
        max_haptic_intensity, max_rumble_intensity,
        haptics_with_reduced_motion, updated_at, revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        haptics_enabled = excluded.haptics_enabled,
        screen_rumble_enabled = excluded.screen_rumble_enabled,
        max_haptic_intensity = excluded.max_haptic_intensity,
        max_rumble_intensity = excluded.max_rumble_intensity,
        haptics_with_reduced_motion = excluded.haptics_with_reduced_motion,
        updated_at = excluded.updated_at,
        revision = excluded.revision
    `);

    stmt.run(
      updated.userId,
      updated.hapticsEnabled ? 1 : 0,
      updated.screenRumbleEnabled ? 1 : 0,
      updated.maxHapticIntensity,
      updated.maxRumbleIntensity,
      updated.hapticsWithReducedMotion ? 1 : 0,
      updated.updatedAt,
      updated.revision
    );

    return updated;
  }

  public recordTelemetryBatch(batch: ImpactTelemetryBatchInput): string {
    const batchId = batch.batchId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const flushedAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO impact_telemetry_batches (
        batch_id, user_id, session_id, source_type, intensity,
        trigger_count, haptic_api_attempts, haptic_accepted_count,
        haptic_suppressed_count, rumble_attempt_count,
        rumble_executed_count, rumble_suppressed_count, flushed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      batchId,
      batch.userId,
      batch.sessionId,
      batch.sourceType,
      batch.intensity,
      batch.triggerCount,
      batch.hapticApiAttempts || 0,
      batch.hapticAcceptedCount || 0,
      batch.hapticSuppressedCount || 0,
      batch.rumbleAttemptCount || 0,
      batch.rumbleExecutedCount || 0,
      batch.rumbleSuppressedCount || 0,
      flushedAt
    );

    return batchId;
  }

  public getAggregatedTelemetry(userId?: string): ImpactTelemetrySummary {
    const query = userId
      ? `SELECT COUNT(*) as batches,
                COALESCE(SUM(trigger_count), 0) as triggers,
                COALESCE(SUM(haptic_accepted_count), 0) as haptics,
                COALESCE(SUM(rumble_executed_count), 0) as rumbles,
                COALESCE(SUM(haptic_suppressed_count + rumble_suppressed_count), 0) as suppressed
         FROM impact_telemetry_batches WHERE user_id = ?`
      : `SELECT COUNT(*) as batches,
                COALESCE(SUM(trigger_count), 0) as triggers,
                COALESCE(SUM(haptic_accepted_count), 0) as haptics,
                COALESCE(SUM(rumble_executed_count), 0) as rumbles,
                COALESCE(SUM(haptic_suppressed_count + rumble_suppressed_count), 0) as suppressed
         FROM impact_telemetry_batches`;

    const stmt = this.db.prepare(query);
    const row = (userId ? stmt.get(userId) : stmt.get()) as any;

    return {
      totalBatches: Number(row?.batches || 0),
      totalTriggers: Number(row?.triggers || 0),
      totalHapticAccepted: Number(row?.haptics || 0),
      totalRumbleExecuted: Number(row?.rumbles || 0),
      totalSuppressed: Number(row?.suppressed || 0),
    };
  }
}
