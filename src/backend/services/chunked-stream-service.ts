/**
 * KuraScroll - Sprint 87: Progressive Image Decompression & Chunked Bitstream Pipeline
 * 
 * Target hardware: Intel Pentium T4500 (2C/2T) & Intel GMA 4500MHD (texture ceiling 2048x2048).
 * Eliminates main-thread jank by slicing tall webtoon strips into sub-tiles decompressed
 * during idle frame budgets (sub-16ms target, 8ms slice budget).
 */

import { DatabaseInstance } from '../db/database.js';

export interface ChunkSlice {
  index: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number;
  byteEstimate: number;
}

export interface ChunkSliceCalculationResult {
  totalWidth: number;
  totalHeight: number;
  maxChunkDim: number;
  rows: number;
  cols: number;
  totalSlices: number;
  slices: ChunkSlice[];
  totalByteEstimate: number;
  isOversized: boolean;
}

export interface ChunkedStreamProfile {
  seriesId: string;
  chunkHeightPx: number;
  bitstreamQuality: number;
  progressivePassCount: number;
  idleSliceBudgetMs: number;
  isEnabled: boolean;
  updatedAt: number;
}

export const CHUNKED_STREAM_PRESETS = {
  webtoon_conservative: {
    id: 'webtoon_conservative',
    label: 'Webtoon Balanced (8ms budget, 1024px)',
    chunkHeightPx: 1024,
    bitstreamQuality: 80,
    progressivePassCount: 2,
    idleSliceBudgetMs: 8.0,
    description: 'Balanced for 60 FPS scrolling and Intel GMA 4500MHD VRAM stability',
  },
  low_vram_aggressive: {
    id: 'low_vram_aggressive',
    label: 'Low VRAM Aggressive (5ms budget, 512px)',
    chunkHeightPx: 512,
    bitstreamQuality: 70,
    progressivePassCount: 1,
    idleSliceBudgetMs: 5.0,
    description: 'Micro-slices for extreme memory-constrained environments and slow buses',
  },
  high_fidelity: {
    id: 'high_fidelity',
    label: 'High Fidelity (12ms budget, 2048px)',
    chunkHeightPx: 2048,
    bitstreamQuality: 90,
    progressivePassCount: 3,
    idleSliceBudgetMs: 12.0,
    description: 'Maximum visual crispness for desktop displays with multi-pass refinement',
  },
} as const;

export class ChunkedStreamService {
  private db: DatabaseInstance;

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  /**
   * Ultra-fast zero/minimal-allocation sub-slice calculation for tall webtoon images.
   * Execution latency strictly < 20 microseconds (SLA 51).
   */
  public calculateImageChunkSlices(
    totalWidth: number,
    totalHeight: number,
    maxChunkDim: number = 1024,
    bytesPerPixel: number = 4
  ): ChunkSliceCalculationResult {
    if (totalWidth <= 0 || totalHeight <= 0) {
      return {
        totalWidth: 0,
        totalHeight: 0,
        maxChunkDim: 1024,
        rows: 0,
        cols: 0,
        totalSlices: 0,
        slices: [],
        totalByteEstimate: 0,
        isOversized: false,
      };
    }

    const clampedChunkDim = Math.max(256, Math.min(2048, Math.floor(maxChunkDim)));
    const cols = Math.ceil(totalWidth / clampedChunkDim);
    const rows = Math.ceil(totalHeight / clampedChunkDim);
    const totalSlices = rows * cols;

    const slices: ChunkSlice[] = new Array(totalSlices);
    let totalBytes = 0;
    let sliceIdx = 0;

    for (let r = 0; r < rows; r++) {
      const y = r * clampedChunkDim;
      const h = Math.min(clampedChunkDim, totalHeight - y);

      for (let c = 0; c < cols; c++) {
        const x = c * clampedChunkDim;
        const w = Math.min(clampedChunkDim, totalWidth - x);
        const byteEstimate = w * h * bytesPerPixel;
        totalBytes += byteEstimate;

        slices[sliceIdx] = {
          index: sliceIdx,
          row: r,
          col: c,
          x,
          y,
          width: w,
          height: h,
          aspectRatio: parseFloat((w / h).toFixed(4)),
          byteEstimate,
        };
        sliceIdx++;
      }
    }

    const isOversized = totalWidth > 2048 || totalHeight > 2048;

    return {
      totalWidth,
      totalHeight,
      maxChunkDim: clampedChunkDim,
      rows,
      cols,
      totalSlices,
      slices,
      totalByteEstimate: totalBytes,
      isOversized,
    };
  }

