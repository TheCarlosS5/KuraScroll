# Sprint 58: Smart WebP Transcoding Cache & Ahead-Of-Time Downsampling Pipeline Blueprint

**Author:** Antigravity (Orchestrator) & Senior ChatGPT Consultation  
**Target Hardware Constraints:** Intel Pentium T4500 (2C/2T @ 2.3 GHz, 1MB L2 cache, <=512MB V8 heap, no AVX), Intel GMA 4500MHD (64-128MB shared VRAM, 2048px max hardware texture size), 4TB SATA II HDD (75-100 IOPS, 12-15ms radial seek latency).

---

## 1. Architectural Strategy & Directives

1. **Decoupled Asynchronous Transcoding:**
   - On-demand transcoding during active reader requests is strictly forbidden; it starves Fastify event loop on 2 cores.
   - If a requested resolution tier is not yet cached, Fastify serves the closest available pre-scaled tier or raw stored page, while enqueuing a background transcode task.
2. **Strict libvips & Sharp Concurrency Isolation:**
   - `sharp.concurrency(1)` enforces a single worker thread per image.
   - `sharp.cache({ memory: 16, files: 0, items: 32 })` caps memory footprint to 16MB.
   - `sharp.simd(false)` or native SSSE3 path (no AVX/AVX2).
   - Single-job queue deduplication prevents parallel Sharp spikes.
3. **Partitioned File Storage & Zero-Thrash Pruning:**
   - Cache path: `<storageRoot>/cache/transcoded/<prefix2>/<chapterId>/p<pageNumber>_<width>.webp`.
   - Prefix partitioning (`prefix2 = chapterId.slice(0, 2)`) avoids NTFS MFT single-directory saturation.
   - High Watermark (85% of 5GB quota = 4.25GB) triggers background batch unlinking down to Low Watermark (70% = 3.5GB) based on `last_accessed_at`.
4. **Resolution Negotiation & Caching Headers:**
   - Supports query params `?w=800` (mobile), `?w=1200` (laptop/720p), `?w=1600` (desktop/1080p).
   - Serves `ETag: W/"<chapterId>_<page>_<width>_<mtime>"`.
   - Returns `304 Not Modified` with zero body bytes on `If-None-Match`.
   - Serves `Cache-Control: public, max-age=31536000, immutable`.
5. **SLA 22 Target:**
   - Transcoded Cache Hit Lookup Latency < 0.05 ms (50 µs) from SQLite covering index `idx_transcode_cache_lookup`.

---

## 2. SQLite Schema (`cached_transcoded_pages`)

```sql
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
```
