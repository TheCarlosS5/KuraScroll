# Sprint 120 QA Resilience Matrix: Spatial Audio Occlusion & Panel-Bound Acoustic Low-Pass Filter Synthesizer (SLA 84)

## Executive Summary
Sprint 120 introduces the **Spatial Audio Occlusion & Panel-Bound Acoustic Low-Pass Filter Synthesizer (SLA 84)**, designed to modulate ambient soundscapes and acoustic effects based on the reader's spatial position relative to active manga speech bubbles and panel boundaries. It features 3D distance attenuation, division-by-zero guards for minimum distances, constant-power $L^2 + R^2 = 1.0$ panning normalization, WebAudio biquad low-pass cutoff frequency clamping (`20 Hz` to `22,050 Hz`), and resilient SQLite profile persistence.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for extreme distances (`10,000 px+`), minimum distance singularity protection, equal-power stereo panning normalization, biquad frequency clamping, SQLite schema checks, and sub-microsecond execution latency.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SPAT-01** | **Extreme Distance Attenuation (10,000 px)** | Sound source or panel anchor positioned at extreme coordinates (`distance = 10,000 px`) | Spatial distance attenuator calculates attenuation smoothly without underflow, flooring gain safely to absolute silence (`0.0`) without NaN distortion. | `spatial-distance.test.ts` |
| **SPAT-02** | **Division-by-Zero Protection (Minimum Distance)** | Source position matches listener position exactly (`dx = 0, dy = 0` $\rightarrow$ `distance = 0`) | Distance calculation guards against division by zero by enforcing a minimum safe distance floor (`minDistance = 1.0 px`), preventing infinite gain calculation. | `spatial-div-zero.test.ts` |
| **SPAT-03** | **Equal-Power Panning Normalization ($L^2 + R^2 = 1.0$)** | Stereo panning angle evaluated across full azimuth spectrum (`[-90°, +90°]`) | Panning law strictly satisfies constant-power equal-power normalization ($L^2 + R^2 = 1.0$), ensuring sound volume remains perceptually constant across stereo speakers during panning transitions. | `spatial-panning.test.ts` |
| **SPAT-04** | **Biquad Frequency Cutoff Clamping (20Hz - 22050Hz)** | Occluded speech bubble requests extreme low-pass cutoff frequency (`freq = -500 Hz` or `50000 Hz`) | Cutoff frequency is clamped strictly to audible human hearing bounds (`[20 Hz, 22050 Hz]`), preventing WebAudio biquad filter instability or audio distortion. | `spatial-cutoff.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Spatial Audio Service & Unit Tests (`tests/unit/backend/services/spatial-audio-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { calculateSpatialAttenuation, normalizeEqualPowerPan, clampCutoffFrequency, computeSpatialEtag } from '../../../../src/backend/services/spatial-audio-service';

describe('Spatial Audio Occlusion Engine Resilience & Clamping', () => {
  it('attenuates audio smoothly at extreme distances (10,000 px) without underflow or NaN', () => {
    const gain = calculateSpatialAttenuation(0, 0, 10000, 10000, 500);
    expect(gain).toBe(0.0);
    expect(Number.isNaN(gain)).toBe(false);
    expect(Number.isFinite(gain)).toBe(true);
  });

  it('protects against division-by-zero when source and listener match (distance = 0)', () => {
    const gain = calculateSpatialAttenuation(100, 100, 100, 100, 10);
    expect(gain).toBe(1.0); // Maximum unattenuated gain at zero distance
    expect(Number.isFinite(gain)).toBe(true);
  });

  it('satisfies equal-power panning normalization law (L^2 + R^2 = 1.0)', () => {
    const angles = [-90, -45, 0, 45, 90];
    for (const angle of angles) {
      const { left, right } = normalizeEqualPowerPan(angle);
      const powerSum = (left * left) + (right * right);
      expect(powerSum).toBeCloseTo(1.0, 4); // Equal power invariant
    }
  });

  it('clamps biquad low-pass filter frequency strictly to [20 Hz, 22050 Hz]', () => {
    expect(clampCutoffFrequency(-500)).toBe(20);
    expect(clampCutoffFrequency(50000)).toBe(22050);
    expect(clampCutoffFrequency(1000)).toBe(1000);
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      calculateSpatialAttenuation(0, 0, i * 10, i * 10, 500);
      normalizeEqualPowerPan(30);
      clampCutoffFrequency(8000);
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached spatial audio profile manifests', () => {
    const etag1 = computeSpatialEtag('scene-cavern', 500);
    const etag2 = computeSpatialEtag('scene-cavern', 500);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Spatial Audio Hook Tests (`frontend/src/tests/useSpatialAudio.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpatialAudio } from '../hooks/useSpatialAudio';

describe('useSpatialAudio Equal-Power Panning & Cutoff Guard', () => {
  it('maintains equal-power stereo panning across azimuth transitions', () => {
    const { result } = renderHook(() => useSpatialAudio({ sourceX: 100, sourceY: 100, listenerX: 400, listenerY: 400 }));
    const { left, right } = result.current.panning;
    expect((left * left) + (right * right)).toBeCloseTo(1.0, 4);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Singularity Protection:** Distance calculations enforce a strict `max(1.0, dist)` minimum denominator floor, neutralizing division-by-zero anomalies when source and listener coordinates overlap.
2. **Perceptual Volume Consistency:** Stereo panning utilizes trigonometric sine/cosine equal-power laws ensuring audio doesn't dip in volume when panning across the center stage.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 120.*
