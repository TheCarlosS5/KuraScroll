# Sprint 91 QA Resilience Matrix: Adaptive Sub-Pixel Color Fringe Neutralizer & In-Viewport Text Sharpening Engine

## Executive Summary
Sprint 91 introduces the **Adaptive Sub-Pixel Color Fringe Neutralizer & In-Viewport Text Sharpening Engine**, designed to counteract chromatic aberration and color fringing (common in low-quality or compressed manga scans) while applying crisp sub-pixel text sharpening to dialogue bubbles without introducing halo artifacts.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for fringe radius clamping (`[0.0, 2.50]`), desaturation and sharpening factor validation, corrupted profile fallback modes, SQLite CHECK constraint enforcement, and division-by-zero prevention.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **CFN-01** | **Extreme Fringe Radius Clamping** | Requested fringe radius outside safe bounds (`radius = -1.0` or `radius = 4.50`) | Neutralizer service clamps fringe radius strictly to `[0.0, 2.50]`, disabling correction or capping at maximum sub-pixel width. | `fringe-radius.test.ts` |
| **CFN-02** | **Full Desaturation & Extreme Sharpening** | Desaturation factor set to `1.0` (100%) and sharpening factor set to `3.0x` | Filter pipeline applies maximum unsharp mask and desaturation without triggering integer overflow or clipping highlights to pure black/white. | `fringe-sharpen.test.ts` |
| **CFN-03** | **Corrupted Profile Fallback Modes** | Storage profile contains unknown or malformed correction modes (`mode = "quantum_sharpen"`) | Engine gracefully falls back to default `'standard_compensate'` mode without throwing shader compilation errors. | `fringe-mode.test.ts` |
| **CFN-04** | **SQLite CHECK Constraint Validation** | Malformed database write attempts to insert negative or out-of-range fringe values | SQLite `CHECK (fringe_radius >= 0.0 AND fringe_radius <= 2.5)` constraint rejects invalid writes, preserving database integrity. | `fringe-sqlite.test.ts` |
| **CFN-05** | **Division-by-Zero Prevention in Kernel Math** | Unsharp mask or chromatic kernel initialized with zero-width / zero-height dimensions | Kernel generator guards against division by zero, falling back to a safe $3 \times 3$ identity matrix. | `fringe-division.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Fringe Neutralizer Service & Clamping Unit Tests (`tests/unit/backend/services/chromatic-fringe-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { clampFringeRadius, clampSharpenFactor, sanitizeCorrectionMode, generateSafeKernel, computeFringeEtag } from '../../../../src/backend/services/chromatic-fringe-service';

describe('Chromatic Fringe Neutralizer Engine Resilience & Clamping', () => {
  it('clamps extreme fringe radius values strictly to [0.0, 2.50]', () => {
    expect(clampFringeRadius(-1.0)).toBe(0.0);
    expect(clampFringeRadius(4.50)).toBe(2.50);
    expect(clampFringeRadius(1.25)).toBe(1.25);
  });

  it('clamps sharpening factors strictly to [0.0, 3.0]', () => {
    expect(clampSharpenFactor(-0.5)).toBe(0.0);
    expect(clampSharpenFactor(5.0)).toBe(3.0);
    expect(clampSharpenFactor(1.8)).toBe(1.8);
  });

  it('falls back to "standard_compensate" on corrupted correction modes', () => {
    expect(sanitizeCorrectionMode('subpixel_shift')).toBe('subpixel_shift');
    expect(sanitizeCorrectionMode('quantum_sharpen')).toBe('standard_compensate');
    expect(sanitizeCorrectionMode(null)).toBe('standard_compensate');
  });

  it('prevents division by zero in sharpening kernel math', () => {
    const safeKernel = generateSafeKernel(0, 0); // Zero width/height edge case
    expect(safeKernel).toBeDefined();
    expect(safeKernel.length).toBe(3); // Falls back to 3x3 identity matrix
  });

  it('generates deterministic ETags for cached fringe correction profiles', () => {
    const etag1 = computeFringeEtag(1.2, 2.0, 'subpixel_shift');
    const etag2 = computeFringeEtag(1.2, 2.0, 'subpixel_shift');
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Neutralizer Hook Tests (`frontend/src/tests/useChromaticFringe.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChromaticFringe } from '../hooks/useChromaticFringe';

describe('useChromaticFringe Hardware & Performance Guard', () => {
  it('respects low-spec hardware (Intel GMA 4500MHD) by bypassing multi-pass matrix filters', () => {
    const { result } = renderHook(() => useChromaticFringe({ hardwareTier: 'low-spec' }));
    expect(result.current.bypassHeavyPass).toBe(true);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Kernel Safety Guard:** All unsharp mask and chromatic aberration correction kernels include strict `width > 0 && height > 0` assertions, falling back to a neutral pass-through matrix if invalid.
2. **SQLite Check Enforcement:** Database tables enforce `CHECK` constraints on all floating-point configuration parameters to prevent malicious or malformed client payloads from persisting.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 91.*
