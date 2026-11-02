# Sprint 82 QA Resilience Matrix: Binaural Page Rustle & Tactile Leaf Turn Acoustics Engine

## Executive Summary
Sprint 82 introduces the **Binaural Page Rustle & Tactile Leaf Turn Acoustics Engine**, delivering immersive spatial audio sound effects and synchronized haptic feedback whenever a reader turns a page or flips spreads in KuraScroll.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for volume clamping (`[0.0, 1.0]`) with NaN/Infinity guards, haptic intensity clamping, paper substrate fallbacks, stereo panning boundary calculations (RTL vs. LTR), and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **ACU-01** | **Volume Clamping & NaN/Infinity Guards** | Volume parameter passed as `NaN`, `Infinity`, `-2.0`, or `3.5` | Acoustics service sanitizes input, applying strict `[0.0, 1.0]` clamping and falling back to `1.0` on invalid numeric types. | `acoustics-volume.test.ts` |
| **ACU-02** | **Haptic Intensity Clamping** | Haptic rumble strength requested outside bounds (`-0.5`, `2.0`) | Haptic intensity is clamped strictly to `[0.0, 1.0]`, preventing hardware vibration actuator overload. | `acoustics-haptics.test.ts` |
| **ACU-03** | **Invalid Paper Substrate Fallback** | Unknown or corrupted paper texture enum (`substrate = "plastic_wrap"`) | Service gracefully falls back to default `'tankobon'` paper rustle audio samples without throwing audio decode errors. | `acoustics-substrate.test.ts` |
| **ACU-04** | **Stereo Panning Boundary (RTL vs LTR)** | Page turn direction triggered in RTL (`manga-rtl`) vs LTR (`webtoon` / `comic-ltr`) | Stereo panner node dynamically positions audio source from right-to-left (-1.0 to +1.0) or left-to-right (+1.0 to -1.0) matching physical flip vector. | `acoustics-panning.test.ts` |
| **ACU-05** | **ETag HTTP 304 Verification** | Client requests page turn audio sample manifest with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant server-side audio buffer serialization. | `acoustics-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Acoustics Service & Clamping Unit Tests (`tests/unit/backend/services/acoustics-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { clampVolume, clampHapticIntensity, sanitizePaperSubstrate, calculateStereoPan, computeAcousticsEtag } from '../../../../src/backend/services/acoustics-service';

describe('Binaural Page Acoustics Engine Resilience & Clamping', () => {
  it('clamps volume levels to [0.0, 1.0] and guards against NaN/Infinity', () => {
    expect(clampVolume(NaN)).toBe(1.0);
    expect(clampVolume(Infinity)).toBe(1.0);
    expect(clampVolume(-2.5)).toBe(0.0);
    expect(clampVolume(5.0)).toBe(1.0);
    expect(clampVolume(0.75)).toBe(0.75);
  });

  it('clamps haptic intensity to [0.0, 1.0]', () => {
    expect(clampHapticIntensity(-0.5)).toBe(0.0);
    expect(clampHapticIntensity(2.0)).toBe(1.0);
    expect(clampHapticIntensity(0.5)).toBe(0.5);
  });

  it('falls back to "tankobon" on invalid paper substrate enums', () => {
    expect(sanitizePaperSubstrate('newsprint')).toBe('newsprint');
    expect(sanitizePaperSubstrate('glossy')).toBe('glossy');
    expect(sanitizePaperSubstrate('plastic_wrap')).toBe('tankobon');
    expect(sanitizePaperSubstrate(null)).toBe('tankobon');
  });

  it('calculates stereo panning correctly for RTL vs LTR reading directions', () => {
    expect(calculateStereoPan('manga-rtl', 'next')).toBe(-0.8); // Sweeps right to left
    expect(calculateStereoPan('comic-ltr', 'next')).toBe(0.8);  // Sweeps left to right
  });

  it('generates deterministic ETags for cached audio sample manifests', () => {
    const etag1 = computeAcousticsEtag('tankobon', 0.8);
    const etag2 = computeAcousticsEtag('tankobon', 0.8);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Acoustics Hook Tests (`frontend/src/tests/usePageAcoustics.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageAcoustics } from '../hooks/usePageAcoustics';

describe('usePageAcoustics Hardware & Performance Guard', () => {
  it('respects low-spec hardware (Intel Pentium T4500) by disabling binaural HRTF convolutions', () => {
    const { result } = renderHook(() => usePageAcoustics({ hardwareTier: 'low-spec' }));
    expect(result.current.useHrtf).toBe(false); // Falls back to basic stereo panning
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Audio Context Fallback:** If `AudioContext` fails to initialize or is blocked by browser policies, page turn acoustics fail silently in the background without interrupting the reader's visual progression.
2. **Memory Safety:** Decoded audio buffer caches are bounded to 15 items using an LRU eviction policy to protect constrained V8 heap allocations.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 82.*
