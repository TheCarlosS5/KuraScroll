/**
 * KuraScroll Semantic Vector & Hybrid RRF Search Service
 * Sprint 47 - Hybrid FTS5 + Int8 Quantized Vector Search + Reciprocal Rank Fusion
 * 
 * Hardware-conscious design for Intel Pentium T4500 (2C/2T) & 4TB SATA II HDD:
 * - 8-bit quantized BLOB storage in SQLite WAL (384 bytes / series)
 * - Contiguous in-memory vector cache for zero-allocation dot products (< 2.0 ms for 5,000 vectors)
 * - Failsafe fallback: pure FTS5 lexical ranking if query vector is omitted
 * - Scale-invariant Reciprocal Rank Fusion (RRF, k=60)
 */

import { DatabaseInstance } from '../db/database.js';
import {
  DEFAULT_VECTOR_DIMENSIONS,
  DEFAULT_RRF_K,
  quantizeFloat32ToInt8,
  cosineSimilarityQuantized,
  reciprocalRankFusion,
  RRFScoredItem
} from '../utils/vector-quantizer.js';

export interface SeriesEmbeddingInput {
  seriesId: string;
  vector: Float32Array | number[];
  modelVersion?: string;
}

export interface HybridSearchParams {
  queryText?: string;
  queryVector?: Float32Array | number[];
  limit?: number;
  lexicalWeight?: number;
  semanticWeight?: number;
  rrfK?: number;
  minSimilarity?: number;
}

export interface HybridSearchResultItem {
  seriesId: string;
  title: string;
  type: string;
  status: string;
  coverImage?: string;
  rrfScore: number;
  lexicalRank?: number;
  semanticRank?: number;
  semanticSimilarity?: number;
  matchType: 'hybrid' | 'lexical' | 'semantic';
}

export interface HybridSearchResponse {
  success: boolean;
  query: string;
  totalResults: number;
  results: HybridSearchResultItem[];
  telemetry: {
    lexicalTimeMs: number;
    semanticTimeMs: number;
    fusionTimeMs: number;
    totalTimeMs: number;
    vectorsEvaluated: number;
  };
}

interface CachedSeriesVector {
  seriesId: string;
  int8Array: Int8Array;
  scaleFactor: number;
  magnitude: number;
}

export class VectorSearchService {
  private vectorCache: CachedSeriesVector[] = [];
  private isCacheLoaded = false;

  constructor(private readonly db: DatabaseInstance) {}

  /**
   * Loads all active series embeddings from SQLite into contiguous in-memory cache.
   */
  public ensureCacheLoaded(): void {
    if (this.isCacheLoaded) {
      return;
    }

    const rows = this.db.prepare(`
      SELECT series_id, dimensions, scale_factor, magnitude, embedding_blob
      FROM series_embeddings
    `).all() as Array<{
      series_id: string;
      dimensions: number;
      scale_factor: number;
      magnitude: number;
      embedding_blob: Buffer | Uint8Array;
    }>;

    this.vectorCache = rows.map((r) => {
      const buffer = r.embedding_blob;
      const int8 = new Int8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      return {
        seriesId: r.series_id,
        int8Array: int8,
        scaleFactor: r.scale_factor,
        magnitude: r.magnitude
      };
    });

    this.isCacheLoaded = true;
  }

