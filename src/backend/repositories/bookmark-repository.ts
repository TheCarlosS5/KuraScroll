import type { DatabaseInstance, Statement } from '../db/database.js';

export interface UserBookmark {
  id: number;
  userId: string;
  seriesId: string;
  chapterId: string;
  pageIndex: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookmarkInput {
  userId: string;
  seriesId: string;
  chapterId: string;
  pageIndex: number;
  note?: string | null;
}

export interface ChapterQuickIndexItem {
  chapterId: string;
  chapterNumber: number;
  title: string | null;
  pageCount: number;
  lastPageIndex: number;
  completed: boolean;
  progressUpdatedAt: string | null;
  bookmarkCount: number;
}

export interface SeriesQuickIndexResult {
  seriesId: string;
  totalChapters: number;
  readChapters: number;
  totalBookmarks: number;
  chapters: ChapterQuickIndexItem[];
}

export class BookmarkRepository {
  private stmtInsertOrReplace: Statement;
  private stmtDeleteById: Statement;
  private stmtDeleteByLocation: Statement;
  private stmtGetByLocation: Statement;
  private stmtGetBySeries: Statement;
  private stmtGetByChapter: Statement;
  private stmtQuickIndex: Statement;

  constructor(private db: DatabaseInstance) {
    // Upsert bookmark on (user_id, chapter_id, page_index)
    this.stmtInsertOrReplace = this.db.prepare(`
      INSERT INTO user_bookmarks (user_id, series_id, chapter_id, page_index, note, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, chapter_id, page_index) DO UPDATE SET
        note = excluded.note,
        updated_at = datetime('now')
      RETURNING id, user_id, series_id, chapter_id, page_index, note, created_at, updated_at
    `);

    this.stmtDeleteById = this.db.prepare(`
      DELETE FROM user_bookmarks
      WHERE id = ? AND user_id = ?
    `);

    this.stmtDeleteByLocation = this.db.prepare(`
      DELETE FROM user_bookmarks
      WHERE user_id = ? AND chapter_id = ? AND page_index = ?
    `);

    this.stmtGetByLocation = this.db.prepare(`
      SELECT id, user_id, series_id, chapter_id, page_index, note, created_at, updated_at
      FROM user_bookmarks
      WHERE user_id = ? AND chapter_id = ? AND page_index = ?
    `);

    this.stmtGetBySeries = this.db.prepare(`
      SELECT id, user_id, series_id, chapter_id, page_index, note, created_at, updated_at
      FROM user_bookmarks
      WHERE user_id = ? AND series_id = ?
      ORDER BY created_at DESC, id DESC
    `);

    this.stmtGetByChapter = this.db.prepare(`
      SELECT id, user_id, series_id, chapter_id, page_index, note, created_at, updated_at
      FROM user_bookmarks
      WHERE user_id = ? AND chapter_id = ?
      ORDER BY page_index ASC
    `);

    // Senior ChatGPT Blueprint: single-query join with covering indexes
    this.stmtQuickIndex = this.db.prepare(`
      SELECT
        c.id AS chapterId,
        c.chapter_number AS chapterNumber,
        c.title AS title,
        c.page_count AS pageCount,
        COALESCE(p.page_number, 1) AS lastPageIndex,
        COALESCE(p.is_completed, 0) AS completed,
        p.updated_at AS progressUpdatedAt,
        COALESCE(b.bookmark_count, 0) AS bookmarkCount
      FROM chapters AS c
      LEFT JOIN user_progress AS p
        ON p.chapter_id = c.id
        AND p.user_id = ?
      LEFT JOIN (
        SELECT
          ub.chapter_id,
          COUNT(*) AS bookmark_count
        FROM user_bookmarks ub
        WHERE ub.user_id = ?
          AND ub.series_id = ?
        GROUP BY ub.chapter_id
      ) b ON b.chapter_id = c.id
      WHERE c.series_id = ?
      ORDER BY c.chapter_number ASC
    `);
  }

  public createOrUpdateBookmark(input: CreateBookmarkInput): UserBookmark {
    const note = input.note !== undefined && input.note !== null ? input.note.slice(0, 500) : null;
    const row = this.stmtInsertOrReplace.get(
      input.userId,
      input.seriesId,
      input.chapterId,
      input.pageIndex,
      note
    ) as any;

    return {
      id: row.id,
      userId: row.user_id,
      seriesId: row.series_id,
      chapterId: row.chapter_id,
      pageIndex: row.page_index,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public deleteBookmark(userId: string, bookmarkId: number): boolean {
    const result = this.stmtDeleteById.run(bookmarkId, userId);
    return result.changes > 0;
  }

  public deleteBookmarkByLocation(userId: string, chapterId: string, pageIndex: number): boolean {
    const result = this.stmtDeleteByLocation.run(userId, chapterId, pageIndex);
    return result.changes > 0;
  }

  public getBookmarkByLocation(userId: string, chapterId: string, pageIndex: number): UserBookmark | null {
    const row = this.stmtGetByLocation.get(userId, chapterId, pageIndex) as any;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      seriesId: row.series_id,
      chapterId: row.chapter_id,
      pageIndex: row.page_index,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public getBookmarksForSeries(userId: string, seriesId: string): UserBookmark[] {
    const rows = this.stmtGetBySeries.all(userId, seriesId) as any[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      seriesId: r.series_id,
      chapterId: r.chapter_id,
      pageIndex: r.page_index,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getBookmarksForChapter(userId: string, chapterId: string): UserBookmark[] {
    const rows = this.stmtGetByChapter.all(userId, chapterId) as any[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      seriesId: r.series_id,
      chapterId: r.chapter_id,
      pageIndex: r.page_index,
      note: r.note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getSeriesQuickIndex(userId: string, seriesId: string): SeriesQuickIndexResult {
    const rows = this.stmtQuickIndex.all(userId, userId, seriesId, seriesId) as any[];

    let readChapters = 0;
    let totalBookmarks = 0;

    const chapters: ChapterQuickIndexItem[] = rows.map((r) => {
      const isCompleted = r.completed === 1;
      if (isCompleted) readChapters++;
      totalBookmarks += Number(r.bookmarkCount || 0);

      return {
        chapterId: r.chapterId,
        chapterNumber: Number(r.chapterNumber),
        title: r.title,
        pageCount: Number(r.pageCount || 0),
        lastPageIndex: Number(r.lastPageIndex || 1),
        completed: isCompleted,
        progressUpdatedAt: r.progressUpdatedAt,
        bookmarkCount: Number(r.bookmarkCount || 0),
      };
    });

    return {
      seriesId,
      totalChapters: chapters.length,
      readChapters,
      totalBookmarks,
      chapters,
    };
  }
}
