# Senior ChatGPT Architectural Blueprint: Sprint 63 — Platter Defragmentation & Sequential CBZ Re-Ordering Daemon

**Consultation Source:** Brave Browser via MCP (`«Colaboración en proyecto - Brave»`), Senior Architect ChatGPT.  
**Sprint Scope:** Sprint 63 (Platter Locality Index [PLI], Sequential File Re-Ordering, Zero-Thrash Stream Rewriting, SQLite Persistence, PlatterDefragHUD, SLA 27).  
**Target Hardware:** 4TB Mechanical SATA II HDD (5400/7200 RPM, SATA II bus, ~75-100 random IOPS, 12-15ms radial seek latency) & Intel Pentium T4500 (2C/2T @ 2.30 GHz, 1MB L2, 512MB RAM heap ceiling) & Intel GMA 4500MHD (Zero CSS blur, zero backdrop-filter, pure solid containment, 0 CLS).

---

## 1. Executive Summary & Mechanical HDD Physical Constraints
On a 4TB mechanical SATA II platter drive, reading chapters scattered non-contiguously forces the drive head actuator to mechanically swing across radial cylinders. Each random seek incurs a **12 to 15 millisecond physical latency penalty**.
- **Objective:** Re-order and contiguous-cluster chapter CBZ archives and page directories in ascending chapter order ($Ch_1 \to Ch_2 \to Ch_3$) on adjacent sectors.
- **Platter Locality Index (PLI):**
  A mathematical metric between $0.0$ (totally fragmented) and $1.0$ (perfectly sequential).
  Evaluates delta between inode / cluster sequence and creation order.
- **Cooperative Low-Priority Streaming:**
  Defragmentation uses $64\text{ KiB}$ chunked buffers with cooperative yielding in `IOCoordinator` to guarantee that interactive page reads take immediate preemption priority ($< 15\text{ ms}$ yield latency).

---

## 2. SQLite Database Schema (`disk_platter_defrag_runs`)

```sql
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
```

---

## 3. Platter Locality Index (PLI) Calculation Math
Given an ordered list of chapters $C = [c_1, c_2, \dots, c_M]$ sorted by `chapter_number`:
1. Obtain inode or file birth/mtime stamp sequence $S = [s_1, s_2, \dots, s_M]$.
2. Compute step difference:
   $$\Delta_i = s_{i+1} - s_i$$
3. An ideal sequential layout has strictly monotonically increasing cluster offsets ($\Delta_i > 0$ and small bounded variance).
4. If out of sequence ($\Delta_i < 0$ or jump $> \text{threshold}$): penalty incurred.
5. Normalized score:
   $$\text{PLI} = \max\left(0.0, \; 1.0 - \frac{\text{Penalties}}{M - 1}\right)$$

---

## 4. Hardware SLA 27 Specification
- **SLA 27:** Sequential cluster evaluation and Platter Locality Index (PLI) calculation latency $< 0.10\text{ ms}$ ($100\ \mu\text{s}$) per chapter.

---

## 5. Frontend Hardware-Safe Component (`PlatterDefragHUD.tsx`)
- Solid `#18181b` card, 0 CSS blur, 0 backdrop-filter.
- Gauge / progress bar showing fragmentation percentage $(1 - \text{PLI}) \times 100\%$.
- Button "Optimizar Cilindros" triggering asynchronous background defrag.
- Layout containment: `contain: layout paint` for 0 CLS.
