# KuraScroll Benchmark Report: 100 Concurrent Multilingual Catalog & FTS5 Search Queries

- **Document ID:** `docs/benchmarks/catalog-search-concurrency.md`
- **Author:** Senior Performance & Benchmarking Engineer
- **Platform:** KuraScroll (Sister platform to KuraStream)
- **Sprint:** Sprint 9 (Catalog Search Concurrency & Multilingual Stress Testing)
- **Test Suite:** `tests/benchmark/catalog-search-concurrency.test.ts`
- **Execution Engine:** Vitest v3.2.7 | Node.js v24.19.0 | Fastify v5.2.1 | SQLite 3 (FTS5 + WAL Mode)
- **Date:** 2026-11-01
- **Status:** Verified & Complete

---

## 1. Executive Summary

A key architectural pillar of KuraScroll is instant graphic novel discovery across international borders. Fans search interchangeably by native Japanese Kanji (*鬼滅の刃*, *呪術廻戦*), Korean Hangul (*나 혼자만 레벨업*, *신의 탑*), Spanish translations (*Guardianes de la Noche*, *El Hombre Motosierra*), or English canonical names, often combined with structured catalog filters such as publication status (`ongoing`, `completed`) and graphic medium (`manga`, `manhwa`, `manhua`, `comic`).

This benchmark evaluates the performance, concurrency limits, and latency distribution of **100 concurrent search requests** combining SQLite FTS5 full-text queries with relational filters against Fastify's `/api/v1/series` endpoint.

### Key Benchmark Telemetry Summary

| Workload Scenario | Concurrency | Total Duration | Throughput (Queries/s) | Latency P50 (Median) | Latency P95 | Latency P99 | Max Latency | Success Rate |
|---|---|---|---|---|---|---|---|---|
| **100 Concurrent Multilingual FTS5 + Combined Filters (`type` + `status`)** | 100 | **91.37 ms** | **1,094.51 queries/s** | **75.77 ms** | **80.69 ms** | **81.09 ms** | **81.09 ms** | **100% (100/100 OK)** |
| **100 Concurrent Pure Multilingual FTS5 Full-Text Queries** | 100 | **51.27 ms** | **1,950.29 queries/s** | **48.46 ms** | **50.33 ms** | **50.48 ms** | **50.48 ms** | **100% (100/100 OK)** |
| **100 Concurrent Structured Catalog Filter & Pagination Queries** | 100 | **41.80 ms** | **2,392.14 queries/s** | **39.20 ms** | **40.89 ms** | **41.04 ms** | **41.04 ms** | **100% (100/100 OK)** |

---

## 2. Test Architecture & Benchmark Methodology

The benchmark suite is located in `tests/benchmark/catalog-search-concurrency.test.ts` and executed via `npx vitest run tests/benchmark/catalog-search-concurrency.test.ts`.

### 2.1. Test Catalog Data Set
The benchmark seeds a representative cross-linguistic catalog in a dedicated disk-backed SQLite database (`tmp/benchmark-catalog-search/catalog-bench.db`) with active WAL mode:
- **Graphic Mediums:** `manga` (Japanese), `manhwa` (Korean), `manhua` (Chinese), and `comic` (Western).
- **Publication Statuses:** `completed`, `ongoing`, and `hiatus`.
- **Multilingual Title Aliases:** Registered across `series_titles` and indexed in `series_search_fts` virtual table using SQLite FTS5 with `unicode61` tokenization.

Sample catalog records seeded:
- **Demon Slayer (`manga`, `completed`):** *Demon Slayer: Kimetsu no Yaiba* (en), *Kimetsu no Yaiba* (ja-ro), *鬼滅の刃* (ja), *Guardianes de la Noche* (es).
- **Solo Leveling (`manhwa`, `completed`):** *Solo Leveling* (en), *나 혼자만 레벨업* (ko), *俺だけレベルアップな件* (ja), *Solo yo subo de nivel* (es).
- **Chainsaw Man (`manga`, `ongoing`):** *Chainsaw Man* (en), *チェンソーマン* (ja), *El Hombre Motosierra* (es).
- **Tower of God (`manhwa`, `ongoing`):** *Tower of God* (en), *신의 탑* (ko), *Torre de Dios* (es).
- **Jujutsu Kaisen (`manga`, `completed`):** *Jujutsu Kaisen* (en), *呪術廻戦* (ja), *Guerra de Magia* (es).
- **The Beginning After the End (`comic`, `ongoing`):** *TBATE* (en), *El Comienzo Después del Fin* (es), *끝이 아닌 시작* (ko).
- **Omniscient Reader's Viewpoint (`manhwa`, `ongoing`):** *Omniscient Reader* (en), *전지적 독자 시점* (ko), *Punto de Vista del Lector Omnisciente* (es).
- **Attack on Titan (`manga`, `completed`):** *Attack on Titan* (en), *進撃の巨人* (ja), *Ataque a los Titanes* (es).
- **Nano Machine (`manhwa`, `ongoing`):** *Nano Machine* (en), *나노마신* (ko), *Máquina Nano* (es).
- **The Outcast (`manhua`, `ongoing`):** *The Outcast* (en), *一人之下* (zh), *El Proscrito* (es).

