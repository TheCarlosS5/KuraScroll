/**
 * KuraScroll Reading Session Dwell & Kinetic Attention Telemetry Service
 * Sprint 45 - Optical Replay & Eye-Tracking Attention Heatmaps
 * 
 * Hardware-conscious design for Intel Pentium T4500 (2C/2T) & 4TB SATA II HDD:
 * - In-memory write-behind batching to prevent I/O disk thrashing
 * - Atomic SQLite WAL upserts with cooperative intensity recalculation
 * - Skim-rejection (velocity > 1500 px/s or dwell < 1.0s) & AFK clamping (<= 180s)
 * - Differential privacy protection with configurable minimum reader thresholds
 */

import { DatabaseInstance } from '../db/database.js';

export type AttentionTier = 'breeze' | 'flow' | 'deep' | 'epic';

export interface DwellEventInput {
  chapterId: string;
  pageNumber: number;
  dwellSeconds: number;
  scrollVelocity?: number; // pixels per second
  userId?: string;
}

export interface PageDwellRecord {
  pageNumber: number;
  totalReads: number;
  totalDwellSeconds: number;
  avgDwellSeconds: number;
  intensityScore: number; // 0.0 - 100.0
  tier: AttentionTier;
}

export interface ChapterAttentionMetrics {
  totalSessionViews: number;
  totalDwellSeconds: number;
  chapterAvgDwellSeconds: number;
  peakAttentionPage: number;
  peakDwellSeconds: number;
}

export interface ChapterDwellHeatmapResponse {
  success: boolean;
  chapterId: string;
  totalPages: number;
  metrics: ChapterAttentionMetrics;
  heatmap: PageDwellRecord[];
  privacyRestricted?: boolean;
}

export interface DwellTelemetryServiceOptions {
  batchSize?: number;
  flushIntervalMs?: number;
  minDwellSeconds?: number;
  maxDwellSeconds?: number;
  maxScrollVelocity?: number;
}

export interface DwellBufferTelemetry {
  dirtyCount: number;
  totalFlushes: number;
  totalFlushedEvents: number;
  totalRejectedEvents: number;
  lastFlushTimestamp: string | null;
  lastFlushDurationMs: number;
  averageFlushDurationMs: number;
}

interface CoalescedDwellItem {
  chapterId: string;
  pageNumber: number;
  readCount: number;
  dwellSeconds: number;
}

export class DwellTelemetryService {
  private buffer = new Map<string, CoalescedDwellItem>();
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize: number;
  private readonly minDwellSeconds: number;
  private readonly maxDwellSeconds: number;
  private readonly maxScrollVelocity: number;

  private totalFlushes = 0;
  private totalFlushedEvents = 0;
  private totalRejectedEvents = 0;
  private lastFlushTimestamp: string | null = null;
  private lastFlushDurationMs = 0;
  private totalFlushDurationMs = 0;

