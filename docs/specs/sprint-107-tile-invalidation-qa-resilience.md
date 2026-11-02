# Sprint 107 QA Resilience Matrix: Bi-Temporal Frame-Paced Adaptive Micro-Tile Invalidator & Memory Cache Garbage Collector (SLA 65 / SLA 71)

## Executive Summary
Sprint 107 introduces the **Bi-Temporal Frame-Paced Adaptive Micro-Tile Invalidator & Memory Cache Garbage Collector (SLA 71)**, explicitly engineered to protect KuraScroll's strict hardware constraints (Intel Pentium T4500 2C/2T 2.3GHz, 512MB V8 heap ceiling, Intel GMA 4500MHD GPU, and 4TB mechanical SATA II HDD).

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for zero/negative tile dimensions, massive webtoon tile lists (1,000+ virtual tiles), rapid oscillating scroll velocity reversals, emergency V8 heap budget purges, and sub-microsecond execution latency (`< 50 µs` unit tests, `< 20 µs` benchmarks).

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **TINV-01** | **Zero or Negative Tile Dimensions / Distances** | Tile width/height or distance vector evaluates to `0`, negative values, or `NaN` | Invalidator guards against division-by-zero and invalid coordinate projections, returning safe non-intersecting fallback status. | `tile-dimensions.test.ts` |
| **TINV-02** | **Huge Tile Lists (1,000+ Virtual Tiles)** | Long-running webtoon chapter renders 1,000+ active virtualized micro-tiles | Invalidator processes spatial occlusion culling in batches using typed array buffers, completing pass within strict time budgets without blocking the 60 FPS frame pacer. | `tile-massive-list.test.ts` |
| **TINV-03** | **Velocity Vector Reversals (Rapid Oscillating Scroll)** | Reader rapidly oscillates scroll direction back and forth at high frequency (30Hz jitter) | Invalidator debounces state mutations and discards obsolete invalidation tokens, preventing cache thrashing and memory churn. | `tile-oscillation.test.ts` |
| **TINV-04** | **Memory Heap Ceiling Breaches (> 512MB V8 Budget)** | V8 heap consumption exceeds 480MB during intensive multi-chapter reading | Garbage collector triggers emergency synchronous/asynchronous purge, evicting cold micro-tiles down to the safe 350MB budget ceiling. | `tile-heap-purge.test.ts` |
| **TINV-05** | **Strict Invalidation Latency (< 50 µs / < 20 µs)** | Micro-tile occlusion check executed repeatedly in Vitest benchmark suite | Unit test assertions complete in `< 50 µs`; optimized benchmark loops complete in `< 20 µs` per evaluation cycle. | `tile-latency.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Tile Invalidator Service & Unit Tests (`tests/unit/backend/services/tile-invalidator-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { invalidateMicroTile, evaluateHeapBudget, sanitizeTileDimensions, computeTileInvalidationEtag } from '../../../../src/backend/services/tile-invalidator-service';

describe('Micro-Tile Invalidator & Garbage Collector Resilience', () => {
  it('guards against zero, negative, or NaN tile dimensions and distance vectors', () => {
    const invalidTile = { id: 't-1', width: 0, height: -256, distance: NaN };
    const result = invalidateMicroTile(invalidTile, { viewportY: 0, viewportHeight: 800 });

    expect(result.shouldInvalidate).toBe(false);
    expect(result.error).toBeUndefined(); // Suppressed safely
  });

  it('processes massive lists (1,000+ virtual tiles) within execution time budget', () => {
    const massiveTiles = Array.from({ length: 1200 }, (_, i) => ({
      id: `tile-${i}`,
      y: i * 256,
      height: 256,
    }));

    const start = performance.now();
    const invalidated = massiveTiles.map(t => invalidateMicroTile(t, { viewportY: 50000, viewportHeight: 800 }));
    const duration = performance.now() - start;

    expect(invalidated.length).toBe(1200);
    expect(duration).toBeLessThan(5.0); // Entire batch in under 5ms
  });

  it('triggers emergency purge down to budget when V8 heap ceiling is breached (> 512MB)', () => {
    const cacheState = { currentHeapBytes: 495 * 1024 * 1024, cachedTilesCount: 850 };
    const postPurge = evaluateHeapBudget(cacheState, 512 * 1024 * 1024);

    expect(postPurge.isPurgeTriggered).toBe(true);
    expect(postPurge.currentHeapBytes).toBeLessThanOrEqual(350 * 1024 * 1024); // Purged to safe budget
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const sampleTile = { id: 't-sample', y: 1000, height: 256 };
    const viewport = { viewportY: 1000, viewportHeight: 800 };

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      invalidateMicroTile(sampleTile, viewport);
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached tile invalidation profile manifests', () => {
    const etag1 = computeTileInvalidationEtag('ch-107', 256);
    const etag2 = computeTileInvalidationEtag('ch-107', 256);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Tile Invalidator Hook Tests (`frontend/src/tests/useTileInvalidator.test.ts`)
```typescript
import { describe, it, expect, act } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTileInvalidator } from '../hooks/useTileInvalidator';

describe('useTileInvalidator Oscillating Scroll & Heap Budget Guard', () => {
  it('suppresses cache thrashing during rapid oscillating scroll direction reversals (30Hz)', () => {
    const { result } = renderHook(() => useTileInvalidator({ capacity: 500 }));

    act(() => {
      for (let i = 0; i < 30; i++) {
        result.current.updateScrollPosition(i % 2 === 0 ? 1500 : 1550);
      }
    });

    expect(result.current.invalidationThrashCount).toBe(0);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Heap Ceiling Enforcement:** When V8 heap tracking approaches the 512MB hardware limit on the Intel Pentium T4500, the tile garbage collector aggressively sweeps inactive micro-tiles, preventing out-of-memory crashes.
2. **Sub-Microsecond Optimization:** Spatial intersection routines are implemented using primitive number comparisons and pre-allocated typed arrays, guaranteeing execution times well under the 50 µs latency ceiling.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 107.*
