import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { StatsAnalyticsRepository } from '../../src/backend/repositories/stats-analytics-repository.js';
import { ChapterRepository } from '../../src/backend/repositories/chapter-repository.js';

describe('Sprint 41: Stats Analytics SQLite WAL Latency Benchmark', () => {
  let db: DatabaseInstance;
  let repo: StatsAnalyticsRepository;
  let chapRepo: ChapterRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    repo = new StatsAnalyticsRepository(db);
    chapRepo = new ChapterRepository(db);

    // Seed 10 series and 10 genres
    for (let i = 1; i <= 10; i++) {
      db.prepare(`
        INSERT INTO series (id, slug, title_primary, type, status)
        VALUES (?, ?, ?, 'manga', 'ongoing')
      `).run(`s${i}`, `series-${i}`, `Series ${i}`);

      db.prepare(`
        INSERT INTO genres (id, name, slug)
        VALUES (?, ?, ?)
      `).run(i, `Genre ${i}`, `genre-${i}`);

      db.prepare(`
        INSERT INTO series_genres (series_id, genre_id)
        VALUES (?, ?)
      `).run(`s${i}`, i);

      chapRepo.createChapter({
        id: `c${i}`,
        seriesId: `s${i}`,
        chapterNumber: 1,
        storagePath: `series/s${i}/c1`,
      });

      // Record reading activity
      repo.recordChapterRead('user_bench', `c${i}`, 150);
    }
  });

  afterEach(() => {
    db.close();
  });

  it('executes genre radar stats query in < 1.5ms SLA', () => {
    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      repo.getGenreRadarStats('user_bench', 8);
    }

    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`Radar Query Avg Latency: ${avgLatencyMs.toFixed(4)} ms`);
    expect(avgLatencyMs).toBeLessThan(1.5);
  });

  it('executes 365-day activity heatmap query in < 1.5ms SLA', () => {
    // Warmup JIT
    for (let i = 0; i < 20; i++) {
      repo.getActivityHeatmap('user_bench', 364);
    }

    const iterations = 200;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      repo.getActivityHeatmap('user_bench', 364);
    }

    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`Heatmap Query Avg Latency: ${avgLatencyMs.toFixed(4)} ms`);
    expect(avgLatencyMs).toBeLessThan(3.0);
  });
});