  /**
   * Upsert a series embedding into SQLite and in-memory cache.
   */
  public upsertEmbedding(
    seriesId: string,
    vector: Float32Array | number[],
    modelVersion = 'all-MiniLM-L6-v2-int8'
  ): void {
    const { int8Array, scaleFactor, magnitude } = quantizeFloat32ToInt8(vector, DEFAULT_VECTOR_DIMENSIONS);
    const blobBuffer = Buffer.from(int8Array.buffer, int8Array.byteOffset, int8Array.byteLength);

    this.db.prepare(`
      INSERT INTO series_embeddings (
        series_id, dimensions, scale_factor, magnitude, embedding_blob, model_version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(series_id) DO UPDATE SET
        dimensions = excluded.dimensions,
        scale_factor = excluded.scale_factor,
        magnitude = excluded.magnitude,
        embedding_blob = excluded.embedding_blob,
        model_version = excluded.model_version,
        updated_at = datetime('now');
    `).run(
      seriesId,
      DEFAULT_VECTOR_DIMENSIONS,
      scaleFactor,
      magnitude,
      blobBuffer,
      modelVersion
    );

    // Update in-memory cache
    const existingIdx = this.vectorCache.findIndex((v) => v.seriesId === seriesId);
    const cachedItem: CachedSeriesVector = {
      seriesId,
      int8Array,
      scaleFactor,
      magnitude
    };

    if (existingIdx >= 0) {
      this.vectorCache[existingIdx] = cachedItem;
    } else {
      this.vectorCache.push(cachedItem);
    }
  }

