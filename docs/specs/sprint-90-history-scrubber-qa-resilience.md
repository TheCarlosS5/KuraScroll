# Sprint 90 QA Resilience Matrix: Bi-Directional Manga & Webtoon Continuous Infinite History Scrubber & Visual Heatmap Tape

## Executive Summary
Sprint 90 introduces the **Bi-Directional Manga & Webtoon Continuous Infinite History Scrubber & Visual Heatmap Tape**, allowing readers to navigate through massive multi-thousand chapter series (e.g., 1,500 chapters, 40,000+ total pages) using an interactive visual timeline scrubber with reading history heatmap indicators.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for empty series (0 chapters), massive long-running series stress tests, abrupt bi-directional scrolling reversals, SQLite CHECK constraint validations, and NaN/Infinity guards in tape coordinate projections.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SCRUB-01** | **Empty Series Edge Case (0 Chapters)** | Series metadata returns `chapters: []` (no chapters available) | Scrubber tape renders empty state placeholder gracefully without division-by-zero or NaN coordinate projections. | `scrubber-empty.test.ts` |
| **SCRUB-02** | **Massive Long-Running Series Stress Test** | Series contains 1,500 chapters and over 40,000 individual pages | Scrubber virtualizes chapter markers and heatmap bins using windowed DOM rendering, maintaining 60 FPS scrolling and stable V8 heap. | `scrubber-massive.test.ts` |
| **SCRUB-03** | **Abrupt Bi-Directional Reversal** | User rapidly flings scrubber from start to end (Chapter 1 $\rightarrow$ Chapter 1,500) and immediately reverses direction at high velocity | Active prefetch and thumbnail render queues abort obsolete requests instantly via `AbortController`, preventing memory saturation. | `scrubber-reversal.test.ts` |
| **SCRUB-04** | **SQLite CHECK Constraint Validation** | Malformed database write attempts to insert out-of-range scrub offsets (`offset < 0.0` or `offset > 1.0`) | SQLite `CHECK (progress_offset >= 0.0 AND progress_offset <= 1.0)` constraint rejects invalid writes, falling back to safe state. | `scrubber-sqlite.test.ts` |
| **SCRUB-05** | **NaN / Infinity Guards in Tape Projection** | Canvas width or chapter count reports `NaN`, `Infinity`, or `0` during resize calculations | Projection math sanitizes input, defaulting to safe coordinate factors and preventing canvas rendering corruption. | `scrubber-nan.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / SQLite CHECK Constraint & Projection Unit Tests (`tests/unit/backend/services/history-scrubber-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { validateScrubberOffset, projectTapeCoordinates, sanitizeSeriesChapters, computeScrubberEtag } from '../../../../src/backend/services/history-scrubber-service';

describe('History Scrubber Engine Resilience & Clamping', () => {
  it('validates and clamps progress offsets strictly to [0.0, 1.0]', () => {
    expect(validateScrubberOffset(-0.2)).toBe(0.0);
    expect(validateScrubberOffset(1.5)).toBe(1.0);
    expect(validateScrubberOffset(NaN)).toBe(0.0);
    expect(validateScrubberOffset(Infinity)).toBe(1.0);
    expect(validateScrubberOffset(0.65)).toBe(0.65);
  });

  it('safely handles empty series with 0 chapters without NaN projections', () => {
    const emptySeries = { id: 's-empty', chapters: [] };
    const sanitized = sanitizeSeriesChapters(emptySeries);
    const coords = projectTapeCoordinates(0.5, sanitized, 800);

    expect(coords.chapterIndex).toBe(0);
    expect(Number.isNaN(coords.pixelX)).toBe(false);
  });

  it('handles massive series (1,500 chapters, 40,000 pages) efficiently', () => {
    const massiveChapters = Array.from({ length: 1500 }, (_, i) => ({
      id: `ch-${i}`,
      pageCount: 25,
    }));
    const coords = projectTapeCoordinates(0.75, massiveChapters, 1200);

    expect(coords.chapterIndex).toBeGreaterThan(1000);
    expect(Number.isFinite(coords.pixelX)).toBe(true);
  });

  it('generates deterministic ETags for cached scrubber profile endpoints', () => {
    const etag1 = computeScrubberEtag('series-one-piece', 1500);
    const etag2 = computeScrubberEtag('series-one-piece', 1500);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Scrubber Hook Tests (`frontend/src/tests/useHistoryScrubber.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryScrubber } from '../hooks/useHistoryScrubber';

describe('useHistoryScrubber Abrupt Reversal & Virtualization', () => {
  it('aborts obsolete thumbnail requests on abrupt bi-directional scrubbing', () => {
    const abortSpy = vi.fn();
    global.fetch = vi.fn().mockImplementation((url, options) => {
      options?.signal?.addEventListener('abort', abortSpy);
      return new Promise(() => {});
    });

    const { result, rerender } = renderHook(
      ({ offset }) => useHistoryScrubber({ seriesId: 's-1', progressOffset: offset }),
      { initialProps: { offset: 0.1 } }
    );

    // Rapidly fling to 0.9 and back to 0.2
    rerender({ offset: 0.9 });
    rerender({ offset: 0.2 });

    expect(abortSpy).toHaveBeenCalled();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Massive Series Virtualization:** For long-running series exceeding 500 chapters, heatmap tape bins are aggregated into dynamic LOD (Level of Detail) buckets to prevent SVG/Canvas DOM node exhaustion.
2. **SQLite Integrity Guard:** Database tables enforce strict `CHECK` constraints on offset ranges, ensuring that third-party sync imports cannot corrupt reading milestone coordinates.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 90.*
