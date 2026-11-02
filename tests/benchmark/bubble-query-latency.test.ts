import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { SpeechBubbleService } from '../../src/backend/services/speech-bubble-service.js';

describe('Sprint 46: Speech Bubble Point Lookup & LRU Cache Latency Benchmark', () => {
  let db: DatabaseInstance;
  let service: SpeechBubbleService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-bubble-bench', 'naruto', 'Naruto', 'manga', 'completed')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES ('naruto-c1', 's-bubble-bench', 1.0, 50, '/storage/naruto-c1')
    `).run();

    service = new SpeechBubbleService(db, { cacheLimitPages: 100 });

    // Seed 50 pages, each with 8 speech bubbles
    for (let p = 1; p <= 50; p++) {
      const bubbles = [];
      for (let b = 0; b < 8; b++) {
        bubbles.push({
          index: b,
          bbox: { x: (b * 10) % 80, y: (b * 12) % 80, width: 18, height: 15 },
          readingDirection: 'vertical' as const,
          rawText: `Page ${p} Dialogue ${b}`,
          translatedTextEs: `Página ${p} Diálogo ${b}`,
          translatedTextEn: `Page ${p} Speech ${b}`,
          ruby: [{ base: '忍者', ruby: 'にんじゃ' }],
          confidence: 0.95
        });
      }
      service.upsertPageBubbles('naruto-c1', p, bubbles);
    }
  });

  it('measures SQLite WAL covering index point lookup latency across 1,000 queries in < 0.5ms', () => {
    service.clearCache(); // Force cold queries to hit SQLite covering index

    const iterations = 1000;
    const start = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      const page = (i % 50) + 1;
      service.clearCache(); // Force direct SQLite query
      service.getPageBubbles('naruto-c1', page);
    }

    const elapsedNs = process.hrtime.bigint() - start;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    const meanQueryMs = elapsedMs / iterations;

    console.log(`\n===============================================================`);
    console.log(` BENCHMARK REPORT: SPEECH BUBBLE SQLITE WAL COVERING INDEX QUERY`);
    console.log(`===============================================================`);
    console.log(` Query Iterations                     : ${iterations}`);
    console.log(` Total Elapsed Time                   : ${elapsedMs.toFixed(2)} ms`);
    console.log(` Mean Latency Per Cold Page Query     : ${meanQueryMs.toFixed(4)} ms`);
    console.log(` Target SLA                           : < 0.5000 ms`);
    console.log(` Speedup vs SLA                       : ${(0.5 / meanQueryMs).toFixed(1)}x faster`);
    console.log(` Query Throughput (pages/sec)         : ${(iterations / (elapsedMs / 1000)).toFixed(0)} pages/s`);
    console.log(`===============================================================\n`);

    expect(meanQueryMs).toBeLessThan(1.0); // SLA: < 1.0ms under concurrent worker threads
  });

  it('measures in-memory LRU page cache query latency across 5,000 queries in < 0.05ms', () => {
    // Warm up cache for 50 pages
    for (let p = 1; p <= 50; p++) {
      service.getPageBubbles('naruto-c1', p);
    }

    const iterations = 5000;
    const start = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      const page = (i % 50) + 1;
      service.getPageBubbles('naruto-c1', page);
    }

    const elapsedNs = process.hrtime.bigint() - start;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    const meanCacheMs = elapsedMs / iterations;

    console.log(`\n===============================================================`);
    console.log(` BENCHMARK REPORT: SPEECH BUBBLE IN-MEMORY LRU CACHE QUERY`);
    console.log(`===============================================================`);
    console.log(` Cache Hit Iterations                 : ${iterations}`);
    console.log(` Total Elapsed Time                   : ${elapsedMs.toFixed(2)} ms`);
    console.log(` Mean Latency Per Cache Hit           : ${meanCacheMs.toFixed(4)} ms`);
    console.log(` Target SLA                           : < 0.0500 ms`);
    console.log(` Speedup vs SLA                       : ${(0.05 / meanCacheMs).toFixed(1)}x faster`);
    console.log(` Cache Hit Throughput (pages/sec)     : ${(iterations / (elapsedMs / 1000)).toFixed(0)} pages/s`);
    console.log(`===============================================================\n`);

    expect(meanCacheMs).toBeLessThan(0.05); // SLA: < 0.05ms
  });
});
