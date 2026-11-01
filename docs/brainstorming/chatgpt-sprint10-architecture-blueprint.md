# Sprint 10 Architectural Blueprint: Virtual Volume Ingestion, Webtoon Virtualization & Mihon/Tachiyomi Migration

> Validated with ChatGPT in Brave session (`Colaboración en proyecto - Brave`) on November 1, 2026.

---

## 1. Multi-Chapter Volume Archive Ingestion (Zero HDD Duplication)

### Core Architectural Principle
**Separate physical storage from logical catalog representation.**
A 1 GB multi-chapter tankobon `.cbz` volume must NOT be unpacked into 1,000 loose image files on the mechanical 4TB HDD, which would waste space, double radial seek times, and exhaust file inodes.
Instead, maintain the source `.cbz` file in `STORAGE_ROOT/volumes/` and treat it as a virtual immutable archive filesystem.

### Ingestion Flow
1. **Central Directory Inspection:**
   - Read ZIP Central Directory only (a few KB at the tail of the archive) without loading whole files into memory.
   - Extract entry paths, compressed sizes, uncompressed sizes, compression methods, and CRC32 headers.
2. **Structural Chapter Detector:**
   - **Directory-based grouping:** Subfolders matching `Chapter X/`, `Capitulo X/`, `Ch.X/`, `Vol. 1/Ch. 1/`.
   - **Prefix-based grouping:** Image names with chapter prefix (e.g. `c01_p001.webp`, `c02_p001.webp`).
   - **Nested archives:** Detect nested `.cbz` / `.zip` files inside the master volume.
   - **Fallback:** If no clear demarcation, treat as a single continuous chapter.
   - *Natural Sorting:* Ensure numeric sorting (`Ch 2` before `Ch 10`) using `naturalSort`.
3. **Database Schema:**
   - `chapters` table gains `source_id` referencing `archive_sources(id)`. Multiple chapters can reference the exact same underlying archive without byte duplication.
   - `pages` entries map to logical `entry_name` within the ZIP index, alongside precomputed dimensions (`width`, `height`, `aspectRatio`).

---

## 2. Webtoon Continuous Reading & DOM Virtualization (React 19)

### Core Architectural Principle
**Decouple DOM virtualization from GPU/Heap image buffer retention.**
Virtualizing DOM elements prevents DOM tree bloat, but does not prevent the browser engine from retaining decoded bitmaps in memory.

### Implementation Strategy
1. **TanStack Virtual (`@tanstack/react-virtual`):**
   - Configured with `useFlushSync: false` for React 19 concurrent mode compliance.
   - `overscan: 3` (renders visible elements + 3 above and 3 below).
   - Dynamic measurement via `measureElement` and `shouldAdjustScrollPositionOnItemSizeChange`.
2. **Zero CLS Height Pre-Calculation:**
   - Compute exact expected container height using:
     $$H_{\text{render}} = W_{\text{container}} \times \frac{H_{\text{original}}}{W_{\text{original}}}$$
   - Pre-allocate the placeholder container height *before* image binary streams arrive.
3. **Resource Lifecycle Policy (Long-Session Memory Budget):**
   - **DOM nodes:** Restricted to visible $\pm 3$ panels.
   - **Concurrent fetch requests:** Capped at 2–3 simultaneous requests.
   - **Adaptive prefetch:** 2–4 panels ahead based on scroll velocity and direction.
   - **Object URLs:** Strict `URL.revokeObjectURL(url)` immediately upon unmounting.
   - **Chapter exit:** When a chapter scrolls out of buffer, purge its image element references, clear observers, and unmount panels.

---

## 3. Tachiyomi / Mihon Backup Migration Pipeline

### Pipeline Architecture
A standalone, non-invasive import pipeline adhering to the 6-stage lifecycle:
$$\text{Archive} \longrightarrow \text{Detection} \longrightarrow \text{Validation} \longrightarrow \text{Normalization} \longrightarrow \text{Staging SQLite} \longrightarrow \text{Transactional Commit}$$

1. **Format Detection:**
   - Detect format by file signature (magic bytes) rather than extension:
     - GZIP-compressed Protobuf (`.tachibk` / `.proto.gz`).
     - Legacy JSON backups.
2. **Validation & Normalization:**
   - Bounds checking: limit counts, validate UTF-8 characters, guard against malicious deep nesting.
   - Map external source identifiers to KuraScroll series/chapter canonical entities.
3. **Deduplication Engine:**
   - Never rely solely on titles (titles vary across translations and languages).
   - Match by external stable ID (MangaDex UUID, AniList ID) $\rightarrow$ normalized source URL $\rightarrow$ FTS5 fuzzy title match.
4. **SQLite Staging & Transactional Atomic Commit:**
   - Stage candidate imports into a temporary transactional batch.
   - Execute in a single `BEGIN IMMEDIATE ... COMMIT` block. If parsing or foreign key constraints fail, roll back entirely without leaving orphaned records.

---

## 4. Transversal Safeguards
1. **Cache vs Source of Truth:** Disk archives and SQLite database are immutable sources of truth. Fastify LRU cache and frontend Blob caches are ephemeral and self-healing.
2. **Idempotency:** Re-running import on the same CBZ or backup must never create duplicate records (`UNIQUE` constraints + `ON CONFLICT DO UPDATE`).
3. **Chunked Transactions:** Process large libraries in batches of 50–100 items to avoid holding WAL writer locks indefinitely.
4. **Online SQLite Backups:** Use Node 24 native SQLite backup or `VACUUM INTO` snapshots to guarantee consistent WAL state without corrupting active reader connections.
