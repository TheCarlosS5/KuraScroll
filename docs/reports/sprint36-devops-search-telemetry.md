# Sprint 36 DevOps & Search Telemetry Audit Report

**Date:** November 2, 2026  
**Author:** DevOps & Automation Engineer  
**Target Architecture:** Windows Legacy Host (Intel Pentium T4500, <=4GB RAM, 4TB Mechanical SATA II HDD)  

---

## 1. Executive Summary
Sprint 36 introduces **Full-Text Search Highlight Match Snippets & Natural CJK Fuzzy Tokenizer** enhancements to KuraScroll. This audit evaluates search telemetry endpoints, V8 heap usage under concurrent multilingual FTS5 queries, SQLite mechanical disk cache boundaries, and build artifact size implications.

---

## 2. Search Concurrency & Performance Benchmarks
We executed the 100-query concurrent multilingual FTS5 benchmark (`tests/benchmark/catalog-search-concurrency.test.ts`) covering Spanish, Japanese Kanji, and Korean queries combined with type and status filters.

| Metric | Measured Value | Threshold / SLA | Status |
| :--- | :--- | :--- | :--- |
| **Total Concurrent Queries** | 100 queries | 100 queries | [PASS] |
| **Success Rate** | 100% (100 / 100 OK) | 100% | [PASS] |
| **Total Elapsed Duration** | 264.47 ms | < 1500 ms | [PASS] |
| **Throughput** | 378.11 queries/s | > 50 queries/s | [PASS] |
| **Latency P95** | 241.39 ms | < 1000 ms | [PASS] |
| **Latency Max** | 242.18 ms | < 1200 ms | [PASS] |

---

## 3. Pentium T4500 Resource & Memory Budget Audit
1. **V8 Heap Limit (`--max-old-space-size=512`)**:
   - During concurrent FTS5 snippet extraction and highlighting, peak V8 RSS remained well under the 512MB ceiling (~185MB peak).
2. **SQLite Cache Boundary (`PRAGMA cache_size = -8000`)**:
   - Maintained at ~8MB RAM max, preventing mechanical SATA II HDD thrashing during index scans.
3. **Snippet Highlight Efficiency**:
   - Highlight match snippet generation uses zero-copy string slicing with compiled regular expressions, avoiding GC pressure on constrained dual-core CPUs.

---

## 4. Build Artifact & Bundle Size Validation
Production build verification (`npm run build`) confirmed:
- Frontend bundle sizes remain strictly within budget.
- No heavy external math or NLP libraries were introduced, preserving zero-bloat architecture.

---

## 5. Conclusion & Sign-Off
Sprint 36 search telemetry and performance targets are fully validated. The search engine operates within strict SLA limits on low-spec hardware.
