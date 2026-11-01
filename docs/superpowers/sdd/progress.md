# SDD ledger — plan: docs/superpowers/plans/2026-11-01-kura-scroll-master-plan.md

- **Status:** In Progress
- **Active Sprint:** Part 4 - Reader UI & Dual-Engine Frontend
- **Orchestrator:** Antigravity AI Orchestrator
- **Branch:** main (isolated in `C:\Users\Admin\dev\kura-scroll`)

## Rulings & Decisions
- Ruling: Standalone Sibling Project ("Proyecto Hermano") chosen as requested by Carlos to prevent monolithic coupling with KuraStream while sharing branding/logo (KS).
- Ruling: Name "KuraScroll" selected because domain/brand is unoccupied, preserves "KS" acronym, and denotes vertical scrolling for webtoons and horizontal for manga.
- Ruling: Ahead-of-time WebP optimization (q=82, max width 1440px) chosen to guarantee ~85% disk reduction for the 4TB HDD constraint.
- Ruling: Native `node:sqlite` (`DatabaseSync` in Node v24) chosen instead of `better-sqlite3` to eliminate C++ compiler requirements on Windows while delivering native WAL mode, FTS5 full-text search, and zero-latency prepared statements.
- Ruling: Fastify 5 + `@fastify/static` with `maxAge: '1y'` and `immutable: true` configured to maximize client-side caching and eliminate disk seek latency on mechanical HDDs.

## Task Execution State
- [x] Part 1: Storage & Ingestion Pipeline
  - [x] Task 1.1: Project Initialization & Ingestion Engine Scaffolding (commits db35ede)
  - [x] Task 1.2: Natural Sorter & Archive Extractor with Zip Slip Protection (commits db35ede)
  - [x] Task 1.3: Image Optimizer & WebP Pipeline via Sharp (commits 77b80f3)
  - [x] Task 1.4: Chapter Ingestion Coordinator & Manifest Builder (commits 7f47935, 9/9 unit tests passing)
- [x] Part 2: Multilingual Metadata & Search Subsystem
  - [x] Task 2.1: SQLite Connection & Migration Engine (commits f1fd8b4)
  - [x] Task 2.2: Multilingual Search Repository (commits f1fd8b4)
  - [x] Task 2.3: MangaDex API v5 Client (commits f1fd8b4)
  - [x] Task 2.4: AniList GraphQL Client & Metadata Resolver (commits f1fd8b4, 20/20 unit tests passing)
- [x] Part 3: Backend REST API & Chapter Delivery
  - [x] Task 3.1: Fastify Server Setup & Static Storage Streaming (commits c104b41)
  - [x] Task 3.2: Series & Catalog API Routes (commits c104b41)
  - [x] Task 3.3: Chapter Manifest & Navigation Routes (commits c104b41)
  - [x] Task 3.4: Reading Progress Synchronization Routes (commits c104b41, 27/27 unit tests passing)
- [ ] Part 4: Reader UI & Dual-Engine Frontend
  - [ ] Task 4.1: Frontend App Scaffolding & Design System (KS Monogram)
  - [ ] Task 4.2: Multilingual Search & Catalog Grid
  - [ ] Task 4.3: Dual-Engine Reader Component (Webtoon + Manga RTL/LTR)
  - [ ] Task 4.4: Client-Side IndexedDB Storage & Progress Sync
- [ ] Part 5: Master Orchestration & Integration
  - [ ] Task 5.1: Root Workspace Orchestration & Environment Configuration
  - [ ] Task 5.2: CLI Ingestion Tool for 4TB Hard Drive Operations
  - [ ] Task 5.3: Full End-to-End Pipeline Verification
