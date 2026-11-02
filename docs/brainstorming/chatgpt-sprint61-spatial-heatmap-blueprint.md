# Senior ChatGPT Architectural Blueprint: Sprint 61 — Continuous In-Memory Spatial Reading Heatmap & Kinetic Focus Analyzer

**Consultation Source:** Brave Browser via MCP (`«Colaboración en proyecto - Brave»`), Senior Architect ChatGPT.  
**Sprint Scope:** Sprint 61 (Continuous Gaze Dwell Spatial Reconstruction, Dual-Layer $16 \times 16$ Quantized Grid, 2D Box/Kernel Projection, Zero-Blur Canvas 2D Overlay, SLA 25).  
**Target Hardware:** Intel Pentium T4500 (2C/2T @ 2.3GHz, 1MB L2, 45nm Penryn, RAM <= 512MB V8 heap ceiling) & Intel GMA 4500MHD (Zero CSS blur, zero backdrop-filter, pure CSS opacity/transform, 0 CLS) & 4TB SATA II HDD (~75-100 IOPS, 12-15ms radial seek latency).

---

## 1. Executive Summary & Design Constraints
Without dedicated eye-tracking hardware, a manga reading platform must reconstruct reading dwell and visual attention from kinetic reading interactions:
1. **Dwell Time per Page:** Total time elapsed on page $\tau$ ($1.5\text{ s} \le \tau \le 180\text{ s}$).
2. **Spatial Priors from OCR & Panels:** Speech bubbles receive 60–70% of reading fixation, while facial expressions and active panel artwork receive 30–40%.
3. **Hardware-Safe Grid Size ($16 \times 16$):**
   - $16 \times 16$ grid $= 256$ cells.
   - Dual-layer representation:
     - Layer 1 (`recentHeat`): In-memory `Float32Array(256)` (1,024 bytes) for sub-millisecond continuous accumulation and decay.
     - Layer 2 (`quantizedHeat`): Quantized `Uint8Array(256)` (256 bytes) with saturation clamping ($0 - 255$) for fast serialization.
   - 500 active chapter pages occupy only **$128\text{ KB}$ of RAM**!

---

## 2. 2D Spatial Kernel & Box Projection Math

### 2.1 Coordinate Normalization
Given a panel or dialogue bubble bounding box normalized to $[0, 100]\%$:
$$x_{\min}, y_{\min}, w, h \in [0, 100]$$
The cell bounds in the $16 \times 16$ grid ($N = 16$) are:
$$c_{x0} = \max\left(0, \min\left(15, \left\lfloor \frac{x_{\min} \cdot N}{100} \right\rfloor\right)\right), \quad c_{x1} = \max\left(0, \min\left(15, \left\lfloor \frac{(x_{\min} + w) \cdot N}{100} \right\rfloor\right)\right)$$
$$c_{y0} = \max\left(0, \min\left(15, \left\lfloor \frac{y_{\min} \cdot N}{100} \right\rfloor\right)\right), \quad c_{y1} = \max\left(0, \min\left(15, \left\lfloor \frac{(y_{\min} + h) \cdot N}{100} \right\rfloor\right)\right)$$

### 2.2 Accumulation & Falloff
For each cell $(c_x, c_y)$ inside the bounding rectangle:
$$\text{Weight}(c_x, c_y) = \text{baseDwellMs} \cdot \text{focusMultiplier}$$
- For speech bubbles: $\text{focusMultiplier} = 2.0$.
- For panels: $\text{focusMultiplier} = 1.0$.
- Quantization to Uint8:
$$\text{CellUint8} = \min\left(255, \left\lfloor \frac{\text{DwellMs}}{10000} \cdot 255 \right\rfloor\right)$$

---

## 3. Database Schema & Write-Behind Persistence
Heatmaps accumulate in V8 memory during reading sessions. They are flushed to SQLite only when the reader transitions chapters or exits the session, preventing mechanical HDD head thrashing.

```sql
CREATE TABLE IF NOT EXISTS page_spatial_heatmaps (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    user_id TEXT NOT NULL,
    grid_dim INTEGER NOT NULL DEFAULT 16 CHECK (grid_dim = 16),
    total_dwell_ms INTEGER NOT NULL DEFAULT 0,
    peak_intensity INTEGER NOT NULL DEFAULT 0 CHECK (peak_intensity BETWEEN 0 AND 255),
    heatmap_blob BLOB NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chapter_id, page_number, user_id)
);

CREATE INDEX IF NOT EXISTS idx_spatial_heatmaps_lookup
    ON page_spatial_heatmaps(chapter_id, page_number);
```

---

## 4. Frontend Canvas 2D Overlay (`SpatialHeatmapOverlay.tsx`)
- Pure solid Canvas 2D render loop (`imageSmoothingEnabled = true`).
- Bilinear color ramp:
  - 0: `rgba(0, 0, 0, 0)` (transparent)
  - 1–64: `rgba(30, 27, 75, 0.4)` (indigo)
  - 65–128: `rgba(6, 182, 212, 0.5)` (cyan)
  - 129–192: `rgba(234, 179, 8, 0.6)` (amber)
  - 193–255: `rgba(239, 68, 68, 0.7)` (coral red)
- Zero CSS blur, zero backdrop-filter for Intel GMA 4500MHD.
- Toggle visibility via keyboard shortcut `'H'`.
- $CLS = 0$ via strict layout containment (`contain: layout paint`).

---

## 5. Performance SLA Specification
- **SLA 25:** Spatial attention accumulation and 2D box projection latency $< 0.05\text{ ms}$ ($50\text{ µs}$) per operation.
