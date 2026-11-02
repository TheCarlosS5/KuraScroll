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



