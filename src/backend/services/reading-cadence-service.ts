/**
 * KuraScroll Continuous Background Reading Velocity & Dynamic Completion Time Predictor
 * Sprint 53 - Zero-Allocation Rolling Window Cadence Engine & Outlier Clamping
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export type ReadingMode = 'manga' | 'webtoon' | 'comic';

export interface CadenceProfile {
  userId: string;
  readingMode: ReadingMode;
  averageSecondsPerPage: number;
  samplesCount: number;
  lastActiveAt: string;
}

export interface TransitionInput {
  userId: string;
  chapterId: string;
  pageNumber: number;
  dwellSeconds: number;
  readingMode?: ReadingMode;
  isDoubleSpread?: boolean;
  totalPages?: number;
}

export interface PredictionResult {
  effectiveSecondsPerPage: number;
  estimatedRemainingSeconds: number;
  estimatedRemainingMinutes: number;
  pagesRemaining: number;
  isOutlier: boolean;
  outlierReason?: string;
}

export const COLD_START_BASELINES: Record<ReadingMode, number> = {
  manga: 24.0,   // ~2.5 pages per minute
  webtoon: 12.0, // ~5.0 pages/viewports per minute
  comic: 32.0,   // ~1.88 pages per minute
};

export const MIN_VALID_DWELL = 1.5;   // Skim threshold (seconds)
export const MAX_VALID_DWELL = 180.0; // AFK threshold (seconds)

export class ReadingCadenceService {
  private stmtGetProfile: Statement;
  private stmtUpsertProfile: Statement;
  private stmtInsertLog: Statement;
  private stmtGetRecentLogs: Statement;
  private stmtResetProfile: Statement;

  // In-memory session cache for microsecond velocity updates
  private sessionCadenceMap: Map<string, number> = new Map();

  constructor(private readonly db: DatabaseInstance) {
    this.stmtGetProfile = this.db.prepare(`
      SELECT 
        user_id AS userId,
        reading_mode AS readingMode,
        average_seconds_per_page AS averageSecondsPerPage,
        samples_count AS samplesCount,
        last_active_at AS lastActiveAt
      FROM user_reading_cadence
      WHERE user_id = ? AND reading_mode = ?
    `);

    this.stmtUpsertProfile = this.db.prepare(`
      INSERT INTO user_reading_cadence (
        user_id,
        reading_mode,
        average_seconds_per_page,
        samples_count,
        last_active_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, reading_mode) DO UPDATE SET
        average_seconds_per_page = excluded.average_seconds_per_page,
        samples_count = excluded.samples_count,
        last_active_at = datetime('now')
    `);

    this.stmtInsertLog = this.db.prepare(`
      INSERT INTO reading_session_cadence_logs (
        user_id,
        chapter_id,
        page_number,
        dwell_seconds,
        is_outlier,
        created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    this.stmtGetRecentLogs = this.db.prepare(`
      SELECT dwell_seconds AS dwellSeconds, is_outlier AS isOutlier
      FROM reading_session_cadence_logs
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY id DESC
      LIMIT ?
    `);

    this.stmtResetProfile = this.db.prepare(`
      DELETE FROM user_reading_cadence
      WHERE user_id = ? AND (? IS NULL OR reading_mode = ?)
    `);
  }

  public getUserCadence(userId: string, mode: ReadingMode = 'manga'): CadenceProfile {
    const row = this.stmtGetProfile.get(userId, mode) as any;
    if (row) {
      return {
        userId: String(row.userId),
        readingMode: row.readingMode as ReadingMode,
        averageSecondsPerPage: Number(row.averageSecondsPerPage),
        samplesCount: Number(row.samplesCount),
        lastActiveAt: String(row.lastActiveAt),
      };
    }

    // Default cold-start baseline
    return {
      userId,
      readingMode: mode,
      averageSecondsPerPage: COLD_START_BASELINES[mode] || 24.0,
      samplesCount: 0,
      lastActiveAt: new Date().toISOString(),
    };
  }

  /**
   * Zero-allocation EMA update with outlier clamping & spread normalization
   */
  public recordTransition(input: TransitionInput): PredictionResult {
    const mode = input.readingMode || 'manga';
    const profile = this.getUserCadence(input.userId, mode);

    let dwell = input.dwellSeconds;
    let isOutlier = false;
    let outlierReason: string | undefined = undefined;

    // 1. Check Rapid Flick / Skim Floor (< 1.5s)
    if (dwell < MIN_VALID_DWELL) {
      isOutlier = true;
      outlierReason = 'rapid_skip';
    } 
    // 2. Check AFK Pause Ceiling (> 180s)
    else if (dwell > MAX_VALID_DWELL) {
      isOutlier = true;
      outlierReason = 'afk_pause';
      dwell = MAX_VALID_DWELL; // Clamp to max ceiling
    }

    // 3. Normalize Double-Page Spreads (Sprint 51)
    if (input.isDoubleSpread && !isOutlier) {
      dwell = dwell / 2.0;
    }

    // Persist raw session dwell log
    this.stmtInsertLog.run(
      input.userId,
      input.chapterId,
      input.pageNumber,
      input.dwellSeconds,
      isOutlier ? 1 : 0
    );

    let currentSpp = profile.averageSecondsPerPage;
    let samples = profile.samplesCount;

    // Only update moving average if the sample was not a rapid skip outlier
    if (outlierReason !== 'rapid_skip') {
      samples++;
      // Adaptive alpha: fast calibration during first 5 pages, then stable smoothing
      const alpha = samples <= 5 ? 0.25 : 0.15;
      currentSpp = alpha * dwell + (1.0 - alpha) * currentSpp;

      // Persist updated profile in SQLite
      this.stmtUpsertProfile.run(input.userId, mode, currentSpp, samples);
    }

    // Cache updated velocity in memory for rapid query
    const sessionKey = `${input.userId}:${input.chapterId}`;
    this.sessionCadenceMap.set(sessionKey, currentSpp);

    // Compute completion estimate
    const totalPages = input.totalPages ?? (input.pageNumber + 1);
    const pagesRemaining = Math.max(0, totalPages - input.pageNumber);
    const estimatedRemainingSeconds = Math.round(pagesRemaining * currentSpp);
    const estimatedRemainingMinutes = Math.max(0, Math.ceil(estimatedRemainingSeconds / 60));

    return {
      effectiveSecondsPerPage: Math.round(currentSpp * 100) / 100,
      estimatedRemainingSeconds,
      estimatedRemainingMinutes,
      pagesRemaining,
      isOutlier,
      outlierReason,
    };
  }

  public predictCompletion(
    userId: string,
    chapterId: string,
    currentPage: number,
    totalPages: number,
    mode: ReadingMode = 'manga'
  ): PredictionResult {
    const sessionKey = `${userId}:${chapterId}`;
    let spp = this.sessionCadenceMap.get(sessionKey);

    if (spp === undefined) {
      const profile = this.getUserCadence(userId, mode);
      spp = profile.averageSecondsPerPage;
    }

    const pagesRemaining = Math.max(0, totalPages - currentPage);
    const estimatedRemainingSeconds = Math.round(pagesRemaining * spp);
    const estimatedRemainingMinutes = Math.max(0, Math.ceil(estimatedRemainingSeconds / 60));

    return {
      effectiveSecondsPerPage: Math.round(spp * 100) / 100,
      estimatedRemainingSeconds,
      estimatedRemainingMinutes,
      pagesRemaining,
      isOutlier: false,
    };
  }

  public resetCadence(userId: string, mode?: ReadingMode): void {
    this.stmtResetProfile.run(userId, mode || null, mode || null);
    for (const key of this.sessionCadenceMap.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.sessionCadenceMap.delete(key);
      }
    }
  }
}
