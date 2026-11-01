# SDD ledger — plan: docs/superpowers/plans/2026-11-01-kura-scroll-master-plan.md

- **Status:** In Progress (Sprint 7: Mechanical HDD Caching & Adaptive Streaming)
- **Orchestrator:** Antigravity AI Orchestrator
- **Branch:** main (isolated in `C:\Users\Admin\dev\kura-scroll`)
- **Total Test Suites:** 22 test files, 102 passing tests (83 backend + 19 frontend, 100% PASS)

## Rulings & Decisions
- Ruling: Standalone Sibling Project ("Proyecto Hermano") chosen as requested by Carlos to prevent monolithic coupling with KuraStream while sharing branding/logo (KS).
- Ruling: Name "KuraScroll" selected because domain/brand is unoccupied, preserves "KS" acronym, and denotes vertical scrolling for webtoons and horizontal for manga.
- Ruling: Ahead-of-time WebP optimization (q=82, max width 1440px) chosen to guarantee ~85% disk reduction for the 4TB HDD constraint.
- Ruling: Native `node:sqlite` (`DatabaseSync` in Node v24) chosen instead of `better-sqlite3` to eliminate C++ compiler requirements on Windows while delivering native WAL mode, FTS5 full-text search, and zero-latency prepared statements.
- Ruling: Fastify 5 + `@fastify/static` with `maxAge: '1y'` and `immutable: true` configured to maximize client-side caching and eliminate disk seek latency on mechanical HDDs.
- Ruling: Dual-Engine React Reader built with Webtoon vertical strip (virtualized windowing & zero-CLS aspect ratio skeletons) and Manga RTL/LTR flipbook with keyboard navigation (`←`/`→`/`A`/`D`/`Space`).
- Ruling: Senior Architectural consultation with ChatGPT conducted via MCP Brave session, adopting a Byte-based LRU cache (256MB WebP buffers, 32MB manifests) and an Adaptive Prefetch Controller with `AbortController` cancellation for rapid scrolling.

## Task Execution State
- [x] Part 1: Storage & Ingestion Pipeline (commits db35ede, 77b80f3, 7f47935)
- [x] Part 2: Multilingual Metadata & Search Subsystem (commit f1fd8b4)
- [x] Part 3: Backend REST API & Chapter Delivery (commit c104b41)
- [x] Part 4: Reader UI & Dual-Engine Frontend (commit 701de7f)
- [x] Part 5: Master Orchestration & Integration (commit e9a5167)
- [x] Part 6: Autonomous Subagent Swarm Hardening (Commits 871e9fe, 975f479, e9d9931, b31f1b3, 29b2276, a94278e, 289da1d)
  - [x] Task 6.1: Incoming Folder Watcher & Auto-Ingest Daemon (`folder-watcher.ts`, 11/11 tests)
  - [x] Task 6.2: Kitsu Manga API Client fallback & triple-source resolution (`kitsu-client.ts`, 7/7 tests)
  - [x] Task 6.3: Reader UX Ergonomics, Background Presets & Percentage Pill (`ReaderControls.tsx`, 19/19 tests)
  - [x] Task 6.4: GSAP 3D Reader Animations & Ambilight Glow System (`MangaReader.tsx`, `WebtoonReader.tsx`)
  - [x] Task 6.5: 4TB Mechanical HDD Bottleneck Simulation & SQLite WAL Concurrency Benchmarks (`storage-stress.test.ts`, 6/6 tests)
  - [x] Task 6.6: Senior QA Edge-Case Fuzzing, Zip Slip, Unicode & Tall Strip Stress (`edge-cases.test.ts`, 24/24 tests)
- [ ] Part 7: Mechanical HDD Caching & Adaptive Streaming (In Progress)
  - [ ] Task 7.1: Fastify In-Memory ByteLRU Cache for WebP Pages & Manifests (256MB / 32MB bounds)
  - [ ] Task 7.2: React 19 Adaptive Prefetch Controller with AbortController for High-Speed Scrolling
  - [ ] Task 7.3: Webtoon Virtualizer Scroll Anchor Engine with Zero Layout Shifts
  - [ ] Task 7.4: Verification & Autonomous Reiteration
