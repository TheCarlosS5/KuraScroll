import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { BookmarkRepository } from '../../../src/backend/repositories/bookmark-repository';

describe('BookmarkRepository Unit Suite', () => {
  let db: DatabaseInstance;
  let repo: BookmarkRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed dummy series and chapters
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('series-1', 'solo-leveling', 'Solo Leveling', 'manhwa', 'ongoing')
    `).run();

    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES (?, 'series-1', ?, ?, '/path', ?)
    `);

    insertChapter.run('ch-1', 1, 'Chapter 1: Awaken', 20);
    insertChapter.run('ch-2', 2, 'Chapter 2: Double Dungeon', 24);
    insertChapter.run('ch-3', 3, 'Chapter 3: Quest Log', 18);

    repo = new BookmarkRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates and retrieves a new bookmark', () => {
    const bm = repo.createOrUpdateBookmark({
      userId: 'user-default',
      seriesId: 'series-1',
      chapterId: 'ch-1',
      pageIndex: 5,
      note: 'Epic entrance panel',
    });

    expect(bm.id).toBeDefined();
    expect(bm.userId).toBe('user-default');
    expect(bm.seriesId).toBe('series-1');
    expect(bm.chapterId).toBe('ch-1');
    expect(bm.pageIndex).toBe(5);
    expect(bm.note).toBe('Epic entrance panel');

    const fetched = repo.getBookmarkByLocation('user-default', 'ch-1', 5);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(bm.id);
  });

  it('updates note on duplicate page without creating multiple records (UPSERT)', () => {
    const first = repo.createOrUpdateBookmark({
      userId: 'user-default',
      seriesId: 'series-1',
      chapterId: 'ch-1',
      pageIndex: 10,
      note: 'Initial note',
    });

    const second = repo.createOrUpdateBookmark({
      userId: 'user-default',
      seriesId: 'series-1',
      chapterId: 'ch-1',
      pageIndex: 10,
      note: 'Updated note',
    });

    expect(second.id).toBe(first.id);
    expect(second.note).toBe('Updated note');

    const all = repo.getBookmarksForChapter('user-default', 'ch-1');
    expect(all.length).toBe(1);
    expect(all[0].note).toBe('Updated note');
  });

  it('deletes bookmark by id and by location', () => {
    const bm1 = repo.createOrUpdateBookmark({
      userId: 'user-default',
      seriesId: 'series-1',
      chapterId: 'ch-1',
      pageIndex: 1,
    });
    const bm2 = repo.createOrUpdateBookmark({
      userId: 'user-default',
      seriesId: 'series-1',
      chapterId: 'ch-1',
      pageIndex: 2,
    });

    expect(repo.deleteBookmark('user-default', bm1.id)).toBe(true);
    expect(repo.getBookmarkByLocation('user-default', 'ch-1', 1)).toBeNull();

    expect(repo.deleteBookmarkByLocation('user-default', 'ch-1', 2)).toBe(true);
    expect(repo.getBookmarkByLocation('user-default', 'ch-1', 2)).toBeNull();

    // Deleting non-existent returns false
    expect(repo.deleteBookmark('user-default', 9999)).toBe(false);
  });

  it('executes getSeriesQuickIndex combining chapters, progress, and bookmarks in a single query', () => {
    // Add user progress: Ch 1 completed
    db.prepare(`
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, is_completed)
      VALUES ('user-default', 'series-1', 'ch-1', 20, 1)
    `).run();

    // Add 2 bookmarks on Ch 2, 1 on Ch 3
    repo.createOrUpdateBookmark({
      userId: 'user-default',
      seriesId: 'series-1',
      chapterId: 'ch-2',
      pageIndex: 4,
    });
    repo.createOrUpdateBookmark({
      userId: 'user-default',
      seriesId: 'series-1',
      chapterId: 'ch-2',
      pageIndex: 8,
    });
    repo.createOrUpdateBookmark({
      userId: 'user-default',
      seriesId: 'series-1',
      chapterId: 'ch-3',
      pageIndex: 1,
    });

    const quickIndex = repo.getSeriesQuickIndex('user-default', 'series-1');

    expect(quickIndex.seriesId).toBe('series-1');
    expect(quickIndex.totalChapters).toBe(3);
    expect(quickIndex.readChapters).toBe(1);
    expect(quickIndex.totalBookmarks).toBe(3);

    // Ch 1
    expect(quickIndex.chapters[0].chapterNumber).toBe(1);
    expect(quickIndex.chapters[0].completed).toBe(true);
    expect(quickIndex.chapters[0].lastPageIndex).toBe(20);
    expect(quickIndex.chapters[0].bookmarkCount).toBe(0);

    // Ch 2
    expect(quickIndex.chapters[1].chapterNumber).toBe(2);
    expect(quickIndex.chapters[1].completed).toBe(false);
    expect(quickIndex.chapters[1].lastPageIndex).toBe(1);
    expect(quickIndex.chapters[1].bookmarkCount).toBe(2);

    // Ch 3
    expect(quickIndex.chapters[2].chapterNumber).toBe(3);
    expect(quickIndex.chapters[2].completed).toBe(false);
    expect(quickIndex.chapters[2].lastPageIndex).toBe(1);
    expect(quickIndex.chapters[2].bookmarkCount).toBe(1);
  });
});
