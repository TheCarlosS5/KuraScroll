import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { FrameTelemetryService } from '../../../src/backend/services/frame-telemetry-service.js';

describe('Sprint 54: FrameTelemetryService', () => {
  let db: DatabaseInstance;
  let service: FrameTelemetryService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new FrameTelemetryService(db);
  });

  it('records client telemetry report and retrieves recent logs', () => {
    const saved = service.recordReport({
      userId: 'client_1',
      fpsAverage: 58.5,
      dropRatePct: 3.2,
      governorState: 'nominal_60',
      readingMode: 'manga',
    });

    expect(saved.id).toBeGreaterThan(0);
    expect(saved.userId).toBe('client_1');
    expect(saved.fpsAverage).toBe(58.5);

    const recent = service.getRecentReports(10);
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe(saved.id);
  });

  it('aggregates telemetry summary stats correctly', () => {
    service.recordReport({
      userId: 'u1',
      fpsAverage: 60.0,
      dropRatePct: 0.0,
      governorState: 'nominal_60',
      readingMode: 'manga',
    });

    service.recordReport({
      userId: 'u2',
      fpsAverage: 30.0,
      dropRatePct: 18.0,
      governorState: 'paced_30',
      readingMode: 'webtoon',
    });

    const summary = service.getTelemetrySummary();
    expect(summary.totalReports).toBe(2);
    expect(summary.averageFps).toBe(45.0);
    expect(summary.averageDropRatePct).toBe(9.0);
    expect(summary.governorBreakdown.nominal_60).toBe(1);
    expect(summary.governorBreakdown.paced_30).toBe(1);
  });
});
