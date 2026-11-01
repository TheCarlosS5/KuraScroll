# SDD ledger — plan: docs/superpowers/plans/2026-11-01-kura-scroll-master-plan.md

- **Status:** Complete & Iterating (Sprint 8 Verified, 155 Tests Passing)
- **Orchestrator:** Antigravity AI Orchestrator
- **Branch:** main (isolated in `C:\Users\Admin\dev\kura-scroll`)
- **Total Test Suites:** 33 test files, 155 passing tests (116 backend + 39 frontend, 100% PASS)

## Rulings & Decisions
- Ruling: Standalone Sibling Project ("Proyecto Hermano") chosen as requested by Carlos to prevent monolithic coupling with KuraStream while sharing branding/logo (KS).
- Ruling: Name "KuraScroll" selected because domain/brand is unoccupied, preserves "KS" acronym, and denotes vertical scrolling for webtoons and horizontal for manga.
- Ruling: Ahead-of-time WebP optimization (q=82, max width 1440px) chosen to guarantee ~85% disk reduction for the 4TB HDD constraint.
- Ruling: Native `node:sqlite` (`DatabaseSync` in Node v24) chosen instead of `better-sqlite3` to eliminate C++ compiler requirements on Windows while delivering native WAL mode, FTS5 full-text search, and zero-latency prepared statements.
- Ruling: Fastify 5 + `@fastify/static` with `maxAge: '1y'` and `immutable: true` configured to maximize client-side caching and eliminate disk seek latency on mechanical HDDs.
- Ruling: Dual-Engine React Reader built with Webtoon vertical strip (virtualized windowing & zero-CLS aspect ratio skeletons) and Manga RTL/LTR flipbook with keyboard navigation (`←`/`→`/`A`/`D`/`Space`).
- Ruling: Senior Architectural consultation with ChatGPT conducted via MCP Brave session, adopting a Byte-based LRU cache (256MB WebP buffers, 32MB manifests) and an Adaptive Prefetch Controller with `AbortController` cancellation for rapid scrolling.
- Ruling: Added autonomous database maintenance (`PRAGMA integrity_check`, `PRAGMA wal_checkpoint(TRUNCATE)`, `PRAGMA optimize`) to prevent WAL file explosion on 4TB local drives.

## Task Execution State
- [x] Part 1: Storage & Ingestion Pipeline (commits db35ede, 77b80f3, 7f47935)
- [x] Part 2: Multilingual Metadata & Search Subsystem (commit f1fd8b4)
- [x] Part 3: Backend REST API & Chapter Delivery (commit c104b41)
- [x] Part 4: Reader UI & Dual-Engine Frontend (commit 701de7f)
- [x] Part 5: Master Orchestration & Integration (commit e9a5167)
- [x] Part 6: Autonomous Subagent Swarm Hardening (Commits 871e9fe, 975f479, e9d9931, b31f1b3, 29b2276, a94278e, 289da1d)
- [x] Part 7: Mechanical HDD Caching & Adaptive Streaming (Commits 3e22198, e83b8ab)
  - [x] Task 7.1: Fastify In-Memory ByteLRU Cache for WebP Pages & Manifests (256MB / 32MB bounds)
  - [x] Task 7.2: React 19 Adaptive Prefetch Controller with AbortController for High-Speed Scrolling
  - [x] Task 7.3: Webtoon Virtualizer Scroll Anchor Engine with Zero Layout Shifts
- [x] Part 8: Ergonomics, Resilience & Offline Autonomy (Commits db3b960, cae5da8, 1f1e183, 9c6d2ac, 9eff552)
  - [x] Task 8.1: Fastify ByteLRU Cold vs Hot Empirical Benchmark (92.31% hit ratio)
  - [x] Task 8.2: Automated SQLite WAL Maintenance & Checkpointing (`maintenance.ts`, 3/3 tests)
  - [x] Task 8.3: Local Offline WebP Cover Image Caching with Dynamic SVG Monogram Fallback (`cover-downloader.ts`, 8/8 tests)
  - [x] Task 8.4: Bottom Thumbnail Scrubber Drawer for Instant Visual Jumps (`ThumbnailScrubber.tsx`, 6/6 tests)
  - [x] Task 8.5: Double-Page Spread Mode & Shortcuts HUD for Manga (`MangaReader.tsx`, `ReaderControls.tsx`)
  - [x] Task 8.6: Fastify HTTP API Fuzzing, 5MB Body Limits (HTTP 413), and Abrupt Connection Teardowns (`http-fuzzing.test.ts`, 14/14 tests)
