# Sprint 87 QA Resilience Matrix: Progressive Image Decompression & Chunked Bitstream Pipeline

## Executive Summary
Sprint 87 introduces the **Progressive Image Decompression & Chunked Bitstream Pipeline**, designed to stream and decompress ultra-high-resolution manga pages and webtoon strips in incremental binary chunks over the 4TB mechanical HDD and HTTP transport, allowing progressive visual rendering before full file download completion.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for zero/negative image dimensions, images smaller than chunk sizes, extreme webtoon strip aspect ratios (`800x16000`), and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **CHV-01** | **Zero or Negative Image Dimensions** | Image header metadata reports width/height as `0`, `-800`, or `NaN` | Stream parser rejects corrupted dimensions, throwing descriptive error and preventing division-by-zero or buffer allocation crashes. | `chunk-dimensions.test.ts` |
| **CHV-02** | **Image Smaller Than Chunk Size** | Small image asset (`800x600` px) loaded with default 1MB stream chunk size | Pipeline detects single-chunk completion, bypassing multi-slice reconstruction overhead and rendering immediately. | `chunk-small-image.test.ts` |
| **CHV-03** | **Extreme Aspect Ratios (Webtoon Strips)** | Ultra-long vertical webtoon strip (`800x16000` px requiring 16+ horizontal/vertical slices) | Pipeline safely chunks strip into manageable slice grids, preventing memory exhaustion and GPU texture allocation failure. | `chunk-extreme-ratio.test.ts` |
| **CHV-04** | **Chunk Stream Interruption & Recovery** | Network drop or disk read error mid-stream (chunk 8 of 16 fails) | Pipeline catches stream abort, releases partial buffer locks, and triggers automatic retry or placeholder fallback. | `chunk-interruption.test.ts` |
| **CHV-05** | **ETag HTTP 304 Verification** | Client requests chunked stream manifest profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant stream segmentation. | `chunk-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Chunked Stream Service & Validation Unit Tests (`tests/unit/backend/services/chunked-stream-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { validateImageDimensions, calculateSliceGrid, computeChunkStreamEtag } from '../../../../src/backend/services/chunked-stream-service';

describe('Chunked Bitstream Pipeline Resilience & Clamping', () => {
  it('rejects zero or negative image dimensions safely', () => {
    expect(() => validateImageDimensions(0, 1200)).toThrowError(/invalid dimensions/i);
    expect(() => validateImageDimensions(800, -500)).toThrowError(/invalid dimensions/i);
    expect(() => validateImageDimensions(NaN, NaN)).toThrowError(/invalid dimensions/i);
    expect(validateImageDimensions(800, 1200)).toBe(true);
  });

  it('handles images smaller than chunk size without multi-slice overhead', () => {
    const grid = calculateSliceGrid(800, 600, 1024 * 1024); // 1MB chunk size
    expect(grid.totalSlices).toBe(1);
    expect(grid.isSinglePass).toBe(true);
  });

  it('calculates slice grids correctly for extreme webtoon aspect ratios (800x16000)', () => {
    const grid = calculateSliceGrid(800, 16000, 256 * 1024); // 256KB chunk size
    expect(grid.totalSlices).toBeGreaterThanOrEqual(16);
    expect(grid.isSinglePass).toBe(false);
  });

  it('generates deterministic ETags for cached chunked stream profile manifests', () => {
    const etag1 = computeChunkStreamEtag('ch-888', 800, 16000);
    const etag2 = computeChunkStreamEtag('ch-888', 800, 16000);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Chunked Stream Hook Tests (`frontend/src/tests/useChunkedStream.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChunkedStream } from '../hooks/useChunkedStream';

describe('useChunkedStream Interruption & Progressive Rendering', () => {
  it('handles stream read failure gracefully with fallback placeholder', async () => {
    const { result } = renderHook(() => useChunkedStream({ chapterId: 'ch-1', page: 1 }));

    act(() => {
      result.current.simulateStreamError(new Error('Disk read timeout on 4TB HDD'));
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.isPlaceholderActive).toBe(true);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **HDD I/O Throttle:** Reading chunked binary streams from the 4TB mechanical HDD utilizes sequential read buffers with read-ahead caching to minimize seek latency overhead.
2. **Memory Safeguard:** Incremental image slices are decoded via streaming decoders and discarded from memory immediately after compositing into the final canvas frame.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 87.*
