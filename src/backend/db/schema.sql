-- Series Master Table
CREATE TABLE IF NOT EXISTS series (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title_primary TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('manga', 'manhwa', 'manhua', 'comic')),
    status TEXT NOT NULL CHECK(status IN ('ongoing', 'completed', 'hiatus', 'cancelled')),
    demographic TEXT CHECK(demographic IN ('shounen', 'seinen', 'shoujo', 'josei', 'none')),
    synopsis TEXT,
    cover_image TEXT,
    banner_image TEXT,
    author TEXT,
    artist TEXT,
    release_year INTEGER,
    anilist_id INTEGER,
    mangadex_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Multi-lingual Title Aliases for Search
CREATE TABLE IF NOT EXISTS series_titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    language_code TEXT NOT NULL,
    title TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0
);

-- Full Text Search Virtual Table with Prefix Indexing (1 2 3) and Diacritic Normalization
CREATE VIRTUAL TABLE IF NOT EXISTS series_search_fts USING fts5(
    series_id UNINDEXED,
    title,
    tokenize = 'unicode61 remove_diacritics 2',
    prefix = '1 2 3'
);

-- Triggers to keep FTS index synchronized
CREATE TRIGGER IF NOT EXISTS series_titles_ai AFTER INSERT ON series_titles BEGIN
    INSERT INTO series_search_fts(series_id, title) VALUES (new.series_id, new.title);
END;

CREATE TRIGGER IF NOT EXISTS series_titles_ad AFTER DELETE ON series_titles BEGIN
    DELETE FROM series_search_fts WHERE series_id = old.series_id AND title = old.title;
END;

-- Genres and Taxonomy
CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS series_genres (
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (series_id, genre_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_series_titles_series_id ON series_titles(series_id);
CREATE INDEX IF NOT EXISTS idx_series_titles_lang ON series_titles(series_id, language_code);
CREATE INDEX IF NOT EXISTS idx_series_titles_title ON series_titles(title);
CREATE INDEX IF NOT EXISTS idx_series_updated_at ON series(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_series_type_status ON series(type, status);
CREATE INDEX IF NOT EXISTS idx_series_genres_genre_id ON series_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_genres_name ON genres(name);
CREATE INDEX IF NOT EXISTS idx_genres_slug ON genres(slug);

-- Volumes / Seasons
CREATE TABLE IF NOT EXISTS volumes (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    volume_number REAL NOT NULL,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(series_id, volume_number)
);

-- Chapters
CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    volume_id TEXT REFERENCES volumes(id) ON DELETE SET NULL,
    chapter_number REAL NOT NULL,
    title TEXT,
    scanlation_group TEXT,
    page_count INTEGER NOT NULL DEFAULT 0,
    storage_path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(series_id, chapter_number)
);

-- Pages Manifest
CREATE TABLE IF NOT EXISTS chapter_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    aspect_ratio REAL NOT NULL,
    blurhash TEXT,
    UNIQUE(chapter_id, page_number)
);

-- Reading Progress & Bookmarks
CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'local_user',
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL DEFAULT 1,
    scroll_offset_y REAL DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, series_id)
);
CREATE INDEX IF NOT EXISTS idx_user_progress_recent ON user_progress(user_id, updated_at DESC);

-- Reading Streak Analytics & Habits
CREATE TABLE IF NOT EXISTS user_reading_streaks (
    user_id TEXT PRIMARY KEY,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_read_date TEXT,
    total_pages_read INTEGER NOT NULL DEFAULT 0,
    total_reading_seconds INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Daily Reading Targets & Habit Configuration
CREATE TABLE IF NOT EXISTS user_reading_goals (
    user_id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL CHECK(target_type IN ('pages', 'minutes')),
    target_value INTEGER NOT NULL CHECK(target_value > 0),
    notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK(notifications_enabled IN (0, 1)),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Daily Reading Activity Logs for Calendars, Streaks, and Analytics
CREATE TABLE IF NOT EXISTS user_daily_activity (
    user_id TEXT NOT NULL,
    date TEXT NOT NULL CHECK(length(date) = 10), -- Strict ISO 8601: YYYY-MM-DD
    pages_read INTEGER NOT NULL DEFAULT 0 CHECK(pages_read >= 0),
    reading_seconds INTEGER NOT NULL DEFAULT 0 CHECK(reading_seconds >= 0),
    goal_completed INTEGER NOT NULL DEFAULT 0 CHECK(goal_completed IN (0, 1)),
    completed_at TEXT, -- Timestamp when the daily goal was met (ISO 8601)
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, date)
);

-- Covering Index for rapid streak calculation and date range lookups without table scans
CREATE INDEX IF NOT EXISTS idx_user_daily_activity_date 
    ON user_daily_activity(user_id, date DESC, goal_completed);

-- Covering Index for lifetime stats aggregation without mechanical disk seeks
CREATE INDEX IF NOT EXISTS idx_user_daily_activity_stats 
    ON user_daily_activity(user_id, pages_read, reading_seconds, goal_completed);

-- Gamification Badges & Achievement Progress
CREATE TABLE IF NOT EXISTS user_badges (
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    current_value REAL NOT NULL DEFAULT 0,
    target_value REAL NOT NULL DEFAULT 1,
    is_unlocked INTEGER NOT NULL DEFAULT 0 CHECK(is_unlocked IN (0, 1)),
    unlocked_at TEXT,
    notified INTEGER NOT NULL DEFAULT 0 CHECK(notified IN (0, 1)),
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, badge_id)
);

