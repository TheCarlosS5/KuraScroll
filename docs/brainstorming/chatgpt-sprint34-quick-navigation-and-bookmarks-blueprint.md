# ChatGPT Blueprint: Sprint 34 — Chapter Quick-Navigation HUD & Reading Bookmarks Drawer

*Consultation Session with Senior ChatGPT via Brave MCP Session (`Colaboración en proyecto - Brave`)*
*Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2 cache, 3-4GB RAM), Intel GMA 4500MHD (0% blur, 0 backdrop-filter, pure CSS transform/opacity), 4TB SATA II HDD (5400 RPM, 75-100 IOPS, 12-15ms latency).*

---

## 1. SQLite Schema: `user_bookmarks`

### Directives:
- Separate bookmark identity from device synchronization. SQLite serves as the authoritative source; client IndexedDB retains pending operations.
- Enforce unique constraint `UNIQUE (user_id, chapter_id, page_index)` to prevent duplicate bookmarks on the same page.
- Do not create a separate redundant index on `(user_id, chapter_id)` because the UNIQUE composite index prefix covers lookups by `(user_id, chapter_id)`.
- Use a dedicated compound covering index `idx_bookmarks_user_series_chapter` for rapid group counting in the quick index query.

### Recommended Schema:
```sql
CREATE TABLE IF NOT EXISTS user_bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  series_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  page_index INTEGER NOT NULL CHECK (page_index >= 0),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, chapter_id, page_index)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_series_chapter
ON user_bookmarks (user_id, series_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_series_created
ON user_bookmarks (user_id, series_id, created_at DESC, id DESC);
```

---

## 2. Quick-Index Endpoint (`GET /api/v1/series/:seriesId/chapters/quick-index`)

### Query Optimization:
- Single-query join across `chapters`, `user_progress`, and aggregated `user_bookmarks`.
- Avoid full table scans; use covering indexes `idx_chapters_series_number` and `idx_progress_user_chapter`.
- Keep payload ultra-compact: only return navigation essentials (`id`, `chapter_number`, `title`, `last_page_index`, `completed`, `bookmark_count`). Omit heavy metadata, covers, and image lists.

```sql
SELECT
  c.id AS chapter_id,
  c.chapter_number,
  c.title,
  c.page_count,
  COALESCE(p.page_number, 1) AS last_page_index,
  COALESCE(p.completed, 0) AS completed,
  p.updated_at AS progress_updated_at,
  COALESCE(b.bookmark_count, 0) AS bookmark_count
FROM chapters AS c
LEFT JOIN user_progress AS p
  ON p.chapter_id = c.id
  AND p.user_id = :userId
LEFT JOIN (
  SELECT
    ub.chapter_id,
    COUNT(*) AS bookmark_count
  FROM user_bookmarks ub
  WHERE ub.user_id = :userId
    AND ub.series_id = :seriesId
  GROUP BY ub.chapter_id
) b ON b.chapter_id = c.id
WHERE c.series_id = :seriesId
ORDER BY c.chapter_number ASC;
```

---

## 3. Fastify API Routes
- `GET /api/v1/series/:seriesId/chapters/quick-index`
- `GET /api/v1/series/:seriesId/bookmarks`
- `POST /api/v1/bookmarks`
- `DELETE /api/v1/bookmarks/:id`

---

## 4. Frontend: Virtualized Windowing Drawer for Intel GMA 4500MHD
- Maintain 60 FPS without external virtualization dependencies.
- Render only visible items + overscan (16-20 active DOM nodes for 1,000+ chapters).
- Row height: 48px fixed.
- Pure CSS `translateX` animation (`contain: layout paint`).
- Zero backdrop blur; solid ambient palette backgrounds.
- Keyboard navigation: `C` (toggle Chapter Drawer), `B` (toggle Bookmark), `ArrowUp`/`ArrowDown` (navigate), `Escape` (close).
