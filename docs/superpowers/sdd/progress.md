# SDD ledger — plan: docs/superpowers/plans/2026-11-01-kura-scroll-master-plan.md

- **Status:** In Progress
- **Active Sprint:** Part 1 - Storage & Ingestion Pipeline
- **Orchestrator:** Antigravity AI Orchestrator
- **Branch:** main (isolated in `C:\Users\Admin\dev\kura-scroll`)

## Rulings & Decisions
- Ruling: Standalone Sibling Project ("Proyecto Hermano") chosen as requested by Carlos to prevent monolithic coupling with KuraStream while sharing branding/logo (KS).
- Ruling: Name "KuraScroll" selected because domain/brand is unoccupied, preserves "KS" acronym, and denotes vertical scrolling for webtoons and horizontal for manga.
- Ruling: Ahead-of-time WebP optimization (q=82, max width 1440px) chosen to guarantee ~85% disk reduction for the 4TB HDD constraint.
- Ruling: SQLite with WAL mode + FTS5 chosen for local-first zero-latency queries with instant full-text search across Japanese, Romaji, English, Spanish, and synonyms.

## Task Execution State
- [ ] Part 1: Storage & Ingestion Pipeline
  - [ ] Task 1.1: Project Initialization & Ingestion Engine Scaffolding
  - [ ] Task 1.2: Natural Sorter & Archive Extractor with Zip Slip Protection
  - [ ] Task 1.3: Image Optimizer & WebP Pipeline via Sharp
  - [ ] Task 1.4: Chapter Ingestion Coordinator & Manifest Builder
- [ ] Part 2: Multilingual Metadata & Search Subsystem
  - [ ] Task 2.1: SQLite Connection & Migration Engine
  - [ ] Task 2.2: Multilingual Search Repository
  - [ ] Task 2.3: MangaDex API v5 Client
  - [ ] Task 2.4: AniList GraphQL Client & Metadata Resolver
- [ ] Part 3: Backend REST API & Chapter Delivery
  - [ ] Task 3.1: Fastify Server Setup & Static Storage Streaming
  - [ ] Task 3.2: Series & Catalog API Routes
  - [ ] Task 3.3: Chapter Manifest & Navigation Routes
  - [ ] Task 3.4: Reading Progress Synchronization Routes
- [ ] Part 4: Reader UI & Dual-Engine Frontend
  - [ ] Task 4.1: Frontend App Scaffolding & Design System (KS Monogram)
  - [ ] Task 4.2: Multilingual Search & Catalog Grid
  - [ ] Task 4.3: Dual-Engine Reader Component (Webtoon + Manga RTL/LTR)
  - [ ] Task 4.4: Client-Side IndexedDB Storage & Progress Sync
- [ ] Part 5: Master Orchestration & Integration
  - [ ] Task 5.1: Root Workspace Orchestration & Environment Configuration
  - [ ] Task 5.2: CLI Ingestion Tool for 4TB Hard Drive Operations
  - [ ] Task 5.3: Full End-to-End Pipeline Verification
