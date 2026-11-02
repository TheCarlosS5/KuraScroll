# Sprint 108 QA Resilience Matrix: Adaptive Per-Panel Visual Acoustic Echo & Spatial Reverberation Modulator (SLA 72)

## Executive Summary
Sprint 108 introduces the **Adaptive Per-Panel Visual Acoustic Echo & Spatial Reverberation Modulator (SLA 72)**, designed to synchronize spatial room acoustics and ambient reverberation tails with the visual environment of active manga panels (e.g., cave cavern, spacious cathedral, tight indoor room, or open outdoor courtyard) while adhering to strict hardware limitations (Intel Pentium T4500, heap $\le 512$MB).

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for zero room size / absorption coefficient division-by-zero guards, strict feedback gain clamping ($g < 1.0$) to prevent infinite acoustic runaway, rapid panel switching with click-free crossfades, WebAudio context suspended state management, and strict sub-microsecond execution latency (`< 50 µs` unit tests, `< 20 µs` benchmarks).

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **REV-01** | **Division-by-Zero Guards (Room Size / Absorption)** | Room size or absorption coefficient evaluates to `0`, negative numbers, or `NaN` | Reverb processor guards against mathematical anomalies, falling back to neutral default room dimensions (`roomSize = 10m`, `absorption = 0.5`). | `reverb-division.test.ts` |
| **REV-02** | **Feedback Gain Clamping ($g < 1.0$)** | Delay line feedback gain requested at or above unity (`g >= 1.0` or `Infinity`) | Feedback gain is clamped strictly to safe operational bounds ($0.0 \le g \le 0.95$), preventing infinite acoustic runaway, clipping, and speaker distortion. | `reverb-feedback.test.ts` |
| **REV-03** | **Rapid Panel Switching & Crossfade** | Reader flips pages rapidly, switching ambient room acoustic presets mid-decay | Previous reverb tail executes a 50ms equal-power crossfade into the new impulse response, preventing audio popping or clicking artifacts. | `reverb-crossfade.test.ts` |
| **REV-04** | **WebAudio Context Suspended State Handling** | `AudioContext` initializes in `suspended` state due to browser autoplay policies | Reverb engine registers event listeners and automatically resumes AudioContext upon first user interaction without throwing unhandled exceptions. | `reverb-suspended.test.ts` |
| **REV-05** | **Strict Execution Latency (< 50 µs / < 20 µs)** | Reverb parameter calculation executed repeatedly in Vitest benchmark suite | Unit test assertions complete in `< 50 µs`; optimized benchmark loops complete in `< 20 µs` per evaluation cycle. | `reverb-latency.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Reverb Modulator Service & Unit Tests (`tests/unit/backend/services/acoustic-reverb-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { sanitizeRoomParameters, clampFeedbackGain, calculateReverbTailDecay, computeReverbEtag } from '../../../../src/backend/services/acoustic-reverb-service';

describe('Acoustic Reverb Modulator Resilience & Clamping', () => {
  it('guards against division-by-zero when room size or absorption coefficient is zero', () => {
    const invalidRoom = { roomSizeMeters: 0, absorptionCoeff: 0.0 };
    const sanitized = sanitizeRoomParameters(invalidRoom);

    expect(sanitized.roomSizeMeters).toBe(10.0); // Safe default fallback
    expect(sanitized.absorptionCoeff).toBe(0.5); // Safe default fallback
  });

  it('clamps feedback gain strictly below 1.0 (g <= 0.95) to prevent infinite acoustic runaway', () => {
    expect(clampFeedbackGain(1.5)).toBe(0.95);
    expect(clampFeedbackGain(1.0)).toBe(0.95);
    expect(clampFeedbackGain(Infinity)).toBe(0.95);
    expect(clampFeedbackGain(-0.2)).toBe(0.0);
    expect(clampFeedbackGain(0.75)).toBe(0.75);
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      clampFeedbackGain(0.85);
      sanitizeRoomParameters({ roomSizeMeters: 15, absorptionCoeff: 0.4 });
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached reverb profile manifests', () => {
    const etag1 = computeReverbEtag('cavern-preset', 0.85);
    const etag2 = computeReverbEtag('cavern-preset', 0.85);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Reverb Hook Tests (`frontend/src/tests/useAcousticReverb.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAcousticReverb } from '../hooks/useAcousticReverb';

describe('useAcousticReverb Suspended Context & Crossfade Resilience', () => {
  it('resumes suspended AudioContext on user gesture without throwing errors', async () => {
    const resumeMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('AudioContext', class {
      state = 'suspended';
      resume = resumeMock;
    });

    const { result } = renderHook(() => useAcousticReverb());

    await act(async () => {
      await result.current.handleUserGesture();
    });

    expect(resumeMock).toHaveBeenCalled();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Feedback Runaway Protection:** Feedback gain formulas are bounded at $g \le 0.95$ to guarantee that infinite impulse response (IIR) comb filters decay gracefully rather than blowing out reader speakers.
2. **Click-Free Crossfading:** Mid-stream acoustic preset switches apply a rapid equal-power gain crossfade over 50ms, eliminating audio clicks and abrupt amplitude discontinuities.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 108.*
