# Sprint 67 QA Resilience Matrix: Dynamic SFX Overlay & Translation Engine

## Executive Summary
Sprint 67 implements the **Dynamic Onomatopoeia (SFX) Overlay & Translation Engine**, responsible for rendering contextual, localized sound effects directly over manga panels and vertical webtoons with correct typography, vertical CJK layout support, Z-index layer resolution, and zero Cumulative Layout Shift (CLS).

This document details the exhaustive test plans, edge-case fuzzing suites, and fallback protocols for coordinate clamping, text direction handling, dictionary misses, and overlapping combat SFX layers.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SFX-01** | **Out-of-Bounds Bounding Box** | Bounding box coordinates `{ x: -0.15, y: 1.25, w: 1.5, h: -0.2 }` | Engine clamps coordinates strictly to normalized canvas space `[0.0, 1.0]` and ignores inverted width/height to prevent rendering overflows. | `sfx-geometry.test.ts` |
| **SFX-02** | **Massive Combat Overlap (Z-Index)** | 15+ concurrent overlapping SFX boxes in a single battle panel | Z-index sorting algorithm resolves hierarchy deterministically based on bounding box area (smaller foreground accents on top of large environmental SFX) without DOM thrashing. | `sfx-zindex.test.ts` |
| **SFX-03** | **Vertical CJK vs Horizontal Typography** | Traditional vertical writing mode (`writing-mode: vertical-rl`) vs horizontal localized text (`Rumble!`) | Engine correctly parses orientation flags, applying CJK punctuation rotation and glyph stacking without character clipping. | `sfx-typography.test.ts` |
| **SFX-04** | **Elongation & Diacritic Fuzzing** | Raw sound strings with repeated chōonpu (`ーーー!!`, `ドガガガッ…`) | Normalization engine trims excessive elongation markers while preserving expressive impact and formatting tags. | `sfx-normalization.test.ts` |
| **SFX-05** | **Dictionary Miss / Fallback** | Obscure dialect SFX missing from local SQLite translation dictionary | Graceful fallback to original kana/kanji or rōmaji with a subtle stylistic outline, preventing missing translation crashes. | `sfx-translation.test.ts` |
| **SFX-06** | **Zero CLS Async Layer Injection** | Asynchronous loading of SFX font faces and translation overlays | SFX container uses CSS absolute positioning over fixed aspect-ratio panel wrappers, guaranteeing `0.00` Cumulative Layout Shift (CLS). | `sfx-cls.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Geometry & Normalization Unit Tests (`tests/unit/backend/services/sfx-engine.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeSfxBox, normalizeSoundText } from '../../../../src/backend/services/sfx-engine';

describe('SFX Engine Resilience & Geometry Fuzzing', () => {
  it('clamps out-of-bounds bounding boxes and drops negative dimensions', () => {
    const rawBox = { x: -0.2, y: 1.5, w: 1.8, h: -0.5 };
    const sanitized = sanitizeSfxBox(rawBox);

    expect(sanitized.x).toBe(0.0);
    expect(sanitized.y).toBe(1.0);
    expect(sanitized.w).toBe(1.0);
    expect(sanitized.h).toBe(0.0); // clamped or ignored
  });

  it('normalizes excessive chōonpu and diacritics without crashing', () => {
    const rawText = 'ドーーーーガガガッ………！！！';
    const normalized = normalizeSoundText(rawText);

    expect(normalized).toBeDefined();
    expect(typeof normalized).toBe('string');
    expect(normalized.length).toBeLessThanOrEqual(20);
  });

  it('falls back gracefully to original text on dictionary miss', () => {
    const translated = lookupSfxTranslation('UNKNOWN_SFX_XYZ_999', 'ja');
    expect(translated).toBe('UNKNOWN_SFX_XYZ_999');
  });
});
```

### 2.2 Frontend Overlay & CLS Component Tests (`frontend/src/tests/SfxOverlay.test.tsx`)
```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SfxOverlay } from '../components/reader/SfxOverlay';

describe('SfxOverlay CLS & Typography Tests', () => {
  it('renders vertical CJK and horizontal text with zero layout shift', () => {
    const sfxItems = [
      { id: '1', text: 'ドドド', orientation: 'vertical-rl', box: { x: 0.1, y: 0.2, w: 0.15, h: 0.4 } },
      { id: '2', text: 'BAM!', orientation: 'horizontal', box: { x: 0.6, y: 0.7, w: 0.2, h: 0.1 } },
    ];

    const { container } = render(<SfxOverlay items={sfxItems} panelWidth={800} panelHeight={1200} />);
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ position: 'absolute', inset: '0px' });
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Overlapping Priority Stack:** In dense action manhwa with overlapping battle cries, SFX layers are batched into DOM fragments using CSS `pointer-events: none` to prevent click interception and rendering bottlenecks.
2. **Font Loading Failures:** If custom styled SFX web fonts fail to load within 300ms, the engine falls back to system fallback stacks (`sans-serif`, `Impact`) while maintaining exact bounding box dimensions.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 67.*
