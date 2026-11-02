# Sprint 49 Specification: MangaSFX Audio Deck & Narrative Ambient Audio Engine

## 1. Architectural Principles & Hardware Confinement
1. **Zero Host Transcoding:**
   The Intel Pentium T4500 CPU (2 cores @ 2.30 GHz, 512MB RAM ceiling) must never run real-time audio transcoding, FFmpeg pipelines, or continuous streaming threads. Fastify serves lightweight static audio assets with immutable cache headers and delivers metadata manifests in $< 1.0$ ms.
2. **Client-Side Synthesis & Web Audio API:**
   Dynamic onomatopoeias (*DON!!*, *DOKI DOKI*, *SWOOSH*, *ZAP*, *RUMBLE*) are generated directly in the reader's browser via Web Audio API oscillators, noise buffers, and gain envelopes. This reduces network payload to $< 1$ KB per chapter!
3. **Intel GMA 4500MHD Visual Confinement:**
   The `AudioDeckHUD.tsx` controller uses zero CSS backdrop-filter or blur, 0 CLS layout containment, and pure CSS `transform` / `opacity` transitions.

---

## 2. SQLite DDL Specification

```sql
-- Reusable Catalog of Audio Assets
CREATE TABLE IF NOT EXISTS audio_assets (
    asset_key TEXT PRIMARY KEY,
    relative_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL CHECK(mime_type IN ('audio/ogg', 'audio/webm', 'audio/mpeg', 'audio/mp4')),
    codec TEXT NOT NULL CHECK(codec IN ('opus', 'vorbis', 'mp3', 'aac')),
    byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 10485760),
    duration_ms INTEGER NOT NULL CHECK(duration_ms > 0),
    kind TEXT NOT NULL DEFAULT 'sfx' CHECK(kind IN ('sfx', 'ambient', 'music')),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Chapter Ambient Background Audio Tracks (Page Ranges)
CREATE TABLE IF NOT EXISTS chapter_audio_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    start_page INTEGER NOT NULL DEFAULT 1 CHECK(start_page >= 1),
    end_page INTEGER CHECK(end_page IS NULL OR end_page >= start_page),
    track_kind TEXT NOT NULL DEFAULT 'ambient' CHECK(track_kind IN ('ambient', 'battle', 'tension', 'silence')),
    asset_key TEXT REFERENCES audio_assets(asset_key) ON DELETE SET NULL,
    volume_level REAL NOT NULL DEFAULT 0.5 CHECK(volume_level >= 0.0 AND volume_level <= 1.0),
    loop_enabled INTEGER NOT NULL DEFAULT 1 CHECK(loop_enabled IN (0, 1)),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audio_tracks_chapter 
    ON chapter_audio_tracks(chapter_id, start_page);

-- Chapter Page-Level Dynamic SFX Cues (Onomatopoeia Trigger Points)
CREATE TABLE IF NOT EXISTS chapter_sfx_cues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK(page_number >= 1),
    cue_index INTEGER NOT NULL DEFAULT 0 CHECK(cue_index >= 0),
    trigger_type TEXT NOT NULL DEFAULT 'on_enter' CHECK(trigger_type IN ('on_enter', 'on_scroll_pct', 'on_tap')),
    trigger_offset_pct REAL NOT NULL DEFAULT 0.0 CHECK(trigger_offset_pct >= 0.0 AND trigger_offset_pct <= 100.0),
    sfx_type TEXT NOT NULL DEFAULT 'synth' CHECK(sfx_type IN ('synth', 'asset')),
    synth_preset TEXT CHECK(synth_preset IN ('don', 'doki_doki', 'swoosh', 'crack', 'rumble', 'custom')),
    synth_params_json TEXT DEFAULT '{}',
    asset_key TEXT REFERENCES audio_assets(asset_key) ON DELETE SET NULL,
    volume_level REAL NOT NULL DEFAULT 0.8 CHECK(volume_level >= 0.0 AND volume_level <= 1.0),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chapter_id, page_number, cue_index)
);

CREATE INDEX IF NOT EXISTS idx_sfx_cues_chapter_page 
    ON chapter_sfx_cues(chapter_id, page_number, cue_index ASC);
```

---

## 3. SLA Targets
- Lookup SFX cues for a specific page: $< 0.5$ ms.
- Lookup full chapter audio manifest: $< 1.0$ ms.
- Client audio debouncing interval: $200$ ms (prevents node explosion during fast scrolling).
