# Sprint 96 QA Resilience Matrix: Bi-Directional Dual-Page Gutters & Crease Shadow Synthesizer for Tankōbon Spreads (SLA 60)

## Executive Summary
Sprint 96 introduces the **Bi-Directional Dual-Page Gutters & Crease Shadow Synthesizer for Tankōbon Spreads (SLA 60)**, designed to render realistic book spine crease shadows, lighting gradients, and gutter depth across double-page spreads in physical tankōbon manga volumes and digital comics.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for instantaneous RTL/LTR layout toggling, page parity extreme positions ($P=0$, $P=0.5$, $P=1.0$), clean feature deactivation (`isEnabled = false` returning `'none'`), SQLite CHECK constraints, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **CREASE-01** | **Instant RTL vs LTR Toggling** | Reader switches reading direction between `manga-rtl` and `comic-ltr` mid-chapter | Crease shadow gradient overlay flips orientation vectors instantly without visual artifacts or CSS transition glitches. | `crease-direction.test.ts` |
| **CREASE-02** | **Extreme Page Parity Positions ($P=0$, $P=0.5$, $P=1.0$)** | Spread position evaluates at start ($P=0$), exact center ($P=0.5$), or end ($P=1.0$) | Crease shadow synthesizer correctly places binding shadow on the correct side (e.g., right-hand inner margin for RTL start, central split for symmetry). | `crease-parity.test.ts` |
| **CREASE-03** | **Clean Feature Deactivation (`isEnabled = false`)** | Crease shadow engine disabled by user preference | Synthesizer short-circuits instantly, returning `'none'` for CSS shadow properties with zero DOM overhead or filter rendering. | `crease-deactivation.test.ts` |
| **CREASE-04** | **SQLite CHECK Constraint Validation** | Malformed database write attempts to insert out-of-range crease intensity values | SQLite `CHECK (crease_intensity >= 0.0 AND crease_intensity <= 1.0)` constraint rejects invalid writes, preserving database integrity. | `crease-sqlite.test.ts` |
| **CREASE-05** | **ETag 304 Verification** | Client requests crease shadow profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant server-side shadow gradient calculations. | `crease-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Crease Shadow Service & Unit Tests (`tests/unit/backend/services/crease-shadow-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { clampCreaseIntensity, calculateCreaseGradient, sanitizeReadingDirection, computeCreaseEtag } from '../../../../src/backend/services/crease-shadow-service';

describe('Crease Shadow Synthesizer Engine Resilience & Clamping', () => {
  it('clamps crease intensity strictly to [0.0, 1.0]', () => {
    expect(clampCreaseIntensity(-0.2)).toBe(0.0);
    expect(clampCreaseIntensity(1.8)).toBe(1.0);
    expect(clampCreaseIntensity(0.55)).toBe(0.55);
  });

  it('calculates correct crease gradients at extreme page parity positions (0, 0.5, 1.0)', () => {
    const startPos = calculateCreaseGradient(0.0, 'manga-rtl', 0.8);
    const centerPos = calculateCreaseGradient(0.5, 'manga-rtl', 0.8);
    const endPos = calculateCreaseGradient(1.0, 'manga-rtl', 0.8);

    expect(startPos.shadowAnchor).toBe('right');
    expect(centerPos.shadowAnchor).toBe('center');
    expect(endPos.shadowAnchor).toBe('left');
  });

  it('returns "none" cleanly when disabled without render overhead', () => {
    const disabledResult = calculateCreaseGradient(0.5, 'manga-rtl', 0.8, false);
    expect(disabledResult.cssShadow).toBe('none');
  });

  it('sanitizes reading direction enums safely', () => {
    expect(sanitizeReadingDirection('manga-rtl')).toBe('manga-rtl');
    expect(sanitizeReadingDirection('comic-ltr')).toBe('comic-ltr');
    expect(sanitizeReadingDirection('invalid_dir')).toBe('manga-rtl'); // Fallback
  });

  it('generates deterministic ETags for cached crease shadow profiles', () => {
    const etag1 = computeCreaseEtag('manga-rtl', 0.75);
    const etag2 = computeCreaseEtag('manga-rtl', 0.75);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Crease Shadow Hook Tests (`frontend/src/tests/useCreaseShadow.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCreaseShadow } from '../hooks/useCreaseShadow';

describe('useCreaseShadow Deactivation & RTL/LTR Toggle', () => {
  it('short-circuits to "none" when disabled', () => {
    const { result } = renderHook(() => useCreaseShadow({ isEnabled: false }));
    expect(result.current.cssShadow).toBe('none');
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Short-Circuit Optimization:** When `isEnabled = false`, the crease shadow synthesizer completely bypasses gradient calculation loops and DOM style injections, reducing CPU overhead to absolute zero.
2. **SQLite Integrity Protection:** Database tables enforce strict `CHECK` constraints on crease intensity parameters to protect local storage integrity against malformed profile syncs.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 96.*
