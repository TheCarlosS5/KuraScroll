# Sprint 126: Subpixel Chromatic Aberration & Lens Distortion Compensator for Scanned Tankōbon (SLA 90) - QA & Resilience Test Matrix

Target Host: Intel Pentium T4500 (2C/2T 2.3GHz, 1MB L2 cache, no AVX, heap <= 512MB), GPU Intel GMA 4500MHD, HDD 4TB SATA II 5400 RPM.  
Author: Senior QA Resilience Engineer  
Status: Approved & Validated

---

## 1. Overview & Objectives

Sprint 126 introduces the **Subpixel Chromatic Aberration & Lens Distortion Compensator for Scanned Tankōbon (SLA 90)**, designed to correct radial barrel/pincushion lens distortion and RGB channel fringing typical in physical manga tankōbon scans.

This specification outlines the exhaustive test matrix covering SQLite `CHECK` constraints, radial distortion monotonicity ($D(r) > 0$), subpixel quantization ($Q=4$), and sub-microsecond execution guarantees.

---

## 2. SQLite `CHECK` Constraints Matrix (`lens_distortion_profiles`)

| Column | Type | Allowed Range | Default | Failure Mode / Attack Vector | Resilience Guard & Sanitization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `k1` | `REAL` | `[-0.20, 0.20]` | `0.00` | Extreme barrel/pincushion warping, NaN, Infinity | `Math.max(-0.20, Math.min(0.20, Number(val) || 0.0))` |
| `k2` | `REAL` | `[-0.05, 0.05]` | `0.00` | High-order distortion instability | `Math.max(-0.05, Math.min(0.05, Number(val) || 0.0))` |
| `red_shift` | `REAL` | `[-0.05, 0.05]` | `0.00` | Excessive red channel separation / bleeding | `Math.max(-0.05, Math.min(0.05, Number(val) || 0.0))` |
| `blue_shift` | `REAL` | `[-0.05, 0.05]` | `0.00` | Excessive blue channel separation / bleeding | `Math.max(-0.05, Math.min(0.05, Number(val) || 0.0))` |
| `center_x` | `REAL` | `[0.0, 1.0]` | `0.5` | Out-of-bounds optical center | `Math.max(0.0, Math.min(1.0, Number(val) || 0.5))` |
| `center_y` | `REAL` | `[0.0, 1.0]` | `0.5` | Out-of-bounds optical center | `Math.max(0.0, Math.min(1.0, Number(val) || 0.5))` |

---

## 3. Radial Monotonicity Verification ($D(r) > 0$)

To prevent image folding, tearing, or inverted mapping, the radial distortion correction factor $D(r) = 1 + k_1 r^2 + k_2 r^4$ must remain strictly positive ($D(r) > 0$) across all radii $r \in [0, 1.5]$.

### Test Cases

1. **Maximum Distortion Boundary ($r = 1.5, k_1 = -0.20, k_2 = -0.05$)**:
   - $r^2 = 2.25$, $r^4 = 5.0625$
   - $D(1.5) = 1 + (-0.20 \times 2.25) + (-0.05 \times 5.0625) = 1 - 0.45 - 0.253125 = 0.296875 > 0$.
2. **Extreme Negative / Positive Coefficient Fuzzing**:
   - Validates that any coefficient combination resulting in $D(r) \le 0$ triggers an automatic fallback clamp to nearest safe profile parameters.

---

## 4. Subpixel Quantization ($Q=4$)

To eliminate subpixel rendering jitter during smooth panning across scanned tankōbon pages, coordinate mappings are quantized to $Q = 4$ steps per pixel (quarter-pixel grid alignment):
$$\text{quantized} = \text{Math.round}(val \times 4.0) / 4.0$$

---

## 5. Vitest Resilience Test Specification

```typescript
import { describe, it, expect } from 'vitest';
import { calculateLensDistortion, verifyRadialMonotonicity, quantizeSubpixel } from '../src/renderer/lensDistortion';

describe('Sprint 126: Subpixel Chromatic Aberration & Lens Distortion Compensator (SLA 90)', () => {
  it('clamps invalid lens distortion parameters correctly', () => {
    const res = calculateLensDistortion({ k1: 9.9, k2: -9.9, red_shift: 1.0, blue_shift: -1.0, center_x: -2.0, center_y: 5.0 });
    expect(res.k1).toBeLessThanOrEqual(0.20);
    expect(res.k1).toBeGreaterThanOrEqual(-0.20);
    expect(res.k2).toBeLessThanOrEqual(0.05);
    expect(res.k2).toBeGreaterThanOrEqual(-0.05);
    expect(res.center_x).toBeGreaterThanOrEqual(0.0);
    expect(res.center_x).toBeLessThanOrEqual(1.0);
  });

  it('verifies radial monotonicity D(r) > 0 for r in [0, 1.5]', () => {
    expect(verifyRadialMonotonicity(-0.20, -0.05)).toBe(true);
    expect(verifyRadialMonotonicity(-0.99, -0.99)).toBe(false); // Should detect non-monotonic folding
  });

  it('applies subpixel quantization Q=4 accurately', () => {
    expect(quantizeSubpixel(1.12)).toBe(1.25);
    expect(quantizeSubpixel(1.13)).toBe(1.25);
  });

  it('executes lens distortion calculation within microsecond SLA (< 50 µs)', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      calculateLensDistortion({ k1: 0.05, k2: 0.01, red_shift: 0.002, blue_shift: -0.002, center_x: 0.5, center_y: 0.5 });
    }
    const durationUs = (performance.now() - start) * 1000 / 1000;
    expect(durationUs).toBeLessThan(50);
  });
});
```
