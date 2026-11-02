# Sprint 88 QA Resilience Matrix: Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller

## Executive Summary
Sprint 88 introduces the **Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller**, providing physics-based kinetic scrolling, momentum damping, velocity clamping (`3500px/s`), boundary resistance, and sub-threshold resting decay (`0.05px/s`) to ensure buttery smooth reading on low-spec hardware (Intel Pentium T4500, Intel GMA 4500MHD).

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for zero/negative time deltas, boundary clamping, extreme velocity spikes, CPU-saving rest decay, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **INS-01** | **Zero or Negative `deltaTimeMs`** | `requestAnimationFrame` delta time reports `0`, `-16ms`, or `NaN` | Physics step guards against division-by-zero, clamping delta time to a safe minimum (`16.67ms` or skipping frame step) to prevent NaN position jumps. | `inertial-delta.test.ts` |
| **INS-02** | **Boundary Bounce & Hard Clamping** | Momentum scroll flings past top (`pos < 0`) or bottom (`pos > maxScroll`) boundaries | Scroller clamps position strictly to `[0, maxScroll]`, suppressing elastic overscroll jitter on legacy GMA 4500MHD hardware. | `inertial-boundaries.test.ts` |
| **INS-03** | **Extreme Velocity Spikes** | User flick gesture generates raw velocity of `12,000 px/s` | Velocity magnitude is clamped strictly to `±3,500 px/s`, preventing uncontrolled page flying and rendering motion blur distortion. | `inertial-velocity.test.ts` |
| **INS-04** | **Sub-Threshold Resting Decay (Auto-Sleep)** | Momentum velocity drops below `0.05 px/s` | Physics animation loop enters idle sleep state (`isScrolling = false`), halting RAF ticks to conserve CPU cycles on Pentium T4500. | `inertial-decay.test.ts` |
| **INS-05** | **ETag 304 Caching Verification** | Client requests inertial scroller configuration profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant profile serialization. | `inertial-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Inertial Scroller Service & Physics Unit Tests (`tests/unit/backend/services/inertial-scroll-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeDeltaTime, clampVelocity, checkRestingDecay, computeInertialEtag } from '../../../../src/backend/services/inertial-scroll-service';

describe('Inertial Scroller Engine Resilience & Clamping', () => {
  it('guards against zero, negative, or NaN deltaTimeMs', () => {
    expect(sanitizeDeltaTime(0)).toBe(16.67);
    expect(sanitizeDeltaTime(-16.67)).toBe(16.67);
    expect(sanitizeDeltaTime(NaN)).toBe(16.67);
    expect(sanitizeDeltaTime(32.0)).toBe(32.0);
  });

  it('clamps extreme velocity spikes to ±3500 px/s', () => {
    expect(clampVelocity(12000)).toBe(3500);
    expect(clampVelocity(-9500)).toBe(-3500);
    expect(clampVelocity(1200)).toBe(1200);
  });

  it('triggers auto-sleep resting decay when velocity drops below 0.05 px/s', () => {
    expect(checkRestingDecay(0.08)).toBe(false); // Still active
    expect(checkRestingDecay(0.04)).toBe(true);  // Enters sleep state
    expect(checkRestingDecay(0.00)).toBe(true);  // Enters sleep state
  });

  it('generates deterministic ETags for cached inertial scroller configuration profiles', () => {
    const etag1 = computeInertialEtag(3500, 0.92);
    const etag2 = computeInertialEtag(3500, 0.92);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Inertial Scroller Hook Tests (`frontend/src/tests/useInertialScroll.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInertialScroll } from '../hooks/useInertialScroll';

describe('useInertialScroll Boundary Clamping & CPU Sleep', () => {
  it('clamps scroll position strictly at boundary 0 and maxScroll', () => {
    const { result } = renderHook(() => useInertialScroll({ maxScroll: 5000 }));

    act(() => {
      result.current.applyScrollDelta(-500); // Try scrolling past top
    });
    expect(result.current.scrollPosition).toBe(0);

    act(() => {
      result.current.applyScrollDelta(99999); // Try scrolling past bottom
    });
    expect(result.current.scrollPosition).toBe(5000);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **CPU Conservation Guard:** When kinetic momentum velocity decays below the `0.05px/s` threshold, the requestAnimationFrame loop terminates immediately, ensuring 0% CPU consumption on idle reading sessions.
2. **Frame Drop Mitigation:** If long tasks on the main thread cause massive frame time spikes, `deltaTimeMs` is capped at `100ms` to prevent physics explosion teleports.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 88.*
