import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { SpreadSplitterService } from '../../src/backend/services/spread-splitter-service.js';
import { detectSpreadLayout } from '../../src/backend/utils/spread-detector.js';

describe('Sprint 51 Benchmark: Two-Page Spread & Geometry Latency SLA', () => {
  let db: DatabaseInstance;
  let service: SpreadSplitterService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_bench', 'ser-bench', 'Bench Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('chap_bench', 'ser_bench', 1, 'Bench Chapter', '/storage/chap_bench')
    `).run();

    service = new SpreadSplitterService(db);

    // Seed 100 pages
    const pages = [];
    for (let i = 1; i <= 100; i++) {
      pages.push({
        pageNumber: i,
        width: i % 10 === 0 ? 2400 : 1000,
        height: 1440,
      });
    }
    service.batchDetectChapter('chap_bench', pages, 'rtl');
  });

  it('SLA 15: detectSpreadLayout executes in < 0.05 ms per page (Zero-allocation target)', () => {
    // Warmup
    for (let i = 0; i < 100; i++) {
      detectSpreadLayout({ width: 2400, height: 1800, sourcePageNumber: 42 });
    }

    const iterations = 5000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      detectSpreadLayout({
        width: i % 2 === 0 ? 2400 : 1000,
        height: 1800,
        sourcePageNumber: (i % 50) + 1,
        readingDirection: 'rtl',
      });
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`[Sprint 51] detectSpreadLayout avg latency: ${avgLatencyMs.toFixed(5)} ms (${(1000 / avgLatencyMs).toFixed(0)} evaluations/sec)`);

    expect(avgLatencyMs).toBeLessThan(0.05);
  });

  it('SLA: getSpreadManifest executes in < 0.5 ms per query', () => {
    // Warmup
    for (let i = 1; i <= 10; i++) {
      service.getSpreadManifest('chap_bench', i);
    }

    const iterations = 1000;
    const start = performance.now();
    for (let i = 1; i <= iterations; i++) {
      service.getSpreadManifest('chap_bench', (i % 100) + 1);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`[Sprint 51] getSpreadManifest avg latency: ${avgLatencyMs.toFixed(4)} ms`);

    expect(avgLatencyMs).toBeLessThan(0.5);
  });

  it('SLA: buildVirtualPageList expands 50 pages in < 3.0 ms', () => {
    const physicalPages = [];
    for (let i = 1; i <= 50; i++) {
      physicalPages.push({
        pageNumber: i,
        width: i % 10 === 0 ? 2400 : 1000,
        height: 1440,
        url: `/storage/p${i}.webp`,
      });
    }

    // Warmup
    for (let i = 0; i < 10; i++) {
      service.buildVirtualPageList('chap_bench', physicalPages, 'rtl');
    }

    const iterations = 500;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      service.buildVirtualPageList('chap_bench', physicalPages, 'rtl');
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`[Sprint 51] buildVirtualPageList (50 pages) avg latency: ${avgLatencyMs.toFixed(4)} ms`);

    expect(avgLatencyMs).toBeLessThan(3.0);
  });
});
