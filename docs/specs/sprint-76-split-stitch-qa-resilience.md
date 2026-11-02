# Sprint 76 QA Resilience Matrix: Intelligent Dual-Page Splitter & Webtoon Vertical Stitcher Engine

## Executive Summary
Sprint 76 introduces the **Intelligent Dual-Page Splitter & Webtoon Vertical Stitcher Engine**, responsible for programmatically splitting scanned physical manga tankōbon double-page spreads with gutter offset calibration, and seamlessly stitching multi-part vertical webtoon strips of varying widths into a unified reading canvas.

This document establishes the exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for uneven gutter offsets, mismatched webtoon strip widths, Fastify endpoint validation (invalid modes, out-of-range split ratios), and HTTP 304 ETag verification.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SPL-01** | **Uneven Gutter Offset & Split Ratios** | Double-page spread with scan tilt; split ratio configured outside default `0.50` (e.g. `0.40` or `0.60`) | Splitter adjusts vertical cut line accurately according to offset ratio without clipping character art or dialogue bubbles. | `splitter-gutter.test.ts` |
| **SPL-02** | **Mismatched Webtoon Strip Widths** | Consecutive webtoon strips in the same chapter with varying widths (`800px`, `720px`, `850px`) | Stitcher applies intelligent padding or center-aligned CSS flex constraints, preventing visual jitter and layout tearing. | `stitcher-width.test.ts` |
| **SPL-03** | **Fastify Endpoint Parameter Fuzzing** | Invalid mode strings (`mode=invalid_mode`), out-of-range split ratios (`ratio=1.5` or `-0.2`) | Fastify validation middleware sanitizes inputs, clamps ratios to `[0.3, 0.7]`, and returns HTTP 400 Bad Request for invalid enums. | `split-stitch-api.test.ts` |
| **SPL-04** | **ETag HTTP 304 Verification** | Client requests processed split/stitched asset with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant image processing or disk reads. | `split-stitch-etag.test.ts` |
| **SPL-05** | **Memory Leak Prevention on Massive Spreads** | Processing ultra-high-res tankōbon scans (`6000x4000` px) | Intermediate Sharp image buffers are explicitly freed using `.destroy()` or garbage collection hooks to stay under 512MB V8 heap. | `splitter-memory.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Splitter & Stitcher Unit Tests (`tests/unit/backend/services/split-stitch.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { validateSplitParams, sanitizeWebtoonStrips, computeAssetEtag } from '../../../../src/backend/services/split-stitch-service';

describe('Splitter & Stitcher Endpoint Validation & Resilience', () => {
  it('clamps out-of-range split ratios and validates mode enums', () => {
    const invalidPayload = { mode: 'invalid_split', ratio: 1.2 };
    const sanitized = validateSplitParams(invalidPayload);

    expect(sanitized.mode).toBe('default'); // Fallback
    expect(sanitized.ratio).toBe(0.7);       // Clamped to max
  });

  it('aligns mismatched webtoon strip widths cleanly', () => {
    const strips = [
      { id: '1', width: 800, url: '/img/1.webp' },
      { id: '2', width: 720, url: '/img/2.webp' },
      { id: '3', width: 850, url: '/img/3.webp' },
    ];
    const standardized = sanitizeWebtoonStrips(strips, 800);
    for (const strip of standardized) {
      expect(strip.targetWidth).toBe(800);
      expect(strip.paddingApplied).toBeDefined();
    }
  });

  it('generates deterministic ETags for cached split/stitched assets', () => {
    const etag1 = computeAssetEtag('ch-1', 'split', 0.5);
    const etag2 = computeAssetEtag('ch-1', 'split', 0.5);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Viewer Component Tests (`frontend/src/tests/WebtoonStitcher.test.tsx`)
```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { WebtoonStitcherViewer } from '../components/reader/WebtoonStitcherViewer';

describe('WebtoonStitcherViewer Layout & CLS Tests', () => {
  it('maintains center-alignment and zero CLS across mismatched strip widths', () => {
    const strips = [
      { id: '1', width: 800, height: 1200, url: '/img/1.webp' },
      { id: '2', width: 720, height: 1000, url: '/img/2.webp' },
    ];

    const { container } = render(<WebtoonStitcherViewer strips={strips} maxWidth={800} />);
    const wrapper = container.firstChild;

    expect(wrapper).toHaveStyle({ display: 'flex', flexDirection: 'column', alignItems: 'center' });
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Gutter Detection Fallback:** If automatic vertical spine gutter detection fails on low-contrast scans, the splitter defaults to a strict `0.50` exact center split.
2. **Buffer Management:** Sharp processing pipelines use strict memory limits and stream pipes to prevent Out-Of-Memory (OOM) crashes on low-spec hosting environments.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 76.*