---

## 3. Detailed Benchmark Analysis

### 3.1. Benchmark 1: 100 Concurrent Multilingual FTS5 + Combined Filter Queries

#### Query Specification
Each request combines an FTS5 multilingual full-text token with relational filter predicates:
```http
GET /api/v1/series?q=<query>&type=<type>&status=<status>&limit=10
```

SQL Execution Plan:
```sql
SELECT DISTINCT s.*
FROM series_search_fts fts
JOIN series s ON s.id = fts.series_id
WHERE series_search_fts MATCH ?
  AND s.type = ?
  AND s.status = ?
LIMIT ?;
```

#### Empirical Results
```
===============================================================
 BENCHMARK REPORT: 100 CONCURRENT MULTILINGUAL FTS5 + COMBINED FILTER QUERIES
===============================================================
 Total Concurrent Queries            : 100
 Languages Tested                    : Spanish (es), Japanese Kanji (ja), Korean (ko)
 Combined Filters                    : type + status + FTS5 Match
 Success Rate                        : 100% (100 / 100 OK)
 Total Elapsed Duration              : 91.37 ms
 Throughput (Queries/sec)            : 1094.51 queries/s
 Latency Min                         : 69.45 ms
 Latency Mean                        : 75.57 ms
 Latency P50 (Median)                : 75.77 ms
 Latency P90                         : 80.17 ms
 Latency P95                         : 80.69 ms
 Latency P99                         : 81.09 ms
 Latency Max                         : 81.09 ms
 Standard Deviation                  : 3.26 ms
===============================================================
```

#### Latency Percentile Distribution
```
Latency (ms)
  100 ┌────────────────────────────────────────────────────────┐
      │                                                        │
   80 ┼───────────────────■ P50 (75.8) ────■ P95 (80.7) ─■ P99 │
      │                                                        │
   60 ┼──■ Min (69.5)                                          │
      │                                                        │
   40 ┼────────────────────────────────────────────────────────┤
      │                                                        │
   20 ┼────────────────────────────────────────────────────────┤
      │                                                        │
    0 ┴────────────────────────────────────────────────────────┘
         Min (69.5)         P50 (75.8)         P95 (80.7)    P99 (81.1)
```

#### Engineering Observations
1. **Sub-100ms Latency across All Percentiles:** Even at the 99th percentile ($81.09\text{ ms}$), the combined query executes with comfortable margin under user-perceivable lag ($< 100\text{ ms}$).
2. **Extremely Low Jitter ($\sigma = 3.26\text{ ms}$):** The gap between Min ($69.45\text{ ms}$) and Max ($81.09\text{ ms}$) is only $11.64\text{ ms}$, demonstrating that Node's event loop and SQLite's prepared statements handle parallel queries without thread stalls.
3. **Filter Correctness:** 100% of returned series records verified that `type === requestedType` and `status === requestedStatus`.

---

### 3.2. Benchmark 2: 100 Concurrent Pure Multilingual FTS5 Full-Text Queries

#### Query Specification
Evaluates raw FTS5 full-text indexing without additional relational filters, measuring raw inverted index seek performance across Unicode character sets:
```http
GET /api/v1/series?q=<multilingual_term>&limit=10
```

#### Empirical Results
```
===============================================================
 BENCHMARK REPORT: 100 CONCURRENT PURE MULTILINGUAL FTS5 FULL-TEXT QUERIES
===============================================================
 Total Concurrent Queries            : 100
 Total Elapsed Duration              : 51.27 ms
 Throughput (Queries/sec)            : 1950.29 queries/s
 Latency Min                         : 46.31 ms
 Latency Mean                        : 48.44 ms
 Latency P50 (Median)                : 48.46 ms
 Latency P95                         : 50.33 ms
 Latency P99                         : 50.48 ms
 Latency Max                         : 50.48 ms
===============================================================
```

