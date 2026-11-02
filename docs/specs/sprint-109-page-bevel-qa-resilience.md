# Sprint 109 QA Resilience Matrix: Bi-Directional Multi-Channel Tactile Page Edge Bevel & Stack Thickness Hologram Synthesizer (SLA 73)

## Executive Summary
Sprint 109 introduces the **Bi-Directional Multi-Channel Tactile Page Edge Bevel & Stack Thickness Hologram Synthesizer (SLA 73)**, designed to render realistic 3D tactile page edge bevels, depth shadows, and physical book stack thickness holograms based on the reader's current page progress ($P$) relative to total chapter pages ($N$).

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for single-page chapters ($N \le 1$), out-of-bounds page requests ($P > N$ or $P < 1$), extreme page parity boundary checks ($P=1$ and $P=N$), vertical webtoon mode fallbacks (zero stack thickness), and ultra-strict microsecond execution benchmarks (`< 50 µs` unit tests, `< 20 µs` benchmarks).

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **BEV-01** | **Division-by-Zero Guards ($N \le 1$ Chapters)** | Chapter metadata reports total pages $N = 1$ or $N = 0$ (single-page or empty chapter) | Bevel engine guards against division by zero in stack thickness and progress ratio formulas, defaulting progress ratio to `1.0` or `0.0` without NaN artifacts. | `bevel-division.test.ts` |
| **BEV-02** | **Out-of-Bounds Page Requests ($P > N$ or $P < 1$)$** | Current page requested outside valid range (`P = 0`, `P = -5`, or `P = 500` when `N = 25`) | Page progress index is strictly clamped within `[1, N]`, preventing negative stack thickness calculation or inverted bevel shadows. | `bevel-bounds.test.ts` |
| **BEV-03** | **Boundary Progress Checks ($P=1$ and $P=N$)** | Reader views exact first page ($P=1$) or exact final page ($P=N$) of a multi-page chapter | Holographic stack proportions correctly reflect full right-side block ($P=1$) vs. full left-side block ($P=N$) without visual clipping. | `bevel-parity.test.ts` |
| **BEV-04** | **Vertical Webtoon Mode Fallback** | Reading mode set to continuous vertical webtoon (`readingMode = "webtoon"`) | Stack thickness and 3D bevel hologram short-circuits instantly, returning zero thickness and neutral pass-through styles with zero render overhead. | `bevel-webtoon.test.ts` |
| **BEV-05** | **Strict Latency Benchmark (< 50 µs / < 20 µs)** | Bevel and stack thickness calculation executed repeatedly in Vitest benchmark suite | Unit test assertions complete in `< 50 µs`; optimized benchmark loops complete in `< 20 µs` per evaluation cycle. | `bevel-latency.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Page Bevel Service & Unit Tests (`tests/unit/backend/services/page-bevel-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { calculateStackThickness, clampPageProgress, sanitizeChapterTotal, computeBevelEtag } from '../../../../src/backend/services/page-bevel-service';

describe('Page Edge Bevel & Stack Thickness Hologram Resilience', () => {
  it('guards against division-by-zero on single-page chapters or N <= 1', () => {
    const singlePageThickness = calculateStackThickness(1, 1, 'manga-rtl');
    const zeroPageThickness = calculateStackThickness(1, 0, 'manga-rtl');

    expect(singlePageThickness.leftBlockRatio).toBe(0.0);
    expect(singlePageThickness.rightBlockRatio).toBe(0.0);
    expect(zeroPageThickness.leftBlockRatio).toBe(0.0);
  });

  it('clamps out-of-bounds page requests strictly to [1, N]', () => {
    const totalPages = 20;
    expect(clampPageProgress(0, totalPages)).toBe(1);
    expect(clampPageProgress(-10, totalPages)).toBe(1);
    expect(clampPageProgress(50, totalPages)).toBe(20);
    expect(clampPageProgress(12, totalPages)).toBe(12);
  });

  it('returns zero stack thickness cleanly in vertical webtoon reading mode', () => {
    const webtoonThickness = calculateStackThickness(5, 25, 'webtoon');
    expect(webtoonThickness.leftBlockRatio).toBe(0.0);
    expect(webtoonThickness.rightBlockRatio).toBe(0.0);
    expect(webtoonThickness.cssBevelStyle).toBe('none');
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      calculateStackThickness(10, 30, 'manga-rtl');
      clampPageProgress(15, 30);
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached bevel profile manifests', () => {
    const etag1 = computeBevelEtag('tankobon-vol-1', 30);
    const etag2 = computeBevelEtag('tankobon-vol-1', 30);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Page Bevel Hook Tests (`frontend/src/tests/usePageBevel.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageBevel } from '../hooks/usePageBevel';

describe('usePageBevel Webtoon Fallback & Boundary Parity', () => {
  it('short-circuits bevel holograms to "none" in vertical webtoon mode', () => {
    const { result } = renderHook(() => usePageBevel({ readingMode: 'webtoon', page: 5, totalPages: 30 }));
    expect(result.current.cssBevelStyle).toBe('none');
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Division-by-Zero Protection:** Chapters with $N \le 1$ automatically bypass proportional stack width ratios, returning a flat neutral bevel profile to prevent division-by-zero runtime crashes.
2. **Webtoon Optimization:** When `readingMode = "webtoon"`, stack thickness calculations are short-circuited entirely, preserving CPU cycles on vertical infinite scrolling chapters.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 109.*
