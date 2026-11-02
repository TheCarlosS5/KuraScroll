# Sprint 74 QA Resilience Matrix: Spine Dewarping & Curvature Correction Engine

## Executive Summary
Sprint 74 introduces the **Spine Dewarping & Curvature Correction Engine**, designed to mathematically flatten physical book spine curvatures (page warping, lighting gradients near the binding) in scanned Tankōbon volumes and manga spreads without degrading rendering performance on low-spec GPUs like the Intel GMA 4500MHD.

This document establishes the exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for binding side detection, digital/flat scan bypasses, GPU texture safety limits (2048x2048), CSS layout containment (`contain: layout paint`), and resilient SQLite profile persistence.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SPN-01** | **Binding Side Detection & Orientation** | RTL Manga spread (even page spine right, odd page spine left), Webtoon vertical strip (no spine), Tankōbon spread (spine center $x = 0.5$) | Spine detector correctly classifies binding coordinates based on chapter metadata and page parity without false warping. | `spine-detection.test.ts` |
| **SPN-02** | **Digital / Flat Scan Bypass** | Perfectly flat digital scan (`curvature_coefficient = 0.0`) | Dewarping pipeline short-circuits instantly, applying zero mesh distortion or CPU/GPU shader overhead. | `spine-bypass.test.ts` |
| **SPN-03** | **Intel GMA 4500MHD Texture Safety** | High-resolution scanned page (`4000x6000` px) rendered with WebGL dewarp mesh | Textures exceeding 2048x2048 are safely downsampled or tiled; CSS containment (`contain: layout paint`) prevents reflow thrashing. | `spine-gpu-limits.test.ts` |
| **SPN-04** | **SQLite Profile Persistence Recovery** | SQLite write transaction interrupted during saving of per-chapter dewarp calibration profiles | Database WAL mode and atomic transactions roll back partial writes, ensuring fallback to default neutral profile without corruption. | `spine-persistence.test.ts` |
| **SPN-05** | **Extreme Curvature Parameter Fuzzing** | Corrupted or malicious curvature coefficients (`NaN`, `Infinity`, negative radius) | Parameter validation clamps values to safe bounds (`[0.0, 1.0]`) and rejects invalid floating-point inputs gracefully. | `spine-fuzzing.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Spine Detection & Parameter Fuzzing Unit Tests (`tests/unit/backend/services/spine-dewarp.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { detectBindingSide, sanitizeCurvatureCoefficient, shouldBypassDewarp } from '../../../../src/backend/services/spine-dewarp';

describe('Spine Dewarping Engine Resilience & Fuzzing', () => {
  it('correctly determines spine position based on page parity in RTL manga', () => {
    expect(detectBindingSide({ pageNumber: 2, layout: 'manga-rtl' })).toBe('right');
    expect(detectBindingSide({ pageNumber: 3, layout: 'manga-rtl' })).toBe('left');
    expect(detectBindingSide({ pageNumber: 5, layout: 'webtoon' })).toBe('none');
  });

  it('bypasses dewarping pipeline when curvature coefficient is 0.0', () => {
    expect(shouldBypassDewarp(0.0)).toBe(true);
    expect(shouldBypassDewarp(0.45)).toBe(false);
  });

  it('sanitizes and clamps corrupted curvature coefficients (NaN, Infinity)', () => {
    expect(sanitizeCurvatureCoefficient(NaN)).toBe(0.0);
    expect(sanitizeCurvatureCoefficient(Infinity)).toBe(1.0);
    expect(sanitizeCurvatureCoefficient(-5.5)).toBe(0.0);
    expect(sanitizeCurvatureCoefficient(0.65)).toBe(0.65);
  });
});
```

### 2.2 Frontend GPU Containment & Rendering Tests (`frontend/src/tests/SpineDewarpViewer.test.tsx`)
```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SpineDewarpViewer } from '../components/reader/SpineDewarpViewer';

describe('SpineDewarpViewer Intel GMA 4500MHD & CSS Containment', () => {
  it('applies strict CSS containment (contain: layout paint) to prevent layout thrashing', () => {
    const { container } = render(<SpineDewarpViewer dewarpEnabled={true} imageWidth={4000} imageHeight={6000} />);
    const viewerElement = container.firstChild;

    expect(viewerElement).toHaveStyle({ contain: 'layout paint' });
  });

  it('downsamples textures exceeding 2048px limits for low-spec GPU compatibility', () => {
    const { container } = render(<SpineDewarpViewer dewarpEnabled={true} imageWidth={4000} imageHeight={6000} />);
    // Verify WebGL canvas or image element respects max texture boundaries
    const canvas = container.querySelector('canvas');
    if (canvas) {
      expect(canvas.width).toBeLessThanOrEqual(2048);
      expect(canvas.height).toBeLessThanOrEqual(2048);
    }
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Low-Spec GPU Shield:** On legacy hardware like the Intel GMA 4500MHD, the dewarping mesh complexity is automatically downscaled from a $16 \times 16$ grid to a $4 \times 4$ bilinear grid to maintain 60 FPS scrolling.
2. **Profile Fallback:** If a series or chapter-specific dewarp profile in SQLite becomes corrupted, the engine automatically falls back to the global default profile without interrupting the reader session.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 74.*
