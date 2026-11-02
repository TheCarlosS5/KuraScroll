# Sprint 89 QA Resilience Matrix: Adaptive Contrast Dynamic Range & HDR Tone-Mapping Engine

## Executive Summary
Sprint 89 introduces the **Adaptive Contrast Dynamic Range & HDR Tone-Mapping Engine**, designed to optimize visual contrast, shadow details, and highlight roll-off across scanned manga panels in varying ambient lighting environments without overloading legacy hardware (Intel Pentium T4500, Intel GMA 4500MHD).

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for extreme gamma bounds clamping (`[0.50, 2.50]`), black lift clamping (`[0.0, 0.25]`), white point compression clamping (`[0.70, 1.00]`), unsupported ambient mode fallbacks, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **TONE-01** | **Extreme Gamma Bounds Clamping** | Gamma correction requested outside safe range (`gamma = 0.2` or `gamma = 4.0`) | Tone-mapping service clamps gamma strictly to `[0.50, 2.50]`, preventing extreme image washout or total shadow crushing. | `tone-gamma.test.ts` |
| **TONE-02** | **Black Lift Bounds Clamping** | Black lift offset requested outside safe range (`black_lift = -0.1` or `black_lift = 0.6`) | Black lift factor is clamped strictly to `[0.0, 0.25]`, preserving deep ink contrast without milky gray backgrounds. | `tone-black-lift.test.ts` |
| **TONE-03** | **White Point Compression Bounds** | White point compression requested outside safe range (`white_point = 0.4` or `white_point = 1.3`) | White point compression is clamped strictly to `[0.70, 1.00]`, preventing harsh highlight blowout on scanned paper gutters. | `tone-white-point.test.ts` |
| **TONE-04** | **Unsupported Ambient Mode Fallback** | Unknown or corrupted ambient lighting mode (`ambient = "neon_cyberpunk"`) | Tone engine gracefully falls back to default `'cinema_night'` tone curve without throwing rendering pipeline errors. | `tone-ambient-fallback.test.ts` |
| **TONE-05** | **ETag 304 Caching Verification** | Client requests tone-mapping profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant tone-curve LUT calculations. | `tone-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Tone-Mapping Service & Clamping Unit Tests (`tests/unit/backend/services/tone-mapping-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { clampGamma, clampBlackLift, clampWhitePoint, sanitizeAmbientMode, computeToneEtag } from '../../../../src/backend/services/tone-mapping-service';

describe('Adaptive Contrast Tone-Mapping Engine Resilience & Clamping', () => {
  it('clamps extreme gamma bounds strictly to [0.50, 2.50]', () => {
    expect(clampGamma(0.2)).toBe(0.50);
    expect(clampGamma(4.0)).toBe(2.50);
    expect(clampGamma(1.2)).toBe(1.2);
  });

  it('clamps black lift bounds strictly to [0.0, 0.25]', () => {
    expect(clampBlackLift(-0.1)).toBe(0.0);
    expect(clampBlackLift(0.6)).toBe(0.25);
    expect(clampBlackLift(0.12)).toBe(0.12);
  });

  it('clamps white point compression bounds strictly to [0.70, 1.00]', () => {
    expect(clampWhitePoint(0.4)).toBe(0.70);
    expect(clampWhitePoint(1.3)).toBe(1.00);
    expect(clampWhitePoint(0.90)).toBe(0.90);
  });

  it('falls back to "cinema_night" on unsupported ambient lighting modes', () => {
    expect(sanitizeAmbientMode('daylight')).toBe('daylight');
    expect(sanitizeAmbientMode('oled_dark')).toBe('oled_dark');
    expect(sanitizeAmbientMode('neon_cyberpunk')).toBe('cinema_night');
    expect(sanitizeAmbientMode(null)).toBe('cinema_night');
  });

  it('generates deterministic ETags for cached tone-mapping configuration profiles', () => {
    const etag1 = computeToneEtag(1.2, 0.05, 0.95);
    const etag2 = computeToneEtag(1.2, 0.05, 0.95);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Tone-Mapping Hook Tests (`frontend/src/tests/useToneMapping.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToneMapping } from '../hooks/useToneMapping';

describe('useToneMapping Hardware & Performance Guard', () => {
  it('respects low-spec hardware (Intel GMA 4500MHD) by using simplified CSS filter approximation', () => {
    const { result } = renderHook(() => useToneMapping({ hardwareTier: 'low-spec' }));
    expect(result.current.shaderMode).toBe('css-filter-approximation'); // Avoids heavy WebGL fragment shaders
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Shader Pipeline Fallback:** On legacy GPUs lacking advanced fragment shader support (Intel GMA 4500MHD), complex HDR tone-mapping curves fall back to equivalent CSS brightness/contrast adjustments.
2. **Parameter Sanitization:** Incoming profile configurations containing `NaN` or `Infinity` are automatically scrubbed and reset to standard neutral defaults (`gamma: 1.0`, `black_lift: 0.0`, `white_point: 1.0`).

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 89.*
