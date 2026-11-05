-- KuraScroll Client-Processed Uploads Migration 002
-- Tables for upload sessions, session pages, and visibility tracking

CREATE TABLE IF NOT EXISTS upload_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    series_id TEXT,
    new_series_title TEXT,
    new_series_type TEXT,
    volume_number REAL,
    chapter_number REAL NOT NULL,
    chapter_title TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'publishing', 'complete', 'failed')),
    manifest_json TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS upload_session_pages (
    upload_id TEXT NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    byte_length INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    confirmed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(upload_id, page_number)
);

ALTER TABLE series ADD COLUMN created_by TEXT;
ALTER TABLE series ADD COLUMN visibility_status TEXT DEFAULT 'published' CHECK(visibility_status IN ('published', 'hidden', 'removed'));

ALTER TABLE chapters ADD COLUMN uploaded_by TEXT;
ALTER TABLE chapters ADD COLUMN visibility_status TEXT DEFAULT 'published' CHECK(visibility_status IN ('published', 'hidden', 'removed'));
ALTER TABLE chapters ADD COLUMN storage_bytes INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires ON upload_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_session_pages_upload ON upload_session_pages(upload_id);
CREATE INDEX IF NOT EXISTS idx_chapters_uploaded_by ON chapters(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_chapters_visibility ON chapters(visibility_status);
CREATE INDEX IF NOT EXISTS idx_series_visibility ON series(visibility_status);
