import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { StatsAnalyticsRepository } from '../../../src/backend/repositories/stats-analytics-repository.js';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository.js';

describe('StatsAnalyticsRepository (Sprint 41)', () => {
  let db: DatabaseInstance;
  let repo: StatsAnalyticsRepository;
  let chapRepo: ChapterRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    repo = new StatsAnalyticsRepository(db);
    chapRepo = new ChapterRepository(db);

    // Seed test series, genres, and chapters
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s1', 'chainsaw-man', 'Chainsaw Man', 'manga', 'ongoing'),
             ('s2', 'frieren', 'Frieren', 'manga', 'ongoing');

      INSERT INTO genres (id, name, slug)
      VALUES (1, 'Action', 'action'),
             (2, 'Fantasy', 'fantasy'),
             (3, 'Comedy', 'comedy');

      INSERT INTO series_genres (series_id, genre_id)
      VALUES ('s1', 1),
             ('s1', 3),
             ('s2', 2);
    `);

    chapRepo.createChapter({
      id: 'c1',
      seriesId: 's1',
      chapterNumber: 1,
      storagePath: 'series/chainsaw-man/c1',
    });

    chapRepo.createChapter({
      id: 'c2',
      seriesId: 's1',
      chapterNumber: 2,
      storagePath: 'series/chainsaw-man/c2',
    });

    chapRepo.createChapter({
      id: 'c3',
      seriesId: 's2',
      chapterNumber: 1,
      storagePath: 'series/frieren/c1',
    });
  });

  afterEach(() => {
    db.close();
  });

  it('returns empty axes when user has no reading history (zero division protection)', () => {
    const stats = repo.getGenreRadarStats('user_empty');
    expect(stats.userId).toBe('user_empty');
    expect(stats.totalGenresTracked).toBe(0);
    expect(stats.maxChapters).toBe(0);
    expect(stats.axes).toEqual([]);
  });

  it('records chapters read and calculates normalized radar scores', () => {
    repo.recordChapterRead('user_otaku', 'c1', 120);
    repo.recordChapterRead('user_otaku', 'c2', 150);
    repo.recordChapterRead('user_otaku', 'c3', 200);

    const stats = repo.getGenreRadarStats('user_otaku');
    expect(stats.userId).toBe('user_otaku');
    expect(stats.totalGenresTracked).toBe(3); // Action, Comedy, Fantasy
    expect(stats.maxChapters).toBe(2); // s1 has 2 chapters read (Action + Comedy)

    const actionAxis = stats.axes.find((a) => a.genreId === 1);
    const fantasyAxis = stats.axes.find((a) => a.genreId === 2);

    expect(actionAxis).toBeDefined();
    expect(actionAxis?.chaptersRead).toBe(2);
    expect(actionAxis?.score).toBe(100); // 2/2 = 100%

    expect(fantasyAxis).toBeDefined();
    expect(fantasyAxis?.chaptersRead).toBe(1);
    expect(fantasyAxis?.score).toBe(50); // 1/2 = 50%
  });

  it('generates continuous 365-day heatmap activity with intensity quartiles', () => {
    repo.recordChapterRead('user_otaku', 'c1', 120);
    repo.recordChapterRead('user_otaku', 'c2', 150);

    const heatmap = repo.getActivityHeatmap('user_otaku', 30);
    expect(heatmap.userId).toBe('user_otaku');
    expect(heatmap.days.length).toBe(31); // 0 to 30 inclusive
    expect(heatmap.totalPagesPeriod).toBeGreaterThan(0);
    expect(heatmap.totalDaysActive).toBe(1);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayItem = heatmap.days.find((d) => d.date === todayStr);
    expect(todayItem).toBeDefined();
    expect(todayItem?.pages).toBeGreaterThan(0);
    expect(todayItem?.intensity).toBeGreaterThanOrEqual(1);
  });

  it('handles monothematic user reading 1 genre smoothly', () => {
    repo.recordChapterRead('user_solo', 'c3', 300);

    const stats = repo.getGenreRadarStats('user_solo');
    expect(stats.totalGenresTracked).toBe(1);
    expect(stats.axes[0].genreName).toBe('Fantasy');
    expect(stats.axes[0].score).toBe(100);
  });
});