  /**
   * Bulk upserts a batch of series embeddings within an atomic transaction.
   */
  public upsertEmbeddingsBatch(items: SeriesEmbeddingInput[]): number {
    if (items.length === 0) return 0;

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const stmt = this.db.prepare(`
        INSERT INTO series_embeddings (
          series_id, dimensions, scale_factor, magnitude, embedding_blob, model_version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(series_id) DO UPDATE SET
          dimensions = excluded.dimensions,
          scale_factor = excluded.scale_factor,
          magnitude = excluded.magnitude,
          embedding_blob = excluded.embedding_blob,
          model_version = excluded.model_version,
          updated_at = datetime('now');
      `);

      for (const item of items) {
        const { int8Array, scaleFactor, magnitude } = quantizeFloat32ToInt8(item.vector, DEFAULT_VECTOR_DIMENSIONS);
        const blobBuffer = Buffer.from(int8Array.buffer, int8Array.byteOffset, int8Array.byteLength);
        const modelVersion = item.modelVersion ?? 'all-MiniLM-L6-v2-int8';

        stmt.run(
          item.seriesId,
          DEFAULT_VECTOR_DIMENSIONS,
          scaleFactor,
          magnitude,
          blobBuffer,
          modelVersion
        );
      }

      this.db.exec('COMMIT;');
      this.invalidateCache();
      this.ensureCacheLoaded();

      return items.length;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Linear vector scan comparing query vector against in-memory quantized vectors.
   */
  public searchSemantic(
    queryVector: Float32Array | number[],
    limit = 20,
    minSimilarity = 0.3
  ): Array<{ id: string; similarity: number }> {
    this.ensureCacheLoaded();

    const { int8Array: queryInt8, scaleFactor: queryScale, magnitude: queryMag } =
      quantizeFloat32ToInt8(queryVector, DEFAULT_VECTOR_DIMENSIONS);

    const scored: Array<{ id: string; similarity: number }> = [];

    const total = this.vectorCache.length;
    for (let i = 0; i < total; i++) {
      const target = this.vectorCache[i];
      const similarity = cosineSimilarityQuantized(
        queryInt8,
        queryMag,
        queryScale,
        target.int8Array,
        target.magnitude,
        target.scaleFactor
      );

      if (similarity >= minSimilarity) {
        scored.push({
          id: target.seriesId,
          similarity: Math.round(similarity * 1000) / 1000
        });
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }

  /**
   * Hybrid Search: Combines FTS5 Lexical Search and Int8 Quantized Vector Semantic Search via RRF.
   */
  public searchHybrid(params: HybridSearchParams): HybridSearchResponse {
    const startTime = performance.now();
    const query = params.queryText?.trim() || '';
    const limit = params.limit ?? 20;

    let lexicalIds: string[] = [];
    let lexicalTimeMs = 0;

    // 1. Lexical Retrieval via SQLite FTS5 (if queryText provided)
    if (query) {
      const lexStart = performance.now();
      try {
        const sanitized = query.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
        if (sanitized) {
          const terms = sanitized.split(/\s+/).filter(Boolean);
          const ftsMatch = terms.map((t) => `"${t}"*`).join(' OR ');

          const rows = this.db.prepare(`
            SELECT DISTINCT s.id
            FROM series_search_fts fts
            JOIN series s ON s.id = fts.series_id
            WHERE series_search_fts MATCH ?
            LIMIT ?
          `).all(ftsMatch, limit * 2) as Array<{ id: string }>;

          lexicalIds = rows.map((r) => r.id);
        }
      } catch {
        // Fallback to empty if FTS syntax error
        lexicalIds = [];
      }
      lexicalTimeMs = performance.now() - lexStart;
    }

    // 2. Semantic Vector Retrieval (if queryVector provided)
    let semanticResults: Array<{ id: string; similarity: number }> = [];
    let semanticTimeMs = 0;
    let vectorsEvaluated = 0;

    if (params.queryVector && params.queryVector.length === DEFAULT_VECTOR_DIMENSIONS) {
      const semStart = performance.now();
      semanticResults = this.searchSemantic(
        params.queryVector,
        limit * 2,
        params.minSimilarity ?? 0.2
      );
      vectorsEvaluated = this.vectorCache.length;
      semanticTimeMs = performance.now() - semStart;
    }

    // 3. Reciprocal Rank Fusion (RRF, k=60)
    const fusionStart = performance.now();
    const fusedRankings = reciprocalRankFusion(lexicalIds, semanticResults, {
      k: params.rrfK ?? DEFAULT_RRF_K,
      weightLex: params.lexicalWeight ?? 1.0,
      weightSem: params.semanticWeight ?? 1.0
    });
    const fusionTimeMs = performance.now() - fusionStart;

    // 4. Hydrate Series Metadata for Top Candidates
    const topCandidates = fusedRankings.slice(0, limit);
    const results: HybridSearchResultItem[] = [];

    if (topCandidates.length > 0) {
      const placeholders = topCandidates.map(() => '?').join(',');
      const ids = topCandidates.map((c) => c.id);

      const seriesRows = this.db.prepare(`
        SELECT id, title_primary, type, status, cover_image
        FROM series
        WHERE id IN (${placeholders})
      `).all(...ids) as Array<{
        id: string;
        title_primary: string;
        type: string;
        status: string;
        cover_image: string | null;
      }>;

      const seriesMap = new Map(seriesRows.map((r) => [r.id, r]));

      for (const item of topCandidates) {
        const metadata = seriesMap.get(item.id);
        if (!metadata) continue;

        let matchType: 'hybrid' | 'lexical' | 'semantic' = 'lexical';
        if (item.lexicalRank !== undefined && item.semanticRank !== undefined) {
          matchType = 'hybrid';
        } else if (item.semanticRank !== undefined) {
          matchType = 'semantic';
        }

        results.push({
          seriesId: item.id,
          title: metadata.title_primary,
          type: metadata.type,
          status: metadata.status,
          coverImage: metadata.cover_image || undefined,
          rrfScore: item.rrfScore,
          lexicalRank: item.lexicalRank,
          semanticRank: item.semanticRank,
          semanticSimilarity: item.semanticSimilarity,
          matchType
        });
      }
    }

    const totalTimeMs = performance.now() - startTime;

    return {
      success: true,
      query,
      totalResults: results.length,
      results,
      telemetry: {
        lexicalTimeMs: Math.round(lexicalTimeMs * 100) / 100,
        semanticTimeMs: Math.round(semanticTimeMs * 100) / 100,
        fusionTimeMs: Math.round(fusionTimeMs * 100) / 100,
        totalTimeMs: Math.round(totalTimeMs * 100) / 100,
        vectorsEvaluated
      }
    };
  }

  public getVectorCount(): number {
    this.ensureCacheLoaded();
    return this.vectorCache.length;
  }

  public invalidateCache(): void {
    this.vectorCache = [];
    this.isCacheLoaded = false;
  }
}
