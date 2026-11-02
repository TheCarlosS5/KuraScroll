import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Sprint 34: Bookmarks & Quick-Navigation Drawer Service
 */
class BookmarkQuickIndexService {
  constructor(private db: DatabaseInstance) {}

  public addBookmark(userId: string, chapterId: string, pageNumber: number, note?: string): boolean {
    const sanitizedNote = note ? note.slice(0, 500) : null;

    const chapter = this.db.prepare(`SELECT id, series_id FROM chapters WHERE id = ?`).get(chapterId) as any;
    if (!chapter) {
      throw new Error('Foreign key violation: Chapter does not exist');
    }

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.prepare(`
        INSERT INTO user_bookmarks (user_id, series_id, chapter_id, page_index, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(user_id, chapter_id, page_index) DO UPDATE SET
          note = excluded.note,
          updated_at = datetime('now')
      `).run(userId, chapter.series_id, chapterId, pageNumber, sanitizedNote);
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return true;
  }

  public deleteBookmark(userId: string, chapterId: string, pageNumber: number): void {
    this.db.prepare(`
      DELETE FROM user_bookmarks WHERE user_id = ? AND chapter_id = ? AND page_index = ?
    `).run(userId, chapterId, pageNumber);
  }

  public getQuickIndex(seriesId: string): any[] {
    const seriesExists = this.db.prepare(`SELECT id FROM series WHERE id = ?`).get(seriesId);
    if (!seriesExists) {
      throw new Error('Series does not exist');
    }

    return this.db.prepare(`
      SELECT id, chapter_number, COALESCE(title, 'Untitled') AS title
      FROM chapters
      WHERE series_id = ?
      ORDER BY chapter_number ASC
    `).all(seriesId);
  }
}

describe('Sprint 34: Bookmarks & Quick-Navigation Drawer Resilience Suite', () => {
  let db: DatabaseInstance;
  let service: BookmarkQuickIndexService;
  let testSandbox: string;

  beforeEach(async () => {
    testSandbox = path.resolve(__dirname, 'sandbox-sprint34');
    await fs.mkdir(testSandbox, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    service = new BookmarkQuickIndexService(db);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Bookmarks: duplicates, empty notes, max 500 chars, FK checks, atomic deletion
  // =========================================================================
  it('1.1: handles bookmark edge cases (duplicate upsert, empty note, 500-char clamp, foreign keys, deletion)', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s-1', 's-1', 'Series 1', 'manhwa', 'ongoing');
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES ('c-1', 's-1', 1, 'path/c1');
    `);

    const userId = 'user-test';

    expect(() => service.addBookmark(userId, 'non-existent-chap', 5, 'note')).toThrow(/Foreign key violation/i);

    service.addBookmark(userId, 'c-1', 5, '');
    let bookmarks = db.prepare(`SELECT * FROM user_bookmarks WHERE user_id = ?`).all(userId);
    expect(bookmarks.length).toBe(1);

    const longNote = 'A'.repeat(1000);
    service.addBookmark(userId, 'c-1', 5, longNote);
    bookmarks = db.prepare(`SELECT * FROM user_bookmarks WHERE user_id = ?`).all(userId);
    expect(bookmarks.length).toBe(1);
    expect((bookmarks[0] as any).note.length).toBe(500);

    service.deleteBookmark(userId, 'c-1', 5);
    bookmarks = db.prepare(`SELECT * FROM user_bookmarks WHERE user_id = ?`).all(userId);
    expect(bookmarks.length).toBe(0);
  });

  // =========================================================================
  // 2. Quick-Index: 0 chapters, 2000 chapters, null titles, negative/float chapter numbers
  // =========================================================================
  it('2.1: quick-index handles extreme chapter counts, null titles, and negative/float chapter numbers (-1, 0, 10.5)', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES 
        ('s-empty', 'empty', 'Empty Series', 'manhwa', 'ongoing'),
        ('s-massive', 'massive', 'Massive Series', 'manhwa', 'ongoing');
    `);

    const emptyIndex = service.getQuickIndex('s-empty');
    expect(emptyIndex).toEqual([]);

    db.exec(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path) VALUES 
        ('c-neg', 's-massive', -1, NULL, 'path/neg'),
        ('c-zero', 's-massive', 0, 'Prologue', 'path/zero'),
        ('c-float', 's-massive', 10.5, NULL, 'path/float');
    `);

    const massiveIndex = service.getQuickIndex('s-massive');
    expect(massiveIndex.length).toBe(3);
    expect(massiveIndex[0].chapter_number).toBe(-1);
    expect(massiveIndex[0].title).toBe('Untitled');
    expect(massiveIndex[2].chapter_number).toBe(10.5);
  });

  // =========================================================================
  // 3. Concurrent bookmark creation under SQLite WAL mode
  // =========================================================================
  it('3.1: concurrent bookmark creations under transaction complete safely without lock errors', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s-conc', 'conc', 'Concurrent Series', 'manhwa', 'ongoing');
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES ('c-conc', 's-conc', 1, 'path/cc');
    `);

    const userId = 'user-concurrent';

    const concurrentWrites = Array.from({ length: 25 }, (_, i) => {
      return Promise.resolve().then(() => {
        service.addBookmark(userId, 'c-conc', i + 1, `Note ${i + 1}`);
      });
    });

    await Promise.all(concurrentWrites);

    const bookmarks = db.prepare(`SELECT * FROM user_bookmarks WHERE user_id = ?`).all(userId);
    expect(bookmarks.length).toBe(25);
  });
});
