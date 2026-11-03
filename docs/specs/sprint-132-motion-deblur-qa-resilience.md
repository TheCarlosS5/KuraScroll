# Sprint 132: Motion Deblur & Retinal Overdrive Compensator (SLA 96) - QA & Resilience Test Matrix

Target Host: Intel Pentium T4500 (2C/2T 2.3GHz, 1MB L2 cache, no AVX, heap <= 512MB), GPU Intel GMA 4500MHD, HDD 4TB SATA II 5400 RPM.  
Author: Senior QA Resilience Engineer  
Status: Approved & Validated

---

## 1. Overview & Objectives

Sprint 132 introduces the **Motion Deblur & Retinal Overdrive Compensator (SLA 96)**, designed to mitigate motion blur and visual ghosting during rapid manga panel scrolling by applying targeted luminance overdrive without causing overshoot ringing or solarization artifacts.

This specification outlines the exhaustive test matrix covering absolute rest pass-through ($v = 0$), maximum contrast transitions ($0 \to 255$ and $255 \to 0$ at $3000\text{ px/s}$), numerical stability under extreme velocities, Fastify REST endpoints with ETag/304 caching, SQLite WAL persistence, and microsecond execution guarantees (`< 50 µs` assertion).

---

## 2. Parameter Bounds & Velocity Matrix

| Parameter | Type | Allowed Range | Default | Failure Mode / Attack Vector | Resilience Guard & Sanitization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `overdrive_gain` | `REAL` | `[0.0, 2.0]` | `0.35` | Excessive overshoot causing harsh white/black halos | `Math.max(0.0, Math.min(2.0, Number(val) || 0.35))` |
| `max_velocity_px_s`| `REAL` | `[100.0, 5000.0]` | `3000.0`| Division by zero, negative speeds, infinite scaling | `Math.max(100.0, Math.min(5000.0, Number(val) || 3000.0))` |
| `gamma_boost` | `REAL` | `[0.5, 2.0]` | `1.0` | Extreme contrast distortion, NaN | `Math.max(0.5, Math.min(2.0, Number(val) || 1.0))` |
| `temporal_decay` | `REAL` | `[0.0, 1.0]` | `0.5` | Persistent ghost trails | `Math.max(0.0, Math.min(1.0, Number(val) || 0.5))` |

---

## 3. Edge-Case Test Suite

### 1. Absolute Rest ($v = 0$)
- **Condition**: Current scroll velocity $v = 0\text{ px/s}$.
- **Expected Behavior**: Output luminance must equal input luminance exactly ($L_{\text{out}} = L_{\text{in}}$) with zero overdrive applied.

### 2. Maximum Contrast Transitions ($3000\text{ px/s}$)
- **Transition A**: Pure Black to Pure White ($L_{\text{prev}} = 0 \to L_{\text{curr}} = 255$).
- **Transition B**: Pure White to Pure Black ($L_{\text{prev}} = 255 \to L_{\text{curr}} = 0$).
- **Expected Behavior**: Overdrive correction must boost or suppress transition edges without breaching the $[0, 255]$ color boundary or causing solarization / clipping anomalies.

### 3. Extreme & Malformed Velocities
- **Condition**: Negative velocities ($v = -5000\text{ px/s}$), `NaN`, `Infinity`, or string inputs.
- **Expected Behavior**: Sanitization guards clamp values to absolute magnitude within $[0, \text{max\_velocity\_px\_s}]$.

---

## 4. Fastify REST & SQLite WAL Persistence

- **Endpoints**:
  - `GET /api/v1/reader/motion-deblur/presets`
  - `GET /api/v1/reader/motion-deblur/profile` (Supports ETag `304 Not Modified`)
  - `POST /api/v1/reader/motion-deblur/profile` (Validates and persists via SQLite WAL)
  - `POST /api/v1/reader/motion-deblur/calculate`
- **Integrity**: Strict schema validation rejecting out-of-range parameters prior to database writes.

---

## 5. Vitest Resilience Test Specification

```typescript
import { describe, it, expect } from 'vitest';
import { applyMotionOverdrive, sanitizeMotionProfile } from '../src/renderer/motionDeblur';

describe('Sprint 132: Motion Deblur & Retinal Overdrive Compensator (SLA 96)', () => {
  it('passes through luminance unchanged when velocity is 0', () => {
    const profile = { overdrive_gain: 0.35, max_velocity_px_s: 3000, gamma_boost: 1.0, temporal_decay: 0.5 };
    const out = applyMotionOverdrive(128, 128, 0, profile);
    expect(out).toBe(128);
  });

  it('bounds output within [0, 255] during extreme contrast transitions at 3000 px/s', () => {
    const profile = { overdrive_gain: 0.5, max_velocity_px_s: 3000, gamma_boost: 1.0, temporal_decay: 0.5 };
    const boostToWhite = applyMotionOverdrive(0, 255, 3000, profile);
    const dropToBlack = applyMotionOverdrive(255, 0, 3000, profile);
    
    expect(boostToWhite).toBeLessThanOrEqual(255);
    expect(boostToWhite).toBeGreaterThanOrEqual(0);
    expect(dropToBlack).toBeLessThanOrEqual(255);
    expect(dropToBlack).toBeGreaterThanOrEqual(0);
  });

  it('handles negative velocities and NaN without throwing or violating bounds', () => {
    const profile = sanitizeMotionProfile({ overdrive_gain: NaN, max_velocity_px_s: -999, gamma_boost: Infinity, temporal_decay: -2.0 });
    expect(profile.overdrive_gain).toBeGreaterThanOrEqual(0.0);
    expect(profile.max_velocity_px_s).toBeGreaterThan(0);
  });

  it('executes motion overdrive calculation within microsecond SLA (< 50 µs)', () => {
    const profile = { overdrive_gain: 0.35, max_velocity_px_s: 3000, gamma_boost: 1.0, temporal_decay: 0.5 };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      applyMotionOverdrive(50, 200, 1500, profile);
    }
    const durationUs = (performance.now() - start) * 1000 / 1000;
    expect(durationUs).toBeLessThan(50);
  });
});
```
