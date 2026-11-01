import { DatabaseInstance } from '../db/database.js';
import { PageMetadata } from '../services/image-processor.js';

export interface InsertChapterInput {
  id: string;
  seriesId: string;
  volumeId?: string | null;
  chapterNumber: number;
  title?: string | null;
  scanlationGroup?: string | null;
  pageCount?: number;
  storagePath: string;
}

export interface ChapterPageRecord {
  id: number;
  pageNumber: number;
  fileName: string;
  width: number;
  height: number;
  aspectRatio: number;
  blurhash: string | null;
}

export interface ChapterDetail {
  chapter: {
    id: string;
    seriesId: string;
    volumeId: string | null;
    chapterNumber: number;
    title: string | null;
    scanlationGroup: string | null;
    pageCount: number;
    storagePath: string;
    createdAt: string;
  };
  pages: ChapterPageRecord[];
  prevChapterId: string | null;
  nextChapterId: string | null;
}

export class ChapterRepository {
  constructor(private db: DatabaseInstance) {}

  createChapter(input: InsertChapterInput): void {
    const stmt = this.db.prepare(`
      INSERT INTO chapters (id, series_id, volume_id, chapter_number, title, scanlation_group, page_count, storage_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      input.id,
      input.seriesId,
      input.volumeId ?? null,
      input.chapterNumber,
      input.title ?? null,
      input.scanlationGroup ?? null,
      input.pageCount ?? 0,
      input.storagePath
    );
  }

  addPages(chapterId: string, pages: PageMetadata[]): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO chapter_pages (chapter_id, page_number, file_name, width, height, aspect_ratio, blurhash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of pages) {
      insertStmt.run(
        chapterId,
        p.pageNumber,
        p.fileName,
        p.width,
        p.height,
        p.aspectRatio,
        null
      );
    }

    // Update chapter page_count
    this.db.prepare('UPDATE chapters SET page_count = ? WHERE id = ?').run(pages.length, chapterId);
  }

  getChapterWithPages(chapterId: string): ChapterDetail | null {
    const chapStmt = this.db.prepare('SELECT * FROM chapters WHERE id = ?');
    const chapRow = chapStmt.get(chapterId) as any;
    if (!chapRow) {
      return null;
    }

    const pagesStmt = this.db.prepare(`
      SELECT id, page_number, file_name, width, height, aspect_ratio, blurhash
      FROM chapter_pages
      WHERE chapter_id = ?
      ORDER BY page_number ASC
    `);
    const pageRows = pagesStmt.all(chapterId) as any[];

    // Fetch previous chapter
    const prevStmt = this.db.prepare(`
      SELECT id FROM chapters
      WHERE series_id = ? AND chapter_number < ?
      ORDER BY chapter_number DESC
      LIMIT 1
    `);
    const prevRow = prevStmt.get(chapRow.series_id, chapRow.chapter_number) as any;

    // Fetch next chapter
    const nextStmt = this.db.prepare(`
      SELECT id FROM chapters
      WHERE series_id = ? AND chapter_number > ?
      ORDER BY chapter_number ASC
      LIMIT 1
    `);
    const nextRow = nextStmt.get(chapRow.series_id, chapRow.chapter_number) as any;

    return {
      chapter: {
        id: chapRow.id,
        seriesId: chapRow.series_id,
        volumeId: chapRow.volume_id,
        chapterNumber: chapRow.chapter_number,
        title: chapRow.title,
        scanlationGroup: chapRow.scanlation_group,
        pageCount: chapRow.page_count,
        storagePath: chapRow.storage_path,
        createdAt: chapRow.created_at,
      },
      pages: pageRows.map((p) => ({
        id: p.id,
        pageNumber: p.page_number,
        fileName: p.file_name,
        width: p.width,
        height: p.height,
        aspectRatio: p.aspect_ratio,
        blurhash: p.blurhash,
      })),
      prevChapterId: prevRow ? prevRow.id : null,
      nextChapterId: nextRow ? nextRow.id : null,
    };
  }
}
