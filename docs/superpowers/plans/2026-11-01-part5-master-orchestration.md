# KuraScroll - Part 5: Master Orchestration & Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the backend API, 4TB storage pipeline, multilingual search, and React frontend into a unified, high-performance local production deployment with automated end-to-end verification.

**Architecture:** A unified npm workspace coordinates the TypeScript Fastify backend and Vite React frontend. An ingestion CLI command (`npm run ingest -- --series <slug> --file <archive>`) enables batch processing directly into the 4TB storage directory. PowerShell and shell startup scripts launch the services concurrently with health checks and SQLite auto-migrations.

**Tech Stack:** Node.js v24, Fastify, React 19, Vite, Better-Sqlite3, Sharp, Concurrently, Playwright / Vitest E2E.

**Spec:** [2026-11-01-kura-scroll-design.md](file:///C:/Users/Admin/dev/kura-scroll/docs/superpowers/specs/2026-11-01-kura-scroll-design.md)

## Global Constraints

- Backend server port defaults to `4000`; Frontend port defaults to `5173`.
- Root package script `npm run dev` must boot both services concurrently with clear colored log prefixes.
- Health check verification: backend must pass `/health` and serve test WebP image with `200 OK` before frontend completes first render.
- CLI Ingestion tool must be executable via `npm run ingest` accepting arguments `--series`, `--vol`, `--chap`, and `--file`.

## Review Focus

1. **Port conflict handling:** If port 4000 or 5173 is already occupied, log an informative error with corrective guidance.
2. **Missing storage directory on first boot:** Auto-create `data/storage/` and `data/storage/covers` if they do not exist.
3. **End-to-end flow:** Ingest a real sample chapter -> verify SQLite record created -> verify WebP files written -> verify search finds series by Japanese & English -> verify reader loads chapter with zero layout shifts.
4. **Clean shutdown:** Handle `SIGINT` / `SIGTERM` gracefully, flushing SQLite WAL checkpoints and closing Fastify without file corruption.
5. **Disk space check:** Ingestion CLI prints warning if free disk space is under 10GB.

---

### Task 1: Root Workspace Orchestration & Environment Configuration

**Files:**
- Create: `package.json` (root workspace)
- Create: `.env.example`
- Create: `scripts/start-local.ps1`
- Test: `tests/e2e/health.test.ts`

**Interfaces:**
- Consumes: `.env` configuration file
- Produces: Coordinated development server running Fastify API on `:4000` and Vite on `:5173`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/e2e/health.test.ts
import { describe, it, expect } from 'vitest';
import fetch from 'undici';

describe('E2E Health & Startup', () => {
  it('backend exposes health endpoint returning 200 OK', async () => {
    // Note: expects dev server or app instance running on port 4000
    try {
      const res = await (await import('undici')).request('http://localhost:4000/health');
      expect(res.statusCode).toBe(200);
    } catch (e) {
      expect(e).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/e2e/health.test.ts`
Expected: FAIL (connection refused)

- [ ] **Step 3: Implement root configuration and startup scripts**

Configure root `package.json` with scripts:
```json
{
  "scripts": {
    "dev": "concurrently -n \"API,UI\" -c \"cyan,magenta\" \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "tsx watch src/backend/server.ts",
    "dev:frontend": "npm --prefix frontend run dev",
    "build": "npm run build:backend && npm --prefix frontend run build",
    "test": "vitest run"
  }
}
```
Create `scripts/start-local.ps1` for one-click launch on Windows.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/e2e/health.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json .env.example scripts/ tests/e2e/
git commit -m "feat(orchestration): setup unified workspace and startup scripts"
```

---

### Task 2: CLI Ingestion Tool for 4TB Hard Drive Operations

**Files:**
- Create: `src/backend/cli/ingest-cli.ts`
- Test: `tests/backend/cli/ingest-cli.test.ts`

**Interfaces:**
- CLI command: `npx tsx src/backend/cli/ingest-cli.ts --series <slug> --chap <num> --file <path> [--vol <num>] [--title <title>]`
- Produces: Automatic image optimization to WebP, directory placement in `/data/storage/`, database chapter & page registration.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/cli/ingest-cli.test.ts
import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../../../src/backend/cli/ingest-cli';

describe('parseCliArgs', () => {
  it('parses series, chapter, and file parameters accurately', () => {
    const args = ['--series', 'chainsaw-man', '--chap', '105', '--file', 'C:/scans/c105.cbz'];
    const parsed = parseCliArgs(args);
    expect(parsed.series).toBe('chainsaw-man');
    expect(parsed.chapter).toBe(105);
    expect(parsed.file).toBe('C:/scans/c105.cbz');
  });

  it('throws error when required arguments are omitted', () => {
    expect(() => parseCliArgs(['--series', 'chainsaw-man'])).toThrow(/missing required/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/cli/ingest-cli.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/backend/cli/ingest-cli.ts`**

Parse arguments with validation, call `ChapterIngestionService.ingestChapter()`, insert records into SQLite database via `ChapterRepository`, report compression savings percentage and duration in console.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/cli/ingest-cli.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/cli/ingest-cli.ts tests/backend/cli/ingest-cli.test.ts
git commit -m "feat(cli): implement chapter batch ingestion CLI tool"
```

---

### Task 3: Full End-to-End Pipeline Verification

**Files:**
- Create: `tests/e2e/full-pipeline.test.ts`

**Interfaces:**
- Runs the end-to-end integration:
  1. Boot database in memory / test file.
  2. Ingest mock chapter with raw JPEG scans.
  3. Query `MangaDex` / `AniList` mock to populate localized titles ("Kimetsu no Yaiba", "Demon Slayer", "鬼滅の刃").
  4. Search via `/api/v1/series?q=鬼滅` -> assert result found.
  5. Fetch chapter manifest `/api/v1/chapters/:id` -> assert all pages converted to `.webp`, aspect ratios present.
  6. Simulate reading progress update via `/api/v1/progress` -> assert persisted.

- [ ] **Step 1: Write the integration test**

```typescript
// tests/e2e/full-pipeline.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/backend/app';
import { createDatabase, runMigrations } from '../../src/backend/db/database';
import { SeriesRepository } from '../../src/backend/repositories/series-repository';
import { ChapterRepository } from '../../src/backend/repositories/chapter-repository';
import { ingestChapter } from '../../src/backend/services/chapter-ingestion-service';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

describe('Full Pipeline Integration', () => {
  const tmpRoot = path.join(__dirname, 'pipeline-test-storage');
  const rawChapterDir = path.join(tmpRoot, 'raw-chapter');
  let app: any;
  let db: any;

  beforeAll(async () => {
    await fs.mkdir(rawChapterDir, { recursive: true });
    // Generate 3 sample manga pages
    for (let i = 1; i <= 3; i++) {
      await sharp({
        create: { width: 1200, height: 1800, channels: 3, background: { r: 50, g: 100, b: 150 } }
      }).png().toFile(path.join(rawChapterDir, `page_${i}.png`));
    }

    db = createDatabase(':memory:');
    runMigrations(db);
    app = buildApp({ db, storageRoot: tmpRoot });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    db.close();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('successfully executes ingestion, multilingual query, chapter manifest, and progress', async () => {
    const seriesRepo = new SeriesRepository(db);
    const chapRepo = new ChapterRepository(db);

    // 1. Create series with aliases
    seriesRepo.createSeries({
      id: 'kny',
      slug: 'kimetsu-no-yaiba',
      titlePrimary: 'Demon Slayer: Kimetsu no Yaiba',
      type: 'manga',
      status: 'completed'
    });
    seriesRepo.addSeriesTitles('kny', [
      { languageCode: 'ja', title: '鬼滅の刃' },
      { languageCode: 'es', title: 'Guardianes de la Noche' },
      { languageCode: 'en', title: 'Demon Slayer' }
    ]);

    // 2. Ingest chapter files
    const ingestResult = await ingestChapter({
      storageRoot: tmpRoot,
      seriesSlug: 'kimetsu-no-yaiba',
      volumeNumber: 1,
      chapterNumber: 1,
      sourcePath: rawChapterDir,
      isArchive: false
    });

    expect(ingestResult.pageCount).toBe(3);

    // 3. Register chapter in db
    chapRepo.createChapter({
      id: 'chap-1',
      seriesId: 'kny',
      chapterNumber: 1,
      title: 'Cruelty',
      storagePath: ingestResult.relativeStorageDir
    });
    chapRepo.addPages('chap-1', ingestResult.pages);

    // 4. Verify search via API
    const searchRes = await app.inject({ method: 'GET', url: '/api/v1/series?q=Guardianes' });
    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.json().items[0].slug).toBe('kimetsu-no-yaiba');

    // 5. Verify chapter manifest via API
    const chapRes = await app.inject({ method: 'GET', url: '/api/v1/chapters/chap-1' });
    expect(chapRes.statusCode).toBe(200);
    expect(chapRes.json().pages.length).toBe(3);
    expect(chapRes.json().pages[0].fileName).toBe('001.webp');

    // 6. Verify progress recording
    const progRes = await app.inject({
      method: 'POST',
      url: '/api/v1/progress',
      payload: { userId: 'carlos', seriesId: 'kny', chapterId: 'chap-1', pageNumber: 3, scrollOffsetY: 0, isCompleted: true }
    });
    expect(progRes.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it passes once components are in place**

Run: `npx vitest run tests/e2e/full-pipeline.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/full-pipeline.test.ts
git commit -m "test(e2e): implement comprehensive full-pipeline integration test"
```
