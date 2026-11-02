# Senior ChatGPT Architectural Blueprint: Sprint 57 — High-Density Compressed Chapter Bundle Streaming Engine

## 1. Context & Hardware Constraints
- **Target Platform**: KuraScroll Manga/Manhwa/Manhua Reader.
- **Host CPU**: Intel Pentium T4500 (2 cores / 2 threads @ 2.30 GHz, Penryn 45nm, 1MB L2 cache, RAM <= 512MB V8 heap).
- **Host Storage**: Mechanical 4TB HDD (`STORAGE_ROOT`, 5400/7200 RPM, SATA II bus, ~75–100 random IOPS, 12–15ms radial seek latency).
- **Host GPU**: Intel GMA 4500MHD (CLS = 0, zero CSS blur, zero backdrop-filter).

---

## 2. Core Problem & Senior Architectural Strategy
Traditional ZIP extractors read the End of Central Directory (EOCD), jump to Central Directory headers, seek to each Local File Header, and inflate the entire file or random entries, causing 120-160 radial seeks per chapter (>2.5 seconds head thrash).

**The Solution:**
1. **Ahead-of-Time (AOT) Byte Offset Indexing**:
   Parse the ZIP archive once. Store exact byte offsets (`data_offset`, `compressed_size`, `uncompressed_size`, `compression_method`, `crc32`) in SQLite table `chapter_archive_offsets`.
2. **Mathematical Offset Formula**:
   $$\text{dataOffset} = \text{localHeaderOffset} + 30 + L_{\text{filename}} + L_{\text{extra}}$$
   Avoid the "Central Directory Trap" by reading the actual local header's 2-byte field lengths (`L_filename`, `L_extra`) directly from the local header to avoid offset drift.
3. **Dual Streaming Modes**:
   - **Method 0 (STORED)**: `fs.createReadStream({ start, end, highWaterMark: 65536 })` piped directly to Fastify HTTP stream (0% CPU, 206 Partial Content enabled).
   - **Method 8 (DEFLATE)**: Stream raw slice through `zlib.createInflateRaw()` (< 1MB RAM footprint, 200 OK stream).
4. **Physical Sequential Clumping**:
   Group physical entries on disk with maximum 1 MiB window and 128 KiB gap to serve contiguous disk sectors in single rotational sweeps.
5. **SLA 21**:
   - In-memory / SQLite compound index lookup latency: P95 $< 0.05\text{ ms}$ ($50\ \mu\text{s}$).

---

## 3. Database Schema
```sql
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
```
