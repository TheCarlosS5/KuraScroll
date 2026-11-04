# KuraScroll GitHub Deployment & Total Emoji Eradication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Overview & Goals
Carlos requested to prepare the KuraScroll platform for public/private GitHub deployment under his account (`TheCarlosS5`), establishing its role as the sister platform to [`TheCarlosS5/KuraStream`](https://github.com/TheCarlosS5/KuraStream).
Before committing and pushing, all emojis across the entire platform (frontend UI, HUDs, buttons, modals, toasts, console logs, seeders, SVG mockups) must be eradicated and replaced with high-end typography and Lucide React SVG icons (following Emil Kowalski design engineering principles).
All 466 test suites and 98 hardware SLAs must pass with 100% compliance.

---

## Delegated Subagent Team (Up to 6 Agents)
1. **Agent 1 (`manga-ux-designer`):** Frontend Reader & HUDs Emoji Eradication (all 70+ HUD components in `frontend/src/components/reader/`, replacement with clean Lucide icons and sleek text tags).
2. **Agent 2 (`user-perspective-critic`):** Frontend Habits, Modals, Navigation & Pages (clean `Navbar.tsx`, `BadgeGridModal.tsx`, `DailyGoalModal.tsx`, `DailyGoalRing.tsx`, `CatalogPage.tsx`, `SeriesDetailPage.tsx`, `HistoryPage.tsx`, `ReaderPage.tsx`).
3. **Agent 3 (`backend-performance-tester`):** Backend & CLI Zero-Emoji Logging (clean `src/backend/server.ts`, `folder-watcher.ts`, `maintenance.ts`, `ingest-pdf-mangas.ts`, `purge-test-data.ts`, `seed-demo-data.ts`).
4. **Agent 4 (`metadata-deep-researcher`):** SVG Assets, Demo Seeder & CJK Resiliency (replace emoji graphics like `⚡` and `★` in SVG covers and pages with clean vector monograms `KS` and bullet separators; verify FTS5 queries).
5. **Agent 5 (`qa-resilience-tester`):** Full Test Suite Green Verification & Unit Test Assertion Harmonization (update frontend and backend tests that assert on previous button text/tags, run `npm test` and `npm run test:frontend`, ensure 100% PASS).
6. **Agent 6 (`devops-watcher`):** Git Repository Audit, `.gitignore` Hardening, Sister Platform `README.md` & GitHub Remote Configuration (`https://github.com/TheCarlosS5/KuraScroll.git` referencing `https://github.com/TheCarlosS5/KuraStream`).

---

## Detailed Task Decomposition

### Task 1: Reader HUDs Emoji Removal (`manga-ux-designer`)
- [ ] **1.1** Run `scripts/eradicate-emojis.ts` to apply the bulk replacements across reader HUDs.
- [ ] **1.2** Audit all 70+ HUD files in `frontend/src/components/reader/` to verify zero emojis remain. Replace close buttons with `<button ... aria-label="Cerrar">&times;</button>` or `<X className="w-4 h-4" />`.
- [ ] **1.3** In `frontend/src/reader/useAmbientSoundscape.ts`, verify track icons are clean identifiers (`rain`, `campfire`, `wind`, `tavern`, `mystery`, `lofi_zen`).

### Task 2: Habits, Modals & Navigation Design Polish (`user-perspective-critic`)
- [ ] **2.1** Inspect `frontend/src/components/habits/BadgeGridModal.tsx`: ensure category tabs use clean text (`Volumen`, `Racha`, `Horarios`, `Explorador`, `Colección`) and badges show `Unlocked`/`Locked` or clean icons.
- [ ] **2.2** Inspect `frontend/src/components/habits/DailyGoalModal.tsx` & `DailyGoalRing.tsx`: ensure goal inputs use `Páginas leídas` and `Minutos de lectura` without emojis.
- [ ] **2.3** Inspect `frontend/src/components/common/Navbar.tsx`: verify no emojis in tooltips, labels, or badges.
- [ ] **2.4** Inspect `frontend/src/pages/ReaderPage.tsx`: verify bookmark toast does not contain `📌`.

### Task 3: Backend, Daemon & CLI Clean Logging (`backend-performance-tester`)
- [ ] **3.1** In `src/backend/server.ts`, verify startup messages use `[KuraScroll] Backend API active at:` and `[KuraScroll] Storage engine mounted at:`.
- [ ] **3.2** In `src/backend/daemon/folder-watcher.ts` and `src/backend/db/maintenance.ts`, replace `✔` and `✖` terminal outputs with `[OK]` and `[ERROR]`.
- [ ] **3.3** In `scripts/ingest-pdf-mangas.ts` and `scripts/purge-test-data.ts`, replace terminal icons with structured bracket tags (`[Ingest]`, `[Clean]`, `[Purge]`, `[Warn]`).

### Task 4: SVG Vector Artwork & Demo Seeder Polish (`metadata-deep-researcher`)
- [ ] **4.1** In `scripts/seed-demo-data.ts`, replace `<text>⚡</text>` with `<text>KS</text>` in cover generator SVG.
- [ ] **4.2** Replace `★` with `•` in genre metadata SVG line.
- [ ] **4.3** Run `cd C:\Users\Admin\dev\kura-scroll ; npx tsx scripts/seed-demo-data.ts` to re-generate clean WebP covers and pages without emojis.

### Task 5: Harmonize Test Assertions & Verify 100% Green (`qa-resilience-tester`)
- [ ] **5.1** Update test files matching modified text:
  - `frontend/src/tests/AmbientSoundscapeHUD.test.tsx`
  - `frontend/src/tests/DialogueJumpHUD.test.tsx`
  - `frontend/src/tests/PanelPacingHUD.test.tsx`
  - `frontend/src/tests/ReadingDwellHUD.test.tsx`
  - `frontend/src/tests/TextEqualizerHUD.test.tsx`
  - `frontend/src/tests/VectorQuantizerHUD.test.tsx`
  - `frontend/tests/components/BadgeGridModal.test.tsx`
  - `frontend/tests/components/DailyGoalModal.test.tsx`
  - `frontend/tests/components/DailyGoalRing.test.tsx`
  - `frontend/tests/components/OfflineMutationOutboxHUD.test.tsx`
  - `frontend/tests/components/ReadingDwellHeatmapOverlay.test.tsx`
- [ ] **5.2** Run `npm run test:frontend` and confirm 220/220 test files pass (100% PASS).
- [ ] **5.3** Run `npm test` and confirm all 292 backend test files pass (100% PASS).
- [ ] **5.4** Run `npx tsx scripts/benchmark-sla.ts` and confirm all 98 Hardware SLAs pass (100% PASS).

### Task 6: GitHub Architecture README, .gitignore Audit & Remote Setup (`devops-watcher`)
- [ ] **6.1** Audit `.gitignore`: ensure `data/storage/`, `data/kura-scroll.db*`, `node_modules/`, `dist/`, `.env`, and log files are strictly excluded from git.
- [ ] **6.2** Create a comprehensive, flagship `README.md` in repository root:
  - Highlight KuraScroll as the official sister platform to [KuraStream](https://github.com/TheCarlosS5/KuraStream).
  - Architecture diagram (Fastify 5 + React 19 + SQLite WAL + WebP reader).
  - Hardware profile constraints (Intel Pentium T4500, Intel GMA 4500MHD, 4TB HDD).
  - 98 Hardware SLAs verified.
  - Zero-emoji minimalist dark-mode design engineering.
- [ ] **6.3** Configure git remote `origin` to `https://github.com/TheCarlosS5/KuraScroll.git`.
- [ ] **6.4** Verify `git status` shows only clean, tracked files ready to be pushed.
