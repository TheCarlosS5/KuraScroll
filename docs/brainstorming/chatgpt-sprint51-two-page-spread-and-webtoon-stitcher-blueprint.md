# Senior Architectural Blueprint: Sprint 51 — Dynamic Two-Page Spread Smart Splitter & Webtoon Seam Stitcher

**Originator:** Senior ChatGPT Consultation via Brave MCP  
**Sprint:** 51  
**Project:** KuraScroll (Local Standalone Host Sister to KuraStream)  
**Target Hardware:** Intel Pentium T4500 (2 Cores, 2.30 GHz, 1MB L2 cache, No AVX), 4TB HDD SATA II, Intel GMA 4500MHD GPU  

---

## 1. Architectural Thesis

1. **Virtual CSS Viewport Splitting (Never Physical Cloning):**
   - Double-page spreads (Tankōbon scans where aspect ratio $\ge 1.25$) are split **virtually** in memory and layout coordinates, never physically on the 4TB mechanical HDD.
   - Physical splitting would trigger tens of thousands of CPU-intensive WebP re-encodings on the Penryn T4500 and double HDD I/O writes, destroying disk latency and consuming gigabytes of duplicate storage.
   - Using CSS `object-fit: cover` and `object-position: left center` / `right center` inside an isolated container with `aspect-ratio: (sourceWidth / 2) / sourceHeight` achieves instantaneous splitting at 60 FPS with zero disk seek or heap allocation.

2. **RTL Reading Order Normalization:**
   - For traditional Japanese manga Tankōbon (RTL):
     - **Right half (x: 50% - 100%)** is Virtual Page `N-a` (read first).
     - **Left half (x: 0% - 50%)** is Virtual Page `N-b` (read second).
   - For Korean Manhwa / Western Comics (LTR):
     - **Left half (x: 0% - 50%)** is Virtual Page `N-a`.
     - **Right half (x: 50% - 100%)** is Virtual Page `N-b`.

3. **Subpixel Bleed Seam Stitcher for Vertical Webtoons:**
   - In manhwa / webtoons, fractional scaling and browser rounding create annoying white horizontal hairlines between slices.
   - **Crucial Rule:** Never use cumulative negative margins (`margin-top: -1px`), because across hundreds of panels this shrinks document length and drifts scroll offsets.
   - **Solution:** Subpixel Seam Bleed:
     ```css
     .webtoon-stack {
       display: block;
       width: 100%;
       margin: 0;
       padding: 0;
       border: 0;
       gap: 0;
       line-height: 0;
       font-size: 0;
       background: var(--reader-bg);
       --seam-bleed: 0.75px;
     }
     .webtoon-segment + .webtoon-segment img {
       position: absolute;
       inset-inline: 0;
       top: calc(-1 * var(--seam-bleed));
       height: calc(100% + var(--seam-bleed));
     }
     ```
   - The bounding wrapper retains its mathematically exact `aspect-ratio` (0 CLS), while only the subsequent image paints an overlapping 0.75px bleed over the seam.

4. **Multi-Sprint Backwards Compatibility:**
   - Speech bubble annotations (Sprint 46), dwell heatmaps (Sprint 45), audio SFX cues (Sprint 49), and eye care filters (Sprint 50) map transparently:
     - `mapBoxToCrop(bubbleBBox, spreadCrop)` converts whole-image coordinates into normalized sub-slice coordinates.
     - Single-page physical tracking in SQLite `reading_progress` is preserved; `last_virtual_page_key` tracks sub-slice cursor state.

---

## 2. SQLite Schema Specification

```sql
CREATE TABLE IF NOT EXISTS chapter_spread_manifests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    source_page_number INTEGER NOT NULL CHECK (source_page_number >= 1),
    source_width INTEGER NOT NULL CHECK (source_width > 0),
    source_height INTEGER NOT NULL CHECK (source_height > 0),
    aspect_ratio REAL NOT NULL,
    layout_decision TEXT NOT NULL DEFAULT 'single' CHECK (layout_decision IN ('single', 'split_spread', 'panorama', 'stitch_webtoon')),
    split_order TEXT NOT NULL DEFAULT 'rtl' CHECK (split_order IN ('rtl', 'ltr', 'none')),
    split_position_pct REAL NOT NULL DEFAULT 50.0 CHECK (split_position_pct BETWEEN 10.0 AND 90.0),
    segments_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chapter_id, source_page_number)
);

CREATE INDEX IF NOT EXISTS idx_spread_manifest_lookup
    ON chapter_spread_manifests(chapter_id, source_page_number);
```
