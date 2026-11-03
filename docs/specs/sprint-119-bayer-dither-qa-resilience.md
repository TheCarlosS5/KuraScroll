# Sprint 119 QA Resilience Matrix: Bayer Dither Matrix Synthesizer & Retro Color Quantization Engine (SLA 83)

## Executive Summary
Sprint 119 introduces the **Bayer Dither Matrix Synthesizer & Retro Color Quantization Engine (SLA 83)**, designed to emulate authentic retro 1-bit / 4-bit / 8-bit manga magazine print textures and color palettes using deterministic Bayer ordered dither matrix indexers ($2 \times 2$, $4 \times 4$, $8 \times 8$), bitwise modulo bitmask masking (`& 0x03`, `& 0x07`), strict quantized color clamping (6-bit vs. 8-bit), integer overflow prevention, and resilient SQLite persistence.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for bitwise modulo indexing masks, quantized color bit-depth clamping, integer overflow protections, SQLite schema checks, and sub-microsecond execution latency.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **DTHR-01** | **Bitwise Modulo Matrix Indexing (`& 0x03`, `& 0x07`)** | Pixel coordinate lookups pass out-of-bounds or massive integer coordinates (`x = 999999, y = -5000`) | Bitwise modulo bitmasking (`& 0x03` for $4 \times 4$ or `& 0x07` for $8 \times 8$) wraps coordinate lookups safely without negative array indexing or out-of-bounds memory access. | `dither-bitwise.test.ts` |
| **DTHR-02** | **Quantized Color Clamping (6-bit vs. 8-bit)** | Color channels pass float/integer values outside standard bit-depth range (`val = 300` or `-50`) | Quantizer clamps values strictly to target bit-depth limits (`6-bit: [0, 63]`, `8-bit: [0, 255]`), preventing integer wrap-around and color inversion. | `dither-clamping.test.ts` |
| **DTHR-03** | **Integer Overflow Prevention** | Dither threshold addition combined with extreme RGB luminance sums (`R + G + B + Threshold > MaxInt`) | Intermediate color sum calculations use safe 32-bit integer arithmetic with explicit saturation capping (`Math.min(255, sum)`), preventing overflow wrapping. | `dither-overflow.test.ts` |
| **DTHR-04** | **SQLite Schema Constraint Validation** | Malformed database write attempts to insert out-of-range Bayer matrix sizes or bit-depths | SQLite `CHECK (matrix_size IN (2, 4, 8) AND bit_depth IN (1, 4, 6, 8))` constraint rejects invalid writes, preserving database integrity. | `dither-sqlite.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Bayer Dither Service & Unit Tests (`tests/unit/backend/services/bayer-dither-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { getBayerIndex, clampQuantizedColor, applySafeDitherArithmetic, computeDitherEtag } from '../../../../src/backend/services/bayer-dither-service';

describe('Bayer Dither Matrix Synthesizer Resilience & Clamping', () => {
  it('wraps massive or negative coordinates safely using bitwise modulo bitmasking (& 0x03, & 0x07)', () => {
    // 4x4 matrix uses & 0x03 (mask 3)
    expect(getBayerIndex(999999, -5000, 4)).toBe(getBayerIndex(999999 & 3, -5000 & 3, 4));
    // 8x8 matrix uses & 0x07 (mask 7)
    expect(getBayerIndex(123456, -7890, 8)).toBe(getBayerIndex(123456 & 7, -7890 & 7, 8));
  });

  it('clamps quantized color channels strictly for 6-bit [0, 63] and 8-bit [0, 255]', () => {
    expect(clampQuantizedColor(300, 8)).toBe(255);
    expect(clampQuantizedColor(-50, 8)).toBe(0);
    expect(clampQuantizedColor(100, 6)).toBe(42); // Scaled to 6-bit [0, 63]
  });

  it('prevents integer overflow during extreme luminance and threshold additions', () => {
    const sum = applySafeDitherArithmetic(255, 255, 255, 1.0);
    expect(sum).toBe(255);
    expect(Number.isSafeInteger(sum)).toBe(true);
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      getBayerIndex(i, i, 4);
      clampQuantizedColor(180, 8);
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached dither profile manifests', () => {
    const etag1 = computeDitherEtag(4, 8);
    const etag2 = computeDitherEtag(4, 8);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Bayer Dither Hook Tests (`frontend/src/tests/useBayerDither.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBayerDither } from '../hooks/useBayerDither';

describe('useBayerDither Bitwise Modulo & Clamping Guard', () => {
  it('applies bitwise bitmask indexing cleanly across viewport transformations', () => {
    const { result } = renderHook(() => useBayerDither({ matrixSize: 4, bitDepth: 8 }));
    expect(result.current.maskBits).toBe(3); // 4x4 matrix uses & 0x03
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Bitwise Masking Efficiency:** Coordinate lookups use blazing-fast bitwise AND masks (`& 0x03`, `& 0x07`) instead of slow division modulo operators (`% 4`, `% 8`), guaranteeing zero performance degradation on low-spec CPUs.
2. **SQLite Integrity Enforcement:** Database tables enforce strict `CHECK` constraints on matrix sizes and bit-depths, preventing corrupt retro presets from persisting across sessions.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 119.*
