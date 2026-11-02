# Sprint 52 Blueprint: Interactive Reader Annotation Deck & Ephemeral Sticky Note Layer
**Senior ChatGPT Architectural Blueprint & Hardware Strategy**
*Host Profile: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2, NO AVX/AVX2) | GPU: Intel GMA 4500MHD | Storage: 4TB Mechanical HDD (SATA II)*

---

## 1. Core Architectural Directives

1. **Normalized Coordinate System ($X, Y \in [0.0, 100.0]\%$):**
   - Coordinates are stored as floating-point percentages relative to the intrinsic dimensions of the source physical manga/webtoon page.
   - For virtual spreads (Manga RTL 2-page split):
     - Annotations with $anchor\_x \ge 50\%$ map to the right slice (sub-page `a`), positioned at $(anchor\_x - 50) \times 2\%$.
     - Annotations with $anchor\_x < 50\%$ map to the left slice (sub-page `b`), positioned at $anchor\_x \times 2\%$.
   - This ensures zero coordinate drift across viewport resize, zoom, and display mode transitions.

2. **Zero-CLS Canvas Overlay Design:**
   - The annotation layer is a pure absolute overlay (`position: absolute; inset: 0; pointer-events: none;`) superimposed over the reading canvas.
   - Marker pins have `pointer-events: auto; transform: translate3d(-50%, -50%, 0);` to ensure GPU rasterization on Intel GMA 4500MHD without triggering DOM reflows or document layout shifts ($CLS = 0$).

3. **GMA 4500MHD Zero-Blur Spoiler Protection:**
   - Blur filters (`backdrop-filter: blur(...)` or `filter: blur(...)`) cause immediate fill-rate stalls on GMA 4500MHD.
   - Spoilers are rendered using a solid dark redact bar with high-contrast text reveal (`background: #18181b; color: #71717a; border: 1px dashed #3f3f46; cursor: pointer;`) or CSS pixel block patterns, revealing full text only on user click.

4. **Microsecond SQLite Performance on Pentium T4500:**
   - Table `chapter_page_annotations` with compound index on `(chapter_id, page_number)`.
   - In-memory LRU cache in `PageAnnotationService` for $O(1)$ lookups, guaranteeing query latencies $< 0.15$ ms ($< 0.5$ ms SLA).
   - Atomic deletes and insertions using `node:sqlite` prepared statements.

5. **Off-Canvas Annotation Deck Drawer:**
   - Collapsible right-hand drawer listing all notes, bookmarks, and reactions for the current chapter.
   - Toggled via keyboard shortcut `'N'` or reader HUD button.
   - Smooth pure-CSS slide transition (`transform: translate3d(...)`) with zero layout reflow of the manga viewing area.
