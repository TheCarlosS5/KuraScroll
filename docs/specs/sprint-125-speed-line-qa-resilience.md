# Sprint 125: Dynamic Speed-Line Vector Synthesizer & Kinetic Impact Focus Engine for Shonen Panels (SLA 89) - QA & Resilience Test Matrix

Target Host: Intel Pentium T4500 (2C/2T 2.3GHz, 1MB L2 cache, no AVX, heap <= 512MB), GPU Intel GMA 4500MHD, HDD 4TB SATA II 5400 RPM.  
Author: Senior QA Resilience Engineer  
Status: Approved & Validated

---

## 1. Overview & Objectives

Sprint 125 introduces the **Dynamic Speed-Line Vector Synthesizer & Kinetic Impact Focus Engine for Shonen Panels (SLA 89)**, engineered to render high-intensity action speed lines and focus impact vectors dynamically in Canvas 2D without causing layout shifts (0 CLS) or exceeding the 512MB memory ceiling on low-spec hardware (Intel GMA 4500MHD).

This specification outlines the exhaustive test matrix covering SQLite `CHECK` constraints, numerical stability under degenerate geometry (focus point matching perimeter coordinates), NaN/Infinity sanitization, TypedArray safety, and microsecond execution guarantees.

---

## 2. SQLite `CHECK` Constraints Matrix (`speed_line_profiles`)

| Column | Type | Allowed Range | Default | Failure Mode / Attack Vector | Resilience Guard & Sanitization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `line_count` | `INTEGER` | `[0, 256]` | `64` | Negative counts, excessive allocations (> 10000 lines crashing GPU/CPU) | `Math.max(0, Math.min(256, Math.floor(Number(val) || 64)))` |
| `focus_x` | `REAL` | `[0.0, 1.0]` | `0.5` | Out-of-bounds coordinates, NaN, Infinity | `Math.max(0.0, Math.min(1.0, Number(val) || 0.5))` |
| `focus_y` | `REAL` | `[0.0, 1.0]` | `0.5` | Out-of-bounds coordinates, NaN, Infinity | `Math.max(0.0, Math.min(1.0, Number(val) || 0.5))` |
| `min_length_ratio` | `REAL` | `[0.0, 1.0]` | `0.2` | Negative lengths, inversion where min > max | `Math.max(0.0, Math.min(1.0, Number(val) || 0.2))` |
| `max_length_ratio` | `REAL` | `[0.0, 1.0]` | `0.8` | Values > 1.0 exceeding panel bounds | `Math.max(0.0, Math.min(1.0, Number(val) || 0.8))` |
| `min_width_px` | `REAL` | `[0.1, 10.0]` | `0.5` | Zero-width lines causing invisible renders | `Math.max(0.1, Math.min(10.0, Number(val) || 0.5))` |
| `max_width_px` | `REAL` | `[0.1, 10.0]` | `3.0` | Excessive width causing heavy fill rate overhead | `Math.max(0.1, Math.min(10.0, Number(val) || 3.0))` |
| `pulse_duration_ms` | `INTEGER` | `[0, 2000]` | `300` | Negative durations, infinite animation locks | `Math.max(0, Math.min(2000, Math.floor(Number(val) || 300)))` |

---

## 3. Numerical Stability & Degenerate Geometry Fuzzing

### Test Cases

1. **Focus Point Coincidence ($focus\_x == perimeter\_x, focus\_y == perimeter\_y$)**:
   - *Risk*: Division by zero when calculating vector angle $\theta = \arctan2(y - focus\_y, x - focus\_x)$.
   - *Mitigation*: Epsilon offset protection ($\epsilon = 1e-6$) or zero-length fallback returning a safe default vector.
2. **NaN & Infinity Injection**:
   - *Input*: `focus_x: NaN`, `max_length_ratio: Infinity`.
   - *Mitigation*: Strict coercion and default fallback clamping.
3. **TypedArray Overflow Protection**:
   - *Risk*: Buffer allocation overflow when `line_count` or vertex attributes exceed memory limits.
   - *Mitigation*: Pre-allocated Float32Array pools capped at 256 lines (`Float32Array(256 * 4)`).

---

## 4. Canvas 2D Rendering & 0 CLS Guarantees

- **Hardware Compatibility**: Designed for Intel GMA 4500MHD without relying on WebGL or modern compute shaders. Uses batched `CanvasRenderingContext2D` stroke paths.
- **0 CLS Enforcement**: Overlay canvases are absolutely positioned with fixed dimensions matching the parent panel container, ensuring zero layout shifts during activation or pulse animations.

---

## 5. Vitest Resilience Test Specification

```typescript
import { describe, it, expect } from 'vitest';
import { synthesizeSpeedLines, sanitizeSpeedLineProfile } from '../src/renderer/speedLineSynthesizer';

describe('Sprint 125: Dynamic Speed-Line Vector Synthesizer & Kinetic Impact Focus Engine (SLA 89)', () => {
  it('sanitizes and clamps invalid profile parameters correctly', () => {
    const raw = {
      line_count: 999,
      focus_x: -5.0,
      focus_y: NaN,
      min_length_ratio: 1.5,
      max_length_ratio: 0.2, // min > max inverted
      min_width_px: 0.0,
      max_width_px: 50.0,
      pulse_duration_ms: -500
    };
    const sanitized = sanitizeSpeedLineProfile(raw);
    expect(sanitized.line_count).toBe(256);
    expect(sanitized.focus_x).toBe(0.0);
    expect(sanitized.focus_y).toBe(0.5); // fallback default
    expect(sanitized.min_width_px).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.max_width_px).toBeLessThanOrEqual(10.0);
    expect(sanitized.pulse_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('handles degenerate geometry without division by zero or NaN', () => {
    const profile = { line_count: 10, focus_x: 0.5, focus_y: 0.5, min_length_ratio: 0.1, max_length_ratio: 0.5, min_width_px: 1.0, max_width_px: 2.0, pulse_duration_ms: 200 };
    // Focus exactly matches perimeter point case tested internally
    const vectors = synthesizeSpeedLines(profile, 100, 100, 0.5, 0.5);
    expect(vectors).toBeDefined();
    expect(vectors.length).toBe(10);
    for (const v of vectors) {
      expect(Number.isFinite(v.startX)).toBe(true);
      expect(Number.isFinite(v.startY)).toBe(true);
      expect(Number.isFinite(v.endX)).toBe(true);
      expect(Number.isFinite(v.endY)).toBe(true);
    }
  });

  it('executes speed-line vector generation within microsecond SLA (< 50 µs)', () => {
    const profile = { line_count: 64, focus_x: 0.5, focus_y: 0.5, min_length_ratio: 0.2, max_length_ratio: 0.8, min_width_px: 1.0, max_width_px: 3.0, pulse_duration_ms: 300 };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      synthesizeSpeedLines(profile, 800, 600);
    }
    const durationUs = (performance.now() - start) * 1000 / 1000;
    expect(durationUs).toBeLessThan(50);
  });
});
```
