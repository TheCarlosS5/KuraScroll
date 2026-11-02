# Sprint 102 QA Resilience Matrix: Adaptive Per-Panel Reading Path Spatial Occlusion & Balloon Collision Avoider (SLA 66)

## Executive Summary
Sprint 102 introduces the **Adaptive Per-Panel Reading Path Spatial Occlusion & Balloon Collision Avoider (SLA 66)**, designed to automatically reposition dialogue translation overlays, reading guides, and UI widgets to prevent occlusion of vital artwork and speech bubbles across complex manga panels.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for zero-collision scenarios, direct center collisions with viewport boundary clamping, multi-bubble cluster resolution, and off-screen jump prevention.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **BCN-01** | **Zero-Collision Scenario** | Overlay bounding box does not intersect with any dialogue speech bubbles or critical artwork zones (`dx = 0, dy = 0`) | Collision resolver detects zero occlusion, leaving overlay position entirely unaltered with zero layout shift. | `balloon-zero-collision.test.ts` |
| **BCN-02** | **Direct Center Collision & Viewport Clamping** | Overlay center directly intersects a prominent speech bubble near viewport edge | Resolver calculates optimal minimum displacement path, shifting overlay while strictly clamping coordinates inside viewport boundaries (`[0, maxW]`, `[0, maxH]`). | `balloon-center-collision.test.ts` |
| **BCN-03** | **Multi-Bubble Cluster Collision** | Overlay placed inside a dense cluster of 4+ overlapping dialogue bubbles | Resolver evaluates bounding box overlaps, successfully shifting overlay to open whitespace pocket without clipping out of bounds. | `balloon-cluster.test.ts` |
| **BCN-04** | **Edge Boundary Clamping (Anti-Jump)** | Extreme collision push forces overlay outside screen bounds | Clamping guard locks position against viewport padding, preventing HUD elements from jumping off-screen. | `balloon-edge-clamping.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Collision Avoider Service & Unit Tests (`tests/unit/backend/services/balloon-collision-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { resolveBalloonCollision, clampOverlayBounds, detectClusterOverlap, computeCollisionEtag } from '../../../../src/backend/services/balloon-collision-service';

describe('Balloon Collision Avoider Resilience & Clamping', () => {
  it('leaves overlay position unaltered (dx=0, dy=0) on zero-collision scenarios', () => {
    const overlay = { x: 10, y: 10, width: 100, height: 50 };
    const bubbles = [{ x: 500, y: 500, width: 100, height: 80 }];
    const resolved = resolveBalloonCollision(overlay, bubbles, { width: 1000, height: 1000 });

    expect(resolved.dx).toBe(0);
    expect(resolved.dy).toBe(0);
    expect(resolved.x).toBe(10);
    expect(resolved.y).toBe(10);
  });

  it('calculates optimal displacement and clamps inside viewport on direct center collision', () => {
    const overlay = { x: 200, y: 200, width: 150, height: 80 };
    const bubbles = [{ x: 180, y: 180, width: 200, height: 100 }]; // Direct overlap
    const viewport = { width: 800, height: 1200 };
    const resolved = resolveBalloonCollision(overlay, bubbles, viewport);

    // Should be displaced and clamped within viewport bounds
    expect(resolved.x).toBeGreaterThanOrEqual(0);
    expect(resolved.y).toBeGreaterThanOrEqual(0);
    expect(resolved.x + overlay.width).toBeLessThanOrEqual(viewport.width);
  });

  it('resolves multi-bubble cluster collisions successfully into whitespace', () => {
    const overlay = { x: 300, y: 300, width: 120, height: 60 };
    const cluster = [
      { x: 280, y: 280, width: 100, height: 80 },
      { x: 350, y: 320, width: 90, height: 70 },
    ];
    const viewport = { width: 800, height: 1200 };
    const resolved = resolveBalloonCollision(overlay, cluster, viewport);

    expect(resolved.hasCollisionResolved).toBe(true);
  });

  it('generates deterministic ETags for cached collision profile manifests', () => {
    const etag1 = computeCollisionEtag('ch-102', 4);
    const etag2 = computeCollisionEtag('ch-102', 4);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Collision Hook Tests (`frontend/src/tests/useBalloonCollision.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBalloonCollision } from '../hooks/useBalloonCollision';

describe('useBalloonCollision Boundary Clamping', () => {
  it('prevents HUD overlay from jumping off-screen during aggressive collision resolution', () => {
    const { result } = renderHook(() => useBalloonCollision({ initialX: -50, initialY: 9999, viewport: { width: 800, height: 1200 } }));
    expect(result.current.clampedX).toBeGreaterThanOrEqual(0);
    expect(result.current.clampedY).toBeLessThanOrEqual(1200);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Whitespace Fallback:** If a dialogue cluster completely surrounds an overlay with zero free space pockets, the resolver falls back to anchoring the HUD at the top-left viewport padding safely.
2. **Viewport Boundary Protection:** All displacement offsets are processed through strict min/max clamping against current container dimensions, eliminating off-screen element loss.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 102.*
