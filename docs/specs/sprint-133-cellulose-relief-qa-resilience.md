# Sprint 133: Cellulose Fiber Micro-Relief & Paper Grain Texture Engine (SLA 97) - QA & Resilience Test Matrix

Target Host: Intel Pentium T4500 (2C/2T 2.3GHz, 1MB L2 cache, no AVX, heap <= 512MB), GPU Intel GMA 4500MHD, HDD 4TB SATA II 5400 RPM.  
Author: Senior QA Resilience Engineer  
Status: Approved & Validated

---

## 1. Overview & Objectives

Sprint 133 introduces the **Cellulose Fiber Micro-Relief & Paper Grain Texture Engine (SLA 97)**, synthesizing realistic physical paper grain topography and micro-relief surface scattering to give digital manga pages the tactile look and feel of authentic wood-free or recycled cellulose paper stock.

This specification outlines the exhaustive test matrix covering coordinate bounds, absolute black ink relief suppression ($K=1.0$), extreme grazing light angles ($0^\circ$ and $90^\circ$), TypedArray memory immutability/safety, Fastify REST endpoints with ETag/304 caching, SQLite WAL persistence, and microsecond execution guarantees (`< 50 µs` assertion).

---

## 2. Parameter Bounds & Relief Matrix

| Parameter | Type | Allowed Range | Default | Failure Mode / Attack Vector | Resilience Guard & Sanitization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `grain_scale` | `REAL` | `[0.1, 5.0]` | `1.0` | Zero scale (division by zero), negative frequency | `Math.max(0.1, Math.min(5.0, Number(val) || 1.0))` |
| `relief_depth` | `REAL` | `[0.0, 1.0]` | `0.25` | Negative depth, excessive blowout (> 1.0) | `Math.max(0.0, Math.min(1.0, Number(val) || 0.25))` |
| `fiber_density`| `REAL` | `[0.0, 1.0]` | `0.5` | Out-of-bounds density | `Math.max(0.0, Math.min(1.0, Number(val) || 0.5))` |
| `light_angle` | `REAL` | `[0.0, 1.57079]`| `0.785` | Negative angles or $> \pi/2$ ($90^\circ$) | `Math.max(0.0, Math.min(Math.PI / 2, Number(val) || 0.785))` |

---

## 3. Edge-Case Test Suite

### 1. Absolute Black Ink Relief Suppression ($K=1.0$)
- **Condition**: Pixels with solid black ink density $K = 1.0$ (heavy tankōbon outlines or solid black fills).
- **Expected Behavior**: Paper grain relief must be suppressed entirely (relief contribution = 0.0), simulating how thick ink completely flattens and seals over underlying paper fibers.

### 2. Extreme Grazing Light Angles ($0^\circ$ and $90^\circ$)
- **$0^\circ$ Incidence (Parallel Light)**: Surface shading collapses to uniform ambient tone; relief shadows drop to zero.
- **$90^\circ$ Incidence (Perpendicular Light)**: Maximum vertical relief contrast with sharp micro-shadowing.
- **Resilience**: Ensure `Math.cos()` and `Math.sin()` terms never trigger division by zero at boundary angles.

### 3. TypedArray Memory Immutability & Safety
- **Condition**: Processing textures via shared `Float32Array` or `Uint8ClampedArray` buffers.
- **Expected Behavior**: Input buffers must remain immutable (read-only reference semantics) while output buffers are safely allocated within the 512MB heap ceiling without memory leaks or buffer overflows.

---

## 4. Fastify REST & SQLite WAL Persistence

- **Endpoints**:
  - `GET /api/v1/reader/cellulose-relief/presets`
  - `GET /api/v1/reader/cellulose-relief/profile` (Supports ETag `304 Not Modified`)
  - `POST /api/v1/reader/cellulose-relief/profile` (Validates and persists via SQLite WAL)
  - `POST /api/v1/reader/cellulose-relief/calculate`
- **Integrity**: Strict schema validation rejecting out-of-range parameters prior to database writes.

---

## 5. Vitest Resilience Test Specification

```typescript
import { describe, it, expect } from 'vitest';
import { synthesizeCelluloseRelief, sanitizeReliefProfile } from '../src/renderer/celluloseRelief';

describe('Sprint 133: Cellulose Fiber Micro-Relief & Paper Grain Texture Engine (SLA 97)', () => {
  it('sanitizes and clamps aberrant relief parameters correctly', () => {
    const raw = { grain_scale: -5.0, relief_depth: 2.5, fiber_density: NaN, light_angle: 5.0 };
    const sanitized = sanitizeReliefProfile(raw);
    expect(sanitized.grain_scale).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.relief_depth).toBeLessThanOrEqual(1.0);
    expect(sanitized.fiber_density).toBeGreaterThanOrEqual(0.0);
    expect(sanitized.light_angle).toBeLessThanOrEqual(Math.PI / 2);
  });

  it('suppresses paper relief entirely on absolute black ink (K=1.0)', () => {
    const profile = { grain_scale: 1.0, relief_depth: 0.5, fiber_density: 0.5, light_angle: 0.785 };
    const whitePaperRelief = synthesizeCelluloseRelief(100, 100, 0.0, 1.0, profile); // K=0
    const blackInkRelief = synthesizeCelluloseRelief(100, 100, 1.0, 1.0, profile);     // K=1
    
    expect(whitePaperRelief).not.toBe(0);
    expect(blackInkRelief).toBeCloseTo(0.0, 3);
  });

  it('handles extreme grazing light angles (0 and 90 degrees) safely without NaN', () => {
    const profile0 = { grain_scale: 1.0, relief_depth: 0.5, fiber_density: 0.5, light_angle: 0.0 };
    const profile90 = { grain_scale: 1.0, relief_depth: 0.5, fiber_density: 0.5, light_angle: Math.PI / 2 };
    
    const res0 = synthesizeCelluloseRelief(50, 50, 0.2, 1.0, profile0);
    const res90 = synthesizeCelluloseRelief(50, 50, 0.2, 1.0, profile90);
    
    expect(Number.isFinite(res0)).toBe(true);
    expect(Number.isFinite(res90)).toBe(true);
  });

  it('executes micro-relief calculation within microsecond SLA (< 50 µs)', () => {
    const profile = { grain_scale: 1.0, relief_depth: 0.25, fiber_density: 0.5, light_angle: 0.785 };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      synthesizeCelluloseRelief(150, 200, 0.1, 1.0, profile);
    }
    const durationUs = (performance.now() - start) * 1000 / 1000;
    expect(durationUs).toBeLessThan(50);
  });
});
```
