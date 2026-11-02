# Sprint 80 QA Resilience Matrix: Adaptive Ambient Lighting & Reactive Backlight Engine

## Executive Summary
Sprint 80 introduces the **Adaptive Ambient Lighting & Reactive Backlight Engine**, designed to synchronize reader background glow and color temperature (Kelvin) with the dominant color palette of the active manga panel, while integrating circadian rhythm scheduling and blue-light reduction filters without overloading low-spec hardware (Intel Pentium T4500, Intel GMA 4500MHD).

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for out-of-bounds Kelvin values, luminance targets, blue light reduction ratios, ETag 304 caching, and 24-hour circadian time boundary calculations.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **BKL-01** | **Out-of-Bounds Kelvin Values** | Requested color temperature outside standard bounds (`-500K`, `0K`, `100K`, `15000K`) | Backlight service clamps Kelvin values strictly to the safe range `[1800K, 6500K]` to prevent color distortion and shader errors. | `backlight-kelvin.test.ts` |
| **BKL-02** | **Luminance Target Edge Cases** | Target luminance factor set to extreme values (`0`, `-1.0`, `5.0`) | Luminance factor is clamped strictly to `[0.3, 1.5]`, preventing pure black blinding or blown-out white halos. | `backlight-luminance.test.ts` |
| **BKL-03** | **Blue Light Reduction Ratio Boundaries** | Blue-light filter ratio requested below `0.0` or above `1.0` (`-0.5`, `1.8`) | Reduction ratio is clamped strictly to `[0.0, 0.8]`, preserving comfortable warmth without total blue-channel annihilation. | `backlight-bluelight.test.ts` |
| **BKL-04** | **Circadian Auto-Time Boundaries** | System clock evaluated at critical circadian hours (`00:00` midnight, `06:00` dawn, `12:00` noon, `18:00` dusk, `03:00` late night) | Circadian scheduler calculates appropriate color temperature curves and blue light levels corresponding to natural solar positioning. | `backlight-circadian.test.ts` |
| **BKL-05** | **ETag HTTP 304 Verification** | Client requests backlight profile config with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant server-side color extraction calculations. | `backlight-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Backlight Service & Clamping Unit Tests (`tests/unit/backend/services/backlight-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { clampKelvin, clampLuminance, clampBlueLightRatio, calculateCircadianTemperature, computeBacklightEtag } from '../../../../src/backend/services/backlight-service';

describe('Adaptive Ambient Backlight Engine Resilience & Clamping', () => {
  it('clamps out-of-bounds Kelvin values to [1800, 6500]', () => {
    expect(clampKelvin(-500)).toBe(1800);
    expect(clampKelvin(0)).toBe(1800);
    expect(clampKelvin(100)).toBe(1800);
    expect(clampKelvin(15000)).toBe(6500);
    expect(clampKelvin(4500)).toBe(4500);
  });

  it('clamps luminance target edge cases to [0.3, 1.5]', () => {
    expect(clampLuminance(0)).toBe(0.3);
    expect(clampLuminance(-1.0)).toBe(0.3);
    expect(clampLuminance(5.0)).toBe(1.5);
    expect(clampLuminance(0.8)).toBe(0.8);
  });

  it('clamps blue light reduction ratios to [0.0, 0.8]', () => {
    expect(clampBlueLightRatio(-0.5)).toBe(0.0);
    expect(clampBlueLightRatio(1.8)).toBe(0.8);
    expect(clampBlueLightRatio(0.4)).toBe(0.4);
  });

  it('calculates correct circadian color temperatures across 24-hour boundaries', () => {
    expect(calculateCircadianTemperature(12, 0)).toBe(6500); // Noon: Cool daylight
    expect(calculateCircadianTemperature(18, 0)).toBe(3500); // Dusk: Warm sunset
    expect(calculateCircadianTemperature(0, 0)).toBe(1800);  // Midnight: Deep amber night mode
    expect(calculateCircadianTemperature(6, 0)).toBe(4000);  // Dawn: Morning light
  });

  it('generates deterministic ETags for cached backlight configuration profiles', () => {
    const etag1 = computeBacklightEtag(4500, 1.0, 0.2);
    const etag2 = computeBacklightEtag(4500, 1.0, 0.2);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Backlight Hook Tests (`frontend/src/tests/useAmbientBacklight.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmbientBacklight } from '../hooks/useAmbientBacklight';

describe('useAmbientBacklight Hardware & Performance Guard', () => {
  it('respects low-spec hardware constraints (Intel GMA 4500MHD) by simplifying glow filters', () => {
    const { result } = renderHook(() => useAmbientBacklight({ hardwareTier: 'low-spec' }));
    expect(result.current.renderMode).toBe('css-solid-glow'); // Bypasses heavy blur/radial gradients
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Hardware Degradation Shield:** On legacy hardware like the Intel Pentium T4500 and GMA 4500MHD, heavy multi-point radial CSS glow filters are disabled in favor of a single solid ambient background tint, maintaining stable 60 FPS scrolling.
2. **Circadian Clock Fallback:** If system clock synchronization fails or returns invalid time zone data, the backlight defaults to a neutral indoor lighting profile (4500K).

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 80.*
