# Sprint 48 Specification: Dynamic Story Recap Engine & 'Previously On...' Catch-Up Drawer

## 1. Executive Summary & Problem Space
Long-running serialized manga, manhwa, and manhua (e.g. *One Piece*, *Tower of God*, *Kingdom*, *Berserk*) span hundreds of chapters and complex narrative arcs.
Readers frequently step away from reading for weeks or months. When resuming at Chapter $N$, readers struggle with narrative amnesia:
- Forgetting character affiliations and allegiances.
- Forgetting pivotal plot reveals and recent battle outcomes.
- Losing track of active cliffhangers.

### The Strict Anti-Spoiler Invariant
No recap displayed when reading Chapter $N$ may ever contain spoilers from Chapter $\ge N$.
Mathematically and architectural enforced:
$$\forall r \in \text{Recaps}(N), \quad r.\text{through\_chapter\_seq} \le N - 1$$
If the reader is on Chapter 1, no preceding recap exists ($\text{through\_chapter\_seq} < 1 \implies \emptyset$), and the system cleanly presents zero recap without errors.

---

## 2. Hardware-Constrained Architecture (Penryn 45nm & GMA 4500MHD)
The platform host is an **Intel Pentium T4500** (2.30 GHz dual-core, 1MB L2 cache, 512MB V8 heap ceiling) with a 4TB SATA II mechanical HDD:
1. **Zero LLM Run-Time Execution on Host:**
   Recaps are extractive, structured snapshots ingested or imported statically (e.g. via ComicInfo, AniList/community manifests, or administrative batch API). The host never runs inference during chapter load.
2. **Sub-Millisecond Seek SLA ($< 1.0$ ms):**
   SQLite compound covering index `(series_id, through_chapter_seq DESC, language_tag)` guarantees $O(\log S)$ seek directly from memory-mapped cache or WAL buffer.
3. **Intel GMA 4500MHD Zero-Jitter Rendering:**
   - Zero CSS `backdrop-filter: blur(...)` or heavy CSS box-shadows.
   - Fixed slide-over drawer with `contain: layout paint` and `transform: translateX(...)` transitions.
   - 0 CLS (Cumulative Layout Shift = 0) so reading canvas never shifts or re-flows.

---

## 3. SQLite DDL Specification

```sql
CREATE TABLE IF NOT EXISTS chapter_story_recaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    through_chapter_seq REAL NOT NULL CHECK(through_chapter_seq >= 0),
    arc_title TEXT NOT NULL,
    language_tag TEXT NOT NULL DEFAULT 'es',
    recap_kind TEXT NOT NULL DEFAULT 'standard' CHECK(recap_kind IN ('short', 'standard', 'deep')),
    summary_text TEXT NOT NULL,
    character_statuses_json TEXT NOT NULL DEFAULT '[]',
    key_events_json TEXT NOT NULL DEFAULT '[]',
    cliffhanger_warning TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(series_id, through_chapter_seq, language_tag, recap_kind)
);

CREATE INDEX IF NOT EXISTS idx_story_recaps_lookup 
    ON chapter_story_recaps(series_id, through_chapter_seq DESC, language_tag);
```

---

## 4. Anti-Spoiler Query Contract & SLA
When retrieving the active catch-up recap for a user opening Chapter $N$:
```sql
SELECT 
    id, series_id, through_chapter_seq, arc_title, language_tag, recap_kind,
    summary_text, character_statuses_json, key_events_json, cliffhanger_warning
FROM chapter_story_recaps
WHERE series_id = ? 
  AND through_chapter_seq <= ?
  AND language_tag = ?
ORDER BY through_chapter_seq DESC
LIMIT 1;
```
Where `?` parameter 2 is $N - 1$ (or `N - 0.001` to strictly ensure `< N`).
- Target SLA: Execution time $< 1.0$ ms.
- Projected SLA on T4500: $\sim 0.15 - 0.35$ ms.

---

## 5. UI/UX Interaction Rules
1. **Inactivity Heuristic (> 14 Days):**
   If user's last reading timestamp on this series is $> 14$ days ago, a discreet "Previously On..." badge lights up on the reader HUD.
2. **Non-Intrusive Drawer:**
   The drawer never automatically covers the page during fast reading sessions.
3. **Drawer Controls:**
   - Quick Dismiss.
   - "Don't show for this arc" memory flag stored in `localStorage`.
