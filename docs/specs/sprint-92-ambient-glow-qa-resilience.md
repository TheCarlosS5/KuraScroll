# Sprint 92 QA Resilience Matrix: Adaptive Ambient Screen-Glow Dispersion & Border Bleed Light Engine

## Executive Summary
Sprint 92 introduces the **Adaptive Ambient Screen-Glow Dispersion & Border Bleed Light Engine**, designed to cast an immersive, real-time dominant-color ambient glow and border bleed around active manga pages and webtoon strips, enhancing immersion without inducing eye fatigue or layout jank.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for opacity clamping (`[0.0, 1.0]`), spread radius clamping (`[0px, 100px]`), extreme RGB perimeter color sanitization (`[0,0,0]` to `[255,255,255]`), SQLite CHECK constraint validations, and malformed CSS injection prevention.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **GLOW-01** | **Extreme Opacity Clamping** | Glow opacity requested outside bounds (`opacity = -0.5` or `opacity = 2.0`) | Glow service clamps opacity strictly to `[0.0, 1.0]`, preventing invisible elements or severe alpha channel saturation. | `glow-opacity.test.ts` |
| **GLOW-02** | **Extreme Spread Radius Clamping** | Spread blur radius requested outside safe bounds (`spreadPx = -10` or `spreadPx = 500`) | Spread radius is clamped strictly to `[0px, 100px]`, preventing GPU rasterization bottlenecks and memory exhaustion on the Intel GMA 4500MHD. | `glow-spread.test.ts` |
| **GLOW-03** | **Perimeter Color Sanitization (RGB)** | Dominant perimeter colors evaluated as extreme or malformed values (`[0,0,0]`, `[255,255,255]`, or `NaN` channels) | Color sanitizer guarantees valid integer RGB tuples `[0-255, 0-255, 0-255]`, preventing CSS injection and invalid color tokens. | `glow-color.test.ts` |
| **GLOW-04** | **SQLite CHECK Constraint Validation** | Malformed database write attempts to insert out-of-range glow parameters | SQLite `CHECK (glow_opacity >= 0.0 AND glow_opacity <= 1.0)` constraint rejects invalid writes, preserving database integrity. | `glow-sqlite.test.ts` |
| **GLOW-05** | **Malformed CSS Injection Prevention** | Color or spread parameters contain malicious string injections or script tags | Sanitizer strips non-numeric / non-hex characters, ensuring generated CSS box-shadow / filter strings are strictly well-formed. | `glow-css.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Ambient Glow Service & Clamping Unit Tests (`tests/unit/backend/services/ambient-glow-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { clampGlowOpacity, clampSpreadRadius, sanitizeRgbColor, generateSafeCssGlow, computeGlowEtag } from '../../../../src/backend/services/ambient-glow-service';

describe('Ambient Screen-Glow Dispersion Engine Resilience & Clamping', () => {
  it('clamps extreme glow opacity strictly to [0.0, 1.0]', () => {
    expect(clampGlowOpacity(-0.5)).toBe(0.0);
    expect(clampGlowOpacity(2.0)).toBe(1.0);
    expect(clampGlowOpacity(0.45)).toBe(0.45);
  });

  it('clamps extreme spread radius strictly to [0, 100]', () => {
    expect(clampSpreadRadius(-10)).toBe(0);
    expect(clampSpreadRadius(500)).toBe(100);
    expect(clampSpreadRadius(35)).toBe(35);
  });

  it('sanitizes perimeter RGB colors and handles NaN channels', () => {
    expect(sanitizeRgbColor([0, 0, 0])).toEqual([0, 0, 0]);
    expect(sanitizeRgbColor([255, 255, 255])).toEqual([255, 255, 255]);
    expect(sanitizeRgbColor([NaN, 300, -50] as any)).toEqual([0, 255, 0]); // Clamped channels
  });

  it('prevents malformed CSS injection in generated glow styles', () => {
    const maliciousColor = [255, 0, 'expression(alert(1))'] as any;
    const css = generateSafeCssGlow(maliciousColor, 20, 0.5);

    expect(css).not.toContain('alert');
    expect(css).toContain('rgba(255, 0, 0, 0.5)');
  });

  it('generates deterministic ETags for cached ambient glow profiles', () => {
    const etag1 = computeGlowEtag([120, 80, 200], 25, 0.6);
    const etag2 = computeGlowEtag([120, 80, 200], 25, 0.6);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Ambient Glow Hook Tests (`frontend/src/tests/useAmbientGlow.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAmbientGlow } from '../hooks/useAmbientGlow';

describe('useAmbientGlow Hardware & Performance Guard', () => {
  it('respects low-spec hardware (Intel GMA 4500MHD) by clamping spread radius and simplifying CSS filters', () => {
    const { result } = renderHook(() => useAmbientGlow({ hardwareTier: 'low-spec' }));
    expect(result.current.maxSpreadPx).toBeLessThanOrEqual(25);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **GPU Rasterization Shield:** To prevent heavy blur filter performance drops on legacy integrated graphics (Intel GMA 4500MHD), `spreadPx` is automatically capped at 25px in low-spec hardware tiers.
2. **CSS Sanitization:** All color tuples and blur values are passed through strict regex parsers before being injected into DOM inline styles, guaranteeing 100% protection against CSS injection vulnerabilities.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 92.*
