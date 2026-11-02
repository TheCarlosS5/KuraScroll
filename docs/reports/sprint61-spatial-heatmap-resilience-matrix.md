# Sprint 61: QA Resilience Test Plan & Spatial Heatmap Matrix
**Feature:** Continuous In-Memory Spatial Reading Heatmap & Kinetic Focus Analyzer  
**Target Host Platform:** Intel Pentium T4500 (2C/2T) & In-Memory Spatial Grid (Uint8Array)

---

## 1. Executive Summary & Objective

In **Sprint 61**, KuraScroll introduces the **Continuous In-Memory Spatial Reading Heatmap & Kinetic Focus Analyzer**, tracking reader gaze and focus density across manga panels and storing aggregated spatial interaction grids.

Operating against low-end hardware, spatial telemetry must be robust against anomalous bounding boxes, extreme dwell times, and truncated binary blobs without causing memory overflows or invalid pixel values.

Our QA resilience test suite rigorously verifies:
1. Spatial coordinate fuzzing (negative coordinates, dimensions $> 100\%$, zero-width/height rectangles, inverted coordinates).
2. Extreme dwell clamping & AFK detection (saturating `Uint8` range `0-255` without overflow).
3. Corrupt binary blob resilience (truncated blobs $< 256$ bytes).

---

## 2. Adversarial Test Case Matrix

### Case 1: Spatial Coordinate Fuzzing & Anomaly Clipping
- **Scenario:** Ingesting gaze/dwell bounding boxes with anomalous coordinates:
  - Negative values: `x = -10, y = -5`
  - Dimensions exceeding 100%: `width = 150, height = 200`
  - Collapsed rectangles: `width = 0` or `height = 0`
  - Inverted coordinates: `x1 = 80, x2 = 20` (width < 0)
- **Behavioral Expectation:**
  - The spatial coordinate sanitizer must normalize and clamp all boxes strictly into valid canvas bounds (`0 <= x <= 100`, `0 <= y <= 100`, `width > 0`, `height > 0`).
  - Collapsed or zero-area rectangles must be dropped silently.
- **Test Implementation Outline (`tests/backend/resilience/spatial-heatmap-fuzz.test.ts`):**
  ```typescript
  it('normalizes, clamps, and discards anomalous spatial bounding boxes', () => {
    const anomalousBox = { x: -20, y: 120, width: 200, height: 0 };
    const sanitized = sanitizeSpatialBox(anomalousBox);

    expect(sanitized).not.toBeNull();
    expect(sanitized.x).toBe(0);
    expect(sanitized.y).toBe(100);
    expect(sanitized.width).toBeLessThanOrEqual(100);
    expect(sanitized.height).toBeGreaterThan(0);
  });
  ```

---

### Case 2: Extreme Dwell Clamping & AFK Saturation (`Uint8` 0-255)
- **Scenario:** Processing fixations or dwell times exceeding 180 seconds or negative values, accumulating into the spatial intensity grid (`Uint8Array`).
- **Behavioral Expectation:**
  - Dwell times above 180s must be clamped to prevent saturation spikes.
  - Grid accumulation values must cap strictly at `255` (`Math.min(255, current + increment)`), preventing `Uint8Array` integer overflow wrap-around (which would reset hot spots to 0).
- **Test Implementation Outline (`tests/backend/resilience/spatial-heatmap-fuzz.test.ts`):**
  ```typescript
  it('clamps extreme dwell times and caps spatial grid accumulation strictly to Uint8 max (255)', () => {
    const grid = new Uint8Array(256 * 256);
    const index = 100;
    grid[index] = 250; // near max

    accumulateSpatialDwell(grid, index, 1000); // massive dwell increment

    expect(grid[index]).toBe(255); // capped at 255, no overflow wrap-around
  });
  ```

---

### Case 3: Corrupt Binary Blob Resilience (< 256 bytes)
- **Scenario:** Deserializing stored heatmap BLOBs from SQLite where data is truncated (e.g. 50 bytes instead of expected grid size).
- **Behavioral Expectation:**
  - The deserializer must verify byte length before parsing.
  - Truncated or malformed blobs must trigger fallback to a fresh blank grid rather than throwing a buffer out-of-bounds exception.
- **Test Implementation Outline (`tests/backend/resilience/spatial-heatmap-fuzz.test.ts`):**
  ```typescript
  it('falls back to a fresh blank grid when encountering truncated binary blobs', () => {
    const truncatedBlob = Buffer.alloc(50); // expected e.g. 65536 bytes

    const grid = deserializeHeatmapBlob(truncatedBlob);
    expect(grid).toBeInstanceOf(Uint8Array);
    expect(grid.length).toBe(65536); // initialized blank grid
  });
  ```

---

## 3. Deliverables & Artifact Summary
- This resilience test plan document (`docs/reports/sprint61-spatial-heatmap-resilience-matrix.md`).
- Automated test suites:
  - `tests/backend/resilience/spatial-heatmap-fuzz.test.ts`
  - `frontend/tests/services/spatial-heatmap.test.ts`
