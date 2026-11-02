import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { DwellTelemetryService } from '../../../src/backend/services/dwell-telemetry-service.js';

describe('DwellTelemetryService Unit Tests (Sprint 45)', () => {
  let db: DatabaseInstance;
  let service: DwellTelemetryService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Insert dummy series and chapter for foreign key relations
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-heat', 'solo-leveling', 'Solo Leveling', 'manhwa', 'completed')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, page_count, storage_path)
      VALUES ('ch-100', 's-heat', 100.0, 'Chapter 100', 45, '/storage/ch-100')
    `).run();

    service = new DwellTelemetryService(db, {
      batchSize: 50,
      minDwellSeconds: 1.0,
      maxDwellSeconds: 180.0,
      maxScrollVelocity: 1500.0
    });
  });

  afterEach(() => {
    service.destroy();
  });

  it('records valid dwell events and buffers them in-memory', () => {
    const accepted = service.recordDwell({
      chapterId: 'ch-100',
      pageNumber: 1,
      dwellSeconds: 15.5
    });

    expect(accepted).toBe(true);
    const telemetry = service.getTelemetry();
    expect(telemetry.dirtyCount).toBe(1);
    expect(telemetry.totalFlushedEvents).toBe(0);
  });

  it('rejects skimming events with dwell under minimum threshold (< 1.0s)', () => {
    const accepted = service.recordDwell({
      chapterId: 'ch-100',
      pageNumber: 2,
      dwellSeconds: 0.4
    });

    expect(accepted).toBe(false);
    const telemetry = service.getTelemetry();
    expect(telemetry.totalRejectedEvents).toBe(1);
    expect(telemetry.dirtyCount).toBe(0);
  });

  it('rejects skimming events with excessive scroll velocity (> 1500 px/s)', () => {
    const accepted = service.recordDwell({
      chapterId: 'ch-100',
      pageNumber: 3,
      dwellSeconds: 2.5,
      scrollVelocity: 1850.0
    });

    expect(accepted).toBe(false);
    const telemetry = service.getTelemetry();
    expect(telemetry.totalRejectedEvents).toBe(1);
    expect(telemetry.dirtyCount).toBe(0);
  });

  it('clamps AFK idle outliers exceeding maxDwellSeconds (180.0s)', () => {
    service.recordDwell({
      chapterId: 'ch-100',
      pageNumber: 4,
      dwellSeconds: 9999.0 // huge AFK idle
    });

    service.flush();

    const row = db.prepare(`
      SELECT total_dwell_seconds, avg_dwell_seconds
      FROM chapter_page_dwell_stats
      WHERE chapter_id = 'ch-100' AND page_number = 4
    `).get() as { total_dwell_seconds: number; avg_dwell_seconds: number };

    expect(row).toBeDefined();
    expect(row.total_dwell_seconds).toBe(180.0);
    expect(row.avg_dwell_seconds).toBe(180.0);
  });

  it('coalesces multiple dwell events on the same page during buffer cycle', () => {
    service.recordDwell({ chapterId: 'ch-100', pageNumber: 5, dwellSeconds: 20.0 });
    service.recordDwell({ chapterId: 'ch-100', pageNumber: 5, dwellSeconds: 40.0 });

    const telemetry = service.getTelemetry();
    expect(telemetry.dirtyCount).toBe(1); // Coalesced into 1 dirty entry

    service.flush();

    const row = db.prepare(`
      SELECT total_reads, total_dwell_seconds, avg_dwell_seconds
      FROM chapter_page_dwell_stats
      WHERE chapter_id = 'ch-100' AND page_number = 5
    `).get() as { total_reads: number; total_dwell_seconds: number; avg_dwell_seconds: number };

    expect(row.total_reads).toBe(2);
    expect(row.total_dwell_seconds).toBe(60.0);
    expect(row.avg_dwell_seconds).toBe(30.0);
  });

  it('triggers auto-flush when buffer size reaches configured batchSize', () => {
    const smallBatchService = new DwellTelemetryService(db, { batchSize: 3 });

    smallBatchService.recordDwell({ chapterId: 'ch-100', pageNumber: 10, dwellSeconds: 10 });
    smallBatchService.recordDwell({ chapterId: 'ch-100', pageNumber: 11, dwellSeconds: 15 });
    expect(smallBatchService.getTelemetry().totalFlushes).toBe(0);

    // 3rd item triggers batch flush
    smallBatchService.recordDwell({ chapterId: 'ch-100', pageNumber: 12, dwellSeconds: 20 });
    expect(smallBatchService.getTelemetry().totalFlushes).toBe(1);
    expect(smallBatchService.getTelemetry().dirtyCount).toBe(0);

    smallBatchService.destroy();
  });

  it('calculates accurate heatmap tiers and peak attention page', () => {
    // Record reading pattern:
    // Page 1: 10s (breeze)
    // Page 2: 25s (flow)
    // Page 3: 60s (deep)
    // Page 4: 90s (epic peak)
    service.recordDwell({ chapterId: 'ch-100', pageNumber: 1, dwellSeconds: 10.0 });
    service.recordDwell({ chapterId: 'ch-100', pageNumber: 2, dwellSeconds: 25.0 });
    service.recordDwell({ chapterId: 'ch-100', pageNumber: 3, dwellSeconds: 60.0 });
    service.recordDwell({ chapterId: 'ch-100', pageNumber: 4, dwellSeconds: 90.0 });

    const response = service.getChapterDwellHeatmap('ch-100');

    expect(response.success).toBe(true);
    expect(response.chapterId).toBe('ch-100');
    expect(response.totalPages).toBe(45); // From chapters metadata
    expect(response.metrics.peakAttentionPage).toBe(4);
    expect(response.metrics.peakDwellSeconds).toBe(90.0);
    expect(response.metrics.totalDwellSeconds).toBe(185.0);

    expect(response.heatmap.length).toBe(4);

    const p1 = response.heatmap.find((p) => p.pageNumber === 1)!;
    expect(p1.tier).toBe('breeze');
    expect(p1.intensityScore).toBeCloseTo(11.1, 1);

    const p2 = response.heatmap.find((p) => p.pageNumber === 2)!;
    expect(p2.tier).toBe('flow');
    expect(p2.intensityScore).toBeCloseTo(27.8, 1);

    const p3 = response.heatmap.find((p) => p.pageNumber === 3)!;
    expect(p3.tier).toBe('deep');
    expect(p3.intensityScore).toBeCloseTo(66.7, 1);

    const p4 = response.heatmap.find((p) => p.pageNumber === 4)!;
    expect(p4.tier).toBe('epic');
    expect(p4.intensityScore).toBe(100.0);
  });

  it('respects differential privacy threshold when minTotalReads is required', () => {
    // Single reader session
    service.recordDwell({ chapterId: 'ch-100', pageNumber: 1, dwellSeconds: 30.0 });
    service.recordDwell({ chapterId: 'ch-100', pageNumber: 2, dwellSeconds: 45.0 });

    // Queried with minTotalReads: 20 (ChatGPT privacy recommendation)
    const restricted = service.getChapterDwellHeatmap('ch-100', { minTotalReads: 20 });
    expect(restricted.privacyRestricted).toBe(true);
    expect(restricted.heatmap).toEqual([]);
    expect(restricted.metrics.totalSessionViews).toBe(1);

    // Local reader query (minTotalReads: 0 or undefined) succeeds
    const local = service.getChapterDwellHeatmap('ch-100');
    expect(local.privacyRestricted).toBeUndefined();
    expect(local.heatmap.length).toBe(2);
  });

  it('records batch events successfully via recordBatch', () => {
    const res = service.recordBatch([
      { chapterId: 'ch-100', pageNumber: 1, dwellSeconds: 12.0 },
      { chapterId: 'ch-100', pageNumber: 2, dwellSeconds: 0.2 }, // skim
      { chapterId: 'ch-100', pageNumber: 3, dwellSeconds: 18.0 }
    ]);

    expect(res.accepted).toBe(2);
    expect(res.rejected).toBe(1);
  });
});
