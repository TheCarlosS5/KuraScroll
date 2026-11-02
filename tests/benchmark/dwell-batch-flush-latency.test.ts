import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { DwellTelemetryService } from '../../src/backend/services/dwell-telemetry-service.js';

describe('Sprint 45: Dwell Telemetry Write-Behind Batch Flush & Query Latency Benchmark', () => {
  let db: DatabaseInstance;
  let service: DwellTelemetryService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-bench', 'bench-manga', 'Benchmark Manga', 'manga', 'ongoing')
    `).run();

    for (let c = 1; c <= 5; c++) {
      db.prepare(`
        INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
        VALUES ('bench-c${c}', 's-bench', ${c}, 50, '/storage/bench-c${c}')
      `).run();
    }

    service = new DwellTelemetryService(db, { batchSize: 100 });
  });

  afterEach(() => {
    service.destroy();
  });

  it('flushes a 50-item write-behind batch in < 2.0ms (SLA target)', () => {
    const batchRuns = 20;
    const flushLatencies: number[] = [];

    for (let run = 0; run < batchRuns; run++) {
      // Buffer 50 events across 5 chapters
      for (let p = 1; p <= 50; p++) {
        const chapterId = `bench-c${(p % 5) + 1}`;
        service.recordDwell({
          chapterId,
          pageNumber: p,
          dwellSeconds: 15.0 + (p % 30)
        });
      }

      const start = process.hrtime.bigint();
      const flushed = service.flush();
      const elapsedNs = process.hrtime.bigint() - start;
      const elapsedMs = Number(elapsedNs) / 1_000_000;

      expect(flushed).toBe(50);
      flushLatencies.push(elapsedMs);
    }

    const meanLatencyMs = flushLatencies.reduce((a, b) => a + b, 0) / flushLatencies.length;
    const minLatencyMs = Math.min(...flushLatencies);
    const maxLatencyMs = Math.max(...flushLatencies);

    console.log(`\n===============================================================`);
    console.log(` BENCHMARK REPORT: DWELL WRITE-BEHIND 50-ITEM BATCH FLUSH`);
    console.log(`===============================================================`);
    console.log(` Batch Runs Evaluated                 : ${batchRuns}`);
    console.log(` Items Per Batch                      : 50`);
    console.log(` Total Telemetry Items Flushed        : ${batchRuns * 50}`);
    console.log(` Mean Flush Latency                   : ${meanLatencyMs.toFixed(3)} ms`);
    console.log(` Min / Max Flush Latency              : ${minLatencyMs.toFixed(3)} ms / ${maxLatencyMs.toFixed(3)} ms`);
    console.log(` Target SLA                           : < 2.000 ms`);
    console.log(` Speedup vs SLA                       : ${(2.0 / meanLatencyMs).toFixed(1)}x faster`);
    console.log(` Flushed Events Throughput            : ${(50 / (meanLatencyMs / 1000)).toFixed(0)} events/sec`);
    console.log(`===============================================================\n`);

    expect(meanLatencyMs).toBeLessThan(2.0); // SLA: < 2ms
  });

  it('queries 50-page chapter dwell heatmap in < 1.0ms', () => {
    // Populate 50 pages of stats for chapter bench-c1
    for (let p = 1; p <= 50; p++) {
      service.recordDwell({
        chapterId: 'bench-c1',
        pageNumber: p,
        dwellSeconds: 10 + (p * 1.5)
      });
    }
    service.flush();

    const iterations = 500;
    const start = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      service.getChapterDwellHeatmap('bench-c1');
    }

    const elapsedNs = process.hrtime.bigint() - start;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    const meanQueryMs = elapsedMs / iterations;

    console.log(`\n===============================================================`);
    console.log(` BENCHMARK REPORT: 50-PAGE CHAPTER HEATMAP QUERY LATENCY`);
    console.log(`===============================================================`);
    console.log(` Query Iterations                     : ${iterations}`);
    console.log(` Total Elapsed Time                   : ${elapsedMs.toFixed(2)} ms`);
    console.log(` Mean Latency Per Query               : ${meanQueryMs.toFixed(4)} ms`);
    console.log(` Target SLA                           : < 1.0000 ms`);
    console.log(` Speedup vs SLA                       : ${(1.0 / meanQueryMs).toFixed(1)}x faster`);
    console.log(` Heatmap Queries Throughput           : ${(iterations / (elapsedMs / 1000)).toFixed(0)} queries/sec`);
    console.log(`===============================================================\n`);

    expect(meanQueryMs).toBeLessThan(1.0); // SLA: < 1ms
  });
});
