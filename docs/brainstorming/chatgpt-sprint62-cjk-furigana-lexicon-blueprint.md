# Senior ChatGPT Architectural Blueprint: Sprint 62 — Interactive CJK Furigana & Manga Lore Lexicon HUD

**Consultation Source:** Brave Browser via MCP (`«Colaboración en proyecto - Brave»`), Senior Architect ChatGPT.  
**Sprint Scope:** Sprint 62 (Zero-Latency Japanese Kanji Furigana & Manhwa Lore Terminology Popover, SQLite Point-Index Lexicon, LRU In-Memory Cache, Hardware-Safe HUD, SLA 26).  
**Target Hardware:** Intel Pentium T4500 (2C/2T @ 2.30 GHz, 1MB L2 cache, 512MB RAM heap ceiling) & Intel GMA 4500MHD (Zero CSS blur, zero backdrop-filter, pure solid containment, 0 CLS) & 4TB SATA II HDD (~75-100 IOPS, 12-15ms radial seek latency).

---

## 1. Executive Summary & Design Constraints
When reading Japanese Manga (often written with complex Kanji or dialectal phrasing) or Korean Manhwa (often featuring elaborate Cultivation, Murim, or Hunter/Dungeon rank terminology like "Dantian", "Qi", "S-Rank Gate"), readers frequently stumble over character readings and lore context.
1. **Zero Cloud Latency:** All glosses, furigana readings, and lore definitions must resolve locally in $< 0.5\text{ ms}$.
2. **Ultra-Low Memory Footprint:** The entire active lexicon cache in RAM must not exceed **$250\text{ KB}$** (bounded to 1,000 recent terms), preserving the 512MB V8 heap ceiling.
3. **Compound Series Lore Partitioning:** Terms can be global (common manga vocabulary, e.g., "センパイ", "バカ", "海賊") or scoped to a specific series (e.g., "覇王色の覇気" in One Piece, "卍解" in Bleach, "念能力" in Hunter x Hunter).
4. **Hardware-Safe HUD:** Zero CSS blur or backdrop filter for Intel GMA 4500MHD. Layout containment `contain: layout paint` to guarantee $CLS = 0$.

---

## 2. SQLite Database Schema (`cjk_lexicon_entries`)

```sql
CREATE TABLE IF NOT EXISTS cjk_lexicon_entries (
    id TEXT PRIMARY KEY,
    term TEXT NOT NULL,
    reading TEXT NOT NULL,
    romaji TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('KANJI', 'VOCAB', 'SERIES_LORE', 'NAME', 'SFX')),
    definition_es TEXT NOT NULL,
    definition_en TEXT,
    series_id TEXT REFERENCES series(id) ON DELETE CASCADE,
    frequency INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(term, series_id)
);

CREATE INDEX IF NOT EXISTS idx_lexicon_lookup
    ON cjk_lexicon_entries (term, series_id);

CREATE INDEX IF NOT EXISTS idx_lexicon_reading
    ON cjk_lexicon_entries (reading);

CREATE INDEX IF NOT EXISTS idx_lexicon_romaji
    ON cjk_lexicon_entries (romaji);
```

---

## 3. In-Memory LRU Cache & Statement Caching
- **Prepared Statement Caching:** Pre-compile SQLite queries into cached `Statement` handles to avoid AST recompilation latency.
- **LRU Cache:** Keep the 1,000 most frequently queried terms in a `Map<string, LexiconEntry>` with $O(1)$ lookup and eviction.

---

## 4. Frontend HUD Specification (`FuriganaLexiconHUD.tsx`)
- Popover triggered by click or long-hover (300ms) on speech bubble tokens or manual search (`'L'` or `'Ctrl+L'`).
- Display:
  - Header: Large Kanji/Hangul term with inline Ruby annotation (`<ruby>漢<rt>かん</rt>字<rt>じ</rt></ruby>`) and Romaji.
  - Category Badge: `SERIES_LORE` (amber), `KANJI` (cyan), `VOCAB` (violet), `SFX` (emerald).
  - Definition in Spanish (and English fallback).
  - Scope: Global vs Series Specific.
- Geometry: Fixed popover with solid background `#18181b`, border `#27272a`, zero GPU blur, 0 layout shifts.

---

## 5. Performance SLA Specification
- **SLA 26:** Lexicon point query and furigana gloss resolution latency $< 0.5\text{ ms}$ ($500\ \mu\text{s}$) per lookup.