-- Covering Index for fast lookup of unlocked achievements and celebratory toasts
CREATE INDEX IF NOT EXISTS idx_user_badges_unlocked 
    ON user_badges(user_id, is_unlocked, unlocked_at DESC);

-- Incremental Folder Synchronization State (Avoids recursive 4TB HDD re-scanning)
CREATE TABLE IF NOT EXISTS folder_sync_state (
    folder_path TEXT PRIMARY KEY,
    last_mtime INTEGER NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Library Snapshots & Differential Mirroring State
CREATE TABLE IF NOT EXISTS library_snapshots (
    id TEXT PRIMARY KEY,
    snapshot_type TEXT NOT NULL CHECK(snapshot_type IN ('full', 'differential')),
    created_at TEXT DEFAULT (datetime('now')),
    total_series INTEGER NOT NULL,
    total_chapters INTEGER NOT NULL,
    file_count INTEGER NOT NULL,
    total_bytes INTEGER NOT NULL,
    destination_path TEXT NOT NULL
);

-- Corrupt Files & Bad Sector Audit Log
CREATE TABLE IF NOT EXISTS corrupt_files_log (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    chapter_id TEXT,
    error_reason TEXT NOT NULL,
    detected_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'pending_repair' CHECK(status IN ('pending_repair', 'repaired', 'quarantined'))
);

-- User Preferences & Hardware Power Profiles
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    reader_theme TEXT NOT NULL DEFAULT 'carbon' CHECK(reader_theme IN ('oled', 'sepia', 'carbon', 'midnight')),
    battery_saver_enabled INTEGER NOT NULL DEFAULT 1 CHECK (battery_saver_enabled IN (0, 1)),
    adaptive_prefetch INTEGER NOT NULL DEFAULT 1 CHECK (adaptive_prefetch IN (0, 1)),
    animations_enabled INTEGER NOT NULL DEFAULT 1 CHECK (animations_enabled IN (0, 1)),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1
);

-- Reading Bookmarks & Navigation Pins
CREATE TABLE IF NOT EXISTS user_bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    series_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    page_index INTEGER NOT NULL CHECK (page_index >= 0),
    note TEXT CHECK (note IS NULL OR length(note) <= 500),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, chapter_id, page_index)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_series_chapter
    ON user_bookmarks (user_id, series_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_series_created
    ON user_bookmarks (user_id, series_id, created_at DESC, id DESC);

-- Offline Mutation Idempotency & Replay Audit Ledger
CREATE TABLE IF NOT EXISTS applied_mutations (
    user_id TEXT NOT NULL,
    client_mutation_id TEXT NOT NULL,
    status TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, client_mutation_id)
);

CREATE INDEX IF NOT EXISTS idx_applied_mutations_lookup
    ON applied_mutations (user_id, client_mutation_id);

