# Sprint 118 QA Resilience Matrix: Dark-Adaptation Retinal Preserver & Night-Shift Dynamic Transition Engine (SLA 82)

## Executive Summary
Sprint 118 introduces the **Dark-Adaptation Retinal Preserver & Night-Shift Dynamic Transition Engine (SLA 82)**, designed to protect reader night-vision during dark-room reading sessions by smoothing out abrupt luminance transitions (e.g., transitioning instantly from a 100% pitch-black night scene page to a blinding 100% white splash page) using adaptive retinal interpolation curves, strict parameter clamping, and resilient SQLite schema checks.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for abrupt luminance shock transitions, ultra-fast chapter navigation throttling, strict NaN/Infinity parameter clamping, and SQLite schema integrity validation.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **RET-01** | **Abrupt Luminance Shock (100% Black $\rightarrow$ 100% White)** | Reader flips from a pitch-black night scene page ($0\%$ luminance) to a blinding white splash page ($100\%$ luminance) | Retinal preserver detects delta luminance spike ($\Delta L > 0.90$), automatically triggering a smooth 150ms opacity/gamma temporal cross-fade buffer to prevent retinal glare and flash blindness. | `retina-shock.test.ts` |
| **RET-02** | **Ultra-Fast Chapter Navigation Throttling** | Reader flings page scrubber across 50 pages in 1 second | Transition buffer queues or preempts intermediate frame calculations via `AbortController`, preventing CPU starvation and rendering jank. | `retina-navigation.test.ts` |
| **RET-03** | **Strict NaN / Infinity Parameter Clamping** | Corrupted user preference profile passes `NaN`, `Infinity`, or negative retinal sensitivity coefficients | Clamping guards sanitize input strictly into safe operational bounds (`[0.0, 1.0]`), guaranteeing zero mathematical NaNs in CSS tone curves. | `retina-clamping.test.ts` |
| **RET-04** | **SQLite Schema Constraint Validation** | Malformed database write attempts to insert out-of-range retinal persistence values | SQLite `CHECK (retinal_sensitivity >= 0.0 AND retinal_sensitivity <= 1.0)` constraint rejects invalid writes, preserving database integrity. | `retina-sqlite.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Retinal Preserver Service & Unit Tests (`tests/unit/backend/services/retinal-preserver-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { sanitizeRetinalCoefficients, evaluateLuminanceShock, calculateTransitionDuration, computeRetinaEtag } from '../../../../src/backend/services/retinal-preserver-service';

describe('Dark-Adaptation Retinal Preserver Resilience & Clamping', () => {
  it('sanitizes NaN, Infinity, and out-of-range retinal coefficients strictly to [0.0, 1.0]', () => {
    expect(sanitizeRetinalCoefficients(NaN)).toBe(0.5);   // Safe default
    expect(sanitizeRetinalCoefficients(Infinity)).toBe(1.0); // Clamped max
    expect(sanitizeRetinalCoefficients(-2.5)).toBe(0.0);  // Clamped min
    expect(sanitizeRetinalCoefficients(0.75)).toBe(0.75); // Valid coefficient
  });

  it('detects abrupt luminance shocks (100% black to 100% white) and triggers smoothing duration', () => {
    const shock = evaluateLuminanceShock(0.0, 1.0); // 0% black -> 100% white
    expect(shock.isShockDetected).toBe(true);
    expect(shock.recommendedFadeMs).toBe(150);
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      sanitizeRetinalCoefficients(0.8);
      evaluateLuminanceShock(0.1, 0.95);
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached retinal preserver profiles', () => {
    const etag1 = computeRetinaEtag('user-118', 0.85);
    const etag2 = computeRetinaEtag('user-118', 0.85);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Retinal Preserver Hook Tests (`frontend/src/tests/useRetinalPreserver.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRetinalPreserver } from '../hooks/useRetinalPreserver';

describe('useRetinalPreserver Ultra-Fast Navigation & Shock Smoothing', () => {
  it('applies temporal gamma smoothing upon detecting abrupt dark-to-light page transitions', () => {
    const { result } = renderHook(() => useRetinalPreserver({ fromLuminance: 0.05, toLuminance: 0.98 }));
    expect(result.current.isSmoothingActive).toBe(true);
    expect(result.current.fadeDurationMs).toBe(150);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Luminance Shock Dampening:** When reader viewports experience rapid delta luminance jumps ($\Delta L > 0.90$), a lightweight temporal buffer smooths out the exposure transition over 150ms, protecting night-adapted retinas from flash blindness.
2. **SQLite Integrity Enforcement:** Database tables enforce strict `CHECK` constraints on all retinal sensitivity coefficients, preventing corrupted user preferences from causing rendering shader exceptions.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 118.*
