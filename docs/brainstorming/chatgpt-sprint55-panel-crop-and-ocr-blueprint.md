# Sprint 55 Senior Architectural Blueprint: High-Precision Panel Crop & Dialogue Bubble OCR Pre-Cacher
**Senior ChatGPT Consultation & Hardware Architectural Directives**
*Host Profile: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2 Cache, No AVX) | GPU: Intel GMA 4500MHD | Storage: 4TB HDD (SATA II)*

---

## 1. Executive Summary & Design Goals

Sprint 55 architecturally introduces **High-Precision Panel Crop & Dialogue Bubble OCR Pre-Cacher** to KuraScroll.
This module enables:
1. **Panel-to-Panel Guided Reading:** Automatic bounding box extraction for manga/manhwa panels, allowing tap-to-focus zoom navigation without layout shifts ($CLS = 0$).
2. **Dialogue Bubble Spatial Indexing & In-Manga Text Search:** Extracting text dialogue and onomatopoeia coordinates, feeding SQLite FTS5 so users can search manga by character spoken quotes in Japanese, English, and Spanish.
3. **Extreme Low-Resource Resilience:** Zero AVX requirement, strict $\le 512$MB V8 heap envelope, zero main-thread blocking, and zero R-Tree write penalties on mechanical SATA II HDDs.

---

## 2. Senior ChatGPT Key Recommendations

### A. Coordinate System & Normalization
- Store coordinates as normalized integer basis points ($0 \dots 10000$, representing $0.00\% \dots 100.00\%$) or normalized floats ($0.0 \dots 100.0\%$).
- All bounding boxes are anchored to the original uncropped physical image, ensuring seamless compatibility with Sprint 51 (Two-Page Spread Splitter) and Sprint 52 (Annotation Deck).
- Bounding box model:
  ```typescript
  export interface PanelBox {
    id: string;
    chapterId: string;
    pageNumber: number;
    panelIndex: number;
    x: number;      // 0.0 .. 100.0%
    y: number;      // 0.0 .. 100.0%
    w: number;      // 0.0 .. 100.0%
    h: number;      // 0.0 .. 100.0%
    aspectRatio: number;
    readingOrder: number; // Japanese right-to-left, top-to-bottom
  }

  export interface DialogueBubble {
    id: string;
    chapterId: string;
    pageNumber: number;
    panelId?: string;
    bubbleIndex: number;
    x: number;      // 0.0 .. 100.0%
    y: number;      // 0.0 .. 100.0%
    w: number;      // 0.0 .. 100.0%
    h: number;      // 0.0 .. 100.0%
    text: string;
    language: string;
    confidence: number; // 0.0 .. 1.0
    bubbleType: 'SPEECH' | 'THOUGHT' | 'SCREAM' | 'WHISPER' | 'SFX';
  }
  ```

### B. SQLite Spatial Indexing without R-Tree Overhead
- An R-Tree virtual table introduces heavy secondary B-tree updates, which degrade throughput on mechanical HDDs with high rotational seek latencies (~15ms).
- In manga/comics, pages rarely contain more than 8 panels or 15 dialogue bubbles.
- Therefore, a compound B-tree index on `(chapter_id, page_number)` fetches all spatial entities for the active viewport in $< 0.1$ ms.
- Point-in-polygon / Point-in-box spatial hit testing is executed in-memory:
  ```typescript
  export function hitTestPanel(x: number, y: number, panels: readonly PanelBox[]): PanelBox | null {
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
        return p;
      }
    }
    return null;
  }
  ```
- In-memory point hit testing executes in **$< 100$ nanoseconds**, completely avoiding database locks and I/O thrashing during fast touch gestures or cursor scrubbing.

### C. Backend vs Web Worker Delegation
- **Backend (Node.js Fastify + SQLite WAL):**
  - Geometric recursive XY-cut gutter analysis.
  - Japanese/Western reading order sorting ($RTL$ vs $LTR$).
  - Storage & fast FTS5 dialogue indexing.
  - Zero heavy neural inference in the Node.js process to guarantee V8 heap stability $\le 512$MB.
- **Client-Side (Web Worker):**
  - Optional on-demand OCR parsing via WebAssembly.
  - Zero-copy buffer transfers (`Transferable` `ArrayBuffer`).
  - Explicit garbage collection via `ImageBitmap.close()` to protect legacy GMA 4500MHD VRAM.

### D. Proposed SLAs for Sprint 55
1. **SLA 19: In-Memory Spatial Hit Test Latency:** $< 0.005$ ms ($5$ µs) per point query.
2. **Page Panel & Bubble Query Latency:** $< 0.50$ ms with SQLite composite index.
3. **Dialogue Bubble FTS5 Text Search:** $< 2.0$ ms for phrase match in 1,000+ chapters.
