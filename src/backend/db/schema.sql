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

-- Sprint 82: Binaural Page Rustle & Tactile Leaf Turn Acoustics Engine
CREATE TABLE IF NOT EXISTS page_acoustics_profiles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    paper_substrate TEXT NOT NULL DEFAULT 'tankobon' CHECK (paper_substrate IN ('glossy', 'newsprint', 'tankobon', 'silk_ribbon')),
    volume_level REAL NOT NULL DEFAULT 0.65 CHECK (volume_level >= 0.0 AND volume_level <= 1.0),
    stereo_panning_enabled INTEGER NOT NULL DEFAULT 1 CHECK (stereo_panning_enabled IN (0, 1)),
    haptic_pulse_enabled INTEGER NOT NULL DEFAULT 1 CHECK (haptic_pulse_enabled IN (0, 1)),
    haptic_intensity REAL NOT NULL DEFAULT 0.5 CHECK (haptic_intensity >= 0.0 AND haptic_intensity <= 1.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_acoustics_lookup 
    ON page_acoustics_profiles(series_id, user_id);

-- Sprint 83: Predictive Gaze Heatmap Trajectory & Eye Fixation Anti-Drift Restorer
CREATE TABLE IF NOT EXISTS gaze_anchor_profiles (
    series_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'manga_rtl' CHECK (mode IN ('webtoon', 'manga_rtl', 'manga_ltr')),
    saccade_sensitivity REAL NOT NULL DEFAULT 1.0 CHECK (saccade_sensitivity >= 0.1 AND saccade_sensitivity <= 3.0),
    dwell_threshold_ms INTEGER NOT NULL DEFAULT 250 CHECK (dwell_threshold_ms >= 50 AND dwell_threshold_ms <= 1000),
    drift_tolerance_px REAL NOT NULL DEFAULT 40.0 CHECK (drift_tolerance_px >= 10.0 AND drift_tolerance_px <= 200.0),
    return_anchor_enabled INTEGER NOT NULL DEFAULT 1 CHECK (return_anchor_enabled IN (0, 1)),
    heatmap_resolution TEXT NOT NULL DEFAULT 'medium' CHECK (heatmap_resolution IN ('low', 'medium', 'high')),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gaze_anchor_lookup 
    ON gaze_anchor_profiles(series_id);

-- Sprint 84: Adaptive Panel Dynamic Cropping & Smart Margin Trimming Engine
CREATE TABLE IF NOT EXISTS smart_crop_profiles (
    series_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'dialogue_safe' CHECK (mode IN ('conservative', 'aggressive', 'dialogue_safe')),
    margin_threshold REAL NOT NULL DEFAULT 0.96 CHECK (margin_threshold >= 0.80 AND margin_threshold <= 0.99),
    aspect_ratio_lock INTEGER NOT NULL DEFAULT 0 CHECK (aspect_ratio_lock IN (0, 1)),
    target_aspect_ratio REAL NOT NULL DEFAULT 0.70 CHECK (target_aspect_ratio >= 0.40 AND target_aspect_ratio <= 2.0),
    padding_px INTEGER NOT NULL DEFAULT 12 CHECK (padding_px >= 0 AND padding_px <= 64),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_smart_crop_lookup 
    ON smart_crop_profiles(series_id);

-- Sprint 85: Continuous Reading Session Milestones & Autonomous Cloudless Sync Hub
CREATE TABLE IF NOT EXISTS sync_milestone_profiles (
    series_id TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'default_user',
    device_id TEXT NOT NULL,
    vector_clock INTEGER NOT NULL DEFAULT 1 CHECK (vector_clock >= 1),
    chapters_completed INTEGER NOT NULL DEFAULT 0 CHECK (chapters_completed >= 0),
    total_reading_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_reading_seconds >= 0),
    streak_days INTEGER NOT NULL DEFAULT 1 CHECK (streak_days >= 0),
    sync_mode TEXT NOT NULL DEFAULT 'local_broadcast' CHECK (sync_mode IN ('local_broadcast', 'p2p_direct', 'offline_vault')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (series_id, user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_milestone_lookup 
    ON sync_milestone_profiles(series_id, user_id);

-- Sprint 86: Continuous Page In-Viewport Micro-Cache & Sliding Window Prefetch Engine
CREATE TABLE IF NOT EXISTS sliding_window_profiles (
    series_id TEXT PRIMARY KEY,
    window_size INTEGER NOT NULL DEFAULT 5 CHECK (window_size >= 1 AND window_size <= 20),
    forward_buffer INTEGER NOT NULL DEFAULT 3 CHECK (forward_buffer >= 1 AND forward_buffer <= 10),
    backward_buffer INTEGER NOT NULL DEFAULT 2 CHECK (backward_buffer >= 1 AND backward_buffer <= 10),
    evict_strategy TEXT NOT NULL DEFAULT 'conservative' CHECK (evict_strategy IN ('conservative', 'aggressive', 'preload_heavy')),
    max_cached_bytes INTEGER NOT NULL DEFAULT 26214400 CHECK (max_cached_bytes >= 5242880 AND max_cached_bytes <= 104857600),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sliding_window_lookup 
    ON sliding_window_profiles(series_id);

-- Sprint 87: Progressive Image Decompression & Chunked Bitstream Pipeline
CREATE TABLE IF NOT EXISTS chunked_stream_profiles (
    series_id TEXT PRIMARY KEY,
    chunk_height_px INTEGER NOT NULL DEFAULT 1024 CHECK (chunk_height_px >= 256 AND chunk_height_px <= 2048),
    bitstream_quality INTEGER NOT NULL DEFAULT 80 CHECK (bitstream_quality >= 30 AND bitstream_quality <= 100),
    progressive_pass_count INTEGER NOT NULL DEFAULT 2 CHECK (progressive_pass_count >= 1 AND progressive_pass_count <= 4),
    idle_slice_budget_ms REAL NOT NULL DEFAULT 8.0 CHECK (idle_slice_budget_ms >= 1.0 AND idle_slice_budget_ms <= 16.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunked_stream_lookup 
    ON chunked_stream_profiles(series_id);

-- Sprint 88: Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller
CREATE TABLE IF NOT EXISTS inertial_scroll_profiles (
    series_id TEXT PRIMARY KEY,
    friction_coefficient REAL NOT NULL DEFAULT 0.92 CHECK (friction_coefficient >= 0.70 AND friction_coefficient <= 0.99),
    mass REAL NOT NULL DEFAULT 1.0 CHECK (mass >= 0.2 AND mass <= 5.0),
    spring_tension REAL NOT NULL DEFAULT 120.0 CHECK (spring_tension >= 10.0 AND spring_tension <= 500.0),
    velocity_clamp_px REAL NOT NULL DEFAULT 3500.0 CHECK (velocity_clamp_px >= 500.0 AND velocity_clamp_px <= 10000.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inertial_scroll_lookup 
    ON inertial_scroll_profiles(series_id);

-- Sprint 89: Adaptive Contrast Dynamic Range & HDR Tone-Mapping Engine
CREATE TABLE IF NOT EXISTS dynamic_tone_profiles (
    series_id TEXT PRIMARY KEY,
    gamma_exponent REAL NOT NULL DEFAULT 1.15 CHECK (gamma_exponent >= 0.50 AND gamma_exponent <= 2.50),
    black_point_lift REAL NOT NULL DEFAULT 0.04 CHECK (black_point_lift >= 0.00 AND black_point_lift <= 0.25),
    white_point_compress REAL NOT NULL DEFAULT 0.92 CHECK (white_point_compress >= 0.70 AND white_point_compress <= 1.00),
    ambient_adaptation_mode TEXT NOT NULL DEFAULT 'cinema_night' CHECK (ambient_adaptation_mode IN ('cinema_night', 'daylight_boost', 'oled_pure_black', 'daylight', 'oled_dark', 'sepia_dim', 'custom')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dynamic_tone_lookup 
    ON dynamic_tone_profiles(series_id);

-- Sprint 90: Bi-Directional Manga & Webtoon Continuous Infinite History Scrubber & Visual Heatmap Tape
CREATE TABLE IF NOT EXISTS history_scrubber_profiles (
    series_id TEXT PRIMARY KEY,
    scrubber_mode TEXT NOT NULL DEFAULT 'webtoon_continuous' CHECK (scrubber_mode IN (
        'webtoon_continuous',
        'manga_rtl_continuous',
        'manga_ltr_continuous'
    )),
    tape_thickness_px INTEGER NOT NULL DEFAULT 48 CHECK (tape_thickness_px >= 24 AND tape_thickness_px <= 120),
    heatmap_intensity REAL NOT NULL DEFAULT 0.65 CHECK (heatmap_intensity >= 0.00 AND heatmap_intensity <= 1.00),
    velocity_multiplier REAL NOT NULL DEFAULT 1.20 CHECK (velocity_multiplier >= 0.50 AND velocity_multiplier <= 3.00),
    is_snap_to_chapter INTEGER NOT NULL DEFAULT 1 CHECK (is_snap_to_chapter IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_scrubber_lookup 
    ON history_scrubber_profiles(series_id);

-- Sprint 91: Adaptive Sub-Pixel Color Fringe Neutralizer & In-Viewport Text Sharpening Engine
CREATE TABLE IF NOT EXISTS chromatic_fringe_profiles (
    series_id TEXT PRIMARY KEY,
    neutralizer_mode TEXT NOT NULL DEFAULT 'subpixel_rgb' CHECK (neutralizer_mode IN (
        'subpixel_rgb',
        'subpixel_bgr',
        'monochrome_ink',
        'custom'
    )),
    fringe_radius_px REAL NOT NULL DEFAULT 0.75 CHECK (fringe_radius_px >= 0.10 AND fringe_radius_px <= 2.50),
    desaturation_strength REAL NOT NULL DEFAULT 0.60 CHECK (desaturation_strength >= 0.00 AND desaturation_strength <= 1.00),
    sharpening_amount REAL NOT NULL DEFAULT 1.25 CHECK (sharpening_amount >= 0.50 AND sharpening_amount <= 3.00),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chromatic_fringe_lookup 
    ON chromatic_fringe_profiles(series_id);

-- Sprint 92: Adaptive Ambient Screen-Glow Dispersion & Border Bleed Light Engine
CREATE TABLE IF NOT EXISTS ambient_glow_profiles (
    series_id TEXT PRIMARY KEY,
    glow_mode TEXT NOT NULL DEFAULT 'cinematic_reactive' CHECK (glow_mode IN (
        'cinematic_reactive',
        'dark_monochrome_dim',
        'vibrant_manhwa_bleed',
        'custom'
    )),
    glow_spread_px INTEGER NOT NULL DEFAULT 64 CHECK (glow_spread_px >= 16 AND glow_spread_px <= 256),
    glow_opacity REAL NOT NULL DEFAULT 0.45 CHECK (glow_opacity >= 0.00 AND glow_opacity <= 1.00),
    feather_smoothness REAL NOT NULL DEFAULT 1.20 CHECK (feather_smoothness >= 0.50 AND feather_smoothness <= 3.00),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ambient_glow_lookup 
    ON ambient_glow_profiles(series_id);

-- Sprint 93: Bi-Temporal Gaze & Velocity Dynamic Page Curl & Turn Synthesizer
CREATE TABLE IF NOT EXISTS page_curl_profiles (
    series_id TEXT PRIMARY KEY,
    curl_preset TEXT NOT NULL DEFAULT 'tankobon_stiff' CHECK (curl_preset IN (
        'tankobon_stiff',
        'doujin_silk',
        'newsprint_pulp',
        'custom'
    )),
    paper_stiffness REAL NOT NULL DEFAULT 0.85 CHECK (paper_stiffness >= 0.20 AND paper_stiffness <= 1.00),
    max_curl_angle_deg REAL NOT NULL DEFAULT 45.0 CHECK (max_curl_angle_deg >= 15.0 AND max_curl_angle_deg <= 85.0),
    shadow_depth REAL NOT NULL DEFAULT 0.40 CHECK (shadow_depth >= 0.00 AND shadow_depth <= 1.00),
    is_peel_corner_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_peel_corner_enabled IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_curl_lookup 
    ON page_curl_profiles(series_id);

-- Sprint 94: Multi-Tier Intelligent Storage Vault Tiering & Auto-Tiered Platter Eviction Manager (SLA 58)
CREATE TABLE IF NOT EXISTS storage_tier_profiles (
    series_id TEXT PRIMARY KEY,
    auto_tiering_mode TEXT NOT NULL DEFAULT 'balanced_hybrid' CHECK (auto_tiering_mode IN (
        'aggressive_evict',
        'balanced_hybrid',
        'archive_pin',
        'custom'
    )),
    hot_retention_days INTEGER NOT NULL DEFAULT 14 CHECK (hot_retention_days >= 1 AND hot_retention_days <= 180),
    warm_retention_days INTEGER NOT NULL DEFAULT 60 CHECK (warm_retention_days >= 7 AND warm_retention_days <= 365),
    disk_quota_target_gb INTEGER NOT NULL DEFAULT 3500 CHECK (disk_quota_target_gb >= 100 AND disk_quota_target_gb <= 4000),
    is_auto_eviction_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_auto_eviction_enabled IN (0, 1)),
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_storage_tier_lookup 
    ON storage_tier_profiles(series_id);

-- Sprint 95: Adaptive Peripheral In-Viewport Motion-Deblur & Micro-Pan Gesture Stabilizer (SLA 59)
CREATE TABLE IF NOT EXISTS motion_stabilizer_profiles (
    series_id TEXT PRIMARY KEY,
    stabilizer_mode TEXT NOT NULL DEFAULT 'smooth_spring' CHECK (stabilizer_mode IN (
        'smooth_spring',
        'high_inertia_damping',
        'esports_raw',
        'custom'
    )),
    damping_coefficient REAL NOT NULL DEFAULT 0.75 CHECK (damping_coefficient >= 0.10 AND damping_coefficient <= 0.99),
    velocity_threshold_px REAL NOT NULL DEFAULT 350.0 CHECK (velocity_threshold_px >= 50.0 AND velocity_threshold_px <= 2000.0),
    contrast_boost_factor REAL NOT NULL DEFAULT 1.25 CHECK (contrast_boost_factor >= 1.00 AND contrast_boost_factor <= 2.00),
    is_anti_ghosting_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_anti_ghosting_enabled IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_motion_stabilizer_lookup 
    ON motion_stabilizer_profiles(series_id);

-- Sprint 96: Bi-Directional Dual-Page Gutters & Crease Shadow Synthesizer for Tankōbon Spreads (SLA 60)
CREATE TABLE IF NOT EXISTS crease_shadow_profiles (
    series_id TEXT PRIMARY KEY,
    spread_binding_mode TEXT NOT NULL DEFAULT 'tankobon_tight' CHECK (spread_binding_mode IN (
        'tankobon_tight',
        'magazine_wide',
        'flat_lay',
        'custom'
    )),
    spine_shadow_intensity REAL NOT NULL DEFAULT 0.65 CHECK (spine_shadow_intensity >= 0.00 AND spine_shadow_intensity <= 1.00),
    gutter_width_px INTEGER NOT NULL DEFAULT 24 CHECK (gutter_width_px >= 8 AND gutter_width_px <= 64),
    asymmetry_ratio REAL NOT NULL DEFAULT 0.50 CHECK (asymmetry_ratio >= 0.00 AND asymmetry_ratio <= 1.00),
    is_rtl INTEGER NOT NULL DEFAULT 1 CHECK (is_rtl IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crease_shadow_lookup 
    ON crease_shadow_profiles(series_id);

-- Sprint 97: Adaptive Dynamic Range In-Viewport Text & Kanji Edge Equalizer (SLA 61)
CREATE TABLE IF NOT EXISTS text_equalizer_profiles (
    series_id TEXT PRIMARY KEY,
    equalizer_mode TEXT NOT NULL DEFAULT 'newsprint_vintage' CHECK (equalizer_mode IN (
        'newsprint_vintage',
        'glossy_digital',
        'faded_doujin',
        'custom'
    )),
    black_level_boost REAL NOT NULL DEFAULT 0.35 CHECK (black_level_boost >= 0.00 AND black_level_boost <= 1.00),
    white_level_compression REAL NOT NULL DEFAULT 0.20 CHECK (white_level_compression >= 0.00 AND white_level_compression <= 1.00),
    kanji_clarity_factor REAL NOT NULL DEFAULT 1.30 CHECK (kanji_clarity_factor >= 1.00 AND kanji_clarity_factor <= 2.50),
    is_furigana_sharpen_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_furigana_sharpen_enabled IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_text_equalizer_lookup 
    ON text_equalizer_profiles(series_id);

-- Sprint 98: Predictive Intelligent Pre-Reading Micro-Heatmap Dwell Predictor (SLA 62)
CREATE TABLE IF NOT EXISTS reading_dwell_profiles (
    series_id TEXT PRIMARY KEY,
    prediction_mode TEXT NOT NULL DEFAULT 'cadence_adaptive' CHECK (prediction_mode IN (
        'cadence_adaptive',
        'action_heavy',
        'dialogue_dense',
        'custom'
    )),
    base_dwell_ms INTEGER NOT NULL DEFAULT 4500 CHECK (base_dwell_ms >= 1000 AND base_dwell_ms <= 30000),
    complexity_weight REAL NOT NULL DEFAULT 1.25 CHECK (complexity_weight >= 0.50 AND complexity_weight <= 3.00),
    urgency_threshold_ms INTEGER NOT NULL DEFAULT 800 CHECK (urgency_threshold_ms >= 200 AND urgency_threshold_ms <= 3000),
    is_prefetch_trigger_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_prefetch_trigger_enabled IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reading_dwell_lookup 
    ON reading_dwell_profiles(series_id);

-- Sprint 99: Adaptive Per-Panel Visual Pacing & Dynamic Zoom Framing Interpolator (SLA 63)
CREATE TABLE IF NOT EXISTS panel_pacing_profiles (
    series_id TEXT PRIMARY KEY,
    pacing_mode TEXT NOT NULL DEFAULT 'cinematic_smooth' CHECK (pacing_mode IN (
        'cinematic_smooth',
        'dynamic_action',
        'instant_cut',
        'custom'
    )),
    transition_duration_ms INTEGER NOT NULL DEFAULT 280 CHECK (transition_duration_ms >= 100 AND transition_duration_ms <= 1000),
    zoom_overshoot_ratio REAL NOT NULL DEFAULT 1.05 CHECK (zoom_overshoot_ratio >= 1.00 AND zoom_overshoot_ratio <= 1.30),
    edge_padding_px INTEGER NOT NULL DEFAULT 16 CHECK (edge_padding_px >= 0 AND edge_padding_px <= 64),
    is_motion_reduced INTEGER NOT NULL DEFAULT 0 CHECK (is_motion_reduced IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_panel_pacing_lookup 
    ON panel_pacing_profiles(series_id);

-- Sprint 100: Century Jubilee - Ultra-Low-Latency In-Memory Vector Search & Embedding Quantizer for Spoilers & Lore Cross-Referencing (SLA 64)
CREATE TABLE IF NOT EXISTS vector_index_profiles (
    series_id TEXT PRIMARY KEY,
    index_mode TEXT NOT NULL DEFAULT 'int8_quantized' CHECK (index_mode IN (
        'int8_quantized',
        'compact_scalar',
        'exact_cosine',
        'custom'
    )),
    embedding_dimension INTEGER NOT NULL DEFAULT 64 CHECK (embedding_dimension >= 16 AND embedding_dimension <= 256),
    similarity_threshold REAL NOT NULL DEFAULT 0.75 CHECK (similarity_threshold >= 0.10 AND similarity_threshold <= 0.99),
    max_top_k INTEGER NOT NULL DEFAULT 5 CHECK (max_top_k >= 1 AND max_top_k <= 50),
    is_spoiler_shield_active INTEGER NOT NULL DEFAULT 1 CHECK (is_spoiler_shield_active IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vector_index_lookup 
    ON vector_index_profiles(series_id);

-- Sprint 101: Bi-Directional Zero-Copy Page Memory Slicing & Ring-Buffer Tile Recycler (SLA 65)
CREATE TABLE IF NOT EXISTS page_buffer_profiles (
    series_id TEXT PRIMARY KEY,
    ring_capacity INTEGER NOT NULL DEFAULT 7 CHECK (ring_capacity >= 3 AND ring_capacity <= 15),
    forward_lookahead INTEGER NOT NULL DEFAULT 3 CHECK (forward_lookahead >= 1 AND forward_lookahead <= 10),
    backward_lookahead INTEGER NOT NULL DEFAULT 2 CHECK (backward_lookahead >= 0 AND backward_lookahead <= 5),
    slot_recycling_strategy TEXT NOT NULL DEFAULT 'circular_lru' CHECK (slot_recycling_strategy IN (
        'circular_lru',
        'boustrophedon_ring',
        'pinned_viewport'
    )),
    zero_copy_slice_enabled INTEGER NOT NULL DEFAULT 1 CHECK (zero_copy_slice_enabled IN (0, 1)),
    max_memory_pool_bytes INTEGER NOT NULL DEFAULT 33554432 CHECK (max_memory_pool_bytes >= 8388608 AND max_memory_pool_bytes <= 67108864),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_buffer_lookup 
    ON page_buffer_profiles(series_id);

-- Sprint 102: Adaptive Per-Panel Reading Path Spatial Occlusion & Balloon Collision Avoider (SLA 66)
CREATE TABLE IF NOT EXISTS balloon_collision_profiles (
    series_id TEXT PRIMARY KEY,
    avoidance_strategy TEXT NOT NULL DEFAULT 'minimal_euclidean' CHECK (avoidance_strategy IN (
        'minimal_euclidean',
        'reading_gravity_downward',
        'opposite_margin',
        'clamp_only'
    )),
    safety_margin_px INTEGER NOT NULL DEFAULT 12 CHECK (safety_margin_px >= 0 AND safety_margin_px <= 64),
    max_displacement_px INTEGER NOT NULL DEFAULT 120 CHECK (max_displacement_px >= 20 AND max_displacement_px <= 400),
    prefer_vertical_shift INTEGER NOT NULL DEFAULT 1 CHECK (prefer_vertical_shift IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_balloon_collision_lookup 
    ON balloon_collision_profiles(series_id);

-- Sprint 103: Dynamic Contrast Tone-Mapping & Halftone Ink Bleed Compensator (SLA 67)
CREATE TABLE IF NOT EXISTS ink_bleed_profiles (
    series_id TEXT PRIMARY KEY,
    compensation_mode TEXT NOT NULL DEFAULT 'vintage_newsprint' CHECK (compensation_mode IN (
        'vintage_newsprint',
        'deep_black_preservation',
        'halftone_clarity',
        'custom'
    )),
    black_point_lift REAL NOT NULL DEFAULT 0.08 CHECK (black_point_lift >= 0.00 AND black_point_lift <= 0.30),
    white_point_compression REAL NOT NULL DEFAULT 0.95 CHECK (white_point_compression >= 0.70 AND white_point_compression <= 1.00),
    gamma_exponent REAL NOT NULL DEFAULT 1.15 CHECK (gamma_exponent >= 0.50 AND gamma_exponent <= 2.50),
    ink_bleed_threshold REAL NOT NULL DEFAULT 0.18 CHECK (ink_bleed_threshold >= 0.05 AND ink_bleed_threshold <= 0.50),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ink_bleed_lookup 
    ON ink_bleed_profiles(series_id);

-- Sprint 104: Adaptive Per-Panel Reading Gaze Anchor & Eye-Rest Aperture Shutter (SLA 68)
CREATE TABLE IF NOT EXISTS eye_rest_profiles (
    series_id TEXT PRIMARY KEY,
    shutter_mode TEXT NOT NULL DEFAULT 'subtle_vignette' CHECK (shutter_mode IN (
        'subtle_vignette',
        'focus_spotlight',
        'circadian_warmth',
        'disabled'
    )),
    aperture_radius_px INTEGER NOT NULL DEFAULT 320 CHECK (aperture_radius_px >= 100 AND aperture_radius_px <= 800),
    falloff_pct INTEGER NOT NULL DEFAULT 35 CHECK (falloff_pct >= 10 AND falloff_pct <= 80),
    rest_interval_min INTEGER NOT NULL DEFAULT 20 CHECK (rest_interval_min >= 5 AND rest_interval_min <= 60),
    eye_care_warmth_k INTEGER NOT NULL DEFAULT 3200 CHECK (eye_care_warmth_k >= 2200 AND eye_care_warmth_k <= 6500),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eye_rest_lookup 
    ON eye_rest_profiles(series_id);

-- Sprint 105: Cross-Chapter Kinetic Scroll Momentum Deceleration & Seam Pre-Baking Engine (SLA 69)
CREATE TABLE IF NOT EXISTS chapter_seam_profiles (
    series_id TEXT PRIMARY KEY,
    deceleration_mode TEXT NOT NULL DEFAULT 'smooth_continuous' CHECK (deceleration_mode IN (
        'smooth_continuous',
        'tactile_snap',
        'rapid_glide',
        'disabled',
        'custom'
    )),
    seam_threshold_px INTEGER NOT NULL DEFAULT 160 CHECK (seam_threshold_px >= 32 AND seam_threshold_px <= 600),
    damping_factor REAL NOT NULL DEFAULT 0.85 CHECK (damping_factor >= 0.10 AND damping_factor <= 0.99),
    pre_bake_panels INTEGER NOT NULL DEFAULT 4 CHECK (pre_bake_panels >= 1 AND pre_bake_panels <= 12),
    is_magnetic_snap INTEGER NOT NULL DEFAULT 1 CHECK (is_magnetic_snap IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chapter_seam_lookup 
    ON chapter_seam_profiles(series_id);

-- Sprint 106: Adaptive Viewport Spatial Dialogue Balloon Glyph & Text Auto-Scaler (SLA 70)
CREATE TABLE IF NOT EXISTS balloon_font_profiles (
    series_id TEXT PRIMARY KEY,
    scaling_mode TEXT NOT NULL DEFAULT 'comfort_legibility' CHECK (scaling_mode IN (
        'comfort_legibility',
        'compact_dialogue',
        'large_print',
        'disabled',
        'custom'
    )),
    min_font_size_px INTEGER NOT NULL DEFAULT 10 CHECK (min_font_size_px >= 6 AND min_font_size_px <= 24),
    max_font_size_px INTEGER NOT NULL DEFAULT 32 CHECK (max_font_size_px >= 16 AND max_font_size_px <= 72),
    target_density_ratio REAL NOT NULL DEFAULT 0.65 CHECK (target_density_ratio >= 0.20 AND target_density_ratio <= 0.95),
    is_furigana_preserved INTEGER NOT NULL DEFAULT 1 CHECK (is_furigana_preserved IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_balloon_font_lookup 
    ON balloon_font_profiles(series_id);

-- Sprint 107: Bi-Temporal Frame-Paced Adaptive Micro-Tile Invalidator & Memory Cache Garbage Collector (SLA 71)
CREATE TABLE IF NOT EXISTS tile_invalidation_profiles (
    series_id TEXT PRIMARY KEY,
    max_heap_mb REAL NOT NULL DEFAULT 128.0 CHECK (max_heap_mb >= 32.0 AND max_heap_mb <= 256.0),
    viewport_margin_px REAL NOT NULL DEFAULT 600.0 CHECK (viewport_margin_px >= 100.0 AND viewport_margin_px <= 2000.0),
    warm_margin_px REAL NOT NULL DEFAULT 1500.0 CHECK (warm_margin_px >= 500.0 AND warm_margin_px <= 5000.0),
    eviction_budget_ms REAL NOT NULL DEFAULT 1.5 CHECK (eviction_budget_ms >= 0.5 AND eviction_budget_ms <= 8.0),
    velocity_weight REAL NOT NULL DEFAULT 0.65 CHECK (velocity_weight >= 0.00 AND velocity_weight <= 1.00),
    recency_weight REAL NOT NULL DEFAULT 0.25 CHECK (recency_weight >= 0.00 AND recency_weight <= 1.00),
    size_weight REAL NOT NULL DEFAULT 0.10 CHECK (size_weight >= 0.00 AND size_weight <= 1.00),
    is_auto_gc_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_auto_gc_enabled IN (0, 1)),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_tile_invalidation_lookup 
    ON tile_invalidation_profiles(series_id);

-- Sprint 108: Adaptive Per-Panel Visual Acoustic Echo & Spatial Reverberation Modulator (SLA 72)
CREATE TABLE IF NOT EXISTS acoustic_reverb_profiles (
    series_id TEXT PRIMARY KEY,
    scene_environment TEXT NOT NULL DEFAULT 'confined_room' CHECK (scene_environment IN (
        'confined_room',
        'cave_echo',
        'outdoor_open',
        'cathedral_vast',
        'dampened_bedroom',
        'custom'
    )),
    room_size_m3 REAL NOT NULL DEFAULT 85.0 CHECK (room_size_m3 >= 5.0 AND room_size_m3 <= 10000.0),
    absorption_coeff REAL NOT NULL DEFAULT 0.35 CHECK (absorption_coeff >= 0.01 AND absorption_coeff <= 0.99),
    t60_decay_s REAL NOT NULL DEFAULT 1.20 CHECK (t60_decay_s >= 0.10 AND t60_decay_s <= 10.00),
    damping_freq_hz REAL NOT NULL DEFAULT 2800.0 CHECK (damping_freq_hz >= 200.0 AND damping_freq_hz <= 20000.0),
    early_reflections_ms TEXT NOT NULL DEFAULT '[18, 31, 47, 63]',
    wet_dry_mix REAL NOT NULL DEFAULT 0.28 CHECK (wet_dry_mix >= 0.00 AND wet_dry_mix <= 1.00),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_acoustic_reverb_lookup 
    ON acoustic_reverb_profiles(series_id);

-- Sprint 109: Bi-Directional Multi-Channel Tactile Page Edge Bevel & Stack Thickness Hologram Synthesizer (SLA 73)
CREATE TABLE IF NOT EXISTS page_bevel_profiles (
    series_id TEXT PRIMARY KEY,
    paper_caliper_mode TEXT NOT NULL DEFAULT 'tankobon_silk_110um' CHECK (paper_caliper_mode IN (
        'newsprint_65um',
        'pulp_85um',
        'tankobon_silk_110um',
        'omnibus_coated_130um',
        'custom'
    )),
    max_stack_thickness_px INTEGER NOT NULL DEFAULT 24 CHECK (max_stack_thickness_px >= 4 AND max_stack_thickness_px <= 48),
    page_caliper_um REAL NOT NULL DEFAULT 110.0 CHECK (page_caliper_um >= 40.0 AND page_caliper_um <= 300.0),
    curvature_sag_pct INTEGER NOT NULL DEFAULT 35 CHECK (curvature_sag_pct >= 0 AND curvature_sag_pct <= 100),
    edge_bevel_shading_pct INTEGER NOT NULL DEFAULT 40 CHECK (edge_bevel_shading_pct >= 0 AND edge_bevel_shading_pct <= 100),
    reading_direction TEXT NOT NULL DEFAULT 'rtl' CHECK (reading_direction IN ('rtl', 'ltr', 'vertical')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_page_bevel_lookup 
    ON page_bevel_profiles(series_id);

-- Sprint 110: Perceptual Ambient Chroma Bleed & Color-Temperature Adaptive Edge Backlight (SLA 74)
CREATE TABLE IF NOT EXISTS chroma_bleed_profiles (
    series_id TEXT PRIMARY KEY,
    color_mode TEXT NOT NULL DEFAULT 'monochrome_bw' CHECK (color_mode IN (
        'monochrome_bw',
        'sepia_vintage',
        'night_crimson',
        'cyberpunk_neon',
        'oled_pitch_black',
        'custom'
    )),
    color_temperature_k INTEGER NOT NULL DEFAULT 6500 CHECK (color_temperature_k >= 2000 AND color_temperature_k <= 9000),
    bleed_spread_px INTEGER NOT NULL DEFAULT 24 CHECK (bleed_spread_px >= 8 AND bleed_spread_px <= 64),
    ambient_intensity_pct INTEGER NOT NULL DEFAULT 35 CHECK (ambient_intensity_pct >= 0 AND ambient_intensity_pct <= 100),
    edge_falloff_exponent REAL NOT NULL DEFAULT 2.2 CHECK (edge_falloff_exponent >= 1.0 AND edge_falloff_exponent <= 4.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chroma_bleed_lookup 
    ON chroma_bleed_profiles(series_id);

-- Sprint 111: Adaptive Panel Aspect-Ratio Anamorphic Un-Squeeze & Webtoon Seam Stitcher (SLA 75)
CREATE TABLE IF NOT EXISTS anamorphic_seam_profiles (
    series_id TEXT PRIMARY KEY,
    aspect_ratio_mode TEXT NOT NULL DEFAULT 'native' CHECK (aspect_ratio_mode IN (
        'native',
        'anamorphic_4_3_to_16_9',
        'anamorphic_4_3_to_16_10',
        'custom_unsqueeze'
    )),
    unsqueeze_factor REAL NOT NULL DEFAULT 1.0 CHECK (unsqueeze_factor >= 0.70 AND unsqueeze_factor <= 1.50),
    seam_overlap_px REAL NOT NULL DEFAULT 0.75 CHECK (seam_overlap_px >= 0.0 AND seam_overlap_px <= 2.0),
    subpixel_snapping_mode TEXT NOT NULL DEFAULT 'cumulative_origin' CHECK (subpixel_snapping_mode IN (
        'cumulative_origin',
        'round',
        'floor',
        'ceil'
    )),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anamorphic_seam_lookup 
    ON anamorphic_seam_profiles(series_id);

-- Sprint 112: Micro-Tile GPU Texture Atlas Packer & Virtual VRAM Compactor (SLA 76)
CREATE TABLE IF NOT EXISTS texture_atlas_profiles (
    series_id TEXT PRIMARY KEY,
    packing_strategy TEXT NOT NULL DEFAULT 'guillotine_bssf' CHECK (packing_strategy IN (
        'guillotine_bssf',
        'shelf_next_fit',
        'max_rects_compact'
    )),
    atlas_max_dimension INTEGER NOT NULL DEFAULT 2048 CHECK (atlas_max_dimension IN (1024, 2048, 4096)),
    tile_padding_px INTEGER NOT NULL DEFAULT 4 CHECK (tile_padding_px >= 0 AND tile_padding_px <= 16),
    max_active_atlases INTEGER NOT NULL DEFAULT 2 CHECK (max_active_atlases >= 1 AND max_active_atlases <= 4),
    vram_budget_mb INTEGER NOT NULL DEFAULT 32 CHECK (vram_budget_mb >= 16 AND vram_budget_mb <= 64),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_texture_atlas_lookup 
    ON texture_atlas_profiles(series_id);

-- Sprint 113: Subpixel Micro-Vector Glyph Sharpener & Anti-Aliasing Edge Contrast Enhancer (SLA 77)
CREATE TABLE IF NOT EXISTS glyph_sharpener_profiles (
    series_id TEXT PRIMARY KEY,
    sharpener_mode TEXT NOT NULL DEFAULT 'adaptive_kanji' CHECK (sharpener_mode IN (
        'adaptive_kanji',
        'high_contrast_furigana',
        'kana_light',
        'dense_cjk_compaction',
        'custom_matrix'
    )),
    stroke_density_tier TEXT NOT NULL DEFAULT 'auto' CHECK (stroke_density_tier IN (
        'auto',
        'low_kana_1_5',
        'mid_kanji_6_14',
        'dense_kanji_15_plus'
    )),
    contrast_multiplier REAL NOT NULL DEFAULT 1.15 CHECK (contrast_multiplier >= 1.0 AND contrast_multiplier <= 1.50),
    luminance_gamma REAL NOT NULL DEFAULT 1.05 CHECK (luminance_gamma >= 0.80 AND luminance_gamma <= 1.30),
    stroke_protection_pct INTEGER NOT NULL DEFAULT 65 CHECK (stroke_protection_pct >= 0 AND stroke_protection_pct <= 100),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_glyph_sharpener_lookup 
    ON glyph_sharpener_profiles(series_id);

-- Sprint 114: Adaptive Boustrophedon Panel Sequence Flow & Cinematic Camera Pan Director (SLA 78)
CREATE TABLE IF NOT EXISTS boustrophedon_camera_profiles (
    series_id TEXT PRIMARY KEY,
    reading_flow TEXT NOT NULL DEFAULT 'manga_rtl_zigzag' CHECK (reading_flow IN (
        'manga_rtl_zigzag',
        'webtoon_vertical',
        'comic_ltr_zigzag',
        'cinematic_freeflow'
    )),
    transition_easing TEXT NOT NULL DEFAULT 'cubic_bezier_cinematic' CHECK (transition_easing IN (
        'cubic_bezier_cinematic',
        'ease_in_out',
        'snappy_linear',
        'dramatic_punch'
    )),
    climax_zoom_multiplier REAL NOT NULL DEFAULT 1.25 CHECK (climax_zoom_multiplier >= 1.0 AND climax_zoom_multiplier <= 1.50),
    pan_lead_in_pct INTEGER NOT NULL DEFAULT 15 CHECK (pan_lead_in_pct >= 0 AND pan_lead_in_pct <= 50),
    max_rotation_deg REAL NOT NULL DEFAULT 0.0 CHECK (max_rotation_deg >= -5.0 AND max_rotation_deg <= 5.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_boustrophedon_camera_lookup 
    ON boustrophedon_camera_profiles(series_id);

-- Sprint 115: Perceptual Micro-Stippling Halftone Grain Synthesizer & Retro Print Simulator (SLA 79)
CREATE TABLE IF NOT EXISTS halftone_grain_profiles (
    series_id TEXT PRIMARY KEY,
    grain_mode TEXT NOT NULL DEFAULT 'shonen_jump_pulp' CHECK (grain_mode IN (
        'shonen_jump_pulp',
        'tankobon_newsprint',
        'doujin_matte_offset',
        'archival_acid_free',
        'custom_stipple'
    )),
    stipple_density REAL NOT NULL DEFAULT 0.16 CHECK (stipple_density >= 0.05 AND stipple_density <= 0.40),
    grain_opacity REAL NOT NULL DEFAULT 0.055 CHECK (grain_opacity >= 0.01 AND grain_opacity <= 0.20),
    particle_radius_px REAL NOT NULL DEFAULT 0.8 CHECK (particle_radius_px >= 0.5 AND particle_radius_px <= 2.0),
    lcg_seed INTEGER NOT NULL DEFAULT 1337 CHECK (lcg_seed >= 0 AND lcg_seed <= 2147483647),
    paper_tint_hex TEXT NOT NULL DEFAULT '#FAF6EE',
    blend_mode TEXT NOT NULL DEFAULT 'multiply' CHECK (blend_mode IN ('multiply', 'darken', 'normal', 'overlay')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_halftone_grain_lookup 
    ON halftone_grain_profiles(series_id);

-- Sprint 116: Adaptive Dialogue Balloon Tail Tracking & Dynamic Focus Pointer (SLA 80)
CREATE TABLE IF NOT EXISTS balloon_tail_profiles (
    series_id TEXT PRIMARY KEY,
    tail_style TEXT NOT NULL DEFAULT 'manga_compact' CHECK (tail_style IN (
        'manga_compact',
        'expressive_curve',
        'manhwa_clean',
        'whisper_subtle',
        'shout_dynamic'
    )),
    balloon_shape TEXT NOT NULL DEFAULT 'ellipse' CHECK (balloon_shape IN ('ellipse', 'rounded_rect', 'polygon_shout')),
    root_width_px REAL NOT NULL DEFAULT 14.0 CHECK (root_width_px >= 6.0 AND root_width_px <= 32.0),
    curvature_factor REAL NOT NULL DEFAULT 0.15 CHECK (curvature_factor >= 0.0 AND curvature_factor <= 0.50),
    tip_offset_px REAL NOT NULL DEFAULT 4.0 CHECK (tip_offset_px >= 0.0 AND tip_offset_px <= 20.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_balloon_tail_lookup 
    ON balloon_tail_profiles(series_id);

-- Sprint 117: Predictive Subpixel Canvas Tile Cache Prefetcher & LRU Texture Swapper (SLA 81)
CREATE TABLE IF NOT EXISTS tile_prefetch_profiles (
    series_id TEXT PRIMARY KEY,
    reading_flow TEXT NOT NULL DEFAULT 'manga_rtl' CHECK (reading_flow IN ('manga_rtl', 'comic_ltr', 'webtoon_vertical', 'cinematic_dynamic')),
    prediction_horizon_ms INTEGER NOT NULL DEFAULT 350 CHECK (prediction_horizon_ms >= 100 AND prediction_horizon_ms <= 1000),
    recency_tau_ms INTEGER NOT NULL DEFAULT 8000 CHECK (recency_tau_ms >= 1000 AND recency_tau_ms <= 30000),
    max_prefetch_tiles INTEGER NOT NULL DEFAULT 3 CHECK (max_prefetch_tiles >= 1 AND max_prefetch_tiles <= 8),
    hysteresis_threshold REAL NOT NULL DEFAULT 0.65 CHECK (hysteresis_threshold >= 0.50 AND hysteresis_threshold <= 0.90),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tile_prefetch_lookup 
    ON tile_prefetch_profiles(series_id);

-- Sprint 118: Adaptive Perceptual Dark-Adaptation Retinal Preserver & Contrast Compensator (SLA 82)
CREATE TABLE IF NOT EXISTS dark_adaptation_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'midnight_reader' CHECK (preset_name IN (
        'night_shonen',
        'midnight_reader',
        'daylight_crisp',
        'paper_sepia'
    )),
    tau_dark_ms INTEGER NOT NULL DEFAULT 1800 CHECK (tau_dark_ms >= 500 AND tau_dark_ms <= 5000),
    tau_bright_ms INTEGER NOT NULL DEFAULT 450 CHECK (tau_bright_ms >= 100 AND tau_bright_ms <= 2000),
    comfort_luminance REAL NOT NULL DEFAULT 0.22 CHECK (comfort_luminance >= 0.05 AND comfort_luminance <= 0.80),
    glare_threshold REAL NOT NULL DEFAULT 0.70 CHECK (glare_threshold >= 0.40 AND glare_threshold <= 0.95),
    base_white_point REAL NOT NULL DEFAULT 0.92 CHECK (base_white_point >= 0.50 AND base_white_point <= 1.0),
    glare_attenuation REAL NOT NULL DEFAULT 0.35 CHECK (glare_attenuation >= 0.0 AND glare_attenuation <= 0.80),
    contrast_base REAL NOT NULL DEFAULT 1.05 CHECK (contrast_base >= 0.80 AND contrast_base <= 1.50),
    contrast_compensation REAL NOT NULL DEFAULT 0.20 CHECK (contrast_compensation >= 0.0 AND contrast_compensation <= 0.50),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dark_adaptation_lookup 
    ON dark_adaptation_profiles(series_id);

-- Sprint 119: Adaptive Subpixel Color De-Banding & Ordered Bayer Dither Matrix Synthesizer (SLA 83)
CREATE TABLE IF NOT EXISTS bayer_dither_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'tn_6bit_default' CHECK (preset_name IN (
        'tn_6bit_default',
        'smooth_gradient',
        'dark_interface',
        'photo_conservative',
        'text_protected'
    )),
    matrix_size INTEGER NOT NULL DEFAULT 8 CHECK (matrix_size IN (2, 4, 8, 16)),
    target_bits INTEGER NOT NULL DEFAULT 6 CHECK (target_bits BETWEEN 5 AND 10),
    dither_strength REAL NOT NULL DEFAULT 0.85 CHECK (dither_strength >= 0.0 AND dither_strength <= 1.0),
    edge_protection REAL NOT NULL DEFAULT 0.25 CHECK (edge_protection >= 0.0 AND edge_protection <= 1.0),
    channel_mode TEXT NOT NULL DEFAULT 'shared' CHECK (channel_mode IN ('shared', 'independent')),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bayer_dither_lookup 
    ON bayer_dither_profiles(series_id);

-- Sprint 120: Spatial Audio Reverberation Occlusion & Distance Attenuation Engine for Dialogue SFX (SLA 84)
CREATE TABLE IF NOT EXISTS spatial_audio_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'dialogue_near' CHECK (preset_name IN (
        'dialogue_near',
        'dialogue_occluded',
        'indoor_scene',
        'action_impact',
        'webtoon_vertical_flow'
    )),
    reference_distance_px REAL NOT NULL DEFAULT 120.0 CHECK (reference_distance_px >= 20.0 AND reference_distance_px <= 500.0),
    rolloff_factor REAL NOT NULL DEFAULT 1.0 CHECK (rolloff_factor >= 0.1 AND rolloff_factor <= 3.0),
    min_gain REAL NOT NULL DEFAULT 0.025 CHECK (min_gain >= 0.0 AND min_gain <= 0.20),
    max_distance_px REAL NOT NULL DEFAULT 1400.0 CHECK (max_distance_px >= 200.0 AND max_distance_px <= 5000.0),
    pan_radius_px REAL NOT NULL DEFAULT 480.0 CHECK (pan_radius_px >= 100.0 AND pan_radius_px <= 2000.0),
    cutoff_open_hz REAL NOT NULL DEFAULT 18000.0 CHECK (cutoff_open_hz >= 5000.0 AND cutoff_open_hz <= 22050.0),
    cutoff_closed_hz REAL NOT NULL DEFAULT 2500.0 CHECK (cutoff_closed_hz >= 200.0 AND cutoff_closed_hz <= 8000.0),
    filter_q REAL NOT NULL DEFAULT 0.707 CHECK (filter_q >= 0.1 AND filter_q <= 4.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spatial_audio_lookup 
    ON spatial_audio_profiles(series_id);

-- Sprint 121: Dynamic Atmospheric Vignette Shader & Depth-of-Field Aperture Simulator
CREATE TABLE IF NOT EXISTS vignette_aperture_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'subtle_vignette' CHECK (preset_name IN (
        'cinematic_macro',
        'action_tunnel',
        'subtle_vignette',
        'dream_flashback',
        'raw_disabled'
    )),
    inner_radius REAL NOT NULL DEFAULT 0.45 CHECK (inner_radius >= 0.0 AND inner_radius <= 1.0),
    outer_radius REAL NOT NULL DEFAULT 1.10 CHECK (outer_radius >= 0.1 AND outer_radius <= 2.5),
    vignette_strength REAL NOT NULL DEFAULT 0.40 CHECK (vignette_strength >= 0.0 AND vignette_strength <= 1.0),
    dof_blur_factor REAL NOT NULL DEFAULT 0.35 CHECK (dof_blur_factor >= 0.0 AND dof_blur_factor <= 1.0),
    focus_x_pct REAL NOT NULL DEFAULT 50.0 CHECK (focus_x_pct >= 0.0 AND focus_x_pct <= 100.0),
    focus_y_pct REAL NOT NULL DEFAULT 50.0 CHECK (focus_y_pct >= 0.0 AND focus_y_pct <= 100.0),
    aspect_ratio REAL NOT NULL DEFAULT 1.0 CHECK (aspect_ratio >= 0.2 AND aspect_ratio <= 5.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vignette_aperture_lookup 
    ON vignette_aperture_profiles(series_id);

-- Sprint 122: Contrast-Adaptive Subpixel Unsharp Mask & Micro-Sharpening Synthesizer
CREATE TABLE IF NOT EXISTS unsharp_mask_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'webtoon_ribbon_crisp' CHECK (preset_name IN (
        'webtoon_ribbon_crisp',
        'tankobon_ink_accent',
        'vintage_grain_pass',
        'furigana_edge_guard',
        'raw_neutral'
    )),
    sharpness REAL NOT NULL DEFAULT 0.85 CHECK (sharpness >= 0.0 AND sharpness <= 2.0),
    edge_threshold REAL NOT NULL DEFAULT 12.0 CHECK (edge_threshold >= 0.0 AND edge_threshold <= 255.0),
    halo_clamp REAL NOT NULL DEFAULT 0.05 CHECK (halo_clamp >= 0.0 AND halo_clamp <= 0.50),
    max_weight REAL NOT NULL DEFAULT 0.35 CHECK (max_weight >= 0.0 AND max_weight <= 0.50),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_unsharp_mask_lookup 
    ON unsharp_mask_profiles(series_id);

-- Sprint 123: Adaptive Dynamic Range (ADR) Tone Equalizer & Black-Crush Compensator
CREATE TABLE IF NOT EXISTS adr_tone_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'berserk_night_recovery' CHECK (preset_name IN (
        'berserk_night_recovery',
        'shonen_deep_black',
        'vintage_newsprint_gamma',
        'webtoon_vibrant_range',
        'raw_linear'
    )),
    shadow_lift REAL NOT NULL DEFAULT 0.55 CHECK (shadow_lift >= 0.0 AND shadow_lift <= 1.0),
    gamma REAL NOT NULL DEFAULT 1.25 CHECK (gamma >= 0.2 AND gamma <= 3.0),
    shoulder_clamp REAL NOT NULL DEFAULT 0.95 CHECK (shoulder_clamp >= 0.50 AND shoulder_clamp <= 1.0),
    white_point REAL NOT NULL DEFAULT 1.00 CHECK (white_point >= 0.80 AND white_point <= 1.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_adr_tone_lookup 
    ON adr_tone_profiles(series_id);

-- Sprint 124: Subpixel Font Kerning & CJK Stroke Density Balancer
CREATE TABLE IF NOT EXISTS cjk_kerning_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'manga_dense_kanji' CHECK (preset_name IN (
        'manga_dense_kanji',
        'webtoon_hangul_flow',
        'furigana_compact',
        'dialogue_whisper',
        'raw_fixed'
    )),
    base_kerning_em REAL NOT NULL DEFAULT 0.04 CHECK (base_kerning_em >= -0.10 AND base_kerning_em <= 0.50),
    tracking_ratio REAL NOT NULL DEFAULT 0.015 CHECK (tracking_ratio >= 0.0 AND tracking_ratio <= 0.10),
    min_kerning_em REAL NOT NULL DEFAULT -0.02 CHECK (min_kerning_em >= -0.20 AND min_kerning_em <= 0.0),
    max_kerning_em REAL NOT NULL DEFAULT 0.20 CHECK (max_kerning_em >= 0.0 AND max_kerning_em <= 1.0),
    optical_weight_ratio REAL NOT NULL DEFAULT 0.25 CHECK (optical_weight_ratio >= 0.0 AND optical_weight_ratio <= 1.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cjk_kerning_lookup 
    ON cjk_kerning_profiles(series_id);

-- Sprint 125: Dynamic Speed-Line Vector Synthesizer & Kinetic Impact Focus Engine
CREATE TABLE IF NOT EXISTS speed_line_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'shonen_radial_climax' CHECK (preset_name IN (
        'shonen_radial_climax',
        'dash_horizontal',
        'explosion_burst',
        'suspense_vortex',
        'raw_fixed'
    )),
    mode TEXT NOT NULL DEFAULT 'radial' CHECK (mode IN ('radial', 'parallel', 'none')),
    line_count INTEGER NOT NULL DEFAULT 72 CHECK (line_count >= 0 AND line_count <= 256),
    focus_x REAL NOT NULL DEFAULT 0.50 CHECK (focus_x >= 0.0 AND focus_x <= 1.0),
    focus_y REAL NOT NULL DEFAULT 0.50 CHECK (focus_y >= 0.0 AND focus_y <= 1.0),
    angle_jitter REAL NOT NULL DEFAULT 0.035 CHECK (angle_jitter >= 0.0 AND angle_jitter <= 0.50),
    min_length_ratio REAL NOT NULL DEFAULT 0.25 CHECK (min_length_ratio >= 0.0 AND min_length_ratio <= 1.0),
    max_length_ratio REAL NOT NULL DEFAULT 0.95 CHECK (max_length_ratio >= 0.0 AND max_length_ratio <= 1.0),
    min_width_px REAL NOT NULL DEFAULT 0.70 CHECK (min_width_px >= 0.10 AND min_width_px <= 10.0),
    max_width_px REAL NOT NULL DEFAULT 2.00 CHECK (max_width_px >= 0.10 AND max_width_px <= 10.0),
    pulse_duration_ms INTEGER NOT NULL DEFAULT 320 CHECK (pulse_duration_ms >= 0 AND pulse_duration_ms <= 2000),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK (min_length_ratio <= max_length_ratio),
    CHECK (min_width_px <= max_width_px)
);

CREATE INDEX IF NOT EXISTS idx_speed_line_lookup 
    ON speed_line_profiles(series_id);

-- Sprint 126: Subpixel Chromatic Aberration & Lens Distortion Compensator
CREATE TABLE IF NOT EXISTS lens_distortion_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'tankobon_flatbed_scanner' CHECK (preset_name IN (
        'tankobon_flatbed_scanner',
        'aged_lens_barrel',
        'pincushion_edge_fix',
        'subtle_neutralizer',
        'raw_fixed'
    )),
    k1 REAL NOT NULL DEFAULT -0.015 CHECK (k1 >= -0.20 AND k1 <= 0.20),
    k2 REAL NOT NULL DEFAULT 0.002 CHECK (k2 >= -0.05 AND k2 <= 0.05),
    red_shift REAL NOT NULL DEFAULT 0.004 CHECK (red_shift >= -0.05 AND red_shift <= 0.05),
    blue_shift REAL NOT NULL DEFAULT -0.004 CHECK (blue_shift >= -0.05 AND blue_shift <= 0.05),
    center_x REAL NOT NULL DEFAULT 0.50 CHECK (center_x >= 0.0 AND center_x <= 1.0),
    center_y REAL NOT NULL DEFAULT 0.50 CHECK (center_y >= 0.0 AND center_y <= 1.0),
    scale REAL NOT NULL DEFAULT 1.00 CHECK (scale >= 0.80 AND scale <= 1.20),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lens_distortion_lookup 
    ON lens_distortion_profiles(series_id);

-- Sprint 127: Adaptive Moiré Pattern Suppressor & Halftone Screentone De-Aliasing Filter
CREATE TABLE IF NOT EXISTS moire_suppressor_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'manga_screentone_soften' CHECK (preset_name IN (
        'manga_screentone_soften',
        'newsprint_despeckle',
        'dense_crosshatch_calm',
        'vintage_magazine_smooth',
        'raw_fixed'
    )),
    suppression_strength REAL NOT NULL DEFAULT 0.45 CHECK (suppression_strength >= 0.0 AND suppression_strength <= 1.0),
    delta_clamp REAL NOT NULL DEFAULT 16.0 CHECK (delta_clamp >= 0.0 AND delta_clamp <= 64.0),
    edge_threshold REAL NOT NULL DEFAULT 32.0 CHECK (edge_threshold >= 5.0 AND edge_threshold <= 100.0),
    filter_radius INTEGER NOT NULL DEFAULT 2 CHECK (filter_radius >= 1 AND filter_radius <= 5),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moire_suppressor_lookup 
    ON moire_suppressor_profiles(series_id);

-- Sprint 128: Perceptual Color Gamut Mapping & CMYK Ink Density Simulator
CREATE TABLE IF NOT EXISTS cmyk_simulator_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'tankobon_four_color' CHECK (preset_name IN (
        'shonen_color_spread',
        'tankobon_four_color',
        'vintage_faded_pulp',
        'cyberpunk_cmyk_boost',
        'raw_fixed'
    )),
    tac_limit REAL NOT NULL DEFAULT 2.80 CHECK (tac_limit >= 1.50 AND tac_limit <= 4.00),
    dot_gain REAL NOT NULL DEFAULT 0.10 CHECK (dot_gain >= 0.0 AND dot_gain <= 0.50),
    black_absorption REAL NOT NULL DEFAULT 0.10 CHECK (black_absorption >= 0.0 AND black_absorption <= 0.50),
    gamut_compression REAL NOT NULL DEFAULT 0.15 CHECK (gamut_compression >= 0.0 AND gamut_compression <= 1.00),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cmyk_simulator_lookup 
    ON cmyk_simulator_profiles(series_id);

-- Sprint 129: Kinetic Peripheral Vignette & Micro-Saccade Gaze Stabilizer
CREATE TABLE IF NOT EXISTS gaze_vignette_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'relaxed_reading_calm' CHECK (preset_name IN (
        'deep_focus_tunnel',
        'shonen_action_burst',
        'relaxed_reading_calm',
        'night_monochrome',
        'raw_fixed'
    )),
    omega REAL NOT NULL DEFAULT 8.0 CHECK (omega >= 1.0 AND omega <= 40.0),
    dead_zone_px REAL NOT NULL DEFAULT 1.5 CHECK (dead_zone_px >= 0.0 AND dead_zone_px <= 20.0),
    snap_threshold_px REAL NOT NULL DEFAULT 120.0 CHECK (snap_threshold_px >= 20.0 AND snap_threshold_px <= 500.0),
    vignette_max REAL NOT NULL DEFAULT 0.12 CHECK (vignette_max >= 0.0 AND vignette_max <= 0.80),
    radius_x REAL NOT NULL DEFAULT 0.55 CHECK (radius_x >= 0.10 AND radius_x <= 1.50),
    radius_y REAL NOT NULL DEFAULT 0.65 CHECK (radius_y >= 0.10 AND radius_y <= 1.50),
    q0 REAL NOT NULL DEFAULT 0.70 CHECK (q0 >= 0.0 AND q0 <= 2.0),
    q1 REAL NOT NULL DEFAULT 1.20 CHECK (q1 >= 0.10 AND q1 <= 3.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gaze_vignette_lookup 
    ON gaze_vignette_profiles(series_id);

-- Sprint 130: Subpixel Matte Paper Specular Reflection & Angular Lighting Modulator
CREATE TABLE IF NOT EXISTS paper_lighting_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'tankobon_deluxe_matte' CHECK (preset_name IN (
        'tankobon_deluxe_matte',
        'shonen_pulp_newsprint',
        'doujinshi_satin',
        'vintage_aged_pulp',
        'raw_fixed'
    )),
    light_x REAL NOT NULL DEFAULT 0.50 CHECK (light_x >= -2.0 AND light_x <= 3.0),
    light_y REAL NOT NULL DEFAULT 0.30 CHECK (light_y >= -2.0 AND light_y <= 3.0),
    light_z REAL NOT NULL DEFAULT 1.20 CHECK (light_z >= 0.10 AND light_z <= 5.0),
    diffuse_kd REAL NOT NULL DEFAULT 0.85 CHECK (diffuse_kd >= 0.0 AND diffuse_kd <= 2.0),
    specular_ks REAL NOT NULL DEFAULT 0.12 CHECK (specular_ks >= 0.0 AND specular_ks <= 1.0),
    roughness REAL NOT NULL DEFAULT 0.45 CHECK (roughness >= 0.05 AND roughness <= 1.0),
    ink_absorption REAL NOT NULL DEFAULT 0.85 CHECK (ink_absorption >= 0.0 AND ink_absorption <= 1.0),
    ambient_ka REAL NOT NULL DEFAULT 0.20 CHECK (ambient_ka >= 0.0 AND ambient_ka <= 1.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_paper_lighting_lookup 
    ON paper_lighting_profiles(series_id);

-- Sprint 131: Subpixel Mechanical Rotary Press Plate Misregistration & Ink Trapping Compensator
CREATE TABLE IF NOT EXISTS ink_trapping_profiles (
    series_id TEXT PRIMARY KEY,
    preset_name TEXT NOT NULL DEFAULT 'vintage_rotary_offset_80s' CHECK (preset_name IN (
        'vintage_rotary_offset_80s',
        'shonen_color_centerfold',
        'modern_cmyk_tight',
        'misregistered_retro_fringe',
        'raw_fixed'
    )),
    shift_cx REAL NOT NULL DEFAULT 0.60 CHECK (shift_cx >= -3.0 AND shift_cx <= 3.0),
    shift_cy REAL NOT NULL DEFAULT -0.40 CHECK (shift_cy >= -3.0 AND shift_cy <= 3.0),
    shift_mx REAL NOT NULL DEFAULT -0.30 CHECK (shift_mx >= -3.0 AND shift_mx <= 3.0),
    shift_my REAL NOT NULL DEFAULT 0.50 CHECK (shift_my >= -3.0 AND shift_my <= 3.0),
    shift_yx REAL NOT NULL DEFAULT 0.20 CHECK (shift_yx >= -3.0 AND shift_yx <= 3.0),
    shift_yy REAL NOT NULL DEFAULT 0.40 CHECK (shift_yy >= -3.0 AND shift_yy <= 3.0),
    shift_kx REAL NOT NULL DEFAULT 0.00 CHECK (shift_kx >= -3.0 AND shift_kx <= 3.0),
    shift_ky REAL NOT NULL DEFAULT 0.00 CHECK (shift_ky >= -3.0 AND shift_ky <= 3.0),
    trap_width REAL NOT NULL DEFAULT 0.35 CHECK (trap_width >= 0.0 AND trap_width <= 2.0),
    trap_mode TEXT NOT NULL DEFAULT 'auto' CHECK (trap_mode IN ('spread', 'choke', 'auto')),
    edge_threshold REAL NOT NULL DEFAULT 0.15 CHECK (edge_threshold >= 0.01 AND edge_threshold <= 1.0),
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ink_trapping_lookup 
    ON ink_trapping_profiles(series_id);
