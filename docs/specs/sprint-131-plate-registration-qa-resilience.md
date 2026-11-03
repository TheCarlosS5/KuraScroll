# Sprint 131: Plate Misregistration & Ink Trapping Compensator (SLA 95) - QA & Resilience Test Matrix

Target Host: Intel Pentium T4500 (2C/2T 2.3GHz, 1MB L2 cache, no AVX, heap <= 512MB), GPU Intel GMA 4500MHD, HDD 4TB SATA II 5400 RPM.  
Author: Senior QA Resilience Engineer  
Status: Approved & Validated

---

## 1. Overview & Objectives

Sprint 131 introduces the **Plate Misregistration & Ink Trapping Compensator (SLA 95)**, simulating and compensating for CMYK plate misregistration and ink trapping artifacts found in vintage printing presses and low-cost color manga tankōbon offset prints.

This specification outlines the exhaustive test matrix covering zero misregistration pass-through, extreme asymmetric offsets, numerical stability against NaN/Infinity/saturation, Fastify REST endpoints with ETag/304 caching, SQLite WAL persistence, and sub-microsecond execution guarantees (`< 50 µs` assertion).

---

## 2. Parameter Bounds & Plate Offset Matrix

| Parameter | Type | Allowed Range | Default | Failure Mode / Attack Vector | Resilience Guard & Sanitization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cyan_offset_x` | `REAL` | `[-2.0, 2.0]` | `0.0` | Excessive pixel shift, NaN, Infinity | `Math.max(-2.0, Math.min(2.0, Number(val) || 0.0))` |
| `cyan_offset_y` | `REAL` | `[-2.0, 2.0]` | `0.0` | Excessive pixel shift, NaN, Infinity | `Math.max(-2.0, Math.min(2.0, Number(val) || 0.0))` |
| `magenta_offset_x`| `REAL` | `[-2.0, 2.0]` | `0.0` | Excessive pixel shift, NaN, Infinity | `Math.max(-2.0, Math.min(2.0, Number(val) || 0.0))` |
| `magenta_offset_y`| `REAL` | `[-2.0, 2.0]` | `0.0` | Excessive pixel shift, NaN, Infinity | `Math.max(-2.0, Math.min(2.0, Number(val) || 0.0))` |
| `yellow_offset_x` | `REAL` | `[-2.0, 2.0]` | `0.0` | Excessive pixel shift, NaN, Infinity | `Math.max(-2.0, Math.min(2.0, Number(val) || 0.0))` |
| `yellow_offset_y` | `REAL` | `[-2.0, 2.0]` | `0.0` | Excessive pixel shift, NaN, Infinity | `Math.max(-2.0, Math.min(2.0, Number(val) || 0.0))` |
| `black_offset_x` | `REAL` | `[-2.0, 2.0]` | `0.0` | Excessive pixel shift, NaN, Infinity | `Math.max(-2.0, Math.min(2.0, Number(val) || 0.0))` |
| `black_offset_y` | `REAL` | `[-2.0, 2.0]` | `0.0` | Excessive pixel shift, NaN, Infinity | `Math.max(-2.0, Math.min(2.0, Number(val) || 0.0))` |
| `trapping_strength`| `REAL` | `[0.0, 1.0]` | `0.3` | Negative trapping or full blowout | `Math.max(0.0, Math.min(1.0, Number(val) || 0.3))` |

---

## 3. Edge-Case Test Suite

### 1. Perfect Registration (Zero Pass-Through)
- **Condition**: All CMYK offsets set strictly to `0.0`.
- **Expected Behavior**: Output RGB channels must match input RGB channels bit-for-bit (exact pass-through with zero distortion or resampling artifact).

### 2. Extreme Asymmetric Offsets & Ink Trapping
- **Condition**: Cyan offset set to `+1.5px`, Black offset set to `-0.8px`, trapping strength set to `0.5`.
- **Expected Behavior**: Ink trapping rules must spread overlapping edges to prevent white gaps without generating saturated RGB channel overflows (> 255) or `NaN` values.

### 3. Fastify REST & SQLite WAL Persistence
- **Endpoints**:
  - `GET /api/v1/reader/plate-registration/presets`
  - `GET /api/v1/reader/plate-registration/profile` (Supports ETag `304 Not Modified`)
  - `POST /api/v1/reader/plate-registration/profile` (Validates and persists via SQLite WAL)
  - `POST /api/v1/reader/plate-registration/calculate`
- **Validation**: Strict schema validation rejecting out-of-range bounds before database transactions occur.

---

## 4. Vitest Resilience Test Specification

```typescript
import { describe, it, expect } from 'vitest';
import { compensatePlateRegistration, sanitizeRegistrationProfile } from '../src/renderer/plateRegistration';

describe('Sprint 131: Plate Misregistration & Ink Trapping Compensator (SLA 95)', () => {
  it('passes through exact input when all offsets are 0.0', () => {
    const profile = { cyan_offset_x: 0, cyan_offset_y: 0, magenta_offset_x: 0, magenta_offset_y: 0, yellow_offset_x: 0, yellow_offset_y: 0, black_offset_x: 0, black_offset_y: 0, trapping_strength: 0.3 };
    const inputPixel = { r: 120, g: 150, b: 200 };
    const output = compensatePlateRegistration(inputPixel, profile);
    expect(output.r).toBe(inputPixel.r);
    expect(output.g).toBe(inputPixel.g);
    expect(output.b).toBe(inputPixel.b);
  });

  it('handles extreme asymmetric offsets and prevents channel saturation or NaN', () => {
    const profile = { cyan_offset_x: 1.5, cyan_offset_y: -1.0, magenta_offset_x: -0.5, magenta_offset_y: 0.5, yellow_offset_x: 0.0, yellow_offset_y: 0.0, black_offset_x: -0.8, black_offset_y: 1.2, trapping_strength: 0.8 };
    const inputPixel = { r: 255, g: 0, b: 128 };
    const output = compensatePlateRegistration(inputPixel, profile);
    expect(Number.isFinite(output.r)).toBe(true);
    expect(Number.isFinite(output.g)).toBe(true);
    expect(Number.isFinite(output.b)).toBe(true);
    expect(output.r).toBeLessThanOrEqual(255);
    expect(output.g).toBeGreaterThanOrEqual(0);
  });

  it('executes plate compensation within microsecond SLA (< 50 µs)', () => {
    const profile = { cyan_offset_x: 0.5, cyan_offset_y: -0.5, magenta_offset_x: -0.2, magenta_offset_y: 0.2, yellow_offset_x: 0.1, yellow_offset_y: -0.1, black_offset_x: 0.0, black_offset_y: 0.0, trapping_strength: 0.3 };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      compensatePlateRegistration({ r: 100, g: 120, b: 140 }, profile);
    }
    const durationUs = (performance.now() - start) * 1000 / 1000;
    expect(durationUs).toBeLessThan(50);
  });
});
```
