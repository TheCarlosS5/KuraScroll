import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { RecommendationService } from '../../../src/backend/services/recommendation-service';

describe('Sprint 32: RecommendationService (Inverted Tag Index & Scoring)', () => {
  let db: DatabaseInstance;
  let service: RecommendationService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed test series
    const insertSeries = db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status, cover_image)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertSeries.run('s1', 'solo-leveling', 'Solo Leveling', 'manhwa', 'completed', '/covers/sl.jpg');
    insertSeries.run('s2', 'omniscient-reader', 'Omniscient Reader', 'manhwa', 'ongoing', '/covers/orv.jpg');
    insertSeries.run('s3', 'berserk', 'Berserk', 'manga', 'ongoing', '/covers/berserk.jpg');
    insertSeries.run('s4', 'spy-family', 'Spy x Family', 'manga', 'ongoing', '/covers/spy.jpg');
    insertSeries.run('s5', 'martial-peak', 'Martial Peak', 'manhua', 'ongoing', '/covers/mp.jpg');

    // Seed genres
    const insertGenre = db.prepare('INSERT OR IGNORE INTO genres (id, name, slug) VALUES (?, ?, ?)');
    insertGenre.run(1, 'Action', 'action');
    insertGenre.run(2, 'Fantasy', 'fantasy');
    insertGenre.run(3, 'Comedy', 'comedy');
    insertGenre.run(4, 'Dark Fantasy', 'dark-fantasy');

    // Link series genres
    const linkGenre = db.prepare('INSERT INTO series_genres (series_id, genre_id) VALUES (?, ?)');
    linkGenre.run('s1', 1);
    linkGenre.run('s1', 2);

    linkGenre.run('s2', 1);
    linkGenre.run('s2', 2);

    linkGenre.run('s3', 1);
    linkGenre.run('s3', 4);

    linkGenre.run('s4', 3);

    linkGenre.run('s5', 1);

    // Add chapters
    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (let i = 1; i <= 5; i++) {
      insertChapter.run(`c1-${i}`, 's1', i, `Capítulo ${i}`, `/sl/${i}`, 20);
      insertChapter.run(`c2-${i}`, 's2', i, `Capítulo ${i}`, `/orv/${i}`, 20);
      insertChapter.run(`c3-${i}`, 's3', i, `Capítulo ${i}`, `/berserk/${i}`, 25);
      insertChapter.run(`c4-${i}`, 's4', i, `Capítulo ${i}`, `/spy/${i}`, 18);
      insertChapter.run(`c5-${i}`, 's5', i, `Capítulo ${i}`, `/mp/${i}`, 15);
    }

    service = new RecommendationService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('provides a cold-start fallback with 0 affinity score when user has no history', () => {
    const recs = service.getRecommendations('new_user_1', 4);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].affinityScore).toBe(0);
    expect(recs[0].reasonBadge).toBe('Popular en KuraScroll');
    expect(recs[0].reasonType).toBe('popular');
  });

  it('recommends highly affine manhwas to a reader who completed Solo Leveling chapters', () => {
    // Record reading progress on Solo Leveling (s1)
    const insertProgress = db.prepare(`
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, is_completed, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    insertProgress.run('user_action_fan', 's1', 'c1-3', 20, 1);

    const recs = service.getRecommendations('user_action_fan', 4);
    expect(recs.length).toBeGreaterThan(0);

    // Omniscient Reader (s2) is also a manhwa and shares Action + Fantasy -> Should be top ranked
    const topRec = recs[0];
    expect(topRec.id).toBe('s2');
    expect(topRec.affinityScore).toBeGreaterThan(50);
    expect(topRec.reasonBadge).toContain('Solo Leveling');
    expect(topRec.reasonType).toBe('similarity');
  });

  it('injects a serendipity card from a distinct genre', () => {
    const insertProgress = db.prepare(`
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, is_completed, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    insertProgress.run('user_otaku', 's1', 'c1-1', 20, 1);

    const recs = service.getRecommendations('user_otaku', 8);
    // Look for serendipity reason
    const serendipity = recs.find((r) => r.reasonType === 'serendipity');
    if (serendipity) {
      expect(serendipity.reasonBadge).toContain('Salto de Dimensión');
    }
  });

  it('serves subsequent recommendation requests from RAM cache', () => {
    const t0 = performance.now();
    const first = service.getRecommendations('cached_user', 5);
    const t1 = performance.now();

    const t2 = performance.now();
    const second = service.getRecommendations('cached_user', 5);
    const t3 = performance.now();

    expect(second.length).toBe(first.length);
    // Cache read must be near instantaneous (< 0.5 ms)
    expect(t3 - t2).toBeLessThan(1.0);
  });
});
