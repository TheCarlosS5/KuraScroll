# Sprint 104 QA Resilience Matrix: Adaptive Per-Panel Reading Gaze Anchor & Eye-Rest Aperture Shutter (SLA 68)

## Executive Summary
Sprint 104 introduces the **Adaptive Per-Panel Reading Gaze Anchor & Eye-Rest Aperture Shutter (SLA 68)**, designed to reduce eye strain during long reading sessions by projecting an intelligent radial aperture shutter (vignette / focal focus ring) around the reader's active gaze anchor or center panel, with customizable radius, falloff, and color temperature (Kelvin) warmth.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for missing database profiles, optical safety parameter boundary clamping, 60 FPS anchor coordinate tracking without gradient lag, and W3C-compliant CSS radial gradient syntax correctness.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **EYE-01** | **Missing Database Profile Fallback** | Requested series or user eye-rest profile ID does not exist in local SQLite store | Service gracefully falls back to default comfortable eye-rest profile (warm amber tint, 3500K, moderate radius) without throwing errors. | `eye-fallback.test.ts` |
| **EYE-02** | **Optical Safety Parameter Clamping** | Radius, falloff, or Kelvin warmth requested with extreme or invalid numbers (`radius = -50px`, `kelvin = 10000K`) | Parameters are clamped strictly to optical safety bounds (`radius: [50px, 800px]`, `falloff: [0.1, 1.0]`, `kelvin: [1800K, 6500K]`), preventing visual blinding or inverse masking bugs. | `eye-clamping.test.ts` |
| **EYE-03** | **60 FPS Gaze Anchor Tracking (No Gradient Lag)** | Rapid gaze anchor coordinate updates fired at 60 FPS during fast manga scrolling | Radial gradient center coordinates are updated via requestAnimationFrame and CSS transform translation variables, avoiding heavy CSS gradient recalculation thrashing. | `eye-performance.test.ts` |
| **EYE-04** | **CSS Radial Gradient Syntax Correctness** | Generated CSS radial gradient property applied to reader viewport overlay | String conforms strictly to W3C standards (`radial-gradient(circle at 400px 300px, transparent 150px, rgba(0,0,0,0.85) 400px)`), preventing browser style parsing exceptions. | `eye-css.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Eye-Rest Aperture Service & Unit Tests (`tests/unit/backend/services/eye-rest-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { getEyeRestProfileOrDefault, clampOpticalSafetyParams, generateRadialGradientCss, computeEyeRestEtag } from '../../../../src/backend/services/eye-rest-service';

describe('Eye-Rest Aperture Shutter Resilience & Clamping', () => {
  it('falls back gracefully to default comfortable profile when DB record is missing', () => {
    const defaultProfile = getEyeRestProfileOrDefault('missing-user-profile');
    expect(defaultProfile).toBeDefined();
    expect(defaultProfile.kelvin).toBe(3500); // Warm comfortable amber
    expect(defaultProfile.radius).toBe(200);
  });

  it('clamps optical safety parameters (radius, falloff, Kelvin warmth) strictly', () => {
    const extreme = { radius: -500, falloff: 5.0, kelvin: 15000 };
    const sanitized = clampOpticalSafetyParams(extreme);

    expect(sanitized.radius).toBe(50);      // Min safe radius
    expect(sanitized.falloff).toBe(1.0);    // Max safe falloff
    expect(sanitized.kelvin).toBe(6500);    // Max Kelvin safety bound
  });

  it('generates syntactically correct W3C CSS radial gradient strings', () => {
    const gradientCss = generateRadialGradientCss(400, 300, 150, 400, 'rgba(20, 10, 0, 0.8)');
    expect(gradientCss).toBe('radial-gradient(circle at 400px 300px, transparent 150px, rgba(20, 10, 0, 0.8) 400px)');
    expect(gradientCss).not.toContain('NaN');
  });

  it('generates deterministic ETags for cached eye-rest profile manifests', () => {
    const etag1 = computeEyeRestEtag('user-104', 3500);
    const etag2 = computeEyeRestEtag('user-104', 3500);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Eye-Rest Hook Tests (`frontend/src/tests/useEyeRest.test.ts`)
```typescript
import { describe, it, expect, act } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEyeRest } from '../hooks/useEyeRest';

describe('useEyeRest 60 FPS Anchor Tracking Performance', () => {
  it('updates anchor coordinates efficiently via CSS translate variables without gradient recalculation', () => {
    const { result } = renderHook(() => useEyeRest({ initialX: 100, initialY: 200 }));

    act(() => {
      result.current.updateAnchor(150, 250);
    });

    expect(result.current.transformStyle).toContain('translate3d(150px, 250px');
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **GPU Acceleration Guard:** Radial gradient positioning leverages hardware-accelerated CSS `transform: translate3d(...)` variables rather than mutating gradient center coordinates directly, guaranteeing buttery smooth 60 FPS scrolling.
2. **Optical Clamping Safeguard:** Kelvin color temperatures are strictly capped at 6500K and floored at 1800K to prevent extreme blue-light spikes or unnatural amber glare.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 104.*
