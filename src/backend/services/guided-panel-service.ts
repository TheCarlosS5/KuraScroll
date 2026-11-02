/**
 * KuraScroll Smart Guided Panel Pacer & Cinematic Auto-Framing Engine
 * Sprint 68 - Topological Boustrophedon Pacing for Manga RTL, Webtoons & Comics
 *
 * Hardware-tuned for Intel Pentium T4500 (2C/2T 2.3GHz) & Intel GMA 4500MHD.
 * Features zero layout recalculations, zero CSS blur, 0 CLS, and sub-20µs framing math.
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export type ReadingMode = 'manga' | 'webtoon' | 'comic';

export interface GuidedPanelBox {
  id?: number;
  chapterId: string;
  pageNumber: number;
  panelIndex: number;
  normX: number; // 0.0 - 1.0 (clamped)
  normY: number; // 0.0 - 1.0 (clamped)
  normW: number; // 0.0 - 1.0 (clamped)
  normH: number; // 0.0 - 1.0 (clamped)
  aspectRatio: number;
  readingOrderScore: number;
  isSplash: boolean;
  createdAt?: number;
}

export interface PanelFramingOptions {
  viewportW?: number;
  viewportH?: number;
  padding?: number; // fractional margin, default 0.04
  minScale?: number; // default 1.0
  maxScale?: number; // default 3.5
}

export interface PanelFramingTarget {
  panelIndex: number;
  panXPercent: number; // CSS translate3d X percentage
  panYPercent: number; // CSS translate3d Y percentage
  scale: number;
  clamped: boolean;
  isSplash: boolean;
  viewportW: number;
  viewportH: number;
  aspectRatio: number;
  normCenter: { x: number; y: number };
}

export class GuidedPanelService {
  private db: DatabaseInstance;
  private stmtCache = new Map<string, Statement>();
  private memoryCache = new Map<string, GuidedPanelBox[]>();

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initStatements();
  }

  private initStatements(): void {
    const selectByPageSql = `
      SELECT id, chapter_id, page_number, panel_index, norm_x, norm_y, norm_w, norm_h,
             aspect_ratio, reading_order_score, is_splash, created_at
      FROM page_panel_sequences
      WHERE chapter_id = ? AND page_number = ?
      ORDER BY panel_index ASC
    `;
    this.stmtCache.set('selectByPage', this.db.prepare(selectByPageSql));

    const insertPanelSql = `
      INSERT INTO page_panel_sequences (
        chapter_id, page_number, panel_index, norm_x, norm_y, norm_w, norm_h,
        aspect_ratio, reading_order_score, is_splash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    this.stmtCache.set('insertPanel', this.db.prepare(insertPanelSql));

    const deleteByPageSql = `
      DELETE FROM page_panel_sequences
      WHERE chapter_id = ? AND page_number = ?
    `;
    this.stmtCache.set('deleteByPage', this.db.prepare(deleteByPageSql));
  }

  private getCacheKey(chapterId: string, pageNumber: number): string {
    return `${chapterId}:${pageNumber}`;
  }

  /**
   * Clamps normalized coordinates to valid [0.0, 1.0] intervals.
   */
  public static clamp(val: number, min = 0.0, max = 1.0): number {
    if (Number.isNaN(val) || !Number.isFinite(val)) return min;
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Sorts panels topologically using the Boustrophedon Tier-Clustering Algorithm.
   * - Manga (RTL): Group tiers top-to-bottom, sort within tier Right-to-Left.
   * - Comic (LTR): Group tiers top-to-bottom, sort within tier Left-to-Right.
   * - Webtoon: Monotonic Top-to-Bottom cascade.
   *
   * SLA 32 Target: < 20 µs per page.
   */
  public boustrophedonSort(
    panels: Omit<GuidedPanelBox, 'panelIndex' | 'readingOrderScore'>[],
    readingMode: ReadingMode = 'manga',
    rowEpsilon = 0.05
  ): GuidedPanelBox[] {
    if (!panels || panels.length === 0) {
      return [];
    }

    const sanitized: GuidedPanelBox[] = panels.map((p) => {
      const x = GuidedPanelService.clamp(p.normX);
      const y = GuidedPanelService.clamp(p.normY);
      const w = GuidedPanelService.clamp(p.normW, 0.01, 1.0 - x);
      const h = GuidedPanelService.clamp(p.normH, 0.01, 1.0 - y);
      const aspectRatio = Math.round((w / h) * 1000) / 1000;
      const isSplash = (w >= 0.88 && h >= 0.82) || (w * h >= 0.72);

      return {
        id: p.id,
        chapterId: p.chapterId,
        pageNumber: p.pageNumber,
        panelIndex: 0,
        normX: Math.round(x * 10000) / 10000,
        normY: Math.round(y * 10000) / 10000,
        normW: Math.round(w * 10000) / 10000,
        normH: Math.round(h * 10000) / 10000,
        aspectRatio,
        readingOrderScore: 0,
        isSplash,
        createdAt: p.createdAt,
      };
    });

    if (sanitized.length === 1) {
      sanitized[0].panelIndex = 0;
      sanitized[0].readingOrderScore = 0;
      return sanitized;
    }

    // Webtoon: Waterfall top-to-bottom
    if (readingMode === 'webtoon') {
      sanitized.sort((a, b) => a.normY - b.normY);
      for (let i = 0; i < sanitized.length; i++) {
        sanitized[i].panelIndex = i;
        sanitized[i].readingOrderScore = i;
      }
      return sanitized;
    }

    // Manga and Comic: Tier-based row clustering
    const sortedByY = [...sanitized].sort((a, b) => a.normY - b.normY);
    const rows: GuidedPanelBox[][] = [];

    for (let i = 0; i < sortedByY.length; i++) {
      const panel = sortedByY[i];
      let placed = false;

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        let rowMinY = row[0].normY;
        let rowMaxBottom = row[0].normY + row[0].normH;
        for (let k = 1; k < row.length; k++) {
          if (row[k].normY < rowMinY) rowMinY = row[k].normY;
          const btm = row[k].normY + row[k].normH;
          if (btm > rowMaxBottom) rowMaxBottom = btm;
        }

        const panelBottom = panel.normY + panel.normH;
        const overlapTop = Math.max(rowMinY, panel.normY);
        const overlapBottom = Math.min(rowMaxBottom, panelBottom);
        const overlapHeight = Math.max(0, overlapBottom - overlapTop);
        const minHeight = Math.min(rowMaxBottom - rowMinY, panel.normH);
        const overlapRatio = minHeight > 0 ? overlapHeight / minHeight : 0;
        const topDiff = Math.abs(panel.normY - rowMinY);

        if (topDiff <= rowEpsilon || overlapRatio >= 0.40) {
          row.push(panel);
          placed = true;
          break;
        }
      }

      if (!placed) {
        rows.push([panel]);
      }
    }

    // Sort tiers vertically
    rows.sort((rowA, rowB) => {
      const minYA = Math.min(...rowA.map((p) => p.normY));
      const minYB = Math.min(...rowB.map((p) => p.normY));
      return minYA - minYB;
    });

    // Sort within each tier according to reading direction
    const result: GuidedPanelBox[] = [];
    let currentIndex = 0;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (readingMode === 'manga') {
        // Manga RTL: Right to Left (descending horizontal center)
        row.sort((a, b) => {
          const cxA = a.normX + a.normW / 2;
          const cxB = b.normX + b.normW / 2;
          return cxB - cxA;
        });
      } else {
        // Comic LTR: Left to Right (ascending horizontal center)
        row.sort((a, b) => {
          const cxA = a.normX + a.normW / 2;
          const cxB = b.normX + b.normW / 2;
          return cxA - cxB;
        });
      }

      for (let k = 0; k < row.length; k++) {
        row[k].panelIndex = currentIndex;
        row[k].readingOrderScore = currentIndex;
        result.push(row[k]);
        currentIndex++;
      }
    }

    return result;
  }

  /**
   * Computes the CSS translate3d and scale transform for smooth cinematic framing.
   * Completely zero layout-thrashing: output is consumed directly by transform style.
   */
  public calculatePanelFraming(
    panel: GuidedPanelBox,
    options: PanelFramingOptions = {}
  ): PanelFramingTarget {
    const viewportW = options.viewportW ?? 1920;
    const viewportH = options.viewportH ?? 1080;
    const padding = options.padding ?? 0.04;
    const minScale = options.minScale ?? 1.0;
    const maxScale = options.maxScale ?? 3.5;

    const normW = Math.max(0.01, panel.normW);
    const normH = Math.max(0.01, panel.normH);

    // If it's a full-page splash, show full unzoomed page
    if (panel.isSplash) {
      return {
        panelIndex: panel.panelIndex,
        panXPercent: 0,
        panYPercent: 0,
        scale: 1.0,
        clamped: false,
        isSplash: true,
        viewportW,
        viewportH,
        aspectRatio: panel.aspectRatio,
        normCenter: {
          x: panel.normX + normW / 2,
          y: panel.normY + normH / 2,
        },
      };
    }

    const availableFraction = Math.max(0.1, 1.0 - 2 * padding);
    const scaleX = availableFraction / normW;
    const scaleY = availableFraction / normH;
    const rawScale = Math.min(scaleX, scaleY);

    let scale = rawScale;
    let clamped = false;

    if (scale < minScale) {
      scale = minScale;
      clamped = true;
    } else if (scale > maxScale) {
      scale = maxScale;
      clamped = true;
    }

    // Panel center in normalized [0, 1] page space
    const cx = panel.normX + normW / 2;
    const cy = panel.normY + normH / 2;

    // Offset relative to page center (0.5, 0.5)
    // Positive pan shifts the container
    const panXPercent = Math.round((0.5 - cx) * scale * 10000) / 100;
    const panYPercent = Math.round((0.5 - cy) * scale * 10000) / 100;

    return {
      panelIndex: panel.panelIndex,
      panXPercent,
      panYPercent,
      scale: Math.round(scale * 1000) / 1000,
      clamped,
      isSplash: false,
      viewportW,
      viewportH,
      aspectRatio: panel.aspectRatio,
      normCenter: { x: cx, y: cy },
    };
  }

  /**
   * Persists ordered panel sequences into SQLite and updates the in-memory cache.
   */
  public savePanelSequence(
    chapterId: string,
    pageNumber: number,
    rawPanels: Omit<GuidedPanelBox, 'panelIndex' | 'readingOrderScore'>[],
    readingMode: ReadingMode = 'manga'
  ): GuidedPanelBox[] {
    const ordered = this.boustrophedonSort(rawPanels, readingMode);
    const now = Date.now();

    const deleteStmt = this.stmtCache.get('deleteByPage')!;
    deleteStmt.run(chapterId, pageNumber);

    const insertStmt = this.stmtCache.get('insertPanel')!;
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      insertStmt.run(
        chapterId,
        pageNumber,
        p.panelIndex,
        p.normX,
        p.normY,
        p.normW,
        p.normH,
        p.aspectRatio,
        p.readingOrderScore,
        p.isSplash ? 1 : 0,
        now
      );
      p.createdAt = now;
    }

    this.memoryCache.set(this.getCacheKey(chapterId, pageNumber), ordered);
    return ordered;
  }

  /**
   * Retrieves panel sequence for a page, checking memory cache first.
   */
  public getPanelSequence(chapterId: string, pageNumber: number): GuidedPanelBox[] {
    const key = this.getCacheKey(chapterId, pageNumber);
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)!;
    }

    const selectStmt = this.stmtCache.get('selectByPage')!;
    const rows = selectStmt.all(chapterId, pageNumber) as Array<{
      id: number;
      chapter_id: string;
      page_number: number;
      panel_index: number;
      norm_x: number;
      norm_y: number;
      norm_w: number;
      norm_h: number;
      aspect_ratio: number;
      reading_order_score: number;
      is_splash: number;
      created_at: number;
    }>;

    const panels: GuidedPanelBox[] = rows.map((r) => ({
      id: r.id,
      chapterId: r.chapter_id,
      pageNumber: r.page_number,
      panelIndex: r.panel_index,
      normX: r.norm_x,
      normY: r.norm_y,
      normW: r.norm_w,
      normH: r.norm_h,
      aspectRatio: r.aspect_ratio,
      readingOrderScore: r.reading_order_score,
      isSplash: r.is_splash === 1,
      createdAt: r.created_at,
    }));

    this.memoryCache.set(key, panels);
    return panels;
  }

  /**
   * Clears memory cache (e.g. during test teardown).
   */
  public clearCache(): void {
    this.memoryCache.clear();
  }
}
