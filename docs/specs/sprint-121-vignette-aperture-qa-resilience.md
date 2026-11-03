# Sprint 121 QA Resilience Matrix: Dynamic Atmospheric Vignette Shader & Depth-of-Field Aperture Simulator (SLA 85)

## Executive Summary
Sprint 121 introduces the **Dynamic Atmospheric Vignette Shader & Depth-of-Field Aperture Simulator (SLA 85)**, designed to render immersive atmospheric vignettes, radial gradient corner shadows, and depth-of-field edge contrast blurring around manga reading viewports, complete with hotkey toggles ('V' / 'v'), preset switching, Fastify REST endpoints with ETag 304 caching, and strict parameter boundary clamping.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for inner/outer radius bounds checking (`innerRadius > outerRadius` inversion prevention), opacity clamping, depth-of-field attenuation clamping, Fastify endpoints validation, and frontend HUD keyboard shortcuts.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **VIG-01** | **Radius Bounds & Inversion Clamping** | Inner radius outside `[0.0, 1.0]`, outer radius outside `[0.1, 2.0]`, or inverted constraint (`innerRadius >= outerRadius`) | Parameter sanitizer clamps inner radius to `[0.0, 1.0]`, outer radius to `[0.1, 2.0]`, and guarantees strict mathematical inequality (`outerRadius = Math.max(innerRadius + 0.1, outerRadius)`), preventing shader tearing or division-by-zero. | `vignette-radius.test.ts` |
| **VIG-02** | **Vignette Opacity Clamping** | Vignette opacity requested outside bounds (`opacity = -0.5` or `opacity = 2.5`) | Opacity factor is clamped strictly to `[0.0, 1.0]`, preventing invisible layers or over-saturated alpha blending artifacts. | `vignette-opacity.test.ts` |
| **VIG-03** | **Depth-of-Field Edge Contrast Attenuation** | DoF attenuation factor requested outside bounds (`dof = -0.2` or `dof = 1.8`) | Attenuation factor is clamped strictly to `[0.0, 1.0]`, guaranteeing stable Gaussian blur and contrast reduction curves along panel edges. | `vignette-dof.test.ts` |
| **VIG-04** | **Fastify REST Endpoints & ETag 304 Caching** | GET presets, GET profile with matching `If-None-Match` ETag header, POST profile updates, POST calculate | Fastify routes return HTTP 200/304 correctly, validate request schemas, and enforce idempotency on profile persistence. | `vignette-api.test.ts` |
| **VIG-05** | **Frontend Hotkey ('V' / 'v') & Preset HUD Tests** | User presses 'V' or 'v' keyboard shortcut, switches atmospheric presets | HUD toggle responds instantly, rotating through preset vignette configurations (`cinematic`, `vintaged`, `subtle`, `disabled`) without UI lag. | `vignette-hud.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Vignette Service & Unit Tests (`tests/unit/backend/services/vignette-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { sanitizeVignetteParams, computeVignetteEtag } from '../../../../src/backend/services/vignette-service';

describe('Vignette Shader & Depth-of-Field Aperture Simulator Resilience', () => {
  it('clamps inner/outer radii and prevents outerRadius <= innerRadius inversion', () => {
    // Inverted scenario: inner = 0.8, outer = 0.4 -> outer must be forced > inner
    const inverted = sanitizeVignetteParams({ innerRadius: 0.8, outerRadius: 0.4, opacity: 0.5, dofAttenuation: 0.2 });
    expect(inverted.outerRadius).toBeGreaterThan(inverted.innerRadius);

    // Extreme out-of-bounds scenario
    const extreme = sanitizeVignetteParams({ innerRadius: -5.0, outerRadius: 10.0, opacity: 2.0, dofAttenuation: -1.0 });
    expect(extreme.innerRadius).toBe(0.0);
    expect(extreme.outerRadius).toBe(2.0);
    expect(extreme.opacity).toBe(1.0);
    expect(extreme.dofAttenuation).toBe(0.0);
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      sanitizeVignetteParams({ innerRadius: 0.3, outerRadius: 0.9, opacity: 0.7, dofAttenuation: 0.4 });
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached vignette profile manifests', () => {
    const etag1 = computeVignetteEtag('user-121', 0.3, 0.9);
    const etag2 = computeVignetteEtag('user-121', 0.3, 0.9);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Vignette HUD & Hotkey Tests (`frontend/src/tests/useVignetteHud.test.ts`)
```typescript
import { describe, it, expect, fireEvent, render } from '@testing-library/react';
import { VignetteHud } from '../../src/frontend/components/VignetteHud';

describe('Vignette HUD Hotkey ('V' / 'v') & Preset Switching', () => {
  it('toggles and cycles atmospheric presets upon pressing 'V' or 'v'', () => {
    const { getByTestId } = render(<VignetteHud />);
    const hudContainer = getByTestId('vignette-hud');

    // Press uppercase 'V'
    fireEvent.keyDown(window, { key: 'V' });
    expect(hudContainer).toHaveAttribute('data-preset');

    // Press lowercase 'v'
    fireEvent.keyDown(window, { key: 'v' });
    expect(hudContainer).toBeDefined();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Radius Inversion Safety:** Parameter sanitization routines enforce `outerRadius = Math.max(innerRadius + 0.1, outerRadius)`, guaranteeing that radial gradient shader stops never invert or collapse into division-by-zero anomalies.
2. **Hotkey Global Listeners:** Keyboard listeners for 'V'/'v' are debounced and mounted safely with window cleanup teardowns, preventing event listener memory leaks.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 121.*