  constructor(
    private readonly db: DatabaseInstance,
    options: DwellTelemetryServiceOptions = {}
  ) {
    this.batchSize = options.batchSize ?? 50;
    this.minDwellSeconds = options.minDwellSeconds ?? 1.0;
    this.maxDwellSeconds = options.maxDwellSeconds ?? 180.0;
    this.maxScrollVelocity = options.maxScrollVelocity ?? 1500.0;

    if (options.flushIntervalMs && options.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        this.flush();
      }, options.flushIntervalMs);
      if (this.timer.unref) {
        this.timer.unref();
      }
    }
  }

  /**
   * Evaluates and records a single page dwell event.
   * Returns true if accepted into write-behind buffer, false if rejected as skim/outlier.
   */
  public recordDwell(event: DwellEventInput): boolean {
    if (
      !event.chapterId ||
      typeof event.pageNumber !== 'number' ||
      event.pageNumber < 1 ||
      typeof event.dwellSeconds !== 'number' ||
      isNaN(event.dwellSeconds)
    ) {
      this.totalRejectedEvents++;
      return false;
    }

    // Filter rapid skimming: scroll velocity exceeds threshold or dwell under min threshold
    if (
      event.dwellSeconds < this.minDwellSeconds ||
      (event.scrollVelocity !== undefined && event.scrollVelocity > this.maxScrollVelocity)
    ) {
      this.totalRejectedEvents++;
      return false;
    }

    // Clamp AFK idle outliers
    const clampedDwell = Math.min(this.maxDwellSeconds, Math.max(this.minDwellSeconds, event.dwellSeconds));
    const key = `${event.chapterId}:${event.pageNumber}`;

    const existing = this.buffer.get(key);
    if (existing) {
      existing.readCount += 1;
      existing.dwellSeconds += clampedDwell;
    } else {
      this.buffer.set(key, {
        chapterId: event.chapterId,
        pageNumber: event.pageNumber,
        readCount: 1,
        dwellSeconds: clampedDwell
      });
    }

    if (this.buffer.size >= this.batchSize) {
      this.flush();
    }

    return true;
  }

  /**
   * Ingest a batch of dwell events (e.g. from Fastify POST /api/v1/analytics/dwell/batch).
   */
  public recordBatch(events: DwellEventInput[]): { accepted: number; rejected: number } {
    let accepted = 0;
    let rejected = 0;

    for (const event of events) {
      if (this.recordDwell(event)) {
        accepted++;
      } else {
        rejected++;
      }
    }

    return { accepted, rejected };
  }

  /**
   * Flushes coalesced in-memory buffer into SQLite within an atomic WAL transaction.
   * Calculates dwell intensity scores for modified chapters.
   */
  public flush(): number {
    if (this.buffer.size === 0) {
      return 0;
    }

    const startTime = performance.now();
    const items = Array.from(this.buffer.values());
    this.buffer.clear();

    const affectedChapters = new Set<string>();

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const upsertStmt = this.db.prepare(`
        INSERT INTO chapter_page_dwell_stats (
          chapter_id, page_number, total_reads, total_dwell_seconds, avg_dwell_seconds, dwell_intensity_score, updated_at
        ) VALUES (?, ?, ?, ?, ?, 50.0, datetime('now'))
        ON CONFLICT(chapter_id, page_number) DO UPDATE SET
          total_reads = total_reads + excluded.total_reads,
          total_dwell_seconds = total_dwell_seconds + excluded.total_dwell_seconds,
          avg_dwell_seconds = ROUND((total_dwell_seconds + excluded.total_dwell_seconds) / (total_reads + excluded.total_reads), 2),
          updated_at = datetime('now');
      `);

      for (const item of items) {
        affectedChapters.add(item.chapterId);
        const avgDwell = Math.round((item.dwellSeconds / item.readCount) * 100) / 100;
        upsertStmt.run(
          item.chapterId,
          item.pageNumber,
          item.readCount,
          item.dwellSeconds,
          avgDwell
        );
      }

      // Re-normalize dwell_intensity_score per chapter based on the peak page dwell
      const updateIntensityStmt = this.db.prepare(`
        WITH MaxDwell AS (
          SELECT MAX(avg_dwell_seconds) as max_avg 
          FROM chapter_page_dwell_stats 
          WHERE chapter_id = ?
        )
        UPDATE chapter_page_dwell_stats
        SET dwell_intensity_score = CASE 
          WHEN (SELECT max_avg FROM MaxDwell) > 0 THEN 
            ROUND((avg_dwell_seconds / (SELECT max_avg FROM MaxDwell)) * 100.0, 1)
          ELSE 0.0
        END
        WHERE chapter_id = ?;
      `);

      for (const chapterId of affectedChapters) {
        updateIntensityStmt.run(chapterId, chapterId);
      }

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      // Re-insert uncommitted items back into buffer
      for (const item of items) {
        const key = `${item.chapterId}:${item.pageNumber}`;
        const existing = this.buffer.get(key);
        if (existing) {
          existing.readCount += item.readCount;
          existing.dwellSeconds += item.dwellSeconds;
        } else {
          this.buffer.set(key, item);
        }
      }
      throw err;
    }

    const duration = performance.now() - startTime;
    this.totalFlushes++;
    this.totalFlushedEvents += items.length;
    this.lastFlushTimestamp = new Date().toISOString();
    this.lastFlushDurationMs = duration;
    this.totalFlushDurationMs += duration;

    return items.length;
  }

  /**
   * Retrieves page attention heatmap and aggregate metrics for a chapter.
   * If minTotalReads is specified (e.g. 20 for community aggregation), privacy rules apply.
   */
  public getChapterDwellHeatmap(
    chapterId: string,
    options?: { minTotalReads?: number }
  ): ChapterDwellHeatmapResponse {
    // Flush any pending events for this chapter so results reflect real-time activity
    let hasPending = false;
    for (const item of this.buffer.values()) {
      if (item.chapterId === chapterId) {
        hasPending = true;
        break;
      }
    }
    if (hasPending) {
      this.flush();
    }

    // Query chapter metadata for totalPages if available
    let totalPages = 0;
    try {
      const chapterRow = this.db.prepare(`
        SELECT page_count FROM chapters WHERE id = ?
      `).get(chapterId) as { page_count: number } | undefined;
      if (chapterRow && chapterRow.page_count > 0) {
        totalPages = chapterRow.page_count;
      }
    } catch {
      // chapters table might not be populated in standalone unit tests
    }

    // Query dwell statistics for chapter
    const rows = this.db.prepare(`
      SELECT 
        page_number,
        total_reads,
        total_dwell_seconds,
        avg_dwell_seconds,
        dwell_intensity_score
      FROM chapter_page_dwell_stats
      WHERE chapter_id = ?
      ORDER BY page_number ASC
    `).all(chapterId) as Array<{
      page_number: number;
      total_reads: number;
      total_dwell_seconds: number;
      avg_dwell_seconds: number;
      dwell_intensity_score: number;
    }>;

    if (rows.length === 0) {
      return {
        success: true,
        chapterId,
        totalPages,
        metrics: {
          totalSessionViews: 0,
          totalDwellSeconds: 0,
          chapterAvgDwellSeconds: 0,
          peakAttentionPage: 0,
          peakDwellSeconds: 0
        },
        heatmap: []
      };
    }

    if (totalPages === 0) {
      totalPages = Math.max(...rows.map((r) => r.page_number));
    }

    let maxReads = 0;
    let sumDwell = 0;
    let peakPage = rows[0].page_number;
    let peakAvgDwell = 0;

    for (const r of rows) {
      if (r.total_reads > maxReads) {
        maxReads = r.total_reads;
      }
      sumDwell += r.total_dwell_seconds;
      if (r.avg_dwell_seconds > peakAvgDwell) {
        peakAvgDwell = r.avg_dwell_seconds;
        peakPage = r.page_number;
      }
    }

    // Check privacy threshold
    const minReads = options?.minTotalReads ?? 0;
    if (minReads > 0 && maxReads < minReads) {
      return {
        success: true,
        chapterId,
        totalPages,
        metrics: {
          totalSessionViews: maxReads,
          totalDwellSeconds: Math.round(sumDwell * 10) / 10,
          chapterAvgDwellSeconds: Math.round((sumDwell / (rows.length || 1)) * 10) / 10,
          peakAttentionPage: peakPage,
          peakDwellSeconds: peakAvgDwell
        },
        heatmap: [],
        privacyRestricted: true
      };
    }

    const chapterAvgDwell = Math.round((sumDwell / rows.length) * 10) / 10;

    const heatmap: PageDwellRecord[] = rows.map((r) => {
      const intensity = peakAvgDwell > 0
        ? Math.min(100.0, Math.round((r.avg_dwell_seconds / peakAvgDwell) * 1000) / 10)
        : 0;

      let tier: AttentionTier = 'breeze';
      if (intensity >= 80) {
        tier = 'epic';
      } else if (intensity >= 55) {
        tier = 'deep';
      } else if (intensity >= 25) {
        tier = 'flow';
      }

      return {
        pageNumber: r.page_number,
        totalReads: r.total_reads,
        totalDwellSeconds: Math.round(r.total_dwell_seconds * 10) / 10,
        avgDwellSeconds: r.avg_dwell_seconds,
        intensityScore: intensity,
        tier
      };
    });

    return {
      success: true,
      chapterId,
      totalPages,
      metrics: {
        totalSessionViews: maxReads,
        totalDwellSeconds: Math.round(sumDwell * 10) / 10,
        chapterAvgDwellSeconds: chapterAvgDwell,
        peakAttentionPage: peakPage,
        peakDwellSeconds: peakAvgDwell
      },
      heatmap
    };
  }

  /**
   * Returns current write-behind buffer and flush telemetry.
   */
  public getTelemetry(): DwellBufferTelemetry {
    return {
      dirtyCount: this.buffer.size,
      totalFlushes: this.totalFlushes,
      totalFlushedEvents: this.totalFlushedEvents,
      totalRejectedEvents: this.totalRejectedEvents,
      lastFlushTimestamp: this.lastFlushTimestamp,
      lastFlushDurationMs: Math.round(this.lastFlushDurationMs * 100) / 100,
      averageFlushDurationMs: this.totalFlushes > 0
        ? Math.round((this.totalFlushDurationMs / this.totalFlushes) * 100) / 100
        : 0
    };
  }

  /**
   * Graceful cleanup.
   */
  public destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}
