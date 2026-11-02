import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { DuplicateDetectorService } from '../../../src/backend/services/duplicate-detector-service.js';

describe('DuplicateDetectorService Unit & Integration Tests (Sprint 43)', () => {
  let db: DatabaseInstance;
  let service: DuplicateDetectorService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new DuplicateDetectorService(db);
  });

  it('detects near-duplicate series pairs using FTS5 candidate blocking and fuzzy scoring', () => {
    // Insert test series
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES 
        ('s-1', 'solo-leveling-asura', 'Solo Leveling [Asura Scans]', 'manhwa', 'completed'),
        ('s-2', 'solo-leveling-official', 'Solo Leveling (Official)', 'manhwa', 'completed'),
        ('s-3', 'berserk', 'Berserk', 'manga', 'ongoing')
    `).run();

    // Populate series_titles for FTS5 index
    db.prepare(`INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES ('s-1', 'en', 'Solo Leveling [Asura Scans]', 1)`).run();
    db.prepare(`INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES ('s-2', 'en', 'Solo Leveling (Official)', 1)`).run();
    db.prepare(`INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES ('s-3', 'en', 'Berserk', 1)`).run();

    const candidates = service.findDuplicateCandidates(0.85);

    expect(candidates.length).toBe(1);
    expect(candidates[0].similarityScore).toBe(1.0);
    expect(candidates[0].recommendation).toBe('AUTO_MERGE');
    expect(candidates[0].source.titlePrimary).toContain('Solo Leveling');
    expect(candidates[0].target.titlePrimary).toContain('Solo Leveling');
  });

  it('merges non-overlapping chapters and transfers user reading progress cleanly', () => {
    // Setup series A (source) and series B (target)
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES 
        ('s-src', 'attack-on-titan-scan', 'Attack on Titan [Scan A]', 'manga', 'completed'),
        ('s-tgt', 'attack-on-titan-hq', 'Attack on Titan [HQ]', 'manga', 'completed')
    `).run();

    // Setup chapters: src has ch 1, 2; tgt has ch 3
    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES 
        ('ch-1', 's-src', 1, 20, '/manga/aot/ch1'),
        ('ch-2', 's-src', 2, 22, '/manga/aot/ch2'),
        ('ch-3', 's-tgt', 3, 24, '/manga/aot/ch3')
    `).run();

    // User progress on source series (ch 2, page 10)
    db.prepare(`
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number)
      VALUES ('local_user', 's-src', 'ch-2', 10)
    `).run();

    // Perform merge
    const result = service.mergeSeries('s-src', 's-tgt');

    expect(result.success).toBe(true);
    expect(result.chaptersMoved).toBe(2);
    expect(result.chaptersOverwritten).toBe(0);

    // Verify target series now owns all 3 chapters
    const chapters = db.prepare('SELECT id, series_id, chapter_number FROM chapters ORDER BY chapter_number ASC').all() as Array<{
      id: string;
      series_id: string;
      chapter_number: number;
    }>;
    expect(chapters.length).toBe(3);
    expect(chapters.every((c) => c.series_id === 's-tgt')).toBe(true);

    // Verify source series was removed
    const sourceSeries = db.prepare('SELECT id FROM series WHERE id = ?').get('s-src');
    expect(sourceSeries).toBeUndefined();

    // Verify user progress was reassigned to target series
    const progress = db.prepare('SELECT series_id, chapter_id, page_number FROM user_progress WHERE user_id = ?').get('local_user') as {
      series_id: string;
      chapter_id: string;
      page_number: number;
    };
    expect(progress.series_id).toBe('s-tgt');
    expect(progress.chapter_id).toBe('ch-2');
    expect(progress.page_number).toBe(10);

    // Verify audit log
    const history = service.getMergeHistory();
    expect(history.length).toBe(1);
    expect(history[0].sourceSeriesId).toBe('s-src');
    expect(history[0].targetSeriesId).toBe('s-tgt');
  });

  it('reconciles colliding chapter numbers using KEEP_HIGHER_PAGE_COUNT strategy', () => {
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES 
        ('s-a', 'chainsaw-man-low', 'Chainsaw Man [LQ]', 'manga', 'ongoing'),
        ('s-b', 'chainsaw-man-hd', 'Chainsaw Man [HD]', 'manga', 'ongoing')
    `).run();

    // Both have chapter 1: s-a has 18 pages, s-b has 26 pages (higher quality)
    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES 
        ('ch-lq-1', 's-a', 1, 18, '/manga/csm/ch1-lq'),
        ('ch-hd-1', 's-b', 1, 26, '/manga/csm/ch1-hd')
    `).run();

    // Merge s-a into s-b
    const result = service.mergeSeries('s-a', 's-b', 'KEEP_HIGHER_PAGE_COUNT');

    expect(result.success).toBe(true);
    expect(result.chaptersOverwritten).toBe(1);

    // Only 1 chapter remaining for s-b, retaining the 26-page version
    const surviving = db.prepare('SELECT id, page_count FROM chapters WHERE series_id = ?').all('s-b') as Array<{
      id: string;
      page_count: number;
    }>;
    expect(surviving.length).toBe(1);
    expect(surviving[0].id).toBe('ch-hd-1');
    expect(surviving[0].page_count).toBe(26);
  });
});