  /**
   * Retrieves profile for series or returns standard default.
   */
  public getProfile(seriesId: string): ChunkedStreamProfile {
    const row = this.db.prepare(`
      SELECT series_id, chunk_height_px, bitstream_quality, progressive_pass_count, idle_slice_budget_ms, is_enabled, updated_at
      FROM chunked_stream_profiles
      WHERE series_id = ?
    `).get(seriesId) as {
      series_id: string;
      chunk_height_px: number;
      bitstream_quality: number;
      progressive_pass_count: number;
      idle_slice_budget_ms: number;
      is_enabled: number;
      updated_at: number;
    } | undefined;

    if (!row) {
      return {
        seriesId,
        chunkHeightPx: CHUNKED_STREAM_PRESETS.webtoon_conservative.chunkHeightPx,
        bitstreamQuality: CHUNKED_STREAM_PRESETS.webtoon_conservative.bitstreamQuality,
        progressivePassCount: CHUNKED_STREAM_PRESETS.webtoon_conservative.progressivePassCount,
        idleSliceBudgetMs: CHUNKED_STREAM_PRESETS.webtoon_conservative.idleSliceBudgetMs,
        isEnabled: true,
        updatedAt: 0,
      };
    }

    return {
      seriesId: row.series_id,
      chunkHeightPx: row.chunk_height_px,
      bitstreamQuality: row.bitstream_quality,
      progressivePassCount: row.progressive_pass_count,
      idleSliceBudgetMs: row.idle_slice_budget_ms,
      isEnabled: row.is_enabled === 1,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Upserts a chunked stream profile with bounds validation.
   */
  public setProfile(profile: ChunkedStreamProfile): ChunkedStreamProfile {
    const chunkHeightPx = Math.max(256, Math.min(2048, Math.floor(profile.chunkHeightPx)));
    const bitstreamQuality = Math.max(30, Math.min(100, Math.floor(profile.bitstreamQuality)));
    const progressivePassCount = Math.max(1, Math.min(4, Math.floor(profile.progressivePassCount)));
    const idleSliceBudgetMs = Math.max(1.0, Math.min(16.0, parseFloat(profile.idleSliceBudgetMs.toFixed(1))));
    const isEnabled = profile.isEnabled ? 1 : 0;
    const updatedAt = Date.now();

    this.db.prepare(`
      INSERT INTO chunked_stream_profiles (
        series_id, chunk_height_px, bitstream_quality, progressive_pass_count, idle_slice_budget_ms, is_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id) DO UPDATE SET
        chunk_height_px = excluded.chunk_height_px,
        bitstream_quality = excluded.bitstream_quality,
        progressive_pass_count = excluded.progressive_pass_count,
        idle_slice_budget_ms = excluded.idle_slice_budget_ms,
        is_enabled = excluded.is_enabled,
        updated_at = excluded.updated_at
    `).run(
      profile.seriesId,
      chunkHeightPx,
      bitstreamQuality,
      progressivePassCount,
      idleSliceBudgetMs,
      isEnabled,
      updatedAt
    );

    return {
      seriesId: profile.seriesId,
      chunkHeightPx,
      bitstreamQuality,
      progressivePassCount,
      idleSliceBudgetMs,
      isEnabled: isEnabled === 1,
      updatedAt,
    };
  }
}
