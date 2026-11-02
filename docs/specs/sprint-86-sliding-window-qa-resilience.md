# Sprint 86 QA Resilience Matrix: Continuous Page In-Viewport Micro-Cache & Sliding Window Prefetch Engine

## Executive Summary
Sprint 86 introduces the **Continuous Page In-Viewport Micro-Cache & Sliding Window Prefetch Engine**, optimized for low-spec hardware (Intel Pentium T4500, Intel GMA 4500MHD, 4TB mechanical SATA II HDD). It maintains a strict sliding window of pre-rendered and cached pages around the viewport while unmounting off-screen DOM nodes to prevent V8 memory bloat and layout thrashing.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for zero/single-page chapters, sliding window boundary clamping, fast scrolling index jumps (`±50` pages), and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **WIN-01** | **Zero or Single-Page Chapters** | Chapter metadata contains `totalCount = 0` or `totalCount = 1` | Sliding window engine safely clamps window bounds to `[0, 0]`, preventing index out-of-bounds exceptions or infinite prefetch loops. | `window-single-page.test.ts` |
| **WIN-02** | **Boundary Index Clamping** | `currentIndex = 0` (start) or `currentIndex = totalCount - 1` (end) | Sliding window prefetch bounds (`[currentIndex - N, currentIndex + N]`) clamp strictly to valid indices `[0, totalCount - 1]`, requesting zero out-of-range assets. | `window-boundaries.test.ts` |
| **WIN-03** | **Fast Scrolling Jump (±50 Pages)** | User drags scrollbar or uses scrubber to jump 50 pages instantly | Active prefetch tasks for obsolete pages are aborted immediately (`AbortController`), preventing disk I/O queue starvation on the 4TB HDD. | `window-fast-scroll.test.ts` |
| **WIN-04** | **Memory Stale Reference Prevention** | Rapid sliding window re-renders and unmounts | Off-screen page DOM nodes are unmounted cleanly, releasing image bitmap references and keeping V8 heap below 512MB. | `window-memory.test.ts` |
| **WIN-05** | **ETag HTTP 304 Caching** | Client requests sliding window profile endpoint with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant profile calculations. | `window-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Sliding Window Service & Boundary Unit Tests (`tests/unit/backend/services/sliding-window-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { calculateSlidingWindowBounds, handleSinglePageChapter, computeWindowEtag } from '../../../../src/backend/services/sliding-window-service';

describe('Sliding Window Micro-Cache Engine Resilience & Clamping', () => {
  it('safely handles zero and single-page chapters without index errors', () => {
    const zeroPageResult = calculateSlidingWindowBounds(0, 0, 3);
    expect(zeroPageResult).toEqual({ startIndex: 0, endIndex: 0 });

    const singlePageResult = calculateSlidingWindowBounds(0, 1, 3);
    expect(singlePageResult).toEqual({ startIndex: 0, endIndex: 0 });
  });

  it('clamps sliding window bounds strictly at chapter start and end boundaries', () => {
    const totalCount = 20;
    // At start (index 0) with radius 3
    const atStart = calculateSlidingWindowBounds(0, totalCount, 3);
    expect(atStart).toEqual({ startIndex: 0, endIndex: 3 });

    // At end (index 19) with radius 3
    const atEnd = calculateSlidingWindowBounds(19, totalCount, 3);
    expect(atEnd).toEqual({ startIndex: 16, endIndex: 19 });
  });

  it('generates deterministic ETags for cached sliding window profile endpoints', () => {
    const etag1 = computeWindowEtag('ch-100', 5, 3);
    const etag2 = computeWindowEtag('ch-100', 5, 3);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Sliding Window Hook Tests (`frontend/src/tests/useSlidingWindow.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlidingWindow } from '../hooks/useSlidingWindow';

describe('useSlidingWindow Fast Scroll Abort & Memory Protection', () => {
  it('cancels pending prefetch requests immediately on massive page index jump (±50 pages)', () => {
    const abortSpy = vi.fn();
    global.fetch = vi.fn().mockImplementation((url, options) => {
      options?.signal?.addEventListener('abort', abortSpy);
      return new Promise(() => {});
    });

    const { result, rerender } = renderHook(
      ({ currentIndex }) => useSlidingWindow({ totalCount: 200, currentIndex, radius: 4 }),
      { initialProps: { currentIndex: 10 } }
    );

    // Massive jump to index 60
    rerender({ currentIndex: 60 });

    expect(abortSpy).toHaveBeenCalled();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **HDD IOPS Protection:** To prevent thrashing the 4TB mechanical SATA II HDD (~80 IOPS), fast-scrolling index jumps clear the prefetch queue instantly, prioritizing the exact target viewport page.
2. **DOM Virtualization:** Off-screen pages beyond the sliding window radius are purged from the DOM entirely, keeping DOM node count constant and preventing memory leaks.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 86.*
