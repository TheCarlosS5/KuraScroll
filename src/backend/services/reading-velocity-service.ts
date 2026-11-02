export interface VelocityStats {
  userId: string;
  seriesId?: string;
  pagesPerMinute: number;
  secondsPerPage: number;
  samplesCount: number;
  confidence: 'provisional' | 'stable' | 'expert';
  estimatedChapterMinutes: number;
  estimatedRemainingSeriesMinutes?: number;
}

export interface VelocitySample {
  userId: string;
  seriesId: string;
  durationSeconds: number;
  timestamp?: number;
}

/**
 * ReadingVelocityService
 * Real-time Reading Velocity Engine with zero-allocation outlier rejection
 * and Exponential Moving Average (EMA) smoothing for Intel Pentium T4500.
 */
export class ReadingVelocityService {
  private static readonly MIN_VALID_SECONDS = 1.5;   // Skimming/skipping reject threshold
  private static readonly MAX_VALID_SECONDS = 300.0; // Idle/away reject threshold
  private static readonly DEFAULT_SPP = 35.0;        // Default: 35 seconds per manga page (~1.7 ppm)
  private static readonly ALPHA = 0.25;              // EMA weight factor

  // In-memory compact state map: key = `${userId}:${seriesId || 'global'}`
  private userVelocityMap = new Map<string, {
    spp: number;
    samples: number;
    lastUpdated: number;
  }>();

  /**
   * Records a page-turn event and updates the user's velocity EMA.
   * Returns true if sample was accepted, false if rejected as outlier.
   */
  public recordSample(userId: string, seriesId: string, durationSeconds: number): boolean {
    // 1. Zero-allocation outlier rejection filter
    if (
      !Number.isFinite(durationSeconds) ||
      durationSeconds < ReadingVelocityService.MIN_VALID_SECONDS ||
      durationSeconds > ReadingVelocityService.MAX_VALID_SECONDS
    ) {
      return false; // Outlier discarded without heap allocations
    }

    const key = `${userId}:${seriesId}`;
    const globalKey = `${userId}:global`;
    const now = Date.now();

    // Update Series-specific velocity
    this.updateEmaForKey(key, durationSeconds, now);
    // Update User-global velocity
    this.updateEmaForKey(globalKey, durationSeconds, now);

    return true;
  }

  private updateEmaForKey(key: string, durationSeconds: number, now: number): void {
    const existing = this.userVelocityMap.get(key);
    if (!existing) {
      this.userVelocityMap.set(key, {
        spp: durationSeconds,
        samples: 1,
        lastUpdated: now,
      });
    } else {
      // EMA formula: EMA = alpha * sample + (1 - alpha) * prevEMA
      const newSpp = (ReadingVelocityService.ALPHA * durationSeconds) + ((1.0 - ReadingVelocityService.ALPHA) * existing.spp);
      existing.spp = Math.round(newSpp * 100) / 100;
      existing.samples += 1;
      existing.lastUpdated = now;
    }
  }

  /**
   * Retrieves smoothed velocity statistics for a user and optional series.
   */
  public getStats(userId: string, seriesId?: string, defaultPagesPerChapter = 20): VelocityStats {
    const key = seriesId ? `${userId}:${seriesId}` : `${userId}:global`;
    let state = this.userVelocityMap.get(key);

    if (!state && seriesId) {
      // Fallback to global user velocity if series hasn't accumulated enough samples
      state = this.userVelocityMap.get(`${userId}:global`);
    }

    const spp = state ? state.spp : ReadingVelocityService.DEFAULT_SPP;
    const samples = state ? state.samples : 0;
    const ppm = Math.round((60.0 / spp) * 10) / 10;

    let confidence: 'provisional' | 'stable' | 'expert' = 'provisional';
    if (samples >= 25) {
      confidence = 'expert';
    } else if (samples >= 5) {
      confidence = 'stable';
    }

    // Granular per-chapter reading time estimate (in minutes, rounded)
    const chapterMinutes = Math.max(1, Math.round((defaultPagesPerChapter * spp) / 60.0));

    return {
      userId,
      seriesId,
      pagesPerMinute: ppm,
      secondsPerPage: spp,
      samplesCount: samples,
      confidence,
      estimatedChapterMinutes: chapterMinutes,
    };
  }

  /**
   * Estimates remaining reading time for unread pages.
   */
  public estimateRemainingTimeMinutes(userId: string, seriesId: string, remainingPages: number): number {
    if (remainingPages <= 0) return 0;
    const stats = this.getStats(userId, seriesId);
    return Math.max(1, Math.round((remainingPages * stats.secondsPerPage) / 60.0));
  }

  /**
   * Clears in-memory velocity cache (useful for test isolation).
   */
  public clear(): void {
    this.userVelocityMap.clear();
  }
}
