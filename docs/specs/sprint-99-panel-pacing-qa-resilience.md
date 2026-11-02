# Sprint 99 QA Resilience Matrix: Adaptive Per-Panel Visual Pacing & Dynamic Zoom Framing Interpolator (SLA 63)

## Executive Summary
Sprint 99 introduces the **Adaptive Per-Panel Visual Pacing & Dynamic Zoom Framing Interpolator (SLA 63)**, responsible for smoothly interpolating viewport camera position and zoom scale between consecutive manga panels (AABB to AABB), supporting dynamic pacing, motion reduction accessibility compliance (`is_motion_reduced = 1`), and ultra-narrow split-screen viewports.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for collapsed/zero-dimension AABBs, ultra-narrow viewports, progress clamping (`[0.0, 1.0]`), reduced-motion instant transitions, Fastify idempotency, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **PACE-01** | **Collapsed / Zero-Dimension AABBs** | Source or target bounding box contains non-positive width or height (`width <= 0` or `height <= 0`) | Interpolator catches invalid AABB bounds, falling back to full-page viewport coordinates without throwing division-by-zero errors. | `pace-aabb.test.ts` |
| **PACE-02** | **Ultra-Narrow / Split-Screen Viewports** | Viewport width/height is extremely narrow (e.g. mobile foldable or split-screen `width = 320px`, `height = 900px`) | Framing engine scales pan/zoom matrix proportionally to fit container aspect ratio without clipping panel art. | `pace-viewport.test.ts` |
| **PACE-03** | **Progress Out-of-Range Clamping** | Animation progress passed outside bounds (`progress = -0.4` or `progress = 1.6`) | Progress factor is clamped strictly to `[0.0, 1.0]`, preventing matrix overshooting and coordinate inversion. | `pace-progress.test.ts` |
| **PACE-04** | **Motion Reduction Compliance (`is_motion_reduced = 1`)** | User or system preference enables reduced motion | Framing engine bypasses spring-physics overshoot and camera easing, applying an instant or direct linear cut. | `pace-motion-reduced.test.ts` |
| **PACE-05** | **Fastify Idempotency & ETag 304 Caching** | Simultaneous duplicate profile updates and requests with matching `If-None-Match` ETag header | Fastify middleware guarantees idempotency; server responds with HTTP 304 Not Modified for unchanged pacing profiles. | `pace-etag-idempotency.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Panel Pacing Service & Unit Tests (`tests/unit/backend/services/panel-pacing-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeAabb, clampInterpolationProgress, calculateFramingMatrix, computePacingEtag } from '../../../../src/backend/services/panel-pacing-service';

describe('Panel Pacing & Zoom Interpolator Resilience & Clamping', () => {
  it('falls back safely when source or target AABBs have zero or negative dimensions', () => {
    const invalidAabb = { x: 0, y: 0, width: 0, height: -100 };
    const validFallback = { width: 800, height: 1200 };
    const sanitized = sanitizeAabb(invalidAabb, validFallback);

    expect(sanitized.width).toBe(800);
    expect(sanitized.height).toBe(1200);
  });

  it('clamps interpolation progress strictly to [0.0, 1.0]', () => {
    expect(clampInterpolationProgress(-0.4)).toBe(0.0);
    expect(clampInterpolationProgress(1.6)).toBe(1.0);
    expect(clampInterpolationProgress(0.75)).toBe(0.75);
  });

  it('bypasses camera overshoot and applies linear cut when is_motion_reduced = 1', () => {
    const source = { x: 0, y: 0, width: 800, height: 1200 };
    const target = { x: 100, y: 200, width: 400, height: 600 };
    const frameReduced = calculateFramingMatrix(source, target, 0.5, { isMotionReduced: true });
    const frameStandard = calculateFramingMatrix(source, target, 0.5, { isMotionReduced: false });

    expect(frameReduced.hasOvershoot).toBe(false);
    expect(frameStandard.hasOvershoot).toBe(true);
  });

  it('generates deterministic ETags for cached panel pacing profiles', () => {
    const etag1 = computePacingEtag('series-pacing-1', 1.2);
    const etag2 = computePacingEtag('series-pacing-1', 1.2);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Panel Pacing Hook Tests (`frontend/src/tests/usePanelPacing.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePanelPacing } from '../hooks/usePanelPacing';

describe('usePanelPacing Reduced Motion & Narrow Viewport Guard', () => {
  it('forces linear cut when motion reduction is enabled', () => {
    const { result } = renderHook(() => usePanelPacing({ isMotionReduced: true }));
    expect(result.current.easingMode).toBe('linear-cut');
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **AABB Sanitization:** Bounding box calculations validate `width > 0 && height > 0` before matrix math, preventing catastrophic layout collapse on malformed panel metadata.
2. **Accessibility Compliance:** When `is_motion_reduced = 1`, all spring-damper camera physics are suppressed in favor of instant snap cuts, preventing vestibular trigger issues for sensitive readers.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 99.*
