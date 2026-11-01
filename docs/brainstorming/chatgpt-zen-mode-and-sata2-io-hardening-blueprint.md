# KuraScroll: ChatGPT Architectural Blueprint — Sprints 23 & 24

**Context:** Local manga/manhwa/manhua platform sister to KuraStream (`KS` branding).  
**Hardware Profile:** Intel Pentium T4500 (2 cores, 2.30GHz, SSSE3 only, ~3-4GB RAM, Intel GMA 4500MHD GPU), Mechanical 4TB HDD (SATA II, 5400 RPM, 75-100 random IOPS).

---

## 1. Sprint 23: Frontend Fullscreen & Zen Immersion Mode (GSAP 3 + React 19)

### 1.1 Finite State Machine (`ZenState`)
- States: `'INACTIVE' | 'ENTERING' | 'ACTIVE' | 'EXITING'`.
- Prevents collision or broken DOM states when user repeatedly presses `F`.
- Keybinding guarded against `input`, `textarea`, `select`, or `contentEditable`.

### 1.2 Intel GMA 4500MHD GPU & 60-120fps Ergonomics
- **No Heavy Filters:** Avoid dynamic `backdrop-filter: blur(...)` and expensive animated `box-shadow` on every frame.
- **AutoAlpha & Scale:** Animate only `opacity`, `transform: scale()`, and `translate()`. Never animate `width`, `height`, `top`, or `left` to avoid layout reflows (CLS = 0).
- **Subtle Ambilight Backdrop:** A single static or low-frequency radial gradient with CSS transition opacity (`300ms ease`), offloading composition to browser compositor thread.
- **Strict Mode Cleanup:** Always invoke `gsap.killTweensOf(...)` on unmount to prevent memory leaks or orphan timelines in React 19.

---

## 2. Sprint 24: Backend SATA II & SQLite I/O Hardening

### 2.1 SQLite PRAGMA Hardening Profile
Configured on every database connection:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 10000;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -1024;
PRAGMA mmap_size = 0;
PRAGMA wal_autocheckpoint = 1000;
```

#### Rationale for Pentium T4500 & 4TB HDD (SATA II):
1. **`journal_mode = WAL`**: Readers never block writers and writers never block readers.
2. **`synchronous = NORMAL`**: Drastically reduces mechanical platter `fsync` calls, cutting I/O wait by up to 80% without risking WAL corruption.
3. **`busy_timeout = 10000`**: Fastify readers and concurrent background maintenance wait up to 10 seconds for locks instead of failing immediately with `SQLITE_BUSY`.
4. **`temp_store = MEMORY`**: Temporary tables and FTS5 intermediate results are processed in RAM rather than generating random disk seeks.
5. **`cache_size = -1024`**: Keeps SQLite RAM footprint strictly bounded to ~1MB per connection, respecting the 3GB-4GB total system ceiling.
6. **`mmap_size = 0`**: Prevents virtual memory thrashing against page files on SATA II.
7. **`wal_autocheckpoint = 1000`**: Checkpoint threshold controlled in predictable 4MB chunks.

### 2.2 Streaming File Copy with 64KB HighWaterMark
Avoids full `fs.readFile` or unbounded `fs.copyFile` disk saturation by streaming with backpressure:
```typescript
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

export async function copyFileWithBackpressure(
  source: string,
  destination: string,
  signal?: AbortSignal
): Promise<void> {
  await pipeline(
    createReadStream(source, { highWaterMark: 64 * 1024 }),
    createWriteStream(destination, { highWaterMark: 64 * 1024, flags: 'w' }),
    { signal }
  );
}
```

### 2.3 Single Heavy Task Arbitration (`maxHeavyTasks: 1`)
Background maintenance tasks (`VACUUM INTO`, `IntegrityScan`, `DifferentialMirror`, `BulkIngestion`) are coordinated so that at most **one** heavy I/O task executes simultaneously, pausing cooperatively when Fastify reader latency P95 exceeds the AIC threshold.
