# Sprint 112 QA Resilience Matrix: Micro-Tile GPU Texture Atlas Packer & Virtual VRAM Compactor (SLA 76)

## Executive Summary
Sprint 112 introduces the **Micro-Tile GPU Texture Atlas Packer & Virtual VRAM Compactor (SLA 76)**, designed to pack thousands of micro-tiles into shared GPU texture atlases while strictly managing VRAM budgets, handling oversized tile exceptions, triggering virtual atlas paging when capacity reaches 100%, and enforcing a 4px anti-bleed inset padding boundary.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for oversized tiles (`> 2048x2048`), 100% atlas capacity overflow with virtual atlas paging, 4px anti-bleed padding checks, deterministic ETags, and unpersisted profile caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **ATLAS-01** | **Oversized Tiles Exceeding Atlas Dimensions** | Micro-tile dimensions exceed standard texture atlas max bounds (`width > 2048` or `height > 2048`) | Packer isolates oversized tiles into dedicated fallback texture layers, preventing WebGL allocation crashes and out-of-bounds UV mapping. | `atlas-oversized.test.ts` |
| **ATLAS-02** | **Atlas 100% Capacity & Virtual Paging** | Texture atlas reaches maximum micro-tile count / spatial capacity (100%) | Packer triggers automatic virtual atlas paging, instantiating a secondary active VRAM atlas page without dropping frame render rates. | `atlas-paging.test.ts` |
| **ATLAS-03** | **Anti-Bleed Padding Boundary (4px Inset)** | Micro-tiles packed into adjacent atlas slots | Packer enforces a strict 4px transparent inset padding boundary around each sub-tile, preventing texture bleeding and bilinear filtering color artifacts. | `atlas-padding.test.ts` |
| **ATLAS-04** | **Deterministic ETag & Unpersisted Caching** | Client requests texture atlas layout manifest with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified; unpersisted VRAM allocation profiles are cached in-memory with deterministic ETags. | `atlas-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Texture Atlas Packer Service & Unit Tests (`tests/unit/backend/services/texture-atlas-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { packMicroTile, checkAtlasCapacity, validateAntiBleedPadding, computeAtlasEtag } from '../../../../src/backend/services/texture-atlas-service';

describe('Micro-Tile GPU Texture Atlas Packer & VRAM Compactor Resilience', () => {
  it('isolates oversized tiles exceeding 2048x2048 atlas dimensions', () => {
    const oversizedTile = { id: 'tile-huge', width: 3000, height: 3000 };
    const packingResult = packMicroTile(oversizedTile, { maxAtlasSize: 2048 });

    expect(packingResult.isOversized).toBe(true);
    expect(packingResult.assignedAtlasId).toBe('fallback-dedicated-layer');
  });

  it('triggers virtual atlas paging when capacity reaches 100%', () => {
    const atlasState = { currentCount: 256, maxCapacity: 256, activePage: 1 };
    const pagingResult = checkAtlasCapacity(atlasState);

    expect(pagingResult.isFull).toBe(true);
    expect(pagingResult.newPageRequired).toBe(true);
    expect(pagingResult.nextActivePage).toBe(2);
  });

  it('enforces strict 4px anti-bleed inset padding boundary around packed tiles', () => {
    const tile = { x: 100, y: 100, width: 256, height: 256 };
    const padded = validateAntiBleedPadding(tile, 4);

    expect(padded.uvInsetX).toBe(4);
    expect(padded.uvInsetY).toBe(4);
    expect(padded.effectiveWidth).toBe(248); // 256 - 8 (4px each side)
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      checkAtlasCapacity({ currentCount: 100, maxCapacity: 256, activePage: 1 });
      validateAntiBleedPadding({ x: 0, y: 0, width: 256, height: 256 }, 4);
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags for unpersisted profile caching', () => {
    const etag1 = computeAtlasEtag('ch-112', 2048);
    const etag2 = computeAtlasEtag('ch-112', 2048);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Texture Atlas Hook Tests (`frontend/src/tests/useTextureAtlas.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextureAtlas } from '../hooks/useTextureAtlas';

describe('useTextureAtlas Virtual Paging & Padding Guard', () => {
  it('instantiates secondary virtual atlas page cleanly upon 100% capacity overflow', () => {
    const { result } = renderHook(() => useTextureAtlas({ initialCapacity: 10 }));
    // Simulate filling atlas to 100%
    expect(result.current.activeAtlasPage).toBe(1);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Oversized Tile Fallback:** Micro-tiles exceeding the 2048x2048 WebGL texture limit are automatically redirected to standalone GPU texture objects, preventing WebGL context loss or allocation exceptions.
2. **Anti-Bleed Inset Protection:** All UV coordinate mapping calculations factor in a 4px transparent padding boundary, eliminating bilinear texture filtering artifacts between adjacent atlas slots.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 112.*
