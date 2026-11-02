import { describe, it, expect } from 'vitest';
import { createDatabase, runMigrations } from '../../src/backend/db/database.js';
import { PanelDetectionService } from '../../src/backend/services/panel-detection-service.js';
import { hitTestPanel, PanelBox } from '../../src/backend/utils/panel-spatial-index.js';

describe('Sprint 55 Benchmark: In-Memory Spatial Hit Test Latency & SLA 19', () => {
  it('SLA 19: In-Memory Spatial Hit Test executes in < 0.005 ms (< 5 µs per query)', () => {
    // Generate realistic 6-panel manga page
    const panels: PanelBox[] = [
      { id: 'p1', chapterId: 'ch1', pageNumber: 1, panelIndex: 0, x: 50.0, y: 0.0, w: 50.0, h: 30.0, aspectRatio: 1.66, readingOrder: 0 },
      { id: 'p2', chapterId: 'ch1', pageNumber: 1, panelIndex: 1, x: 0.0, y: 0.0, w: 50.0, h: 30.0, aspectRatio: 1.66, readingOrder: 1 },
      { id: 'p3', chapterId: 'ch1', pageNumber: 1, panelIndex: 2, x: 60.0, y: 32.0, w: 40.0, h: 35.0, aspectRatio: 1.14, readingOrder: 2 },
      { id: 'p4', chapterId: 'ch1', pageNumber: 1, panelIndex: 3, x: 0.0, y: 32.0, w: 60.0, h: 35.0, aspectRatio: 1.71, readingOrder: 3 },
      { id: 'p5', chapterId: 'ch1', pageNumber: 1, panelIndex: 4, x: 45.0, y: 69.0, w: 55.0, h: 31.0, aspectRatio: 1.77, readingOrder: 4 },
      { id: 'p6', chapterId: 'ch1', pageNumber: 1, panelIndex: 5, x: 0.0, y: 69.0, w: 45.0, h: 31.0, aspectRatio: 1.45, readingOrder: 5 }
    ];

    const iterations = 50_000;
    // Warmup
    for (let i = 0; i < 2_000; i++) {
      hitTestPanel(25.0, 15.0, panels);
    }

    const startNs = process.hrtime.bigint();
    let hits = 0;
    for (let i = 0; i < iterations; i++) {
      const px = (i % 100);
      const py = ((i * 7) % 100);
      const hit = hitTestPanel(px, py, panels);
      if (hit) hits++;
    }
    const elapsedNs = process.hrtime.bigint() - startNs;
    const avgMs = Number(elapsedNs) / (iterations * 1_000_000);
    const avgUs = avgMs * 1000;
    const opsPerSec = Math.round(iterations / (Number(elapsedNs) / 1_000_000_000));

    console.log(`[Sprint 55 SLA 19] In-Memory Spatial Hit Test avg latency: ${avgUs.toFixed(3)} µs (${avgMs.toFixed(6)} ms) | ${opsPerSec} queries/sec | hits: ${hits}`);

    // SLA 19 Target: < 0.005 ms (5 µs)
    expect(avgMs).toBeLessThan(0.005);
  });

  it('PanelDetectionService getPanelsForPage query with SQLite/LRU executes in < 0.5 ms', () => {
    const db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s1', 's-1', 'Test', 'manga', 'ongoing')
    `).run();
    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('ch1', 's1', 1.0, 'Chapter 1', '/storage/ch1')
    `).run();

    const service = new PanelDetectionService(db);
    service.savePanels('ch1', 1, [
      { x: 50, y: 0, w: 50, h: 30 },
      { x: 0, y: 0, w: 50, h: 30 },
      { x: 0, y: 35, w: 100, h: 65 }
    ]);

    const iterations = 10_000;
    const startNs = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      const panels = service.getPanelsForPage('ch1', 1);
      expect(panels).toHaveLength(3);
    }
    const elapsedNs = process.hrtime.bigint() - startNs;
    const avgMs = Number(elapsedNs) / (iterations * 1_000_000);

    console.log(`[Sprint 55] getPanelsForPage avg latency: ${avgMs.toFixed(6)} ms | ${(avgMs * 1000).toFixed(3)} µs`);
    expect(avgMs).toBeLessThan(0.5);

    db.close();
  });
});
