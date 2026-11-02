# Sprint 100 QA Resilience Matrix: Century Jubilee - Ultra-Low-Latency In-Memory Vector Search & Embedding Quantizer (SLA 64)

## Executive Summary
For the **Century Jubilee Sprint 100**, KuraScroll introduces the **Ultra-Low-Latency In-Memory Vector Search & Embedding Quantizer (SLA 64)**, providing sub-millisecond semantic dialogue search and panel retrieval via Product Quantization (PQ) and SIMD-accelerated cosine similarity calculations.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for zero-norm vectors (preventing division-by-zero/NaN), uneven vector dimensionality handling, extreme similarity thresholds (`0.10` and `0.99`), and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **VEC-01** | **Zero-Norm Vectors (All-Zero Embeddings)** | Query or database embedding vector consists entirely of zeros (`[0.0, 0.0, ..., 0.0]`) | Cosine similarity calculation guards against division by zero, returning `0.00` similarity score instantly without generating `NaN` or `Infinity`. | `vec-zero-norm.test.ts` |
| **VEC-02** | **Unequal Vector Dimensionality** | Query vector has dimension $D=128$, but target embedding has dimension $D=64$ | Quantizer safely handles dimension mismatch by zero-padding the shorter vector or slicing to the common lower dimension without throwing array index exceptions. | `vec-dimensions.test.ts` |
| **VEC-03** | **Extreme Similarity Thresholds** | Search executed with ultra-loose threshold (`0.10`) or ultra-strict threshold (`0.99`) | Search index correctly filters and ranks results according to clamping rules, returning expansive or highly precise semantic matches. | `vec-thresholds.test.ts` |
| **VEC-04** | **Fastify Idempotency & ETag 304 Caching** | Client requests vector index manifest with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant embedding deserialization and index scans. | `vec-etag-idempotency.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Vector Index Service & Quantization Unit Tests (`tests/unit/backend/services/vector-index-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { calculateCosineSimilarity, padOrSliceVector, clampSimilarityThreshold, computeVectorIndexEtag } from '../../../../src/backend/services/vector-index-service';

describe('Vector Search & Embedding Quantizer Resilience & Clamping', () => {
  it('returns 0.00 similarity without NaN or division by zero for zero-norm vectors', () => {
    const zeroVec = [0.0, 0.0, 0.0, 0.0];
    const normalVec = [0.5, -0.3, 0.8, 0.1];

    const sim1 = calculateCosineSimilarity(zeroVec, normalVec);
    const sim2 = calculateCosineSimilarity(zeroVec, zeroVec);

    expect(sim1).toBe(0.00);
    expect(sim2).toBe(0.00);
    expect(Number.isNaN(sim1)).toBe(false);
    expect(Number.isFinite(sim1)).toBe(true);
  });

  it('safely handles unequal vector lengths via padding or slicing', () => {
    const shortVec = [1.0, 2.0];
    const longVec = [1.0, 2.0, 3.0, 4.0];

    const adjusted = padOrSliceVector(shortVec, longVec.length);
    expect(adjusted.length).toBe(longVec.length);
    expect(adjusted).toEqual([1.0, 2.0, 0.0, 0.0]);
  });

  it('clamps similarity thresholds strictly to [0.0, 1.0]', () => {
    expect(clampSimilarityThreshold(-0.5)).toBe(0.0);
    expect(clampSimilarityThreshold(1.5)).toBe(1.0);
    expect(clampSimilarityThreshold(0.99)).toBe(0.99);
  });

  it('generates deterministic ETags for cached vector index manifests', () => {
    const etag1 = computeVectorIndexEtag('vector-index-v1', 5000);
    const etag2 = computeVectorIndexEtag('vector-index-v1', 5000);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Vector Search Hook Tests (`frontend/src/tests/useVectorSearch.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVectorSearch } from '../hooks/useVectorSearch';

describe('useVectorSearch Zero-Norm & Threshold Guard', () => {
  it('handles zero-norm query embeddings gracefully in UI search results', () => {
    const { result } = renderHook(() => useVectorSearch({ queryVector: [0, 0, 0, 0] }));
    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Zero-Norm Safeguard:** All dot-product and cosine similarity routines explicitly check vector magnitude norms ($\|A\| = 0$ or $\|B\| = 0$), short-circuiting to `0.00` to prevent division-by-zero crashes.
2. **Quantization Memory Protection:** In-memory Product Quantization index centroids are compressed into uint8 codebooks to maintain a tiny footprint in V8 heap memory.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 100.*
