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

-- Full Text Search Virtual Table
CREATE VIRTUAL TABLE IF NOT EXISTS series_search_fts USING fts5(
    series_id UNINDEXED,
    title,
    tokenize = 'unicode61'
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
