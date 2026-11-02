/**
 * KuraScroll Client Frame Drop Telemetry Service
 * Sprint 54 - Client Render Performance Aggregator
 */

import { DatabaseInstance, Statement } from '../db/database.js';
import { GovernorState } from '../utils/frame-pacer.js';

export interface ClientTelemetryReport {
  id?: number;
  userId: string;
  fpsAverage: number;
  dropRatePct: number;
  governorState: GovernorState;
  readingMode: string;
  createdAt?: string;
}

export interface TelemetrySummary {
  totalReports: number;
  averageFps: number;
  averageDropRatePct: number;
  governorBreakdown: Record<GovernorState, number>;
  latestReportTimestamp?: string;
}

export class FrameTelemetryService {
  private stmtInsert: Statement;
  private stmtGetRecent: Statement;
  private stmtGetStats: Statement;

  // In-memory ring buffer of recent reports for microsecond summary stats
  private recentReports: ClientTelemetryReport[] = [];
  private readonly maxRecent = 100;

  constructor(private readonly db: DatabaseInstance) {
    this.stmtInsert = this.db.prepare(`
      INSERT INTO client_render_telemetry (
        user_id,
        fps_average,
        drop_rate_pct,
        governor_state,
        reading_mode,
        created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    this.stmtGetRecent = this.db.prepare(`
      SELECT 
        id,
        user_id AS userId,
        fps_average AS fpsAverage,
        drop_rate_pct AS dropRatePct,
        governor_state AS governorState,
        reading_mode AS readingMode,
        created_at AS createdAt
      FROM client_render_telemetry
      ORDER BY id DESC
      LIMIT ?
    `);

    this.stmtGetStats = this.db.prepare(`
      SELECT 
        count(*) AS totalCount,
        avg(fps_average) AS avgFps,
        avg(drop_rate_pct) AS avgDropRate
      FROM client_render_telemetry
    `);
  }

  public recordReport(report: ClientTelemetryReport): ClientTelemetryReport {
    const result = this.stmtInsert.run(
      report.userId,
      report.fpsAverage,
      report.dropRatePct,
      report.governorState,
      report.readingMode || 'manga'
    );

    const saved: ClientTelemetryReport = {
      ...report,
      id: Number(result.lastInsertRowid),
      createdAt: new Date().toISOString(),
    };

    if (this.recentReports.length >= this.maxRecent) {
      this.recentReports.shift();
    }
    this.recentReports.push(saved);

    return saved;
  }

  public getRecentReports(limit: number = 20): ClientTelemetryReport[] {
    const rows = this.stmtGetRecent.all(limit) as any[];
    return rows.map((r) => ({
      id: Number(r.id),
      userId: String(r.userId),
      fpsAverage: Number(r.fpsAverage),
      dropRatePct: Number(r.dropRatePct),
      governorState: r.governorState as GovernorState,
      readingMode: String(r.readingMode),
      createdAt: String(r.createdAt),
    }));
  }

  public getTelemetrySummary(): TelemetrySummary {
    const statsRow = this.stmtGetStats.get() as any;
    const totalReports = Number(statsRow?.totalCount || 0);
    const averageFps = statsRow?.avgFps ? Math.round(Number(statsRow.avgFps) * 10) / 10 : 60.0;
    const averageDropRatePct = statsRow?.avgDropRate ? Math.round(Number(statsRow.avgDropRate) * 10) / 10 : 0.0;

    const breakdown: Record<GovernorState, number> = {
      nominal_60: 0,
      paced_30: 0,
      emergency_step: 0,
    };

    for (const r of this.recentReports) {
      if (breakdown[r.governorState] !== undefined) {
        breakdown[r.governorState]++;
      }
    }

    return {
      totalReports,
      averageFps,
      averageDropRatePct,
      governorBreakdown: breakdown,
      latestReportTimestamp: this.recentReports[this.recentReports.length - 1]?.createdAt,
    };
  }
}
