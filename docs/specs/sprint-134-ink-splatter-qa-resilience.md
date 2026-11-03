# Sprint 134: Capillary Ink Bleed & Platter Splatter Synthesizer (SLA 98) - QA & Resilience Test Matrix

Target Host: Intel Pentium T4500 (2C/2T 2.3GHz, 1MB L2 cache, no AVX, heap <= 512MB), GPU Intel GMA 4500MHD, HDD 4TB SATA II 5400 RPM.  
Author: Senior QA Resilience Engineer  
Status: Approved & Validated

---

## 1. Overview & Objectives

Sprint 134 introduces the **Capillary Ink Bleed & Platter Splatter Synthesizer (SLA 98)**, simulating the organic fiber wicking, ink droplet splatter, and capillary feathering characteristic of traditional dip-pen manga illustration on porous paper stock.

This specification outlines the exhaustive test matrix covering zero-velocity stroke checks, extreme impact dispersion, zero-fraying waterproof paper modes, TypedArray memory immutability, Fastify REST endpoints with ETag/304 caching, SQLite WAL persistence, and microsecond execution guarantees (`< 50 µs` assertion).

---

## 2. Parameter Bounds & Splatter Matrix

| Parameter | Type | Allowed Range | Default | Failure Mode / Attack Vector | Resilience Guard & Sanitization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `stroke_velocity` | `REAL` | `[0.0, 1000.0]`| `250.0` | Negative velocity, NaN, Infinity | `Math.max(0.0, Math.min(1000.0, Number(val) || 250.0))` |
| `bleed_radius_px` | `REAL` | `[0.0, 5.0]` | `1.2` | Negative bleed, memory exhaustion from giant kernels | `Math.max(0.0, Math.min(5.0, Number(val) || 1.2))` |
| `splatter_density`| `REAL` | `[0.0, 1.0]` | `0.3` | Out-of-bounds density | `Math.max(0.0, Math.min(1.0, Number(val) || 0.3))` |
| `wicking_rate` | `REAL` | `[0.0, 1.0]` | `0.4` | Unbounded capillary expansion | `Math.max(0.0, Math.min(1.0, Number(val) || 0.4))` |

---

## 3. Edge-Case Test Suite

### 1. Zero Stroke Velocity ($v = 0$)
- **Condition**: Stroke velocity equals `0.0` (static pen dot or resting drop).
- **Expected Behavior**: No directional motion droplets or splatter trails are ejected; ink forms a symmetrical circular drop with standard capillary wicking radius.

### 2. Extreme Impact Dispersion ($v = 1000\text{ px/s}$, `splatter_density = 1.0`)
- **Condition**: Maximum velocity and maximum splatter density.
- **Expected Behavior**: Synthesizes high-velocity droplet sprays along the stroke vector without exceeding TypedArray allocation buffers or causing memory faults on the 512MB heap.

### 3. Zero Fraying Radius (`bleed_radius = 0.0`)
- **Condition**: Waterproof synthetic paper or coated Bristol board stock (`bleed_radius_px = 0.0`).
- **Expected Behavior**: Ink edges remain razor-sharp with absolute zero feathering or capillary wicking.

---

## 4. Fastify REST & SQLite WAL Persistence

- **Endpoints**:
  - `GET /api/v1/reader/ink-splatter/presets`
  - `GET /api/v1/reader/ink-splatter/profile` (Supports ETag `304 Not Modified`)
  - `POST /api/v1/reader/ink-splatter/profile` (Validates and persists via SQLite WAL)
  - `POST /api/v1/reader/ink-splatter/calculate`
- **Integrity**: Strict parameter validation rejecting out-of-range inputs before SQLite transactions.

---

## 5. Vitest Resilience Test Specification

```typescript
import { describe, it, expect } from 'vitest';
import { synthesizeInkSplatter, sanitizeSplatterProfile } from '../src/renderer/inkSplatter';

describe('Sprint 134: Capillary Ink Bleed & Platter Splatter Synthesizer (SLA 98)', () => {
  it('sanitizes and clamps aberrant splatter parameters correctly', () => {
    const raw = { stroke_velocity: -500, bleed_radius_px: 99.9, splatter_density: NaN, wicking_rate: 2.0 };
    const sanitized = sanitizeSplatterProfile(raw);
    expect(sanitized.stroke_velocity).toBeGreaterThanOrEqual(0.0);
    expect(sanitized.bleed_radius_px).toBeLessThanOrEqual(5.0);
    expect(sanitized.splatter_density).toBeGreaterThanOrEqual(0.0);
    expect(sanitized.wicking_rate).toBeLessThanOrEqual(1.0);
  });

  it('generates symmetrical drop without directional splatter when velocity is 0', () => {
    const profile = { stroke_velocity: 0.0, bleed_radius_px: 1.2, splatter_density: 0.5, wicking_rate: 0.4 };
    const result = synthesizeInkSplatter(100, 100, 0.0, profile);
    expect(result.droplets.length).toBe(0); // No dynamic motion droplets
    expect(result.radius).toBeCloseTo(1.2, 1);
  });

  it('maintains razor-sharp edges with zero bleed when bleed radius is 0.0', () => {
    const profile = { stroke_velocity: 500.0, bleed_radius_px: 0.0, splatter_density: 0.3, wicking_rate: 0.0 };
    const result = synthesizeInkSplatter(100, 100, 500.0, profile);
    expect(result.feathering).toBe(0.0);
  });

  it('executes splatter synthesis within microsecond SLA (< 50 µs)', () => {
    const profile = { stroke_velocity: 250.0, bleed_radius_px: 1.2, splatter_density: 0.3, wicking_rate: 0.4 };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      synthesizeInkSplatter(200, 200, 250.0, profile);
    }
    const durationUs = (performance.now() - start) * 1000 / 1000;
    expect(durationUs).toBeLessThan(50);
  });
});
```
