# Sprint 83 QA Resilience Matrix: GazeAnchor Saccadic Trajectory & Eye-Tracking Integration Engine

## Executive Summary
Sprint 83 introduces the **GazeAnchor Saccadic Trajectory & Eye-Tracking Integration Engine**, providing predictive focus retention, saccadic drift recovery, and gaze-anchored reading navigation for KuraScroll.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for GazeAnchor Fastify endpoints, coordinate bounds clamping, negative dwell times, NaN/null coordinate guards, concurrency/idempotency, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **GAZE-01** | **Out-of-Bounds Coordinate Clamping** | Raw eye-tracking coordinates outside viewport bounds (`x = -150`, `y = 9999`) | Coordinates are clamped strictly to `[0, viewportWidth]` and `[0, viewportHeight]` to prevent off-screen focus drift. | `gaze-bounds.test.ts` |
| **GAZE-02** | **NaN / Null Coordinate Guards** | Payload contains `x: NaN`, `y: null`, or missing coordinate properties | Service sanitizes inputs, falling back to last valid anchor position and rejecting malformed tracking vectors without throwing exceptions. | `gaze-sanitization.test.ts` |
| **GAZE-03** | **Negative Dwell Time Rejection** | Dwell duration reported as a negative integer or floating-point (`dwell = -450ms`) | Dwell time is clamped to `0ms` or rejected with validation error, preventing corrupt attention telemetry metrics. | `gaze-dwell.test.ts` |
| **GAZE-04** | **Concurrency & Idempotency** | Simultaneous duplicate `POST /profile` submissions or trajectory calculation requests | Fastify idempotency middleware and database transactions ensure state remains consistent without duplicate row creation or race conditions. | `gaze-concurrency.test.ts` |
| **GAZE-05** | **ETag 304 Caching (`GET /profile/:seriesId`)** | Client requests profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant database queries. | `gaze-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify GazeAnchor Service & Clamping Unit Tests (`tests/unit/backend/services/gaze-anchor-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { clampCoordinates, sanitizeGazePayload, calculateSaccadeTrajectory, computeGazeEtag } from '../../../../src/backend/services/gaze-anchor-service';

describe('GazeAnchor Saccadic Trajectory Engine Resilience & Clamping', () => {
  it('clamps coordinates strictly within viewport bounds [0, max]', () => {
    const viewport = { width: 1024, height: 768 };
    expect(clampCoordinates(-50, 9000, viewport)).toEqual({ x: 0, y: 768 });
    expect(clampCoordinates(500, 400, viewport)).toEqual({ x: 500, y: 400 });
  });

  it('sanitizes NaN and null coordinate values safely', () => {
    const malformed = { x: NaN, y: null, dwellTime: -200 };
    const sanitized = sanitizeGazePayload(malformed, { width: 800, height: 1200 });

    expect(sanitized.x).toBe(0);
    expect(sanitized.y).toBe(0);
    expect(sanitized.dwellTime).toBe(0); // Clamped negative dwell
  });

  it('calculates next saccade anchor and drift recovery point', () => {
    const currentGaze = { x: 100, y: 200, timestamp: Date.now() };
    const trajectory = calculateSaccadeTrajectory(currentGaze, 'manga_rtl');

    expect(trajectory).toHaveProperty('nextAnchorX');
    expect(trajectory).toHaveProperty('nextAnchorY');
    expect(trajectory).toHaveProperty('driftCorrection');
  });

  it('generates deterministic ETags for cached gaze profiles', () => {
    const etag1 = computeGazeEtag('series-123', 5);
    const etag2 = computeGazeEtag('series-123', 5);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Gaze Hook Tests (`frontend/src/tests/useGazeAnchor.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGazeAnchor } from '../hooks/useGazeAnchor';

describe('useGazeAnchor Idempotency & Latency Resilience', () => {
  it('throttles rapid coordinate telemetry submissions to prevent network saturation', () => {
    vi.useFakeTimers();
    const submitSpy = vi.fn();
    const { result } = renderHook(() => useGazeAnchor({ onSubmit: submitSpy }));

    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.recordGaze({ x: i, y: i });
      }
    });

    expect(submitSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Tracking Signal Loss:** If eye-tracking data stream drops for more than 1,000ms, GazeAnchor gracefully reverts to standard reading ruler behavior without interrupting the user.
2. **Idempotency Locks:** Fastify POST routes utilize client-provided request UUIDs to guarantee idempotent profile persistence across unstable network drops.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 83.*
