/**
 * KuraScroll Continuous In-Memory Spatial Reading Heatmap & Kinetic Focus Analyzer
 * Sprint 61 - High-Density Dwell Reconstruction & 2D Spatial Kernel Projection Engine
 *
 * Designed for Intel Pentium T4500 (V8 heap <= 512MB) and 4TB mechanical SATA II HDD.
 * Uses zero-allocation Float32Array in-memory accumulation buffers (1KB per page),
 * quantizing to Uint8Array (256 bytes) with write-behind persistence to SQLite BLOB storage.
 */

import { DatabaseInstance, Statement } from '../db/database.js';
import crypto from 'node:crypto';

export const GRID_DIM = 16;
export const TOTAL_CELLS = GRID_DIM * GRID_DIM; // 256
export const DEFAULT_SATURATION_MS = 10000; // 10.0 seconds dwell reaches 255 saturation

export interface SpatialBoundingBox {
  x: number; // 0..100 percentage
  y: number; // 0..100 percentage
  w: number; // 0..100 percentage
  h: number; // 0..100 percentage
}

export interface SpatialPoint {
  x: number; // 0..100 percentage
  y: number; // 0..100 percentage
}

export type FocusElementType = 'BUBBLE' | 'PANEL' | 'GLOBAL' | 'KINETIC_POINT';

export interface SpatialDwellEventInput {
  chapterId: string;
  pageNumber: number;
  userId: string;
  dwellMs: number;
  focusType?: FocusElementType;
  boundingBox?: SpatialBoundingBox;
  point?: SpatialPoint;
}

export interface PageHeatmapResponse {
  chapterId: string;
  pageNumber: number;
  userId?: string;
  gridDim: number;
  totalDwellMs: number;
  peakIntensity: number;
  grid: number[]; // 256 Uint8 values (0..255)
  matrix2D: number[][]; // 16x16 normalized 0.0..1.0 for UI overlays
  updatedAt: string;
}

interface InMemoryPageAccumulator {
  chapterId: string;
  pageNumber: number;
  userId: string;
  floatGrid: Float32Array; // 256 cells
  totalDwellMs: number;
  peakIntensity: number;
  dirty: boolean;
  lastUpdated: number;
}

export class SpatialHeatmapService {
  private db: DatabaseInstance;
  private accumulators: Map<string, InMemoryPageAccumulator> = new Map();
  private stmtCache: Map<string, Statement> = new Map();

