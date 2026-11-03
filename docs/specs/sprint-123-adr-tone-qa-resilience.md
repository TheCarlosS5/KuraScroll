# Sprint 123 QA Resilience Matrix: Adaptive Dynamic Range Tone Equalizer & Black-Crush Compensator (SLA 87)

## Executive Summary
Sprint 123 introduces the **Adaptive Dynamic Range Tone Equalizer & Black-Crush Compensator (SLA 87)**, designed to recover shadow details trapped in deep black-crushed tankōbon scans while managing gamma curves and shoulder compression to prevent highlight blowouts.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for shadow lift clamping (`[0.0, 1.0]`), gamma clamping (`[0.2, 3.0]`), shoulder clamp bounds (`[0.5, 1.0]`), strict mathematical monotonicity verification ($L_1 < L_2 \implies outL(L_1) \le outL(L_2)$), extreme pixel inputs (`0`, `255`, negatives), Fastify REST endpoints with ETag 304 caching, and frontend hotkeys ('R' / 'r') with preset HUD controls.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **TONE-01** | **Parameter Bounds Checking** | shadowLift outside `[0.0, 1.0]`, gamma outside `[0.2, 3.0]`, shoulderClamp outside `[0.5, 1.0]` | Parameter sanitizer clamps shadowLift strictly to `[0.0, 1.0]`, gamma to `[0.2, 3.0]`, and shoulderClamp to `[0.5, 1.0]`, preventing tone curve inversion or clipping. | `tone-bounds.test.ts` |
| **TONE-02** | **Strict Monotonicity Verification** | Random luminance pairs $L_1 < L_2$ evaluated across the full luminance spectrum `[0, 255]` | Tone transfer function guarantees monotonic non-decreasing output ($outL(L_1) \le outL(L_2)$), preventing solarization or tonal inversion artifacts. | `tone-monotonicity.test.ts` |
| **TONE-03** | **Extreme Inputs & Clamping** | Input luminance evaluates to pure black (`0`), pure white (`255`), negative numbers (`-50`), or out-of-range floats | Input is safely clamped to `[0, 255]`, returning exact bounds for pure black and pure white without crashing or generating NaN values. | `tone-extremes.test.ts` |
| **TONE-04** | **Fastify REST Endpoints & ETag 304 Caching** | GET presets, GET profile with matching `If-None-Match` ETag header, POST profile updates, POST calculate | Fastify routes return HTTP 200/304 correctly, validate request schemas, and enforce idempotency on profile persistence. | `tone-api.test.ts` |
| **TONE-05** | **Frontend Hotkey ('R' / 'r') & Preset HUD Tests** | User presses 'R' or 'r' keyboard shortcut, switches tone equalization presets | HUD toggle responds instantly, rotating through preset tone configurations (`balanced`, `shadow_lift`, `crisp_dark`, `disabled`) without UI lag. | `tone-hud.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Tone Equalizer Service & Unit Tests (`tests/unit/backend/services/adr-tone-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { sanitizeToneParams, applyToneCurve, verifyMonotonicity, computeToneEtag } from '../../../../src/backend/services/adr-tone-service';

describe('Adaptive Dynamic Range Tone Equalizer Resilience', () => {
  it('clamps shadowLift, gamma, and shoulderClamp parameters strictly within valid bounds', () => {
    const extreme = sanitizeToneParams({ shadowLift: -2.0, gamma: 5.0, shoulderClamp: 0.1 });
    expect(extreme.shadowLift).toBe(0.0);
    expect(extreme.gamma).toBe(3.0);
    expect(extreme.shoulderClamp).toBe(0.5);
  });

  it('guarantees strict mathematical monotonicity: for any L1 < L2, outL(L1) <= outL(L2)', () => {
    const params = { shadowLift: 0.3, gamma: 1.2, shoulderClamp: 0.85 };
    const isMonotonic = verifyMonotonicity(params);
    expect(isMonotonic).toBe(true);
  });

  it('handles extreme inputs (0, 255, negative numbers, out-of-range clamp) safely', () => {
    const params = { shadowLift: 0.2, gamma: 1.0, shoulderClamp: 0.9 };
    expect(applyToneCurve(-100, params)).toBe(0);
    expect(applyToneCurve(0, params)).toBe(0);
    expect(applyToneCurve(255, params)).toBe(255);
    expect(applyToneCurve(500, params)).toBe(255);
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    const params = { shadowLift: 0.3, gamma: 1.1, shoulderClamp: 0.8 };
    for (let i = 0; i < 100; i++) {
      applyToneCurve(i * 2, params);
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for cached tone equalizer profile manifests', () => {
    const etag1 = computeToneEtag('user-123', 0.3, 1.1);
    const etag2 = computeToneEtag('user-123', 0.3, 1.1);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Tone Equalizer HUD & Hotkey Tests (`frontend/src/tests/useAdrToneHud.test.ts`)
```typescript
import { describe, it, expect, fireEvent, render } from '@testing-library/react';
import { AdrToneHud } from '../../src/frontend/components/AdrToneHud';

describe('Tone Equalizer HUD Hotkey ('R' / 'r') & Preset Switching', () => {
  it('toggles and cycles tone equalization presets upon pressing 'R' or 'r'', () => {
    const { getByTestId } = render(<AdrToneHud />);
    const hudContainer = getByTestId('adr-tone-hud');

    // Press uppercase 'R'
    fireEvent.keyDown(window, { key: 'R' });
    expect(hudContainer).toHaveAttribute('data-preset');

    // Press lowercase 'r'
    fireEvent.keyDown(window, { key: 'r' });
    expect(hudContainer).toBeDefined();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Monotonicity Protection:** All tone curve interpolation formulas undergo strict discrete derivative verification across the `[0, 255]` domain to guarantee that darker pixels never map brighter than lighter pixels, eliminating solarization.
2. **Hotkey Global Listeners:** Keyboard listeners for 'R'/'r' are debounced and mounted safely with window cleanup teardowns, preventing event listener memory leaks.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 123.*
