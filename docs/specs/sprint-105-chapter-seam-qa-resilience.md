# Sprint 105 QA Resilience Matrix: Cross-Chapter Kinetic Scroll Momentum Deceleration & Seam Pre-Baking Engine (SLA 69)

## Executive Summary
Sprint 105 introduces the **Cross-Chapter Kinetic Scroll Momentum Deceleration & Seam Pre-Baking Engine (SLA 69)**, designed to handle high-velocity continuous scrolling across chapter boundaries (`Chapter N` $\rightarrow$ `Chapter N+1`) on mechanical 4TB HDDs without overshooting into blank space, lagging during head seeks, or failing when seam threshold configurations are malformed.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for extreme fling velocities (`> 10,000 px/s`), 4TB HDD seek latency resilience (`15ms` delay handling), out-of-order pre-bake cancellation on scroll reversal, and division-by-zero protection for `seamThresholdPx <= 0`.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SEAM-01** | **Extreme Fling Velocity (> 10,000 px/s)** | User flings scroll momentum past chapter boundary at `14,500 px/s` | Momentum deceleration physics apply smooth damping right at the seam, locking view onto Chapter N+1 without overshooting into blank space. | `seam-velocity.test.ts` |
| **SEAM-02** | **4TB HDD Seek Latency Resilience (15ms Lag)** | Next chapter assets take 15ms to read from mechanical 4TB HDD while seam is reached | Seamless micro-shimmer placeholder or buffered seam transition masks the disk seek time without dropping UI frame rate. | `seam-hdd-lag.test.ts` |
| **SEAM-03** | **Out-of-Order Pre-Bake Cancellation** | Reader triggers pre-bake for Chapter N+1 but immediately reverses scroll direction back to Chapter N | `AbortController` signals cancel pending pre-bake fetch operations instantly, preventing background disk I/O congestion. | `seam-cancellation.test.ts` |
| **SEAM-04** | **Division-by-Zero Protection (`seamThresholdPx <= 0`)** | Configuration passes invalid or zero seam threshold (`seamThresholdPx = 0` or `-50`) | Threshold calculation guards against division by zero, falling back to safe default (`150px`) to prevent `NaN` layout math. | `seam-threshold.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Seam Pre-Bake Service & Unit Tests (`tests/unit/backend/services/chapter-seam-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeSeemThreshold, calculateDecelerationCurve, handleHddSeekLag, computeSeamEtag } from '../../../../src/backend/services/chapter-seam-service';

describe('Chapter Seam Pre-Bake & Deceleration Resilience', () => {
  it('guards against division by zero and negative seamThresholdPx values', () => {
    expect(sanitizeSeemThreshold(0)).toBe(150);     // Default fallback
    expect(sanitizeSeemThreshold(-100)).toBe(150);  // Default fallback
    expect(sanitizeSeemThreshold(NaN)).toBe(150);   // Default fallback
    expect(sanitizeSeemThreshold(200)).toBe(200);   // Valid threshold
  });

  it('clamps extreme fling velocities (> 10,000 px/s) to prevent overshooting blank space', () => {
    const decel = calculateDecelerationCurve(14500, 500); // 500px remaining to seam
    expect(decel.finalVelocity).toBeLessThanOrEqual(0);
    expect(decel.didOvershoot).toBe(false);
  });

  it('masks mechanical 4TB HDD seek latency (15ms lag) with seamless buffer transition', async () => {
    const seekSimulation = async () => new Promise((res) => setTimeout(res, 15));
    const result = await handleHddSeekLag(seekSimulation);

    expect(result.status).toBe('buffered-success');
    expect(result.fallbackTriggered).toBe(false);
  });

  it('generates deterministic ETags for cached cross-chapter seam manifests', () => {
    const etag1 = computeSeamEtag('ch-104', 'ch-105');
    const etag2 = computeSeamEtag('ch-104', 'ch-105');
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Seam Hook Tests (`frontend/src/tests/useChapterSeam.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChapterSeam } from '../hooks/useChapterSeam';

describe('useChapterSeam Scroll Reversal Cancellation', () => {
  it('aborts pending pre-bake requests immediately when reader reverses scroll direction', () => {
    const abortSpy = vi.fn();
    global.fetch = vi.fn().mockImplementation((url, options) => {
      options?.signal?.addEventListener('abort', abortSpy);
      return new Promise(() => {});
    });

    const { result, rerender } = renderHook(
      ({ direction }) => useChapterSeam({ currentChapter: 'ch-105', scrollDirection: direction }),
      { initialProps: { direction: 'down' } }
    );

    // Reverse scroll direction to 'up'
    rerender({ direction: 'up' });

    expect(abortSpy).toHaveBeenCalled();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **HDD Seek Masking:** When mechanical 4TB HDD head seeks introduce minor read delays (~15ms) at chapter boundaries, the seam engine renders a pre-cached low-res strip placeholder, eliminating visual stutter.
2. **Threshold Guardians:** All geometric calculations involving `seamThresholdPx` include explicit `> 0` validation checks, preventing division-by-zero layout failures.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 105.*
