/**
 * KuraScroll Ultra-Low-Latency Local Dialogue OCR & Trigram Substring Search Engine
 * Sprint 60 - In-Manga Quote, Character Dialogue & Speech Bubble Search
 *
 * Designed for Intel Pentium T4500 (V8 heap <= 512MB) and 4TB mechanical SATA II HDD.
 * Uses SQLite FTS5 with 'trigram' tokenizer for mixed CJK & Latin text without external dependencies,
 * featuring hybrid short-query fallback (< 3 chars) and anti-spoiler causal progress filtering.
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export interface DialogueBubbleInput {
  id: string;
  chapterId: string;
  pageNumber: number;
  panelId?: string | null;
  bubbleIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  language?: string;
  confidence?: number;
  bubbleType?: 'SPEECH' | 'THOUGHT' | 'SCREAM' | 'WHISPER' | 'SFX';
}

export interface DialogueSearchOptions {
  query: string;
  seriesId?: string;
  chapterId?: string;
  maxChapterNumber?: number; // Anti-spoiler causal ceiling
  limit?: number;
  offset?: number;
}

export interface DialogueSearchResult {
  bubbleId: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle?: string;
  pageNumber: number;
  text: string;
  snippet?: string;
  boundingBox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  bubbleType: string;
  language: string;
  confidence: number;
  rank?: number;
}

export class DialogueSearchService {
  private stmtInsertBubble: Statement;
  private stmtGetBubbleCount: Statement;
  private stmtOptimizeFts: Statement;
  private stmtCache: Map<string, Statement> = new Map();

  constructor(private readonly db: DatabaseInstance) {
    this.stmtInsertBubble = this.db.prepare(`
      INSERT OR REPLACE INTO chapter_bubble_ocr_index (
        id, chapter_id, page_number, panel_id, bubble_index,
        x, y, w, h, text, language, confidence, bubble_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtGetBubbleCount = this.db.prepare(`
      SELECT COUNT(*) as total FROM chapter_bubble_ocr_index
    `);

    this.stmtOptimizeFts = this.db.prepare(`
      INSERT INTO dialogue_fts(dialogue_fts) VALUES('optimize')
    `);
  }

  private getStatement(sql: string): Statement {
    let stmt = this.stmtCache.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.stmtCache.set(sql, stmt);
    }
    return stmt;
  }

  /**
   * Sanitize raw search string for safe FTS5 evaluation
   */
  public static sanitizeQuery(raw: string): string {
    if (!raw) return '';
    // Strip FTS5 operators and unbalanced quotes that cause SQLite syntax errors
    let clean = raw.replace(/[":*^()[\]{}~+]/g, ' ').trim();
    // Collapse consecutive whitespaces
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  }

  /**
   * Index batch of OCR speech bubble records
   */
  public indexBatch(bubbles: DialogueBubbleInput[]): number {
    if (!bubbles || bubbles.length === 0) return 0;

    let count = 0;
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const b of bubbles) {
        this.stmtInsertBubble.run(
          b.id,
          b.chapterId,
          b.pageNumber,
          b.panelId ?? null,
          b.bubbleIndex ?? 0,
          b.x,
          b.y,
          b.w,
          b.h,
          b.text,
          b.language ?? 'ja',
          b.confidence ?? 1.0,
          b.bubbleType ?? 'SPEECH'
        );
        count++;
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return count;
  }

  /**
   * Execute high-speed dialogue search with CJK trigram matching,
   * short-token fallback, and anti-spoiler chapter constraints.
   */
  public search(options: DialogueSearchOptions): {
    results: DialogueSearchResult[];
    total: number;
    queryTimeMs: number;
  } {
    const t0 = performance.now();
    const rawQuery = options.query?.trim() || '';
    if (!rawQuery) {
      return { results: [], total: 0, queryTimeMs: 0 };
    }

    const sanitized = DialogueSearchService.sanitizeQuery(rawQuery);
    if (!sanitized) {
      return { results: [], total: 0, queryTimeMs: 0 };
    }

    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);

    // Unicode codepoint length check for trigram viability
    const charCount = Array.from(sanitized).length;

    let rows: any[] = [];

    if (charCount >= 3) {
      // Fast path: SQLite FTS5 Trigram Substring Search
      // Wrap in double quotes for exact substring matching
      const ftsQuery = `"${sanitized}"`;

      let sql = `
        SELECT 
          d.bubble_id,
          b.chapter_id,
          c.chapter_number,
          c.title AS chapter_title,
          b.page_number,
          b.text,
          b.text AS match_snippet,
          b.x, b.y, b.w, b.h,
          b.bubble_type,
          b.language,
          b.confidence,
          rank
        FROM dialogue_fts d
        JOIN chapter_bubble_ocr_index b ON b.id = d.bubble_id
        JOIN chapters c ON c.id = b.chapter_id
        WHERE dialogue_fts MATCH ?
      `;

      const params: any[] = [ftsQuery];

      if (options.seriesId) {
        sql += ` AND c.series_id = ?`;
        params.push(options.seriesId);
      }

      if (options.chapterId) {
        sql += ` AND b.chapter_id = ?`;
        params.push(options.chapterId);
      }

      if (options.maxChapterNumber !== undefined) {
        sql += ` AND c.chapter_number <= ?`;
        params.push(options.maxChapterNumber);
      }

      sql += ` ORDER BY rank LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      try {
        rows = this.getStatement(sql).all(...params);
      } catch {
        // Fallback to INSTR if FTS MATCH encounters token issue
        rows = this.fallbackSubstringSearch(sanitized, options, limit, offset);
      }
    } else {
      // Fallback path for short queries (1 or 2 chars, e.g. single Kanji names)
      rows = this.fallbackSubstringSearch(sanitized, options, limit, offset);
    }

    const results: DialogueSearchResult[] = rows.map((r) => ({
      bubbleId: r.bubble_id,
      chapterId: r.chapter_id,
      chapterNumber: r.chapter_number,
      chapterTitle: r.chapter_title || undefined,
      pageNumber: r.page_number,
      text: r.text,
      snippet: r.match_snippet || r.text,
      boundingBox: {
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
      },
      bubbleType: r.bubble_type || 'SPEECH',
      language: r.language || 'ja',
      confidence: r.confidence ?? 1.0,
      rank: r.rank !== undefined ? Number(r.rank) : undefined,
    }));

    const queryTimeMs = Math.round((performance.now() - t0) * 100) / 100;

    return {
      results,
      total: results.length,
      queryTimeMs,
    };
  }

  /**
   * Fallback substring search for 1-2 character queries using INSTR
   */
  private fallbackSubstringSearch(
    sanitized: string,
    options: DialogueSearchOptions,
    limit: number,
    offset: number
  ): any[] {
    let sql = `
      SELECT 
        b.id AS bubble_id,
        b.chapter_id,
        c.chapter_number,
        c.title AS chapter_title,
        b.page_number,
        b.text,
        b.text AS match_snippet,
        b.x, b.y, b.w, b.h,
        b.bubble_type,
        b.language,
        b.confidence
      FROM chapter_bubble_ocr_index b
      JOIN chapters c ON c.id = b.chapter_id
      WHERE INSTR(b.text, ?) > 0
    `;

    const params: any[] = [sanitized];

    if (options.seriesId) {
      sql += ` AND c.series_id = ?`;
      params.push(options.seriesId);
    }

    if (options.chapterId) {
      sql += ` AND b.chapter_id = ?`;
      params.push(options.chapterId);
    }

    if (options.maxChapterNumber !== undefined) {
      sql += ` AND c.chapter_number <= ?`;
      params.push(options.maxChapterNumber);
    }

    sql += ` ORDER BY c.chapter_number ASC, b.page_number ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return this.getStatement(sql).all(...params);
  }

  /**
   * Optimize FTS5 B-tree index
   */
  public optimizeFtsIndex(): void {
    try {
      this.stmtOptimizeFts.run();
    } catch {
      // Ignore if optimize is not supported or locked
    }
  }

  /**
   * Get total indexed speech bubble count
   */
  public getTotalCount(): number {
    const row: any = this.stmtGetBubbleCount.get();
    return row?.total ?? 0;
  }
}
