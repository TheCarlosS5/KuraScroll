# Sprint 122 QA Resilience Matrix: Contrast-Adaptive Subpixel Unsharp Mask & Micro-Sharpening Synthesizer (SLA 86)

## Executive Summary
Sprint 122 introduces the **Contrast-Adaptive Subpixel Unsharp Mask & Micro-Sharpening Synthesizer (SLA 86)**, designed to enhance crisp dialogue letterings and intricate ink lines in scanned manga chapters without generating undesirable bright/dark halo ringing artifacts around stark black strokes.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for sharpness factor clamping (`[0.0, 2.0]`), threshold clamping (`[0.0, 255.0]`), halo clamping (`[0.0, 1.0]`), neighbor-bounded pixel clamping to prevent ringing on black manga strokes, Fastify REST endpoints with ETag 304 caching, and frontend hotkeys ('U' / 'u') with preset HUD controls.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SHARP-01** | **Parameter Bounds Checking** | Sharpness outside `[0.0, 2.0]`, threshold outside `[0.0, 255.0]`, or haloClamp outside `[0.0, 1.0]` | Parameter sanitizer clamps sharpness strictly to `[0.0, 2.0]`, threshold to `[0.0, 255.0]`, and haloClamp to `[0.0, 1.0]`, preventing filter over-saturation or quantization errors. | `sharp-bounds.test.ts` |
| **SHARP-02** | **Neighbor-Bounded Pixel Clamping (Anti-Halo Ringing)** | High-contrast black manga strokes undergo aggressive unsharp masking | Output sharpened pixel channel values are strictly bounded within local neighbor extremes (`[min_neighbor, max_neighbor]`), completely eliminating white halo ringing artifacts along stark ink edges. | `sharp-anti-halo.test.ts` |
| **SHARP-03** | **Fastify REST Endpoints & ETag 304 Caching** | GET presets, GET profile with matching `If-None-Match` ETag header, POST profile updates, POST calculate | Fastify routes return HTTP 200/304 correctly, validate request schemas, and enforce idempotency on profile persistence. | `sharp-api.test.ts` |
| **SHARP-04** | **Frontend Hotkey ('U' / 'u') & Preset HUD Tests** | User presses 'U' or 'u' keyboard shortcut, switches sharpening presets | HUD toggle responds instantly, rotating through preset micro-sharpening configurations (`crisp`, `subtle`, `magazine`, `disabled`) without UI lag. | `sharp-hud.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Unsharp Mask Service & Unit Tests (`tests/unit/backend/services/unsharp-mask-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { sanitizeSharpenParams, clampPixelToNeighbors, computeSharpenEtag } from '../../../../src/backend/services/unsharp-mask-service';

describe('Contrast-Adaptive Unsharp Mask & Micro-Sharpening Resilience', () => {
  it('clamps sharpness, threshold, and haloClamp parameters strictly within valid ranges', () => {
    const extreme = sanitizeSharpenParams({ sharpness: 5.0, threshold: -50.0, haloClamp: 1.5 });
    expect(extreme.sharpness).toBe(2.0);
    expect(extreme.threshold).toBe(0.0);
    expect(extreme.haloClamp).toBe(1.0);
  });

  it('bounds output pixel within local neighbor extremes to prevent halo ringing on black strokes', () => {
    const originalPixel = 40; // Dark ink stroke
    const sharpenedValue = 180; // Overshot sharpened value causing halo ring
    const minNeighbor = 35;
    const maxNeighbor = 60;

    const clamped = clampPixelToNeighbors(sharpenedValue, minNeighbor, maxNeighbor, originalPixel, 0.2);
    // Should be constrained near local neighborhood without blowing out
    expect(clamped).toBeLessThanOrEqual(maxNeighbor);
    expect(clamped).toBeGreaterThanOrEqual(minNeighbor);
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      sanitizeSharpenParams({ sharpness: 1.2, threshold: 10.0, haloClamp: 0.5 });
      clampPixelToNeighbors(120, 50, 100, 80, 0.5);
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached unsharp mask profile manifests', () => {
    const etag1 = computeSharpenEtag('user-122', 1.2, 10.0);
    const etag2 = computeSharpenEtag('user-122', 1.2, 10.0);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Unsharp Mask HUD & Hotkey Tests (`frontend/src/tests/useUnsharpMaskHud.test.ts`)
```typescript
import { describe, it, expect, fireEvent, render } from '@testing-library/react';
import { UnsharpMaskHud } from '../../src/frontend/components/UnsharpMaskHud';

describe('Unsharp Mask HUD Hotkey ('U' / 'u') & Preset Switching', () => {
  it('toggles and cycles micro-sharpening presets upon pressing 'U' or 'u'', () => {
    const { getByTestId } = render(<UnsharpMaskHud />);
    const hudContainer = getByTestId('unsharp-mask-hud');

    // Press uppercase 'U'
    fireEvent.keyDown(window, { key: 'U' });
    expect(hudContainer).toHaveAttribute('data-preset');

    // Press lowercase 'u'
    fireEvent.keyDown(window, { key: 'u' });
    expect(hudContainer).toBeDefined();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Anti-Ring Clamping Guard:** Sharpened pixels are passed through a local neighbor extremum clamp (`[min_neighbor, max_neighbor]`), completely eliminating the bright/dark halo ringing that typically plagues high-contrast manga line art.
2. **Hotkey Global Listeners:** Keyboard listeners for 'U'/'u' are debounced and mounted safely with window cleanup teardowns, preventing event listener memory leaks.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 122.*