  // Scratch buffers for zero-allocation Gaussian kernel projections
  private scratchKernel = new Float32Array(9); // 3x3 local patch

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initStatements();
  }

  private initStatements(): void {
    const upsertSql = `
      INSERT INTO page_spatial_heatmaps (
        id, chapter_id, page_number, user_id, grid_dim,
        total_dwell_ms, peak_intensity, heatmap_blob, updated_at
      ) VALUES (?, ?, ?, ?, 16, ?, ?, ?, datetime('now'))
      ON CONFLICT(chapter_id, page_number, user_id) DO UPDATE SET
        total_dwell_ms = excluded.total_dwell_ms,
        peak_intensity = excluded.peak_intensity,
        heatmap_blob = excluded.heatmap_blob,
        updated_at = datetime('now')
    `;
    this.stmtCache.set('upsert', this.db.prepare(upsertSql));

    const selectSingleSql = `
      SELECT chapter_id, page_number, user_id, total_dwell_ms, peak_intensity, heatmap_blob, updated_at
      FROM page_spatial_heatmaps
      WHERE chapter_id = ? AND page_number = ? AND user_id = ?
      LIMIT 1
    `;
    this.stmtCache.set('selectSingle', this.db.prepare(selectSingleSql));

    const selectAggregateSql = `
      SELECT chapter_id, page_number, user_id, total_dwell_ms, peak_intensity, heatmap_blob, updated_at
      FROM page_spatial_heatmaps
      WHERE chapter_id = ? AND page_number = ?
    `;
    this.stmtCache.set('selectAggregate', this.db.prepare(selectAggregateSql));

    const deleteChapterSql = `
      DELETE FROM page_spatial_heatmaps WHERE chapter_id = ?
    `;
    this.stmtCache.set('deleteChapter', this.db.prepare(deleteChapterSql));
  }

  private getCacheKey(chapterId: string, pageNumber: number, userId: string): string {
    return `${chapterId}:${pageNumber}:${userId}`;
  }

  /**
   * Retrieves or instantiates the in-memory continuous Float32 accumulator for a given page.
   */
  private getOrCreateAccumulator(
    chapterId: string,
    pageNumber: number,
    userId: string
  ): InMemoryPageAccumulator {
    const key = this.getCacheKey(chapterId, pageNumber, userId);
    let acc = this.accumulators.get(key);
    if (!acc) {
      acc = {
        chapterId,
        pageNumber,
        userId,
        floatGrid: new Float32Array(TOTAL_CELLS),
        totalDwellMs: 0,
        peakIntensity: 0,
        dirty: false,
        lastUpdated: Date.now(),
      };

      // Try loading prior state from SQLite
      const stmt = this.stmtCache.get('selectSingle');
      if (stmt) {
        try {
          const row = stmt.get(chapterId, pageNumber, userId) as
            | {
                total_dwell_ms: number;
                peak_intensity: number;
                heatmap_blob: Uint8Array | Buffer;
              }
            | undefined;

          if (row && row.heatmap_blob) {
            acc.totalDwellMs = row.total_dwell_ms;
            acc.peakIntensity = row.peak_intensity;
            const blobBytes = new Uint8Array(row.heatmap_blob);
            for (let i = 0; i < TOTAL_CELLS && i < blobBytes.length; i++) {
              // De-quantize back to milliseconds estimation
              acc.floatGrid[i] = (blobBytes[i] / 255) * DEFAULT_SATURATION_MS;
            }
          }
        } catch {
          // If query fails, start with fresh zeroed grid
        }
      }

      this.accumulators.set(key, acc);
    }
    return acc;
  }

  /**
   * Fast 2D Spatial Kernel / Box projection onto the 16x16 grid.
   * Execution budget < 0.05ms (50µs) for SLA 25.
   */
  public recordDwellEvent(event: SpatialDwellEventInput): void {
    const {
      chapterId,
      pageNumber,
      userId,
      dwellMs,
      focusType = 'BUBBLE',
      boundingBox,
      point,
    } = event;

    if (dwellMs <= 0 || pageNumber < 1) return;

    const acc = this.getOrCreateAccumulator(chapterId, pageNumber, userId);
    acc.totalDwellMs += dwellMs;
    acc.dirty = true;
    acc.lastUpdated = Date.now();

    const multiplier = focusType === 'BUBBLE' ? 2.0 : focusType === 'PANEL' ? 1.0 : 0.8;
    const effectiveDwell = dwellMs * multiplier;

    if (boundingBox) {
      // 2D Bounding Box Projection
      const cX0 = Math.max(0, Math.min(15, Math.floor((boundingBox.x * GRID_DIM) / 100)));
      const cX1 = Math.max(0, Math.min(15, Math.floor(((boundingBox.x + boundingBox.w) * GRID_DIM) / 100)));
      const cY0 = Math.max(0, Math.min(15, Math.floor((boundingBox.y * GRID_DIM) / 100)));
      const cY1 = Math.max(0, Math.min(15, Math.floor(((boundingBox.y + boundingBox.h) * GRID_DIM) / 100)));

      const cellCount = Math.max(1, (cX1 - cX0 + 1) * (cY1 - cY0 + 1));
      const dwellPerCell = effectiveDwell / cellCount;

      for (let cy = cY0; cy <= cY1; cy++) {
        const rowOffset = cy * GRID_DIM;
        for (let cx = cX0; cx <= cX1; cx++) {
          const idx = rowOffset + cx;
          acc.floatGrid[idx] += dwellPerCell;
        }
      }
    } else if (point) {
      // Kinetic 2D Gaussian Kernel Projection (3x3 footprint)
      const cx = Math.max(0, Math.min(15, Math.floor((point.x * GRID_DIM) / 100)));
      const cy = Math.max(0, Math.min(15, Math.floor((point.y * GRID_DIM) / 100)));

      // Kernel distribution: Center 50%, Orthogonal Neighbors 10% each, Diagonals 2.5% each
      const weights = [
        0.025, 0.100, 0.025,
        0.100, 0.500, 0.100,
        0.025, 0.100, 0.025,
      ];

      let kIdx = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny >= 0 && ny < GRID_DIM) {
          const rowOffset = ny * GRID_DIM;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const w = weights[kIdx++];
            if (nx >= 0 && nx < GRID_DIM) {
              acc.floatGrid[rowOffset + nx] += effectiveDwell * w;
            }
          }
        } else {
          kIdx += 3;
        }
      }
    } else {
      // Global uniform dwell
      const dwellPerCell = effectiveDwell / TOTAL_CELLS;
      for (let i = 0; i < TOTAL_CELLS; i++) {
        acc.floatGrid[i] += dwellPerCell;
      }
    }

    // Compute peak intensity
    let maxVal = 0;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (acc.floatGrid[i] > maxVal) maxVal = acc.floatGrid[i];
    }
    acc.peakIntensity = maxVal > 0 ? Math.max(1, Math.min(255, Math.round((maxVal / DEFAULT_SATURATION_MS) * 255))) : 0;
  }

  /**
   * Quantizes an in-memory continuous Float32 grid into an 8-bit Uint8Array (0..255).
   */
  public quantizeGrid(floatGrid: Float32Array, saturationMs = DEFAULT_SATURATION_MS): Uint8Array {
    const uint8 = new Uint8Array(TOTAL_CELLS);
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const ms = floatGrid[i];
      if (ms <= 0) {
        uint8[i] = 0;
        continue;
      }
      let scaled = Math.round((ms / saturationMs) * 255);
      if (scaled === 0 && ms > 0) {
        scaled = 1; // Preserve non-zero dwell trace
      }
      uint8[i] = scaled > 255 ? 255 : scaled;
    }
    return uint8;
  }

  /**
   * Flushes dirty accumulators to SQLite BLOB storage via write-behind batching.
   * Returns the count of persisted heatmaps.
   */
  public flushBuffer(filter?: { chapterId?: string; userId?: string }): number {
    let flushedCount = 0;
    const stmt = this.stmtCache.get('upsert');
    if (!stmt) return 0;

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const acc of this.accumulators.values()) {
        if (!acc.dirty) continue;
        if (filter?.chapterId && acc.chapterId !== filter.chapterId) continue;
        if (filter?.userId && acc.userId !== filter.userId) continue;

        const uint8 = this.quantizeGrid(acc.floatGrid);
        const recordId = `sh_${acc.chapterId}_${acc.pageNumber}_${acc.userId}`;
        const blobBuffer = Buffer.from(uint8.buffer, uint8.byteOffset, TOTAL_CELLS);

        stmt.run(
          recordId,
          acc.chapterId,
          acc.pageNumber,
          acc.userId,
          acc.totalDwellMs,
          acc.peakIntensity,
          blobBuffer
        );

        acc.dirty = false;
        flushedCount++;
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return flushedCount;
  }

  /**
   * Fetches spatial heatmap for a specific page and user, or aggregated community heatmap.
   */
  public getPageHeatmap(
    chapterId: string,
    pageNumber: number,
    userId?: string
  ): PageHeatmapResponse | null {
    if (userId) {
      const key = this.getCacheKey(chapterId, pageNumber, userId);
      const acc = this.accumulators.get(key);
      if (acc) {
        const uint8 = this.quantizeGrid(acc.floatGrid);
        return this.formatResponse(
          chapterId,
          pageNumber,
          userId,
          acc.totalDwellMs,
          acc.peakIntensity,
          uint8,
          new Date(acc.lastUpdated).toISOString()
        );
      }

      // Fallback to SQLite
      const stmt = this.stmtCache.get('selectSingle');
      if (stmt) {
        const row = stmt.get(chapterId, pageNumber, userId) as
          | {
              chapter_id: string;
              page_number: number;
              user_id: string;
              total_dwell_ms: number;
              peak_intensity: number;
              heatmap_blob: Uint8Array | Buffer;
              updated_at: string;
            }
          | undefined;

        if (row && row.heatmap_blob) {
          const uint8 = new Uint8Array(row.heatmap_blob);
          return this.formatResponse(
            chapterId,
            pageNumber,
            userId,
            row.total_dwell_ms,
            row.peak_intensity,
            uint8,
            row.updated_at
          );
        }
      }
      return null;
    }

    // Community aggregate heatmap across all users for this page
    return this.getPageAggregateHeatmap(chapterId, pageNumber);
  }

  /**
   * Aggregates spatial heatmaps across all readers of a page into a unified gaze overlay.
   */
  public getPageAggregateHeatmap(
    chapterId: string,
    pageNumber: number
  ): PageHeatmapResponse | null {
    // Collect from DB
    const stmt = this.stmtCache.get('selectAggregate');
    const rows = (stmt ? stmt.all(chapterId, pageNumber) : []) as Array<{
      total_dwell_ms: number;
      peak_intensity: number;
      heatmap_blob: Uint8Array | Buffer;
      updated_at: string;
    }>;

    // Also include in-memory accumulators that might not be flushed
    const activeAccs: InMemoryPageAccumulator[] = [];
    for (const acc of this.accumulators.values()) {
      if (acc.chapterId === chapterId && acc.pageNumber === pageNumber) {
        activeAccs.push(acc);
      }
    }

    if (rows.length === 0 && activeAccs.length === 0) {
      return null;
    }

    const mergedFloat = new Float32Array(TOTAL_CELLS);
    let aggregateDwellMs = 0;

    // Merge DB rows
    for (const r of rows) {
      aggregateDwellMs += r.total_dwell_ms;
      const b = new Uint8Array(r.heatmap_blob);
      for (let i = 0; i < TOTAL_CELLS && i < b.length; i++) {
        mergedFloat[i] += b[i];
      }
    }

    // If active accumulators exist, incorporate them (preferring live state)
    for (const acc of activeAccs) {
      const alreadyInDb = rows.some((r) => (r as any).user_id === acc.userId);
      if (!alreadyInDb) {
        aggregateDwellMs += acc.totalDwellMs;
        for (let i = 0; i < TOTAL_CELLS; i++) {
          mergedFloat[i] += (acc.floatGrid[i] / DEFAULT_SATURATION_MS) * 255;
        }
      }
    }

    // Normalize aggregate
    let maxAgg = 0;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (mergedFloat[i] > maxAgg) maxAgg = mergedFloat[i];
    }

    const uint8 = new Uint8Array(TOTAL_CELLS);
    if (maxAgg > 0) {
      for (let i = 0; i < TOTAL_CELLS; i++) {
        uint8[i] = Math.min(255, Math.round((mergedFloat[i] / maxAgg) * 255));
      }
    }

    let peak = 0;
    for (let i = 0; i < TOTAL_CELLS; i++) {
      if (uint8[i] > peak) peak = uint8[i];
    }

    return this.formatResponse(
      chapterId,
      pageNumber,
      'community_aggregate',
      aggregateDwellMs,
      peak,
      uint8,
      new Date().toISOString()
    );
  }

  private formatResponse(
    chapterId: string,
    pageNumber: number,
    userId: string | undefined,
    totalDwellMs: number,
    peakIntensity: number,
    uint8Grid: Uint8Array,
    updatedAt: string
  ): PageHeatmapResponse {
    const gridArray = Array.from(uint8Grid);
    const matrix2D: number[][] = [];
    for (let r = 0; r < GRID_DIM; r++) {
      const row: number[] = [];
      const offset = r * GRID_DIM;
      for (let c = 0; c < GRID_DIM; c++) {
        row.push(uint8Grid[offset + c] / 255);
      }
      matrix2D.push(row);
    }

    return {
      chapterId,
      pageNumber,
      userId,
      gridDim: GRID_DIM,
      totalDwellMs,
      peakIntensity,
      grid: gridArray,
      matrix2D,
      updatedAt,
    };
  }

  /**
   * Diagnostic statistics for memory and cache pressure auditing.
   */
  public getStats(): {
    activeAccumulators: number;
    dirtyCount: number;
    estimatedMemoryBytes: number;
  } {
    let dirtyCount = 0;
    for (const acc of this.accumulators.values()) {
      if (acc.dirty) dirtyCount++;
    }
    // Each accumulator: Float32Array(256) is 1024 bytes + ~200 bytes object overhead = ~1.2KB
    return {
      activeAccumulators: this.accumulators.size,
      dirtyCount,
      estimatedMemoryBytes: this.accumulators.size * 1224,
    };
  }

  /**
   * Clears in-memory accumulators (e.g. for testing or memory pressure release).
   */
  public clearMemoryCache(): void {
    this.accumulators.clear();
  }
}
