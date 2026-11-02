/**
 * KuraScroll Sprint 55: High-Precision Panel Detection & Dialogue Bubble OCR Service
 * SQLite WAL backed with In-Memory Page Spatial LRU Caching
 */

import { DatabaseInstance } from '../db/database.js';
import { randomUUID } from 'node:crypto';
import {
  PanelBox,
  DialogueBubble,
  ReadingDirection,
  normalizePanelBounds,
  sortPanelsReadingOrder,
  findEnclosingPanel
} from '../utils/panel-spatial-index.js';

export interface DialogueSearchResult {
  bubbleId: string;
  chapterId: string;
  pageNumber: number;
  text: string;
  language: string;
  rank: number;
}

export class PanelDetectionService {
  private db: DatabaseInstance;
  private panelCache = new Map<string, PanelBox[]>();
  private bubbleCache = new Map<string, DialogueBubble[]>();

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  private cacheKey(chapterId: string, pageNumber: number): string {
    return `${chapterId}:${pageNumber}`;
  }

  /**
   * Saves or replaces panels for a specific page, assigning normalized reading order.
   */
  public savePanels(
    chapterId: string,
    pageNumber: number,
    rawPanels: Array<{ x: number; y: number; w: number; h: number }>,
    direction: ReadingDirection = 'RTL'
  ): PanelBox[] {
    // If no panels detected, generate fallback pseudo-panel
    const panelsToProcess = rawPanels.length > 0
      ? rawPanels
      : [{ x: 0.0, y: 0.0, w: 100.0, h: 100.0 }];

    const normalized = panelsToProcess.map(p => normalizePanelBounds(p));
    const sorted = sortPanelsReadingOrder(normalized, direction);

    const deleteStmt = this.db.prepare(
      'DELETE FROM chapter_page_panels WHERE chapter_id = ? AND page_number = ?'
    );
    const insertStmt = this.db.prepare(`
      INSERT INTO chapter_page_panels (id, chapter_id, page_number, panel_index, x, y, w, h, aspect_ratio, reading_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saved: PanelBox[] = [];

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      deleteStmt.run(chapterId, pageNumber);

      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        const panel: PanelBox = {
          id: randomUUID(),
          chapterId,
          pageNumber,
          panelIndex: i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          aspectRatio: item.aspectRatio,
          readingOrder: i
        };

        insertStmt.run(
          panel.id,
          panel.chapterId,
          panel.pageNumber,
          panel.panelIndex,
          panel.x,
          panel.y,
          panel.w,
          panel.h,
          panel.aspectRatio,
          panel.readingOrder
        );

        saved.push(panel);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    this.panelCache.set(this.cacheKey(chapterId, pageNumber), saved);
    return saved;
  }

  /**
   * Retrieves panels for a page (from LRU cache or SQLite).
   */
  public getPanelsForPage(chapterId: string, pageNumber: number): PanelBox[] {
    const key = this.cacheKey(chapterId, pageNumber);
    if (this.panelCache.has(key)) {
      return this.panelCache.get(key)!;
    }

    const rows = this.db
      .prepare(`
        SELECT id, chapter_id AS chapterId, page_number AS pageNumber,
               panel_index AS panelIndex, x, y, w, h,
               aspect_ratio AS aspectRatio, reading_order AS readingOrder
        FROM chapter_page_panels
        WHERE chapter_id = ? AND page_number = ?
        ORDER BY reading_order ASC
      `)
      .all(chapterId, pageNumber) as unknown as PanelBox[];

    this.panelCache.set(key, rows);
    return rows;
  }

  /**
   * Saves or replaces speech bubbles for a page, linking them to enclosing panels if present.
   */
  public saveBubbles(
    chapterId: string,
    pageNumber: number,
    rawBubbles: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      language?: string;
      confidence?: number;
      bubbleType?: 'SPEECH' | 'THOUGHT' | 'SCREAM' | 'WHISPER' | 'SFX';
    }>
  ): DialogueBubble[] {
    const panels = this.getPanelsForPage(chapterId, pageNumber);

    const deleteStmt = this.db.prepare(
      'DELETE FROM chapter_bubble_ocr_index WHERE chapter_id = ? AND page_number = ?'
    );
    const insertStmt = this.db.prepare(`
      INSERT INTO chapter_bubble_ocr_index (
        id, chapter_id, page_number, panel_id, bubble_index, x, y, w, h, text, language, confidence, bubble_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saved: DialogueBubble[] = [];

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      deleteStmt.run(chapterId, pageNumber);

      for (let i = 0; i < rawBubbles.length; i++) {
        const raw = rawBubbles[i];
        const enclosing = findEnclosingPanel(raw, panels);

        const bubble: DialogueBubble = {
          id: randomUUID(),
          chapterId,
          pageNumber,
          panelId: enclosing ? enclosing.id : null,
          bubbleIndex: i,
          x: Math.max(0.0, Math.min(100.0, raw.x)),
          y: Math.max(0.0, Math.min(100.0, raw.y)),
          w: Math.max(0.1, Math.min(100.0, raw.w)),
          h: Math.max(0.1, Math.min(100.0, raw.h)),
          text: raw.text.trim(),
          language: raw.language || 'ja',
          confidence: raw.confidence !== undefined ? raw.confidence : 1.0,
          bubbleType: raw.bubbleType || 'SPEECH'
        };

        insertStmt.run(
          bubble.id,
          bubble.chapterId,
          bubble.pageNumber,
          bubble.panelId ?? null,
          bubble.bubbleIndex,
          bubble.x,
          bubble.y,
          bubble.w,
          bubble.h,
          bubble.text,
          bubble.language,
          bubble.confidence,
          bubble.bubbleType
        );

        saved.push(bubble);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    this.bubbleCache.set(this.cacheKey(chapterId, pageNumber), saved);
    return saved;
  }

  /**
   * Retrieves bubbles for a page.
   */
  public getBubblesForPage(chapterId: string, pageNumber: number): DialogueBubble[] {
    const key = this.cacheKey(chapterId, pageNumber);
    if (this.bubbleCache.has(key)) {
      return this.bubbleCache.get(key)!;
    }

    const rows = this.db
      .prepare(`
        SELECT id, chapter_id AS chapterId, page_number AS pageNumber,
               panel_id AS panelId, bubble_index AS bubbleIndex,
               x, y, w, h, text, language, confidence, bubble_type AS bubbleType
        FROM chapter_bubble_ocr_index
        WHERE chapter_id = ? AND page_number = ?
        ORDER BY bubble_index ASC
      `)
      .all(chapterId, pageNumber) as unknown as DialogueBubble[];

    this.bubbleCache.set(key, rows);
    return rows;
  }

  /**
   * Full-text dialogue search using SQLite FTS5 table `dialogue_fts`.
   */
  public searchDialogue(query: string, limit: number = 20): DialogueSearchResult[] {
    const sanitized = query.trim().replace(/["'*]/g, '');
    if (!sanitized) return [];

    try {
      const rows = this.db
        .prepare(`
          SELECT bubble_id AS bubbleId, chapter_id AS chapterId,
                 page_number AS pageNumber, text, language, rank
          FROM dialogue_fts
          WHERE dialogue_fts MATCH ?
          ORDER BY rank ASC
          LIMIT ?
        `)
        .all(`"${sanitized}"`, limit) as unknown as DialogueSearchResult[];

      return rows;
    } catch {
      return [];
    }
  }
}
