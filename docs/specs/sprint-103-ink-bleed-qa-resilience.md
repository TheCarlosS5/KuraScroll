# Sprint 103 QA Resilience Matrix: Dynamic Contrast Tone-Mapping & Halftone Ink Bleed Compensator (SLA 67)

## Executive Summary
Sprint 103 introduces the **Dynamic Contrast Tone-Mapping & Halftone Ink Bleed Compensator (SLA 67)**, designed to counteract ink bleed, dot gain, and muddy dark tones in scanned vintage manga tankōbon volumes by applying adaptive tone-mapping curves and sharpness compensation.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for default profile fallbacks when series profiles are missing, slope/intercept luminance clamping, rapid profile updates without database locks, and CSS filter string syntax correctness.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **INK-01** | **Default Profile Fallback** | Requested series profile ID does not exist in local SQLite store (`seriesId = "unknown-123"`) | Compensator service gracefully falls back to default neutral tone-mapping profile without throwing database exceptions. | `ink-fallback.test.ts` |
| **INK-02** | **Slope & Intercept Luminance Clamping** | Tone-mapping slope or intercept values passed with extreme or invalid numbers (`slope = -2.5`, `intercept = Infinity`) | Parameters are clamped strictly to safe operational bounds (`slope: [0.5, 3.0]`, `intercept: [0.0, 0.5]`), preventing negative luminance or infinite values. | `ink-clamping.test.ts` |
| **INK-03** | **Rapid Profile Updates (No DB Thrash)** | User rapidly toggles ink bleed compensation settings 15 times per second | Database write operations are debounced (250ms window) and executed inside WAL mode transactions, preventing SQLite database locks. | `ink-debouncing.test.ts` |
| **INK-04** | **CSS Filter String Syntax Correctness** | Generated CSS filter string applied to manga panel element | Filter string strictly conforms to W3C web standards (`contrast(1.2) brightness(0.95) saturate(1.1)`), preventing rendering failures. | `ink-css.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Ink Bleed Compensator Service & Unit Tests (`tests/unit/backend/services/ink-bleed-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { getProfileOrDefault, clampSlopeAndIntercept, generateCssFilterString, computeInkEtag } from '../../../../src/backend/services/ink-bleed-service';

describe('Ink Bleed Compensator Resilience & Clamping', () => {
  it('falls back gracefully to default neutral profile when series profile is missing', () => {
    const missingProfile = getProfileOrDefault('non-existent-series');
    expect(missingProfile).toBeDefined();
    expect(missingProfile.slope).toBe(1.0);
    expect(missingProfile.intercept).toBe(0.0);
  });

  it('clamps slope and intercept strictly to prevent negative luminance or infinite values', () => {
    const extreme = { slope: -5.0, intercept: Infinity };
    const sanitized = clampSlopeAndIntercept(extreme);

    expect(sanitized.slope).toBe(0.5);      // Min safe bound
    expect(sanitized.intercept).toBe(0.5);  // Max safe bound
    expect(Number.isFinite(sanitized.slope)).toBe(true);
    expect(Number.isFinite(sanitized.intercept)).toBe(true);
  });

  it('generates syntactically correct W3C CSS filter strings', () => {
    const css = generateCssFilterString(1.25, 0.1, 1.1);
    expect(css).toBe('contrast(1.25) brightness(1.1) saturate(1.1)');
    expect(css).not.toContain('NaN');
    expect(css).not.toContain('Infinity');
  });

  it('generates deterministic ETags for cached ink bleed profile manifests', () => {
    const etag1 = computeInkEtag('series-103', 1.2, 0.05);
    const etag2 = computeInkEtag('series-103', 1.2, 0.05);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Ink Bleed Hook Tests (`frontend/src/tests/useInkBleed.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInkBleed } from '../hooks/useInkBleed';

describe('useInkBleed Debounce & Database Lock Protection', () => {
  it('debounces rapid profile updates to prevent SQLite database thrashing', () => {
    vi.useFakeTimers();
    const saveSpy = vi.fn();
    const { result } = renderHook(() => useInkBleed({ onSave: saveSpy }));

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.updateProfile({ slope: 1.0 + i * 0.1 });
      }
    });

    // Should not have called save yet due to debounce
    expect(saveSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Database WAL Mode:** SQLite is enforced in WAL (Write-Ahead Logging) mode with debounced profile writes, preventing table locks during rapid user slider adjustments.
2. **CSS Syntax Guardians:** All numeric parameters injected into CSS filter strings pass through strict finiteness checks, ensuring invalid floats never break browser layout parsing.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 103.*
