/**
 * Reading Statistics & Velocity Estimation Service
 * Tracks pages read, elapsed reading duration, and estimates time-to-finish.
 */

export interface ReadingSessionMetrics {
  sessionStartTime: number;
  lastPageTime: number;
  pagesReadCount: number;
  pageDurationsSeconds: number[];
}

export interface ChapterPaceEstimate {
  avgSecondsPerPage: number;
  estimatedMinutesRemaining: number;
  pagesRemaining: number;
  formattedRemaining: string;
  formattedSpeed: string;
}

export class ReadingStatsTracker {
  private metrics: ReadingSessionMetrics;
  private readonly defaultSecondsPerPage: number;

  constructor(defaultSecondsPerPage = 18) {
    this.defaultSecondsPerPage = defaultSecondsPerPage;
    this.metrics = {
      sessionStartTime: Date.now(),
      lastPageTime: Date.now(),
      pagesReadCount: 0,
      pageDurationsSeconds: [],
    };
  }

  /**
   * Records a page flip event, measuring dwell time on the prior page.
   */
  public recordPageAdvance(): number {
    const now = Date.now();
    const durationSeconds = Math.max(1, Math.min(180, (now - this.metrics.lastPageTime) / 1000));

    this.metrics.pageDurationsSeconds.push(durationSeconds);
    // Keep sliding window of last 20 pages for adaptive speed
    if (this.metrics.pageDurationsSeconds.length > 20) {
      this.metrics.pageDurationsSeconds.shift();
    }

    this.metrics.pagesReadCount++;
    this.metrics.lastPageTime = now;
    return durationSeconds;
  }

  /**
   * Calculates the current rolling average seconds per page.
   */
  public getAverageSecondsPerPage(): number {
    const durations = this.metrics.pageDurationsSeconds;
    if (durations.length === 0) {
      return this.defaultSecondsPerPage;
    }
    const sum = durations.reduce((acc, d) => acc + d, 0);
    return Math.round((sum / durations.length) * 10) / 10;
  }

  /**
   * Computes dynamic pace estimate for the current chapter.
   */
  public estimateRemainingChapterTime(currentPage: number, totalPages: number): ChapterPaceEstimate {
    const pagesRemaining = Math.max(0, totalPages - currentPage);
    const avgSeconds = this.getAverageSecondsPerPage();
    const totalRemainingSeconds = pagesRemaining * avgSeconds;
    const estimatedMinutesRemaining = Math.max(1, Math.ceil(totalRemainingSeconds / 60));

    let formattedRemaining: string;
    if (pagesRemaining === 0) {
      formattedRemaining = 'Completado';
    } else if (totalRemainingSeconds < 60) {
      formattedRemaining = `~${Math.round(totalRemainingSeconds)} seg restantes`;
    } else {
      formattedRemaining = `~${estimatedMinutesRemaining} min restantes`;
    }

    const formattedSpeed = `${Math.round(avgSeconds)}s / pág`;

    return {
      avgSecondsPerPage: avgSeconds,
      estimatedMinutesRemaining: pagesRemaining === 0 ? 0 : estimatedMinutesRemaining,
      pagesRemaining,
      formattedRemaining,
      formattedSpeed,
    };
  }

  /**
   * Returns session summary statistics.
   */
  public getSessionSummary(): {
    elapsedMinutes: number;
    pagesReadCount: number;
    avgSpeed: string;
  } {
    const elapsedMs = Date.now() - this.metrics.sessionStartTime;
    const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    return {
      elapsedMinutes,
      pagesReadCount: this.metrics.pagesReadCount,
      avgSpeed: `${Math.round(this.getAverageSecondsPerPage())}s / pág`,
    };
  }
}