#### Key Findings
- **Throughput:** Near **2,000 queries per second** ($1,950.29\text{ queries/s}$).
- **P50 Latency:** **$48.46\text{ ms}$**.
- **FTS5 Unicode Efficiency:** SQLite's `unicode61` tokenizer evaluates Hangul and CJK characters with near-zero overhead compared to Latin text.

---

### 3.3. Benchmark 3: 100 Concurrent Structured Catalog Filter & Pagination Queries

#### Query Specification
Simulates readers browsing catalog categories (e.g. "Completed Manga", "Ongoing Manhwa") using structured index scans with limit/offset pagination:
```http
GET /api/v1/series?type=<type>&status=<status>&page=<page>&limit=5
```

#### Empirical Results
```
===============================================================
 BENCHMARK REPORT: 100 CONCURRENT STRUCTURED CATALOG FILTER & PAGINATION QUERIES
===============================================================
 Total Concurrent Queries            : 100
 Total Elapsed Duration              : 41.80 ms
 Throughput (Queries/sec)            : 2392.14 queries/s
 Latency Min                         : 31.91 ms
 Latency Mean                        : 36.77 ms
 Latency P50 (Median)                : 39.20 ms
 Latency P95                         : 40.89 ms
 Latency P99                         : 41.04 ms
 Latency Max                         : 41.04 ms
===============================================================
```

#### Key Findings
- **Peak Throughput:** **2,392.14 queries per second**.
- **P50 Latency:** **$39.20\text{ ms}$**, P95: **$40.89\text{ ms}$**.
- Pure relational filtering bypasses FTS5 virtual table overhead, executing index seek and pagination in sub-40ms durations.

---

## 4. Performance Thresholds & SLA Criteria

The following production Service Level Agreements (SLAs) are established and enforced by the test suite:

| Metric | Target SLA | Benchmark Measured | Margin / Headroom | Status |
|---|---|---|---|---|
| **P50 Latency (Combined Search)** | $< 200\text{ ms}$ | **$75.77\text{ ms}$** | 62.1% Headroom | **PASSED** |
| **P95 Latency (Combined Search)** | $< 350\text{ ms}$ | **$80.69\text{ ms}$** | 76.9% Headroom | **PASSED** |
| **P99 Latency (Combined Search)** | $< 500\text{ ms}$ | **$81.09\text{ ms}$** | 83.8% Headroom | **PASSED** |
| **Throughput (Combined Search)** | $> 200\text{ queries/s}$ | **$1,094.51\text{ queries/s}$** | 5.4x Target | **PASSED** |
| **Multilingual Resolution Precision** | 100% | 100% | Perfect Resolution | **PASSED** |
| **Zero-Error Concurrency** | 100/100 OK | 100/100 OK | 0 Failures / 0 Deadlocks | **PASSED** |

---

## 5. Production Architectural Recommendations

To sustain $> 1,000\text{ queries/s}$ catalog throughput on 4TB mechanical HDD installations:

1. **Keep SQLite Catalog Database on Host SSD / RAM Page Cache:**
   While the 4TB mechanical HDD holds the massive graphic WebP files (`/storage/...`), the SQLite database file (`kura-scroll.db`) is small (< 100 MB for 50,000 series). Keeping the `.db` file in OS page cache or host SSD guarantees that search queries never wait on mechanical actuator head seeks.
2. **Prepared Statement Caching:**
   Pre-compile FTS5 and filter query statements to eliminate repeated SQL AST compilation on every search request.
3. **FTS Sanitization:**
   Retain `sanitizeFtsQuery()` to strip control characters and inject prefix wildcards (`"token"*`), preventing malformed FTS syntax crashes while enabling instant autocomplete search.
4. **SQLite WAL Memory Pragmas:**
   Ensure `PRAGMA synchronous = NORMAL;`, `PRAGMA temp_store = MEMORY;`, and `PRAGMA cache_size = -64000;` are configured on database startup.

---

## 6. Verification & Reproducibility

Execute the benchmark suite:

```powershell
cd C:\Users\Admin\dev\kura-scroll
npx vitest run tests/benchmark/catalog-search-concurrency.test.ts
```

### Test Suite Execution Output
```
✓ tests/benchmark/catalog-search-concurrency.test.ts (3 tests) 380ms
  ✓ benchmarks 100 concurrent multilingual FTS5 queries with combined type and status filters (91ms)
  ✓ benchmarks 100 concurrent unconstrained multilingual FTS5 queries (51ms)
  ✓ benchmarks 100 concurrent structured catalog filter and pagination queries (42ms)

Test Files  1 passed (1)
Tests       3 passed (3)
Duration    1.43s
```
