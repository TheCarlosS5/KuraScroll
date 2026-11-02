# Sprint 84 QA Resilience Matrix: SmartCrop Auto-Framing & Border Removal Engine

## Executive Summary
Sprint 84 introduces the **SmartCrop Auto-Framing & Border Removal Engine**, designed to automatically detect and crop physical page borders, scan artifacts, and excess margins from manga chapters to maximize reading space on smaller screens and mobile devices.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for SmartCrop Fastify endpoints, all-white/all-black page fallbacks, negative/inverted bounding boxes, extreme aspect ratio overflows, concurrency/idempotency, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **CROP-01** | **All-White / All-Black Pages (Zero Content)** | Scanned page consists entirely of white margins or pure black background without panel boundaries | SmartCrop detector detects zero valid content variance, gracefully falling back to full uncropped page dimensions (`0, 0, width, height`). | `smart-crop-zero.test.ts` |
| **CROP-02** | **Inverted / Negative Bounding Boxes** | Calculated bounding box returns inverted coordinates (`minX > maxX` or `minY > maxY`) | Validation guard detects spatial inversion, auto-corrects or rejects the bounding box, and falls back to safe default margins. | `smart-crop-bounds.test.ts` |
| **CROP-03** | **Extreme Aspect Ratio Overflow** | Crop calculation produces width/height dimensions exceeding actual page boundaries (`width > pageWidth`) | Dimensions are clamped strictly within `[0, pageWidth]` and `[0, pageHeight]`, preventing layout clipping and rendering overflows. | `smart-crop-overflow.test.ts` |
| **CROP-04** | **Concurrency & Idempotency** | Simultaneous duplicate `POST /profile` submissions or crop calculation requests | Fastify idempotency middleware and database transactions guarantee idempotent persistence without duplicate row creation or race conditions. | `smart-crop-concurrency.test.ts` |
| **CROP-05** | **ETag 304 Caching (`GET /profile/:seriesId`)** | Client requests smart-crop profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant database queries. | `smart-crop-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify SmartCrop Service & Clamping Unit Tests (`tests/unit/backend/services/smart-crop-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeCropBox, handleZeroContentPage, calculateSmartCropBox, computeCropEtag } from '../../../../src/backend/services/smart-crop-service';

describe('SmartCrop Auto-Framing Engine Resilience & Clamping', () => {
  it('falls back to full uncropped dimensions on all-white or all-black pages', () => {
    const pageDims = { width: 1200, height: 1800 };
    const result = handleZeroContentPage(pageDims, 'all-white');

    expect(result).toEqual({ x: 0, y: 0, width: 1200, height: 1800, marginSavedPercent: 0 });
  });

  it('corrects inverted or negative bounding boxes (minX > maxX)', () => {
    const invertedBox = { minX: 800, maxX: 200, minY: 1500, maxY: 300 };
    const sanitized = sanitizeCropBox(invertedBox, { width: 1000, height: 1500 });

    expect(sanitized.minX).toBeLessThanOrEqual(sanitized.maxX);
    expect(sanitized.minY).toBeLessThanOrEqual(sanitized.maxY);
  });

  it('clamps extreme aspect ratio dimensions within page boundaries', () => {
    const overflowBox = { minX: -50, maxX: 1500, minY: 0, maxY: 2500 };
    const sanitized = sanitizeCropBox(overflowBox, { width: 1000, height: 1500 });

    expect(sanitized.maxX).toBe(1000);
    expect(sanitized.maxY).toBe(1500);
    expect(sanitized.minX).toBe(0);
  });

  it('generates deterministic ETags for cached smart-crop profiles', () => {
    const etag1 = computeCropEtag('series-999', 'dialogue_safe');
    const etag2 = computeCropEtag('series-999', 'dialogue_safe');
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend SmartCrop Hook Tests (`frontend/src/tests/useSmartCrop.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSmartCrop } from '../hooks/useSmartCrop';

describe('useSmartCrop Idempotency & Error Recovery', () => {
  it('gracefully handles cropping failures without interrupting reader flow', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('SmartCrop service unavailable'));

    const { result } = renderHook(() => useSmartCrop({ seriesId: 's-1' }));

    await act(async () => {
      await result.current.requestCrop('ch-1', 1);
    });

    expect(result.current.isCropped).toBe(false);
    expect(result.current.error).toBeNull(); // Suppressed for seamless fallback to uncropped
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Zero-Content Fallback:** If image histogram analysis detects uniform white or black pixels across 98%+ of the page surface, SmartCrop bypasses boundary cropping to prevent cutting off minimalist art or splash pages.
2. **Idempotency Safeguards:** Fastify endpoints enforce request fingerprinting so concurrent duplicate crop calculations are deduplicated at the controller layer.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 84.*
