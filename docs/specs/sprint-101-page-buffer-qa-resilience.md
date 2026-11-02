# Sprint 101 QA Resilience Matrix: Bi-Directional Zero-Copy Page Memory Slicing & Ring-Buffer Tile Recycler (SLA 65)

## Executive Summary
Sprint 101 introduces the **Bi-Directional Zero-Copy Page Memory Slicing & Ring-Buffer Tile Recycler (SLA 65)**, designed to eliminate garbage collection pauses and memory allocation overhead during rapid manga scrolling by recycling fixed-size ArrayBuffer tile slots in a circular ring buffer and performing zero-copy typed array byte offset slicing for double-page spreads.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for ring buffer wrap-around (modulo capacity) when scrolling past capacity, rapid bi-directional flicking between adjacent pages, zero-copy byte offset alignment for spread slicing, and large page index jumps resetting ring state cleanly.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **BUF-01** | **Ring Wrap-Around (Modulo Capacity)** | Scrolling continuously forward past ring capacity (`pageIndex > ringCapacity`, e.g., page 35 on ring size 16) | Ring buffer wraps around cleanly using modulo index arithmetic (`index % capacity`), recycling oldest tile buffers without memory reallocation. | `buffer-wrap.test.ts` |
| **BUF-02** | **Rapid Direction Reversals (Flick Thrashing)** | Rapidly flicking back and forth between adjacent pages (`10` $\rightarrow$ `11` $\rightarrow$ `10` $\rightarrow$ `11` at 20Hz) | Ring buffer reuse locks prevent thrashing and redundant buffer reallocations, maintaining stable V8 heap and zero GC pauses. | `buffer-flick.test.ts` |
| **BUF-03** | **Zero-Copy Spread Page Slicing** | Double-page spread image binary loaded into shared ArrayBuffer sliced into left/right pages | Zero-copy `TypedArray.subarray()` byte offset slicing splits image view without copying underlying memory bytes. | `buffer-spread-slice.test.ts` |
| **BUF-04** | **Large Jump Eviction (Page 5 $\rightarrow$ 80)** | User jumps instantly from page 5 to page 80 via chapter scrubber | Ring buffer invalidates all active slots, resets circular pointers, and re-allocates ring window around page 80 cleanly. | `buffer-jump-evict.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Ring Buffer Service & Memory Slicing Unit Tests (`tests/unit/backend/services/page-buffer-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { calculateRingIndex, sliceSpreadZeroCopy, resetRingBufferState, computeBufferEtag } from '../../../../src/backend/services/page-buffer-service';

describe('Ring-Buffer Tile Recycler & Zero-Copy Memory Slicing Resilience', () => {
  it('wraps around ring capacity correctly using modulo arithmetic', () => {
    const capacity = 16;
    expect(calculateRingIndex(0, capacity)).toBe(0);
    expect(calculateRingIndex(15, capacity)).toBe(15);
    expect(calculateRingIndex(16, capacity)).toBe(0);  // Wrap around
    expect(calculateRingIndex(35, capacity)).toBe(3);  // 35 % 16 = 3
  });

  it('performs zero-copy byte offset slicing on shared ArrayBuffers for spread pages', () => {
    const sharedBuffer = new ArrayBuffer(10000);
    const leftSlice = sliceSpreadZeroCopy(sharedBuffer, 'left');
    const rightSlice = sliceSpreadZeroCopy(sharedBuffer, 'right');

    // Verify zero-copy byte offset alignment (sharing underlying buffer)
    expect(leftSlice.buffer).toBe(sharedBuffer);
    expect(rightSlice.buffer).toBe(sharedBuffer);
    expect(leftSlice.byteOffset).toBe(0);
    expect(rightSlice.byteOffset).toBe(5000);
  });

  it('resets ring buffer state cleanly on large page index jumps (Page 5 -> 80)', () => {
    const ring = { capacity: 16, head: 5, tail: 12, activeSlots: new Set([5, 6, 7]) };
    const resetRing = resetRingBufferState(ring, 80);

    expect(resetRing.head).toBe(80);
    expect(resetRing.tail).toBe(80);
    expect(resetRing.activeSlots.size).toBe(0);
  });

  it('generates deterministic ETags for cached buffer state manifests', () => {
    const etag1 = computeBufferEtag('ch-101', 16);
    const etag2 = computeBufferEtag('ch-101', 16);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Ring Buffer Hook Tests (`frontend/src/tests/usePageBuffer.test.ts`)
```typescript
import { describe, it, expect, act } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePageBuffer } from '../hooks/usePageBuffer';

describe('usePageBuffer Flick Thrashing & Wrap-Around Resilience', () => {
  it('prevents buffer reallocation storms during rapid page 10/11 flick thrashing', () => {
    const { result } = renderHook(() => usePageBuffer({ capacity: 16 }));

    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.requestPage(i % 2 === 0 ? 10 : 11);
      }
    });

    expect(result.current.reallocationCount).toBe(0); // Zero reallocations due to ring recycling
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Memory Slicing Alignment:** All typed array views derived from spread images enforce 4-byte boundary alignment to prevent CPU architecture unaligned memory access exceptions.
2. **Ring Pointer Reset:** When large scrubbing jumps occur, dirty flag states on stale ring slots are cleared instantly without waiting for garbage collection cycles.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 101.*
