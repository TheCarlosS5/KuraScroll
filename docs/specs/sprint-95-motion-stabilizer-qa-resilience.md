# Sprint 95 QA Resilience Matrix: Adaptive Peripheral In-Viewport Motion-Deblur & Micro-Pan Gesture Stabilizer (SLA 59)

## Executive Summary
Sprint 95 introduces the **Adaptive Peripheral In-Viewport Motion-Deblur & Micro-Pan Gesture Stabilizer (SLA 59)**, designed to eliminate sub-pixel motion jitter during high-velocity pan/flick gestures, protect against zero-delta division errors ($\Delta t \to 0$), clamp extreme touch velocities, and maintain rock-solid 60 FPS rendering on legacy hardware like the Intel GMA 4500MHD.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for touch/mouse gesture bursts (`> 5,000 px/s`), $\Delta t \to 0$ division-by-zero guards, Intel GMA 4500MHD performance optimizations, SQLite CHECK constraints, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **STAB-01** | **Ultra-High Velocity Bursts (> 5,000 px/s)** | Accidental touchpad multi-touch flicks or sensor spikes generating raw velocity of `12,000 px/s` | Gesture stabilizer clamps velocity magnitude strictly to `±3,500 px/s`, preventing runaway screen flying and jarring panel jumps. | `stabilizer-velocity.test.ts` |
| **STAB-02** | **Zero-Delta Division Guard ($\Delta t \to 0$)** | High-frequency mouse event listeners fire multiple events within the exact same clock tick (`deltaTimeMs = 0`) | Velocity calculation guards against division by zero, falling back to minimum safe delta (`16.67ms`) to prevent `NaN` layout coordinates. | `stabilizer-delta.test.ts` |
| **STAB-03** | **Intel GMA 4500MHD 60 FPS Preservation** | Rapid panning and kinetic micro-gestures executed on low-spec hardware | Heavy motion-deblur post-processing filters are automatically bypassed on low-spec tiers, ensuring stable 60 FPS rendering without micro-stutters. | `stabilizer-fps.test.ts` |
| **STAB-04** | **SQLite CHECK Constraint Validation** | Malformed database write attempts to insert out-of-range stabilizer smoothing factors | SQLite `CHECK (smoothing_factor >= 0.0 AND smoothing_factor <= 1.0)` constraint rejects invalid writes, preserving database integrity. | `stabilizer-sqlite.test.ts` |
| **STAB-05** | **ETag HTTP 304 Verification** | Client requests stabilizer configuration profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant server-side profile serialization. | `stabilizer-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Motion Stabilizer Service & Clamping Unit Tests (`tests/unit/backend/services/motion-stabilizer-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeDeltaTime, clampGestureVelocity, clampSmoothingFactor, computeStabilizerEtag } from '../../../../src/backend/services/motion-stabilizer-service';

describe('Motion Stabilizer Engine Resilience & Clamping', () => {
  it('guards against division by zero when deltaTimeMs approaches zero', () => {
    expect(sanitizeDeltaTime(0)).toBe(16.67);
    expect(sanitizeDeltaTime(-5)).toBe(16.67);
    expect(sanitizeDeltaTime(NaN)).toBe(16.67);
    expect(sanitizeDeltaTime(12.5)).toBe(12.5);
  });

  it('clamps ultra-high velocity bursts strictly to ±3500 px/s', () => {
    expect(clampGestureVelocity(15000)).toBe(3500);
    expect(clampGestureVelocity(-8000)).toBe(-3500);
    expect(clampGestureVelocity(1200)).toBe(1200);
  });

  it('clamps smoothing factors strictly to [0.0, 1.0]', () => {
    expect(clampSmoothingFactor(-0.2)).toBe(0.0);
    expect(clampSmoothingFactor(1.5)).toBe(1.0);
    expect(clampSmoothingFactor(0.75)).toBe(0.75);
  });

  it('generates deterministic ETags for cached motion stabilizer profiles', () => {
    const etag1 = computeStabilizerEtag(0.85, 3500);
    const etag2 = computeStabilizerEtag(0.85, 3500);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Gesture Stabilizer Hook Tests (`frontend/src/tests/useMotionStabilizer.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMotionStabilizer } from '../hooks/useMotionStabilizer';

describe('useMotionStabilizer Hardware & Performance Guard', () => {
  it('bypasses heavy motion-deblur filters on low-spec Intel GMA 4500MHD hardware', () => {
    const { result } = renderHook(() => useMotionStabilizer({ hardwareTier: 'low-spec' }));
    expect(result.current.enableDeblur).toBe(false);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Delta Time Guard:** Any gesture velocity calculation encountering $\Delta t \le 0$ immediately falls back to a standard 60 FPS frame interval (`16.67ms`), neutralizing potential `NaN` coordinate explosions.
2. **SQLite Integrity Protection:** Database tables enforce strict `CHECK` constraints on smoothing factors to ensure client configuration persistence remains immune to malformed inputs.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 95.*
