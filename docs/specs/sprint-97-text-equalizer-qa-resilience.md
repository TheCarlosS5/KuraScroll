# Sprint 97 QA Resilience Matrix: Adaptive Dynamic Range In-Viewport Text & Kanji Edge Equalizer (SLA 61)

## Executive Summary
Sprint 97 introduces the **Adaptive Dynamic Range In-Viewport Text & Kanji Edge Equalizer (SLA 61)**, designed to analyze manga dialogue bubbles and dense kanji characters (up to 64 strokes) in real-time, sharpening ink edges and enhancing readability against yellowed, dirty, or over-exposed scan backgrounds.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for dirty/yellowed scans, over-exposed scans, dense kanji glyph processing, clean feature deactivation (`isEnabled = false` returning `'none'`), SQLite CHECK constraints, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **EQ-01** | **Yellowed / Dirty Scans with Background Noise** | Scanned page contains sepia paper discoloration, dot-matrix noise, and foxing stains | Equalizer applies adaptive local thresholding (Sauvola / Niblack algorithm) to isolate ink strokes from dirty background without halo artifacting. | `eq-dirty-scans.test.ts` |
| **EQ-02** | **Over-Exposed Scans** | Scanned page has washed-out highlights and faint, low-contrast ink lines | Equalizer applies dynamic contrast stretching and local histogram equalization to boost faint dialogue lettering. | `eq-overexposed.test.ts` |
| **EQ-03** | **Dense Kanji Glyph Processing (64 Strokes)** | Dialogue bubble contains extremely intricate kanji (e.g. 龖, 龘) | Equalizer prevents stroke bleeding and morphological erosion, maintaining sharp separation between closely packed horizontal/vertical lines. | `eq-dense-kanji.test.ts` |
| **EQ-04** | **Clean Feature Deactivation (`isEnabled = false`)** | Text equalizer disabled by user preference | Equalizer short-circuits instantly, returning `'none'` for CSS filter / SVG adjustments with zero DOM or GPU overhead. | `eq-deactivation.test.ts` |
| **EQ-05** | **SQLite CHECK Constraint Validation & ETag 304** | Malformed DB write attempts out-of-range boost factors; client requests profile with matching `If-None-Match` ETag | SQLite `CHECK (boost_factor >= 0.0 AND boost_factor <= 3.0)` rejects invalid writes; Fastify responds with HTTP 304 Not Modified. | `eq-sqlite-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Text Equalizer Service & Unit Tests (`tests/unit/backend/services/text-equalizer-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { clampBoostFactor, equalizeTextEdges, sanitizeEqualizerMode, computeEqualizerEtag } from '../../../../src/backend/services/text-equalizer-service';

describe('Text & Kanji Edge Equalizer Resilience & Clamping', () => {
  it('clamps boost factor strictly to [0.0, 3.0]', () => {
    expect(clampBoostFactor(-0.5)).toBe(0.0);
    expect(clampBoostFactor(4.5)).toBe(3.0);
    expect(clampBoostFactor(1.5)).toBe(1.5);
  });

  it('handles dirty/yellowed scans and over-exposed scans without crashing', () => {
    const dirtyScanProfile = equalizeTextEdges({ noiseLevel: 0.8, exposure: 0.3 }, 1.2, true);
    expect(dirtyScanProfile.kernelApplied).toBe('sauvola-adaptive');

    const overexposedProfile = equalizeTextEdges({ noiseLevel: 0.1, exposure: 1.9 }, 1.2, true);
    expect(overexposedProfile.kernelApplied).toBe('contrast-stretch');
  });

  it('processes dense kanji (64 strokes) without stroke bleeding', () => {
    const denseKanjiResult = equalizeTextEdges({ strokeDensity: 0.95 }, 1.5, true);
    expect(denseKanjiResult.strokeSeparationValid).toBe(true);
  });

  it('returns "none" cleanly when disabled without render overhead', () => {
    const disabledResult = equalizeTextEdges({ noiseLevel: 0.5 }, 1.0, false);
    expect(disabledResult.cssFilter).toBe('none');
  });

  it('generates deterministic ETags for cached text equalizer profiles', () => {
    const etag1 = computeEqualizerEtag(1.5, 'sauvola-adaptive');
    const etag2 = computeEqualizerEtag(1.5, 'sauvola-adaptive');
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Text Equalizer Hook Tests (`frontend/src/tests/useTextEqualizer.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextEqualizer } from '../hooks/useTextEqualizer';

describe('useTextEqualizer Deactivation & Render Guard', () => {
  it('short-circuits to "none" when disabled', () => {
    const { result } = renderHook(() => useTextEqualizer({ isEnabled: false }));
    expect(result.current.cssFilter).toBe('none');
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Lightweight Fallback:** For low-spec hardware (Intel Pentium T4500), complex Sauvola local thresholding filters fall back to standard unsharp mask sharpening, preventing CPU lockups.
2. **SQLite Integrity Protection:** Database tables enforce strict `CHECK` constraints on boost factors to guarantee robust offline profile synchronization.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 97.*
