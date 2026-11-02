/**
 * KuraScroll Two-Page Spread Splitter & Layout Manifest Service
 * Sprint 51 - High-Performance Virtual Geometry Splitting
 */

import { DatabaseInstance, Statement } from '../db/database.js';
import {
  detectSpreadLayout,
  LayoutDecision,
  ReadingDirection,
  SpreadDetectionResult,
  VirtualSlice,
} from '../utils/spread-detector.js';

export interface SpreadManifest {
  id?: number;
  chapterId: string;
  sourcePageNumber: number;
  sourceWidth: number;
  sourceHeight: number;
  aspectRatio: number;
  layoutDecision: LayoutDecision;
  splitOrder: 'rtl' | 'ltr' | 'none';
  splitPositionPct: number;
  segments: VirtualSlice[];
  createdAt?: string;
}

export interface VirtualPageEntry {
  virtualKey: string; // e.g. "42-a", "42-b", "43"
  sourcePageNumber: number;
  side: 'left' | 'right' | 'full';
  label: string;
  virtualAspectRatio: number;
  crop: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  assetUrl?: string;
}

export class SpreadSplitterService {
  private stmtGetOne: Statement;
  private stmtGetChapter: Statement;
  private stmtUpsert: Statement;
  private stmtDeleteChapter: Statement;

  constructor(private readonly db: DatabaseInstance) {
    this.stmtGetOne = this.db.prepare(`
      SELECT 
        id,
        chapter_id AS chapterId,
        source_page_number AS sourcePageNumber,
        source_width AS sourceWidth,
        source_height AS sourceHeight,
        aspect_ratio AS aspectRatio,
        layout_decision AS layoutDecision,
        split_order AS splitOrder,
        split_position_pct AS splitPositionPct,
        segments_json AS segmentsJson,
        created_at AS createdAt
      FROM chapter_spread_manifests
      WHERE chapter_id = ? AND source_page_number = ?
    `);

    this.stmtGetChapter = this.db.prepare(`
      SELECT 
        id,
        chapter_id AS chapterId,
        source_page_number AS sourcePageNumber,
        source_width AS sourceWidth,
        source_height AS sourceHeight,
        aspect_ratio AS aspectRatio,
        layout_decision AS layoutDecision,
        split_order AS splitOrder,
        split_position_pct AS splitPositionPct,
        segments_json AS segmentsJson,
        created_at AS createdAt
      FROM chapter_spread_manifests
      WHERE chapter_id = ?
      ORDER BY source_page_number ASC
    `);

    this.stmtUpsert = this.db.prepare(`
      INSERT INTO chapter_spread_manifests (
        chapter_id, source_page_number, source_width, source_height,
        aspect_ratio, layout_decision, split_order, split_position_pct,
        segments_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(chapter_id, source_page_number) DO UPDATE SET
        source_width = excluded.source_width,
        source_height = excluded.source_height,
        aspect_ratio = excluded.aspect_ratio,
        layout_decision = excluded.layout_decision,
        split_order = excluded.split_order,
        split_position_pct = excluded.split_position_pct,
        segments_json = excluded.segments_json,
        created_at = datetime('now')
    `);

    this.stmtDeleteChapter = this.db.prepare(`
      DELETE FROM chapter_spread_manifests WHERE chapter_id = ?
    `);
  }

  /**
   * Retrieves spread manifest for a specific page.
   */
  public getSpreadManifest(chapterId: string, pageNumber: number): SpreadManifest | null {
    if (!chapterId || pageNumber < 1) return null;

    const row = this.stmtGetOne.get(chapterId, pageNumber) as any;
    if (!row) return null;

    return this.mapRowToManifest(row);
  }

  /**
   * Retrieves all spread manifests for a chapter.
   */
  public getChapterSpreadManifests(chapterId: string): SpreadManifest[] {
    if (!chapterId) return [];

    const rows = this.stmtGetChapter.all(chapterId) as any[];
    return rows.map((r) => this.mapRowToManifest(r));
  }

