/**
 * KuraScroll Vector Quantizer & Fast Int8 Similarity Utilities
 * Sprint 47 - Hybrid FTS5 + Int8 Vector Search + Reciprocal Rank Fusion
 * 
 * Hardware-conscious design for Intel Pentium T4500 (2C/2T @ 2.3GHz, NO AVX/AVX2):
 * - 8-bit symmetric linear quantization (75% memory reduction: 1536B -> 384B)
 * - Zero-allocation integer dot product loop unrolled for Penryn L2 cache
 * - Scale-invariant Reciprocal Rank Fusion (RRF, k=60)
 */

export const DEFAULT_VECTOR_DIMENSIONS = 384;
export const DEFAULT_RRF_K = 60;

export interface QuantizedVector {
  int8Array: Int8Array;
  scaleFactor: number;
  magnitude: number;
}

export interface RRFScoredItem {
  id: string;
  rrfScore: number;
  lexicalRank?: number; // 1-based rank in FTS5
  semanticRank?: number; // 1-based rank in Vector
  semanticSimilarity?: number; // Cosine similarity (-1.0 to 1.0)
}

/**
 * Quantizes a 384-dimensional Float32 vector into a memory-efficient Int8 vector.
 */
export function quantizeFloat32ToInt8(
  vector: Float32Array | number[],
  expectedDim = DEFAULT_VECTOR_DIMENSIONS
): QuantizedVector {
  if (vector.length !== expectedDim) {
    throw new Error(`Vector dimension mismatch: expected ${expectedDim}, received ${vector.length}`);
  }

  let sumSquares = 0;
  let maxAbs = 0;

  for (let i = 0; i < expectedDim; i++) {
    const val = vector[i];
    if (isNaN(val) || !isFinite(val)) {
      throw new Error(`Vector contains invalid element at index ${i}`);
    }
    sumSquares += val * val;
    const absVal = Math.abs(val);
    if (absVal > maxAbs) {
      maxAbs = absVal;
    }
  }

  const magnitude = Math.sqrt(sumSquares);
  const scaleFactor = maxAbs > 0 ? maxAbs / 127.0 : 1.0;
  const int8Array = new Int8Array(expectedDim);

  for (let i = 0; i < expectedDim; i++) {
    const quantized = Math.round(vector[i] / scaleFactor);
    int8Array[i] = Math.max(-128, Math.min(127, quantized));
  }

  return {
    int8Array,
    scaleFactor,
    magnitude: magnitude > 0 ? magnitude : 1.0
  };
}

/**
 * Reconstructs Float32Array from an Int8Array and scale factor.
 */
export function dequantizeInt8ToFloat32(
  int8Array: Int8Array,
  scaleFactor: number
): Float32Array {
  const len = int8Array.length;
  const float32 = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    float32[i] = int8Array[i] * scaleFactor;
  }
  return float32;
}

/**
 * Computes integer dot product between two Int8Arrays with zero allocations.
 * Unrolled 8x to maximize instruction-level parallelism on Penryn 45nm cores.
 */
export function dotProductInt8(a: Int8Array, b: Int8Array): number {
  const len = a.length;
  let sum = 0;
  let i = 0;

  // Unrolled 8x
  const limit = len - 7;
  for (; i < limit; i += 8) {
    sum +=
      a[i] * b[i] +
      a[i + 1] * b[i + 1] +
      a[i + 2] * b[i + 2] +
      a[i + 3] * b[i + 3] +
      a[i + 4] * b[i + 4] +
      a[i + 5] * b[i + 5] +
      a[i + 6] * b[i + 6] +
      a[i + 7] * b[i + 7];
  }

  // Remainder
  for (; i < len; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}

/**
 * Calculates cosine similarity between two quantized vectors using integer dot products.
 */
export function cosineSimilarityQuantized(
  queryInt8: Int8Array,
  queryMag: number,
  queryScale: number,
  targetInt8: Int8Array,
  targetMag: number,
  targetScale: number
): number {
  if (queryMag === 0 || targetMag === 0) {
    return 0.0;
  }

  const dotInt = dotProductInt8(queryInt8, targetInt8);
  const dotFloat = dotInt * queryScale * targetScale;
  const cosine = dotFloat / (queryMag * targetMag);

  return Math.max(-1.0, Math.min(1.0, cosine));
}

/**
 * Reciprocal Rank Fusion (RRF, k=60).
 * Combines ranked lists of candidate IDs from lexical and semantic search engines.
 */
export function reciprocalRankFusion(
  lexicalCandidates: string[],
  semanticCandidates: Array<{ id: string; similarity: number }>,
  options?: {
    k?: number;
    weightLex?: number;
    weightSem?: number;
  }
): RRFScoredItem[] {
  const k = options?.k ?? DEFAULT_RRF_K;
  const wLex = options?.weightLex ?? 1.0;
  const wSem = options?.weightSem ?? 1.0;

  const scores = new Map<
    string,
    {
      rrfScore: number;
      lexicalRank?: number;
      semanticRank?: number;
      semanticSimilarity?: number;
    }
  >();

  // Process Lexical Rankings (1-based)
  for (let i = 0; i < lexicalCandidates.length; i++) {
    const id = lexicalCandidates[i];
    const rank = i + 1;
    const contribution = wLex / (k + rank);

    const existing = scores.get(id);
    if (existing) {
      existing.rrfScore += contribution;
      existing.lexicalRank = rank;
    } else {
      scores.set(id, {
        rrfScore: contribution,
        lexicalRank: rank
      });
    }
  }

  // Process Semantic Rankings (1-based)
  for (let i = 0; i < semanticCandidates.length; i++) {
    const item = semanticCandidates[i];
    const rank = i + 1;
    const contribution = wSem / (k + rank);

    const existing = scores.get(item.id);
    if (existing) {
      existing.rrfScore += contribution;
      existing.semanticRank = rank;
      existing.semanticSimilarity = item.similarity;
    } else {
      scores.set(item.id, {
        rrfScore: contribution,
        semanticRank: rank,
        semanticSimilarity: item.similarity
      });
    }
  }

  const results: RRFScoredItem[] = Array.from(scores.entries()).map(([id, data]) => ({
    id,
    rrfScore: Math.round(data.rrfScore * 1_000_000) / 1_000_000,
    lexicalRank: data.lexicalRank,
    semanticRank: data.semanticRank,
    semanticSimilarity: data.semanticSimilarity
  }));

  // Sort descending by combined RRF score
  results.sort((a, b) => b.rrfScore - a.rrfScore);

  return results;
}
