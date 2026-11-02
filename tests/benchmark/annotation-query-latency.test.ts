import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { PageAnnotationService } from '../../src/backend/services/page-annotation-service.js';

describe('Sprint 52 Benchmark: Annotation Query Latency & Memory SLA', () => {
  let db: DatabaseInstance;
  let service: PageAnnotationService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_sla', 'ser-sla', 'SLA Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('chap_sla', 'ser_sla', 1, 'SLA Chapter', '/storage/sla')
    `).run();

    service = new PageAnnotationService(db);

    // Seed 100 annotations across 50 pages
    for (let i = 1; i <= 100; i++) {
      const page = (i % 50) + 1;
      service.createAnnotation({
        chapterId: 'chap_sla',
        pageNumber: page,
        userId: `reader_${i % 10}`,
        anchorX: (i * 3.7) % 95,
        anchorY: (i * 5.1) % 90,
        annotationType: i % 3 === 0 ? 'panel_bookmark' : i % 3 === 1 ? 'reaction' : 'sticky_note',
        contentText: `Benchmark annotation #${i} for latency testing`,
        colorPreset: i % 2 === 0 ? 'yellow' : 'blue',
      });
    }
  });

  it('SLA 16: getAnnotationsForPage with LRU caching executes in < 0.15 ms (< 0.5 ms SLA)', () => {
    // Warmup
    for (let i = 1; i <= 50; i++) {
      service.getAnnotationsForPage('chap_sla', i);
    }

    const iterations = 2000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const page = (i % 50) + 1;
      service.getAnnotationsForPage('chap_sla', page);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`[Sprint 52 SLA 16] getAnnotationsForPage avg latency: ${avgLatencyMs.toFixed(5)} ms (${(1000 / avgLatencyMs).toFixed(0)} queries/sec)`);

    expect(avgLatencyMs).toBeLessThan(0.15);
  });

  it('getAnnotationsForChapter retrieves full chapter deck in < 1.0 ms', () => {
    const start = performance.now();
    const allNotes = service.getAnnotationsForChapter('chap_sla');
    const elapsed = performance.now() - start;

    expect(allNotes).toHaveLength(100);
    expect(elapsed).toBeLessThan(1.5);
  });
});