  /**
   * Upserts a spread manifest for a given page dimensions.
   */
  public upsertSpreadManifest(params: {
    chapterId: string;
    pageNumber: number;
    width: number;
    height: number;
    readingDirection?: ReadingDirection;
    isCover?: boolean;
    explicitOverride?: 'automatic' | 'force_single' | 'force_split';
    splitPositionPct?: number;
  }): SpreadManifest {
    const {
      chapterId,
      pageNumber,
      width,
      height,
      readingDirection = 'rtl',
      isCover = false,
      explicitOverride = 'automatic',
      splitPositionPct = 50.0,
    } = params;

    if (!chapterId) {
      throw new Error('chapterId is required');
    }

    const detection = detectSpreadLayout({
      width,
      height,
      sourcePageNumber: pageNumber,
      readingDirection,
      isCover,
      explicitOverride,
      splitPositionPct,
    });

    const splitOrder = detection.decision === 'split_spread' ? readingDirection : 'none';
    const segmentsJson = JSON.stringify(detection.segments);

    this.stmtUpsert.run(
      chapterId,
      pageNumber,
      width,
      height,
      detection.aspectRatio,
      detection.decision,
      splitOrder,
      detection.splitPositionPct,
      segmentsJson
    );

    return {
      chapterId,
      sourcePageNumber: pageNumber,
      sourceWidth: width,
      sourceHeight: height,
      aspectRatio: detection.aspectRatio,
      layoutDecision: detection.decision,
      splitOrder,
      splitPositionPct: detection.splitPositionPct,
      segments: detection.segments,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Batch evaluates and upserts manifests for all pages in a chapter inside a transaction.
   */
  public batchDetectChapter(
    chapterId: string,
    pages: Array<{ pageNumber: number; width: number; height: number; isCover?: boolean }>,
    readingDirection: ReadingDirection = 'rtl'
  ): SpreadManifest[] {
    if (!chapterId || !pages || pages.length === 0) return [];

    const results: SpreadManifest[] = [];
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const p of pages) {
        const manifest = this.upsertSpreadManifest({
          chapterId,
          pageNumber: p.pageNumber,
          width: p.width,
          height: p.height,
          readingDirection,
          isCover: p.isCover ?? p.pageNumber === 1,
        });
        results.push(manifest);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return results;
  }

  /**
   * Expands physical chapter pages into a virtual page sequence.
   * If a page is a two-page spread, it splits into two virtual entries (e.g. 42-a, 42-b).
   */
  public buildVirtualPageList(
    chapterId: string,
    physicalPages: Array<{ pageNumber: number; width?: number; height?: number; url?: string }>,
    readingDirection: ReadingDirection = 'rtl'
  ): VirtualPageEntry[] {
    const manifests = this.getChapterSpreadManifests(chapterId);
    const manifestMap = new Map<number, SpreadManifest>();
    for (const m of manifests) {
      manifestMap.set(m.sourcePageNumber, m);
    }

    const virtualPages: VirtualPageEntry[] = [];

    for (const p of physicalPages) {
      const manifest = manifestMap.get(p.pageNumber);

      if (manifest && manifest.layoutDecision === 'split_spread') {
        for (const seg of manifest.segments) {
          virtualPages.push({
            virtualKey: seg.key,
            sourcePageNumber: p.pageNumber,
            side: seg.side,
            label: seg.label,
            virtualAspectRatio: seg.virtualAspectRatio,
            crop: seg.crop,
            assetUrl: p.url,
          });
        }
      } else {
        // Single page fallback
        const w = p.width ?? (manifest ? manifest.sourceWidth : 1000);
        const h = p.height ?? (manifest ? manifest.sourceHeight : 1440);
        const ar = Math.round((w / h) * 10000) / 10000;

        virtualPages.push({
          virtualKey: `${p.pageNumber}`,
          sourcePageNumber: p.pageNumber,
          side: 'full',
          label: `Pág ${p.pageNumber}`,
          virtualAspectRatio: ar,
          crop: { x: 0.0, y: 0.0, w: 1.0, h: 1.0 },
          assetUrl: p.url,
        });
      }
    }

    return virtualPages;
  }

  private mapRowToManifest(row: any): SpreadManifest {
    let segments: VirtualSlice[] = [];
    try {
      segments = JSON.parse(row.segmentsJson || '[]');
    } catch {
      segments = [];
    }

    return {
      id: Number(row.id),
      chapterId: String(row.chapterId),
      sourcePageNumber: Number(row.sourcePageNumber),
      sourceWidth: Number(row.sourceWidth),
      sourceHeight: Number(row.sourceHeight),
      aspectRatio: Number(row.aspectRatio),
      layoutDecision: row.layoutDecision,
      splitOrder: row.splitOrder,
      splitPositionPct: Number(row.splitPositionPct),
      segments,
      createdAt: String(row.createdAt),
    };
  }
}