-- Sprint 41: Otaku Stats & Incremental Genre Aggregation
CREATE TABLE IF NOT EXISTS user_genre_read_stats (
    user_id TEXT NOT NULL,
    genre_id INTEGER NOT NULL,
    chapters_read INTEGER NOT NULL DEFAULT 0,
    reading_seconds INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_user_genre_stats_lookup
    ON user_genre_read_stats (user_id, chapters_read DESC);

-- Sprint 43: Deduplication & Merge Audit Ledger
CREATE TABLE IF NOT EXISTS duplicate_merge_history (
    id TEXT PRIMARY KEY,
    source_series_id TEXT NOT NULL,
    target_series_id TEXT NOT NULL,
    source_title TEXT NOT NULL,
    target_title TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    chapters_moved INTEGER NOT NULL DEFAULT 0,
    chapters_overwritten INTEGER NOT NULL DEFAULT 0,
    merged_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merge_history_target
    ON duplicate_merge_history (target_series_id);

-- Sprint 45: Reading Session Optical Replay & Kinetic Dwell-Time Attention Heatmaps
CREATE TABLE IF NOT EXISTS chapter_page_dwell_stats (
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK(page_number >= 1),
    total_reads INTEGER NOT NULL DEFAULT 0 CHECK(total_reads >= 0),
    total_dwell_seconds REAL NOT NULL DEFAULT 0.0 CHECK(total_dwell_seconds >= 0.0),
    avg_dwell_seconds REAL NOT NULL DEFAULT 0.0 CHECK(avg_dwell_seconds >= 0.0),
    dwell_intensity_score REAL NOT NULL DEFAULT 0.0 CHECK(dwell_intensity_score >= 0.0 AND dwell_intensity_score <= 100.0),
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (chapter_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_dwell_stats_lookup 
    ON chapter_page_dwell_stats(chapter_id, page_number ASC);

CREATE INDEX IF NOT EXISTS idx_dwell_stats_intensity 
    ON chapter_page_dwell_stats(chapter_id, dwell_intensity_score DESC);

-- Sprint 46: Multilingual Speech Bubble Overlays & Ruby/Furigana
CREATE TABLE IF NOT EXISTS chapter_speech_bubbles (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK(page_number >= 1),
    bubble_index INTEGER NOT NULL DEFAULT 0 CHECK(bubble_index >= 0),
    bbox_x REAL NOT NULL CHECK(bbox_x >= 0.0 AND bbox_x <= 100.0),
    bbox_y REAL NOT NULL CHECK(bbox_y >= 0.0 AND bbox_y <= 100.0),
    bbox_width REAL NOT NULL CHECK(bbox_width > 0.0 AND bbox_width <= 100.0),
    bbox_height REAL NOT NULL CHECK(bbox_height > 0.0 AND bbox_height <= 100.0),
    reading_direction TEXT NOT NULL DEFAULT 'vertical' CHECK(reading_direction IN ('vertical', 'horizontal')),
    raw_text TEXT NOT NULL,
    translated_text_es TEXT,
    translated_text_en TEXT,
    ruby_furigana TEXT,
    confidence_score REAL NOT NULL DEFAULT 1.0 CHECK(confidence_score >= 0.0 AND confidence_score <= 1.0),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chapter_id, page_number, bubble_index)
);

CREATE INDEX IF NOT EXISTS idx_speech_bubbles_page 
    ON chapter_speech_bubbles(chapter_id, page_number, bubble_index ASC);

-- Sprint 47: Semantic Vector Embeddings & Hybrid RRF Search
CREATE TABLE IF NOT EXISTS series_embeddings (
    series_id TEXT PRIMARY KEY REFERENCES series(id) ON DELETE CASCADE,
    dimensions INTEGER NOT NULL DEFAULT 384 CHECK(dimensions = 384),
    scale_factor REAL NOT NULL CHECK(scale_factor > 0.0),
    magnitude REAL NOT NULL CHECK(magnitude > 0.0),
    embedding_blob BLOB NOT NULL CHECK(length(embedding_blob) = 384),
    model_version TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2-int8',
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_series_embeddings_lookup 
    ON series_embeddings(series_id, magnitude);

-- Sprint 48: Dynamic Story Recap Engine & Anti-Spoiler Reading Companion
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

-- Sprint 49: MangaSFX Dynamic Sound Effects & Ambient Audio Engine
CREATE TABLE IF NOT EXISTS chapter_audio_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    start_page INTEGER NOT NULL DEFAULT 1 CHECK(start_page >= 1),
    end_page INTEGER CHECK(end_page IS NULL OR end_page >= start_page),
    track_kind TEXT NOT NULL DEFAULT 'ambient' CHECK(track_kind IN ('ambient', 'battle', 'tension', 'silence')),
    ambient_preset TEXT NOT NULL DEFAULT 'rain' CHECK(ambient_preset IN ('rain', 'storm', 'fire', 'tavern', 'wind', 'eerie', 'battle', 'silence')),
    asset_url TEXT,
    volume_level REAL NOT NULL DEFAULT 0.5 CHECK(volume_level >= 0.0 AND volume_level <= 1.0),
    loop_enabled INTEGER NOT NULL DEFAULT 1 CHECK(loop_enabled IN (0, 1)),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audio_tracks_chapter 
    ON chapter_audio_tracks(chapter_id, start_page);

CREATE TABLE IF NOT EXISTS chapter_sfx_cues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK(page_number >= 1),
    cue_index INTEGER NOT NULL DEFAULT 0 CHECK(cue_index >= 0),
    sfx_id TEXT NOT NULL,
    onomatopoeia_text TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'on_enter' CHECK(trigger_type IN ('on_enter', 'on_scroll_pct', 'on_tap')),
    trigger_offset_pct REAL NOT NULL DEFAULT 0.0 CHECK(trigger_offset_pct >= 0.0 AND trigger_offset_pct <= 100.0),
    synth_params_json TEXT DEFAULT '{}',
    volume_level REAL NOT NULL DEFAULT 0.8 CHECK(volume_level >= 0.0 AND volume_level <= 1.0),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chapter_id, page_number, cue_index)
);

CREATE INDEX IF NOT EXISTS idx_sfx_cues_chapter_page 
    ON chapter_sfx_cues(chapter_id, page_number, cue_index ASC);

-- Sprint 50: Smart Contrast Adaptive Filters & High-Dynamic OLED / E-Ink Eye Care Reading Engine
CREATE TABLE IF NOT EXISTS user_eye_care_preferences (
    user_id TEXT PRIMARY KEY,
    filter_mode TEXT NOT NULL DEFAULT 'default' CHECK(filter_mode IN ('default', 'sepia_warm', 'oled_dark', 'smart_invert', 'e_ink_high_contrast')),
    brightness_pct INTEGER NOT NULL DEFAULT 100 CHECK(brightness_pct BETWEEN 10 AND 200),
    contrast_pct INTEGER NOT NULL DEFAULT 100 CHECK(contrast_pct BETWEEN 50 AND 250),
    blue_light_reduction_pct INTEGER NOT NULL DEFAULT 0 CHECK(blue_light_reduction_pct BETWEEN 0 AND 100),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Sprint 51: Dynamic Two-Page Spread Smart Splitter & Webtoon Seam Stitcher
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

-- Sprint 52: Interactive Reader Annotation Deck & Ephemeral Sticky Note Layer
CREATE TABLE IF NOT EXISTS chapter_page_annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    user_id TEXT NOT NULL,
    anchor_x REAL NOT NULL CHECK (anchor_x BETWEEN 0.0 AND 100.0),
    anchor_y REAL NOT NULL CHECK (anchor_y BETWEEN 0.0 AND 100.0),
    annotation_type TEXT NOT NULL DEFAULT 'sticky_note' CHECK (annotation_type IN ('sticky_note', 'panel_bookmark', 'reaction')),
    content_text TEXT NOT NULL,
    color_preset TEXT NOT NULL DEFAULT 'yellow' CHECK (color_preset IN ('yellow', 'blue', 'green', 'pink', 'purple')),
    is_spoiler INTEGER NOT NULL DEFAULT 0 CHECK (is_spoiler IN (0, 1)),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_annotations_lookup
    ON chapter_page_annotations(chapter_id, page_number);

CREATE INDEX IF NOT EXISTS idx_page_annotations_user
    ON chapter_page_annotations(user_id);

-- Sprint 53: Continuous Background Reading Velocity & Dynamic Completion Time Predictor
CREATE TABLE IF NOT EXISTS user_reading_cadence (
    user_id TEXT NOT NULL,
    reading_mode TEXT NOT NULL CHECK (reading_mode IN ('manga', 'webtoon', 'comic')),
    average_seconds_per_page REAL NOT NULL DEFAULT 24.0,
    samples_count INTEGER NOT NULL DEFAULT 0,
    last_active_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, reading_mode)
);

CREATE TABLE IF NOT EXISTS reading_session_cadence_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    dwell_seconds REAL NOT NULL CHECK (dwell_seconds >= 0.0),
    is_outlier INTEGER NOT NULL DEFAULT 0 CHECK (is_outlier IN (0, 1)),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_cadence_lookup
    ON reading_session_cadence_logs(user_id, chapter_id);

-- Sprint 54: Adaptive Frame-Rate Pacer & Thermal Throttling Guard
CREATE TABLE IF NOT EXISTS client_render_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    fps_average REAL NOT NULL,
    drop_rate_pct REAL NOT NULL,
    governor_state TEXT NOT NULL CHECK (governor_state IN ('nominal_60', 'paced_30', 'emergency_step')),
    reading_mode TEXT NOT NULL DEFAULT 'manga',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_render_telemetry_user
    ON client_render_telemetry(user_id, created_at);

-- Sprint 55: High-Precision Panel Crop & Dialogue Bubble OCR Pre-Cacher
CREATE TABLE IF NOT EXISTS chapter_page_panels (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    panel_index INTEGER NOT NULL CHECK (panel_index >= 0),
    x REAL NOT NULL CHECK (x >= 0.0 AND x <= 100.0),
    y REAL NOT NULL CHECK (y >= 0.0 AND y <= 100.0),
    w REAL NOT NULL CHECK (w >= 0.0 AND w <= 100.0),
    h REAL NOT NULL CHECK (h >= 0.0 AND h <= 100.0),
    aspect_ratio REAL NOT NULL,
    reading_order INTEGER NOT NULL CHECK (reading_order >= 0),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chapter_page_panels_lookup
    ON chapter_page_panels(chapter_id, page_number, reading_order);

CREATE TABLE IF NOT EXISTS chapter_bubble_ocr_index (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    panel_id TEXT REFERENCES chapter_page_panels(id) ON DELETE SET NULL,
    bubble_index INTEGER NOT NULL CHECK (bubble_index >= 0),
    x REAL NOT NULL CHECK (x >= 0.0 AND x <= 100.0),
    y REAL NOT NULL CHECK (y >= 0.0 AND y <= 100.0),
    w REAL NOT NULL CHECK (w >= 0.0 AND w <= 100.0),
    h REAL NOT NULL CHECK (h >= 0.0 AND h <= 100.0),
    text TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'ja',
    confidence REAL NOT NULL DEFAULT 1.0,
    bubble_type TEXT NOT NULL DEFAULT 'SPEECH' CHECK (bubble_type IN ('SPEECH', 'THOUGHT', 'SCREAM', 'WHISPER', 'SFX')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chapter_bubble_ocr_lookup
    ON chapter_bubble_ocr_index(chapter_id, page_number);

-- FTS5 Full-Text Dialogue Search for In-Manga Spoken Quotes (Trigram Tokenizer for CJK & Latin Substring Match)
CREATE VIRTUAL TABLE IF NOT EXISTS dialogue_fts USING fts5(
    bubble_id UNINDEXED,
    chapter_id UNINDEXED,
    page_number UNINDEXED,
    text,
    language UNINDEXED,
    tokenize = 'trigram'
);

CREATE TRIGGER IF NOT EXISTS trg_bubble_ocr_insert AFTER INSERT ON chapter_bubble_ocr_index BEGIN
    INSERT INTO dialogue_fts(bubble_id, chapter_id, page_number, text, language)
    VALUES (new.id, new.chapter_id, new.page_number, new.text, new.language);
END;

CREATE TRIGGER IF NOT EXISTS trg_bubble_ocr_delete AFTER DELETE ON chapter_bubble_ocr_index BEGIN
    DELETE FROM dialogue_fts WHERE bubble_id = old.id;
END;

-- Sprint 56: Dynamic Haptic Feedback & Screen Rumble Engine
CREATE TABLE IF NOT EXISTS user_immersion_preferences (
    user_id TEXT PRIMARY KEY,
    haptics_enabled INTEGER NOT NULL DEFAULT 0 CHECK (haptics_enabled IN (0, 1)),
    screen_rumble_enabled INTEGER NOT NULL DEFAULT 0 CHECK (screen_rumble_enabled IN (0, 1)),
    max_haptic_intensity INTEGER NOT NULL DEFAULT 1 CHECK (max_haptic_intensity BETWEEN 0 AND 2),
    max_rumble_intensity INTEGER NOT NULL DEFAULT 1 CHECK (max_rumble_intensity BETWEEN 0 AND 2),
    haptics_with_reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (haptics_with_reduced_motion IN (0, 1)),
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS impact_telemetry_batches (
    batch_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('sfx', 'onomatopoeia', 'manual')),
    intensity INTEGER NOT NULL CHECK (intensity BETWEEN 0 AND 2),
    trigger_count INTEGER NOT NULL DEFAULT 0,
    haptic_api_attempts INTEGER NOT NULL DEFAULT 0,
    haptic_accepted_count INTEGER NOT NULL DEFAULT 0,
    haptic_suppressed_count INTEGER NOT NULL DEFAULT 0,
    rumble_attempt_count INTEGER NOT NULL DEFAULT 0,
    rumble_executed_count INTEGER NOT NULL DEFAULT 0,
    rumble_suppressed_count INTEGER NOT NULL DEFAULT 0,
    flushed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_user_session
    ON impact_telemetry_batches (user_id, session_id);

-- Sprint 57: High-Density Compressed Chapter Bundle Streaming Engine (CBZ Zero-Seek Offsets)
CREATE TABLE IF NOT EXISTS chapter_archive_offsets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    file_name TEXT NOT NULL,
    compression_method INTEGER NOT NULL CHECK (compression_method IN (0, 8)),
    data_offset INTEGER NOT NULL CHECK (data_offset >= 0),
    compressed_size INTEGER NOT NULL CHECK (compressed_size > 0),
    uncompressed_size INTEGER NOT NULL CHECK (uncompressed_size > 0),
    crc32 INTEGER NOT NULL,
    local_header_offset INTEGER NOT NULL CHECK (local_header_offset >= 0),
    mime_type TEXT NOT NULL DEFAULT 'image/webp',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chapter_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_archive_offsets_lookup
    ON chapter_archive_offsets (chapter_id, page_number);

-- Sprint 58: Smart WebP Transcoding Cache & Ahead-Of-Time Downsampling Pipeline
CREATE TABLE IF NOT EXISTS cached_transcoded_pages (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    target_width INTEGER NOT NULL CHECK (target_width > 0),
    target_height INTEGER NOT NULL CHECK (target_height > 0),
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
    quality INTEGER NOT NULL DEFAULT 80,
    etag TEXT NOT NULL,
    last_accessed_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(chapter_id, page_number, target_width)
);

CREATE INDEX IF NOT EXISTS idx_transcode_cache_lookup
    ON cached_transcoded_pages (chapter_id, page_number, target_width);

CREATE INDEX IF NOT EXISTS idx_transcode_lru_prune
    ON cached_transcoded_pages (last_accessed_at);

-- Sprint 61: Continuous In-Memory Spatial Reading Heatmap & Kinetic Focus Analyzer
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

-- Sprint 62: Interactive CJK Furigana & Manga Lore Lexicon HUD
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

-- Sprint 63: Platter Defragmentation & Sequential CBZ Re-Ordering Daemon
CREATE TABLE IF NOT EXISTS disk_platter_defrag_runs (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    initial_pli REAL NOT NULL CHECK (initial_pli BETWEEN 0.0 AND 1.0),
    optimized_pli REAL NOT NULL CHECK (optimized_pli BETWEEN 0.0 AND 1.0),
    bytes_reordered INTEGER NOT NULL DEFAULT 0,
    chapters_processed INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_defrag_runs_series
    ON disk_platter_defrag_runs (series_id, created_at DESC);

-- Sprint 64: Adaptive Paper Tone, E-Ink Simulation & Palette Remapping Engine
CREATE TABLE IF NOT EXISTS user_paper_tone_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    series_id TEXT DEFAULT NULL REFERENCES series(id) ON DELETE CASCADE,
    preset TEXT NOT NULL DEFAULT 'ORIGINAL' CHECK (preset IN ('ORIGINAL', 'SEPIA_CALIDO', 'PAPEL_E_INK', 'PERIODICO_VINTAGE', 'AMBAR_MEDIANOCHE', 'NOIR_ALTO_CONTRASTE')),
    warmth REAL NOT NULL DEFAULT 0.0 CHECK (warmth BETWEEN -1.0 AND 1.0),
    contrast REAL NOT NULL DEFAULT 1.0 CHECK (contrast BETWEEN 0.5 AND 2.0),
    brightness REAL NOT NULL DEFAULT 1.0 CHECK (brightness BETWEEN 0.5 AND 1.5),
    custom_matrix TEXT DEFAULT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_paper_tone_scoped 
    ON user_paper_tone_profiles(user_id, IFNULL(series_id, '__global__'));

CREATE INDEX IF NOT EXISTS idx_user_paper_tone_user
    ON user_paper_tone_profiles(user_id);

-- Sprint 65: Multi-Tab BroadcastChannel Synchronization & Shared Tab Leader Election
CREATE TABLE IF NOT EXISTS ephemeral_tab_sessions (
    tab_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    is_leader INTEGER NOT NULL DEFAULT 0 CHECK (is_leader IN (0, 1)),
    leader_epoch INTEGER NOT NULL DEFAULT 0,
    active_series_id TEXT DEFAULT NULL REFERENCES series(id) ON DELETE SET NULL,
    active_chapter_id TEXT DEFAULT NULL,
    last_heartbeat_ms INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tab_sessions_user
    ON ephemeral_tab_sessions (user_id, last_heartbeat_ms DESC);

-- Sprint 66: Memory-Bounded WebP Tile Tiling & Deep-Zoom Pyramidal Reader Engine
CREATE TABLE IF NOT EXISTS page_pyramid_metadata (
    chapter_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    is_pyramidal INTEGER NOT NULL DEFAULT 0 CHECK (is_pyramidal IN (0, 1)),
    original_width INTEGER NOT NULL,
    original_height INTEGER NOT NULL,
    tile_size INTEGER NOT NULL DEFAULT 512,
    max_level INTEGER NOT NULL DEFAULT 0,
    total_tiles INTEGER NOT NULL DEFAULT 1,
    pyramid_json TEXT,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (chapter_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pyramid_chapter
    ON page_pyramid_metadata (chapter_id);

-- Sprint 67: Dynamic SFX & Onomatopoeia Overlay Engine
CREATE TABLE IF NOT EXISTS sfx_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    surface TEXT NOT NULL,
    normalized_surface TEXT NOT NULL,
    language_code TEXT NOT NULL CHECK(language_code IN ('ja', 'ko')),
    category TEXT NOT NULL CHECK(category IN ('GISEIGO', 'GIONGO', 'GITAGO', 'GIJOGO', 'GIOUGO', 'UISEONGEO', 'UITAEEO')),
    romanization TEXT NOT NULL,
    meaning_es TEXT NOT NULL,
    meaning_en TEXT NOT NULL,
    translation_es TEXT NOT NULL,
    translation_en TEXT NOT NULL,
    style_preset TEXT NOT NULL DEFAULT 'IMPACT_BOLD',
    intensity REAL NOT NULL DEFAULT 0.5 CHECK(intensity BETWEEN 0.0 AND 1.0),
    created_at INTEGER NOT NULL,
    UNIQUE(language_code, normalized_surface)
);

CREATE INDEX IF NOT EXISTS idx_sfx_catalog_lookup
    ON sfx_catalog(language_code, normalized_surface);

CREATE INDEX IF NOT EXISTS idx_sfx_catalog_romaji
    ON sfx_catalog(romanization);

CREATE TABLE IF NOT EXISTS page_sfx_annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    sfx_id INTEGER NOT NULL REFERENCES sfx_catalog(id) ON DELETE CASCADE,
    norm_x REAL NOT NULL CHECK(norm_x >= 0.0 AND norm_x <= 1.0),
    norm_y REAL NOT NULL CHECK(norm_y >= 0.0 AND norm_y <= 1.0),
    norm_w REAL NOT NULL CHECK(norm_w > 0.0 AND norm_w <= 1.0),
    norm_h REAL NOT NULL CHECK(norm_h > 0.0 AND norm_h <= 1.0),
    rotation_deg REAL NOT NULL DEFAULT 0.0,
    is_vertical INTEGER NOT NULL DEFAULT 0 CHECK(is_vertical IN (0, 1)),
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_sfx_chapter_page
    ON page_sfx_annotations(chapter_id, page_number);

-- Sprint 68: Smart Guided Panel Pacer & Cinematic Auto-Framing Engine
CREATE TABLE IF NOT EXISTS page_panel_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    panel_index INTEGER NOT NULL,
    norm_x REAL NOT NULL CHECK(norm_x >= 0.0 AND norm_x <= 1.0),
    norm_y REAL NOT NULL CHECK(norm_y >= 0.0 AND norm_y <= 1.0),
    norm_w REAL NOT NULL CHECK(norm_w > 0.0 AND norm_w <= 1.0),
    norm_h REAL NOT NULL CHECK(norm_h > 0.0 AND norm_h <= 1.0),
    aspect_ratio REAL NOT NULL,
    reading_order_score REAL NOT NULL,
    is_splash INTEGER NOT NULL DEFAULT 0 CHECK(is_splash IN (0, 1)),
    created_at INTEGER NOT NULL,
    UNIQUE(chapter_id, page_number, panel_index)
);

CREATE INDEX IF NOT EXISTS idx_panel_seq_chapter_page
    ON page_panel_sequences(chapter_id, page_number, panel_index);

-- Sprint 69: LAN Companion Pairing Sessions & Sync Bridge
CREATE TABLE IF NOT EXISTS lan_pairing_sessions (
    pairing_id TEXT PRIMARY KEY,
    pairing_token_hash TEXT NOT NULL,
    session_token_hash TEXT,
    device_name TEXT,
    device_type TEXT NOT NULL DEFAULT 'mobile' CHECK(device_type IN ('mobile', 'tablet', 'desktop_companion', 'unknown')),
    client_ip TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PAIRED', 'REVOKED', 'EXPIRED')),
    active_series_id TEXT,
    active_chapter_id TEXT,
    active_page_number INTEGER NOT NULL DEFAULT 1 CHECK(active_page_number >= 1),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    paired_at INTEGER,
    last_seen_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_lan_pairing_status 
    ON lan_pairing_sessions(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_lan_pairing_token 
    ON lan_pairing_sessions(pairing_token_hash);

-- Sprint 70: Kinetic Motion Shutter & Multi-Layer Parallax Engine
CREATE TABLE IF NOT EXISTS page_kinetic_layers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    panel_index INTEGER NOT NULL,
    layer_index INTEGER NOT NULL,
    layer_role TEXT NOT NULL DEFAULT 'MIDGROUND' CHECK(layer_role IN ('FOREGROUND', 'MIDGROUND', 'BACKGROUND', 'SFX_LAYER')),
    norm_x REAL NOT NULL CHECK(norm_x >= 0.0 AND norm_x <= 1.0),
    norm_y REAL NOT NULL CHECK(norm_y >= 0.0 AND norm_y <= 1.0),
    norm_w REAL NOT NULL CHECK(norm_w > 0.0 AND norm_w <= 1.0),
    norm_h REAL NOT NULL CHECK(norm_h > 0.0 AND norm_h <= 1.0),
    depth_factor REAL NOT NULL CHECK(depth_factor >= 0.0 AND depth_factor <= 2.0),
    asset_url TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE(chapter_id, page_number, panel_index, layer_index)
);

CREATE INDEX IF NOT EXISTS idx_kinetic_layers_lookup 
    ON page_kinetic_layers(chapter_id, page_number, panel_index);

-- Sprint 71: Dynamic Optical Reading Ruler & Saccadic Guided Focus Engine
CREATE TABLE IF NOT EXISTS reading_ruler_preferences (
    user_id TEXT PRIMARY KEY,
    is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
    mode TEXT NOT NULL DEFAULT 'ruler' CHECK (mode IN ('ruler', 'shutter', 'saccadic_pacer')),
    orientation TEXT NOT NULL DEFAULT 'horizontal' CHECK (orientation IN ('horizontal', 'vertical')),
    slot_height_px INTEGER NOT NULL DEFAULT 64 CHECK (slot_height_px BETWEEN 32 AND 240),
    dim_opacity REAL NOT NULL DEFAULT 0.50 CHECK (dim_opacity BETWEEN 0.10 AND 0.90),
    tint_color TEXT NOT NULL DEFAULT 'amber' CHECK (tint_color IN ('amber', 'mint', 'rose', 'neutral', 'midnight')),
    pacer_speed_wpm INTEGER NOT NULL DEFAULT 250 CHECK (pacer_speed_wpm BETWEEN 60 AND 800),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ruler_pref_user 
    ON reading_ruler_preferences(user_id);

-- Sprint 72: Offline Storage Vault & Quota Arbiter Engine
CREATE TABLE IF NOT EXISTS offline_storage_vault (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    series_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    chapter_number REAL NOT NULL,
    series_title TEXT NOT NULL,
    total_bytes INTEGER NOT NULL,
    total_pages INTEGER NOT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
    is_unread INTEGER NOT NULL DEFAULT 1 CHECK (is_unread IN (0, 1)),
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    last_accessed_at INTEGER NOT NULL,
    downloaded_at INTEGER NOT NULL,
    UNIQUE(user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_user_chapter 
    ON offline_storage_vault(user_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_vault_eviction_sort 
    ON offline_storage_vault(user_id, is_pinned, last_accessed_at ASC);

CREATE TABLE IF NOT EXISTS storage_quota_policies (
    user_id TEXT PRIMARY KEY,
    max_quota_bytes INTEGER NOT NULL DEFAULT 1073741824, -- 1 GB default
    high_watermark_pct REAL NOT NULL DEFAULT 0.75,
    low_watermark_pct REAL NOT NULL DEFAULT 0.65,
    auto_evict_enabled INTEGER NOT NULL DEFAULT 1 CHECK (auto_evict_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

-- Sprint 73: Multi-Track Ambient Soundscapes & Atmospheric BGM Mixer Engine
CREATE TABLE IF NOT EXISTS ambient_soundscape_presets (
    id TEXT PRIMARY KEY,
    genre TEXT NOT NULL,
    title TEXT NOT NULL,
    track_base_url TEXT NOT NULL,
    track_sub_url TEXT,
    track_harmony_url TEXT,
    default_volume REAL NOT NULL DEFAULT 0.5,
    fade_duration_ms INTEGER NOT NULL DEFAULT 1500,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soundscape_genre 
    ON ambient_soundscape_presets(genre);

CREATE TABLE IF NOT EXISTS user_soundscape_preferences (
    user_id TEXT PRIMARY KEY,
    master_volume REAL NOT NULL DEFAULT 0.7,
    is_muted INTEGER NOT NULL DEFAULT 0 CHECK (is_muted IN (0, 1)),
    auto_play_on_reader INTEGER NOT NULL DEFAULT 0 CHECK (auto_play_on_reader IN (0, 1)),
    active_preset_id TEXT NOT NULL DEFAULT 'silence_pure',
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soundscape_user_pref 
    ON user_soundscape_preferences(user_id);

-- Sprint 74: Smart Page Curvature & Spine Flattening Dewarping Engine
CREATE TABLE IF NOT EXISTS page_spine_dewarp_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    chapter_id TEXT,
    page_number INTEGER,
    gutter_side TEXT NOT NULL DEFAULT 'auto' CHECK (gutter_side IN ('left', 'right', 'center', 'auto')),
    curvature_depth REAL NOT NULL DEFAULT 0.25,
    spine_width_pct REAL NOT NULL DEFAULT 0.20,
    shadow_compensation REAL NOT NULL DEFAULT 0.15,
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spine_dewarp_lookup 
    ON page_spine_dewarp_profiles(series_id, chapter_id, page_number);

-- Sprint 75: Dynamic Dialogue TTS & Multi-Voice Actor Synthesizer
CREATE TABLE IF NOT EXISTS dialogue_voice_profiles (
    series_id TEXT NOT NULL,
    character_name TEXT NOT NULL,
    voice_role TEXT NOT NULL DEFAULT 'narrator' CHECK (voice_role IN ('narrator', 'male_hero', 'female_hero', 'child_creature', 'villain', 'elder')),
    pitch_offset REAL NOT NULL DEFAULT 0.0,
    rate_multiplier REAL NOT NULL DEFAULT 1.0,
    preferred_voice_name TEXT DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (series_id, character_name)
);

CREATE INDEX IF NOT EXISTS idx_dialogue_voice_lookup 
    ON dialogue_voice_profiles(series_id, character_name);

CREATE TABLE IF NOT EXISTS user_tts_preferences (
    user_id TEXT PRIMARY KEY,
    master_rate REAL NOT NULL DEFAULT 1.0,
    master_volume REAL NOT NULL DEFAULT 1.0,
    auto_advance INTEGER NOT NULL DEFAULT 1 CHECK (auto_advance IN (0, 1)),
    auto_play INTEGER NOT NULL DEFAULT 0 CHECK (auto_play IN (0, 1)),
    default_narrator_voice TEXT DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0
);

-- Sprint 76: Intelligent Dual-Page Splitter & Webtoon Vertical Stitcher Engine
CREATE TABLE IF NOT EXISTS page_split_stitch_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    chapter_id TEXT,
    page_number INTEGER,
    mode TEXT NOT NULL DEFAULT 'none' CHECK (mode IN ('none', 'split_rtl', 'split_ltr', 'stitch_webtoon')),
    split_ratio REAL NOT NULL DEFAULT 0.50,
    stitch_gap_px INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_split_stitch_lookup 
    ON page_split_stitch_profiles(series_id, chapter_id, page_number);

-- Sprint 77: Dynamic Halftone Screentone & Vintage Paper Aging Engine
CREATE TABLE IF NOT EXISTS page_halftone_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    chapter_id TEXT,
    preset_name TEXT NOT NULL DEFAULT 'pristine' CHECK (preset_name IN ('pristine', 'shonen_90s', 'tankobon_retro', 'pulp_press', 'custom')),
    dot_pitch_lpi INTEGER NOT NULL DEFAULT 60 CHECK (dot_pitch_lpi >= 20 AND dot_pitch_lpi <= 150),
    dot_angle_deg REAL NOT NULL DEFAULT 45.0,
    dot_intensity REAL NOT NULL DEFAULT 0.35,
    paper_age_pct REAL NOT NULL DEFAULT 0.20,
    foxing_intensity REAL NOT NULL DEFAULT 0.10,
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_halftone_lookup 
    ON page_halftone_profiles(series_id, chapter_id);

-- Sprint 78: Saccadic Glance & Panel Magnifier Loupe Engine
CREATE TABLE IF NOT EXISTS page_magnifier_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    chapter_id TEXT,
    shape TEXT NOT NULL DEFAULT 'circle' CHECK (shape IN ('circle', 'rectangle')),
    zoom_factor REAL NOT NULL DEFAULT 2.0 CHECK (zoom_factor >= 1.25 AND zoom_factor <= 4.0),
    lens_radius_px INTEGER NOT NULL DEFAULT 120 CHECK (lens_radius_px >= 60 AND lens_radius_px <= 250),
    smoothing_factor REAL NOT NULL DEFAULT 0.15 CHECK (smoothing_factor >= 0.0 AND smoothing_factor <= 0.5),
    border_color TEXT NOT NULL DEFAULT '#3b82f6',
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magnifier_lookup 
    ON page_magnifier_profiles(series_id, chapter_id);

-- Sprint 79: Intelligent Chapter Transition Pre-Baking Engine
CREATE TABLE IF NOT EXISTS chapter_transition_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    from_chapter_id TEXT,
    to_chapter_id TEXT,
    prebake_trigger_page_offset INTEGER NOT NULL DEFAULT 3 CHECK (prebake_trigger_page_offset >= 1 AND prebake_trigger_page_offset <= 5),
    transition_style TEXT NOT NULL DEFAULT 'curtain' CHECK (transition_style IN ('curtain', 'infinite_scroll', 'page_turn')),
    auto_advance_delay_ms INTEGER NOT NULL DEFAULT 1500 CHECK (auto_advance_delay_ms >= 0 AND auto_advance_delay_ms <= 5000),
    show_reading_summary INTEGER NOT NULL DEFAULT 1 CHECK (show_reading_summary IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chapter_transition_lookup 
    ON chapter_transition_profiles(series_id, from_chapter_id);

-- Sprint 80: Adaptive Ambient Lighting Reactive Backlight Engine
CREATE TABLE IF NOT EXISTS ambient_backlight_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    kelvin_temperature INTEGER NOT NULL DEFAULT 6500 CHECK (kelvin_temperature >= 1800 AND kelvin_temperature <= 6500),
    luminance_target REAL NOT NULL DEFAULT 1.0 CHECK (luminance_target >= 0.3 AND luminance_target <= 1.5),
    circadian_auto INTEGER NOT NULL DEFAULT 0 CHECK (circadian_auto IN (0, 1)),
    blue_light_reduction_ratio REAL NOT NULL DEFAULT 0.0 CHECK (blue_light_reduction_ratio >= 0.0 AND blue_light_reduction_ratio <= 0.8),
    paper_tint_mode TEXT NOT NULL DEFAULT 'neutral' CHECK (paper_tint_mode IN ('neutral', 'warm_amber', 'sunset', 'candlelight', 'e_ink_amber', 'custom')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ambient_backlight_lookup 
    ON ambient_backlight_profiles(series_id, user_id);

-- Sprint 81: Continuous Page Glance & Multi-Angle Reading Projection
CREATE TABLE IF NOT EXISTS page_projection_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    pitch_degrees REAL NOT NULL DEFAULT 0.0 CHECK (pitch_degrees >= -35.0 AND pitch_degrees <= 35.0),
    yaw_degrees REAL NOT NULL DEFAULT 0.0 CHECK (yaw_degrees >= -25.0 AND yaw_degrees <= 25.0),
    perspective_px INTEGER NOT NULL DEFAULT 1000 CHECK (perspective_px >= 400 AND perspective_px <= 2000),
    keystone_correction REAL NOT NULL DEFAULT 0.0 CHECK (keystone_correction >= 0.0 AND keystone_correction <= 1.0),
    focal_plane_preset TEXT NOT NULL DEFAULT 'flat_orthodox' CHECK (focal_plane_preset IN ('flat_orthodox', 'desk_tilt_20', 'easel_stand_15', 'bed_incline_30', 'lateral_yaw_12', 'custom')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_projection_lookup 
    ON page_projection_profiles(series_id, user_id);






