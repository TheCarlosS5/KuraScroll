/**
 * KuraScroll Reader Page Annotation & Sticky Note Service
 * Sprint 52 - Ephemeral Sticky Note Layer & Interactive Reader Annotation Deck
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export type AnnotationType = 'sticky_note' | 'panel_bookmark' | 'reaction';
export type AnnotationColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple';

export interface PageAnnotation {
  id: number;
  chapterId: string;
  pageNumber: number;
  userId: string;
  anchorX: number;
  anchorY: number;
  annotationType: AnnotationType;
  contentText: string;
  colorPreset: AnnotationColor;
  isSpoiler: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnotationInput {
  chapterId: string;
  pageNumber: number;
  userId: string;
  anchorX: number;
  anchorY: number;
  annotationType?: AnnotationType;
  contentText: string;
  colorPreset?: AnnotationColor;
  isSpoiler?: boolean;
}

export interface UpdateAnnotationInput {
  contentText?: string;
  colorPreset?: AnnotationColor;
  isSpoiler?: boolean;
  anchorX?: number;
  anchorY?: number;
}

export class PageAnnotationService {
  private stmtGetByPage: Statement;
  private stmtGetByChapter: Statement;
  private stmtGetById: Statement;
  private stmtInsert: Statement;
  private stmtDelete: Statement;
  private stmtDeleteByUser: Statement;
  private stmtUpdate: Statement;
  private stmtToggleSpoiler: Statement;

  // High-performance microsecond LRU cache keyed by `chapterId:pageNumber`
  private pageCache: Map<string, PageAnnotation[]> = new Map();
  private readonly maxCacheEntries = 256;

  constructor(private readonly db: DatabaseInstance) {
    this.stmtGetByPage = this.db.prepare(`
      SELECT 
        id,
        chapter_id AS chapterId,
        page_number AS pageNumber,
        user_id AS userId,
        anchor_x AS anchorX,
        anchor_y AS anchorY,
        annotation_type AS annotationType,
        content_text AS contentText,
        color_preset AS colorPreset,
        is_spoiler AS isSpoiler,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM chapter_page_annotations
      WHERE chapter_id = ? AND page_number = ?
      ORDER BY id ASC
    `);

    this.stmtGetByChapter = this.db.prepare(`
      SELECT 
        id,
        chapter_id AS chapterId,
        page_number AS pageNumber,
        user_id AS userId,
        anchor_x AS anchorX,
        anchor_y AS anchorY,
        annotation_type AS annotationType,
        content_text AS contentText,
        color_preset AS colorPreset,
        is_spoiler AS isSpoiler,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM chapter_page_annotations
      WHERE chapter_id = ?
      ORDER BY page_number ASC, id ASC
    `);

    this.stmtGetById = this.db.prepare(`
      SELECT 
        id,
        chapter_id AS chapterId,
        page_number AS pageNumber,
        user_id AS userId,
        anchor_x AS anchorX,
        anchor_y AS anchorY,
        annotation_type AS annotationType,
        content_text AS contentText,
        color_preset AS colorPreset,
        is_spoiler AS isSpoiler,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM chapter_page_annotations
      WHERE id = ?
    `);

    this.stmtInsert = this.db.prepare(`
      INSERT INTO chapter_page_annotations (
        chapter_id,
        page_number,
        user_id,
        anchor_x,
        anchor_y,
        annotation_type,
        content_text,
        color_preset,
        is_spoiler,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    this.stmtDelete = this.db.prepare(`
      DELETE FROM chapter_page_annotations
      WHERE id = ?
    `);

    this.stmtDeleteByUser = this.db.prepare(`
      DELETE FROM chapter_page_annotations
      WHERE id = ? AND user_id = ?
    `);

    this.stmtUpdate = this.db.prepare(`
      UPDATE chapter_page_annotations
      SET 
        content_text = coalesce(?, content_text),
        color_preset = coalesce(?, color_preset),
        is_spoiler = coalesce(?, is_spoiler),
        anchor_x = coalesce(?, anchor_x),
        anchor_y = coalesce(?, anchor_y),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    this.stmtToggleSpoiler = this.db.prepare(`
      UPDATE chapter_page_annotations
      SET 
        is_spoiler = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);
  }

  private normalizeRow(row: any): PageAnnotation {
    return {
      id: Number(row.id),
      chapterId: String(row.chapterId),
      pageNumber: Number(row.pageNumber),
      userId: String(row.userId),
      anchorX: Number(row.anchorX),
      anchorY: Number(row.anchorY),
      annotationType: row.annotationType as AnnotationType,
      contentText: String(row.contentText),
      colorPreset: row.colorPreset as AnnotationColor,
      isSpoiler: Boolean(row.isSpoiler),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }

  public getAnnotationsForPage(chapterId: string, pageNumber: number): PageAnnotation[] {
    const cacheKey = `${chapterId}:${pageNumber}`;
    const cached = this.pageCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const rows = this.stmtGetByPage.all(chapterId, pageNumber) as any[];
    const result = rows.map((r) => this.normalizeRow(r));

    // Cache management
    if (this.pageCache.size >= this.maxCacheEntries) {
      const firstKey = this.pageCache.keys().next().value;
      if (firstKey) this.pageCache.delete(firstKey);
    }
    this.pageCache.set(cacheKey, result);
    return result;
  }

  public getAnnotationsForChapter(chapterId: string): PageAnnotation[] {
    const rows = this.stmtGetByChapter.all(chapterId) as any[];
    return rows.map((r) => this.normalizeRow(r));
  }

  public getAnnotationById(id: number): PageAnnotation | null {
    const row = this.stmtGetById.get(id) as any;
    if (!row) return null;
    return this.normalizeRow(row);
  }

  public createAnnotation(input: CreateAnnotationInput): PageAnnotation {
    if (input.anchorX < 0 || input.anchorX > 100) {
      throw new Error(`Invalid anchorX ${input.anchorX}. Must be between 0.0 and 100.0`);
    }
    if (input.anchorY < 0 || input.anchorY > 100) {
      throw new Error(`Invalid anchorY ${input.anchorY}. Must be between 0.0 and 100.0`);
    }
    if (input.pageNumber < 1) {
      throw new Error(`Invalid pageNumber ${input.pageNumber}. Must be >= 1`);
    }
    if (!input.contentText || input.contentText.trim().length === 0) {
      throw new Error('Content text cannot be empty');
    }

    const annotationType = input.annotationType || 'sticky_note';
    const colorPreset = input.colorPreset || 'yellow';
    const isSpoilerNum = input.isSpoiler ? 1 : 0;

    const result = this.stmtInsert.run(
      input.chapterId,
      input.pageNumber,
      input.userId,
      input.anchorX,
      input.anchorY,
      annotationType,
      input.contentText.trim(),
      colorPreset,
      isSpoilerNum
    );

    const insertedId = Number(result.lastInsertRowid);

    // Invalidate LRU cache for this page
    this.pageCache.delete(`${input.chapterId}:${input.pageNumber}`);

    const created = this.getAnnotationById(insertedId);
    if (!created) {
      throw new Error(`Failed to retrieve newly created annotation with id ${insertedId}`);
    }
    return created;
  }

  public updateAnnotation(id: number, input: UpdateAnnotationInput, userId?: string): PageAnnotation | null {
    const existing = this.getAnnotationById(id);
    if (!existing) return null;
    if (userId && existing.userId !== userId) {
      throw new Error('Permission denied: You cannot update another user\'s annotation');
    }

    const spoilerParam = input.isSpoiler !== undefined ? (input.isSpoiler ? 1 : 0) : null;
    const contentParam = input.contentText !== undefined ? input.contentText.trim() : null;
    const colorParam = input.colorPreset !== undefined ? input.colorPreset : null;
    const anchorXParam = input.anchorX !== undefined ? input.anchorX : null;
    const anchorYParam = input.anchorY !== undefined ? input.anchorY : null;

    this.stmtUpdate.run(contentParam, colorParam, spoilerParam, anchorXParam, anchorYParam, id);

    // Invalidate cache
    this.pageCache.delete(`${existing.chapterId}:${existing.pageNumber}`);

    return this.getAnnotationById(id);
  }

  public toggleSpoiler(id: number, isSpoiler: boolean): PageAnnotation | null {
    const existing = this.getAnnotationById(id);
    if (!existing) return null;

    this.stmtToggleSpoiler.run(isSpoiler ? 1 : 0, id);
    this.pageCache.delete(`${existing.chapterId}:${existing.pageNumber}`);
    return this.getAnnotationById(id);
  }

  public deleteAnnotation(id: number, userId?: string): boolean {
    const existing = this.getAnnotationById(id);
    if (!existing) return false;

    if (userId) {
      if (existing.userId !== userId) {
        throw new Error('Permission denied: You cannot delete another user\'s annotation');
      }
      this.stmtDeleteByUser.run(id, userId);
    } else {
      this.stmtDelete.run(id);
    }

    this.pageCache.delete(`${existing.chapterId}:${existing.pageNumber}`);
    return true;
  }

  public clearCache(): void {
    this.pageCache.clear();
  }
}
