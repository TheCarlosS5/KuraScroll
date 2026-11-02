import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { ReadingCadenceService } from '../../../src/backend/services/reading-cadence-service.js';

describe('Sprint 53: ReadingCadenceService', () => {
  let db: DatabaseInstance;
  let service: ReadingCadenceService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_cad', 'ser-cad', 'Cadence Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('chap_cad', 'ser_cad', 1, 'Chapter 1', '/storage/cad1')
    `).run();

    service = new ReadingCadenceService(db);
  });

  it('provides cold-start baselines based on reading mode', () => {
    const mangaProfile = service.getUserCadence('user_1', 'manga');
    expect(mangaProfile.averageSecondsPerPage).toBe(24.0);
    expect(mangaProfile.samplesCount).toBe(0);

    const webtoonProfile = service.getUserCadence('user_1', 'webtoon');
    expect(webtoonProfile.averageSecondsPerPage).toBe(12.0);

    const comicProfile = service.getUserCadence('user_1', 'comic');
    expect(comicProfile.averageSecondsPerPage).toBe(32.0);
  });

  it('records valid transitions and smooths cadence using EMA', () => {
    // Record page 1: 20 seconds dwell
    const res1 = service.recordTransition({
      userId: 'user_1',
      chapterId: 'chap_cad',
      pageNumber: 1,
      dwellSeconds: 20.0,
      readingMode: 'manga',
      totalPages: 20,
    });

    expect(res1.isOutlier).toBe(false);
    expect(res1.pagesRemaining).toBe(19);
    // Initial was 24.0, first sample alpha 0.25: 0.25 * 20 + 0.75 * 24 = 23.0
    expect(res1.effectiveSecondsPerPage).toBe(23.0);
    expect(res1.estimatedRemainingSeconds).toBe(19 * 23);

    // Record page 2: 15 seconds dwell
    const res2 = service.recordTransition({
      userId: 'user_1',
      chapterId: 'chap_cad',
      pageNumber: 2,
      dwellSeconds: 15.0,
      readingMode: 'manga',
      totalPages: 20,
    });

    expect(res2.pagesRemaining).toBe(18);
    expect(res2.effectiveSecondsPerPage).toBeLessThan(23.0);
  });

  it('filters rapid skips without corrupting cadence', () => {
    // Baseline is 24.0
    const res = service.recordTransition({
      userId: 'user_1',
      chapterId: 'chap_cad',
      pageNumber: 5,
      dwellSeconds: 0.4, // Rapid skip < 1.5s
      readingMode: 'manga',
      totalPages: 20,
    });

    expect(res.isOutlier).toBe(true);
    expect(res.outlierReason).toBe('rapid_skip');
    // Cadence remains at baseline
    expect(res.effectiveSecondsPerPage).toBe(24.0);
  });

  it('clamps AFK pauses and marks as afk_pause outlier', () => {
    const res = service.recordTransition({
      userId: 'user_1',
      chapterId: 'chap_cad',
      pageNumber: 3,
      dwellSeconds: 400.0, // 6+ minutes AFK
      readingMode: 'manga',
      totalPages: 20,
    });

    expect(res.isOutlier).toBe(true);
    expect(res.outlierReason).toBe('afk_pause');
  });

  it('normalizes two-page spread dwell times', () => {
    const res = service.recordTransition({
      userId: 'user_spread',
      chapterId: 'chap_cad',
      pageNumber: 10,
      dwellSeconds: 40.0,
      isDoubleSpread: true, // Effective dwell = 20s
      readingMode: 'manga',
      totalPages: 25,
    });

    // 0.25 * 20.0 + 0.75 * 24.0 = 23.0
    expect(res.effectiveSecondsPerPage).toBe(23.0);
  });

  it('predicts completion based on cached session cadence', () => {
    service.recordTransition({
      userId: 'u_pred',
      chapterId: 'chap_cad',
      pageNumber: 1,
      dwellSeconds: 20.0,
      readingMode: 'manga',
      totalPages: 10,
    });

    const pred = service.predictCompletion('u_pred', 'chap_cad', 4, 10, 'manga');
    expect(pred.pagesRemaining).toBe(6);
    expect(pred.estimatedRemainingSeconds).toBe(6 * 23);
    expect(pred.estimatedRemainingMinutes).toBe(3);
  });

  it('resets cadence profile cleanly', () => {
    service.recordTransition({
      userId: 'u_reset',
      chapterId: 'chap_cad',
      pageNumber: 1,
      dwellSeconds: 10.0,
      readingMode: 'manga',
    });

    service.resetCadence('u_reset', 'manga');
    const profile = service.getUserCadence('u_reset', 'manga');
    expect(profile.samplesCount).toBe(0);
    expect(profile.averageSecondsPerPage).toBe(24.0);
  });
});
