# KuraScroll - Part 3: Backend REST API & Chapter Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fastify REST API, high-performance static image streaming with aggressive HTTP caching, chapter manifest endpoints, and user reading progress synchronization.

**Architecture:** Fastify server provides high-throughput endpoints. Image assets from the 4TB storage directory are served using Fastify `@fastify/static` with strict cache headers (`Cache-Control: public, max-age=31536000, immutable`) and ETags so mechanical HDD reads are eliminated once cached by the browser. Chapter endpoints deliver pre-computed dimensions and adjacent chapter pointers (`prevChapterId`, `nextChapterId`) for seamless reader progression.

**Tech Stack:** Node.js v24, TypeScript, Fastify, `@fastify/cors`, `@fastify/static`, Supertest / Fastify Inject, Vitest.

**Spec:** [2026-11-01-kura-scroll-design.md](file:///C:/Users/Admin/dev/kura-scroll/docs/superpowers/specs/2026-11-01-kura-scroll-design.md)

## Global Constraints

- API endpoints must be prefixed with `/api/v1/`.
- Cross-Origin Resource Sharing (CORS) must be enabled for local development (`http://localhost:5173` and local network origins).
- Static image routes must return `immutable` cache headers and support standard `304 Not Modified` conditional requests.
- Chapter manifests must return `pages` in ascending `pageNumber` order along with precomputed `aspectRatio` for zero layout shifts.
- Progress updates must support unauthenticated guest tracking via client UUID or local user fallback.

## Review Focus

1. **Static image delivery bottlenecks:** Ensure static image serving streams files asynchronously without loading full images into Node.js buffer memory.
2. **Missing chapter boundaries:** Ensure `nextChapterId` and `prevChapterId` navigation pointers handle fractional chapters (e.g. 10.5 after 10) and boundary limits (first and last chapter) correctly.
3. **CORS preflight rejection:** Local frontend requests from Vite dev server must pass CORS headers without blocking image canvas or WebP requests.
4. **Invalid slug or missing chapter errors:** Return standardized JSON error payloads `{ statusCode: 404, error: "Not Found", message: string }`.
5. **Concurrent reading progress race conditions:** Upserting progress records in `user_progress` must use SQLite `ON CONFLICT(user_id, series_id) DO UPDATE` to avoid duplicate constraint errors.

---

### Task 1: Fastify Server Setup & Static Storage Streaming

**Files:**
- Create: `src/backend/app.ts`
- Create: `src/backend/server.ts`
- Test: `tests/backend/routes/static-storage.test.ts`

**Interfaces:**
- Consumes: Storage root path, port, host configuration.
- Produces: `buildApp(options?: AppOptions): FastifyInstance` with static file streaming and CORS.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/routes/static-storage.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Fastify Static Storage & Health', () => {
  const testStorage = path.join(__dirname, 'tmp-static-test');
  let app: any;

  beforeAll(async () => {
    await fs.mkdir(testStorage, { recursive: true });
    await fs.writeFile(path.join(testStorage, 'test.webp'), 'dummy-webp-binary');
    app = buildApp({ storageRoot: testStorage });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(testStorage, { recursive: true, force: true });
  });

  it('responds with 200 on /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('serves static storage files with immutable cache header', async () => {
    const res = await app.inject({ method: 'GET', url: '/storage/test.webp' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/routes/static-storage.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/backend/app.ts`**

Register `@fastify/cors` with permissive origin options. Register `@fastify/static` serving prefix `/storage/` pointing to `storageRoot` with `maxAge: '1y'` and `immutable: true`. Add `/health` route.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/routes/static-storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/app.ts src/backend/server.ts tests/backend/routes/static-storage.test.ts
git commit -m "feat(api): implement Fastify server with static storage streaming and CORS"
```

---

### Task 2: Series & Catalog API Routes

**Files:**
- Create: `src/backend/routes/series-routes.ts`
- Test: `tests/backend/routes/series-routes.test.ts`

**Interfaces:**
- Endpoints:
  - `GET /api/v1/series?q=&type=&status=&page=&limit=`
  - `GET /api/v1/series/:slug`
  - `POST /api/v1/series`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/routes/series-routes.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';
import Database from 'better-sqlite3';

describe('Series Routes', () => {
  let app: any;
  let db: Database.Database;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    const repo = new SeriesRepository(db);
    repo.createSeries({
      id: 'solo-leveling',
      slug: 'solo-leveling',
      titlePrimary: 'Solo Leveling',
      type: 'manhwa',
      status: 'completed',
      synopsis: 'Sung Jinwoo ascends as the Shadow Monarch.'
    });
    repo.addSeriesTitles('solo-leveling', [
      { languageCode: 'ko', title: '나 혼자만 레벨업' },
      { languageCode: 'en', title: 'Solo Leveling' }
    ]);

    app = buildApp({ db, storageRoot: './tmp' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/series returns catalog list and responds to search queries', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/series' });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items.length).toBe(1);

    const searchRes = await app.inject({ method: 'GET', url: '/api/v1/series?q=레벨업' });
    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.json().items.length).toBe(1);
    expect(searchRes.json().items[0].slug).toBe('solo-leveling');
  });

  it('GET /api/v1/series/:slug returns series details', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/series/solo-leveling' });
    expect(res.statusCode).toBe(200);
    expect(res.json().titlePrimary).toBe('Solo Leveling');
    expect(res.json().titles.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/routes/series-routes.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/backend/routes/series-routes.ts`**

Implement catalog filtering (type, status), multilingual full-text query dispatching to `SeriesRepository`, detail query with related titles and volumes. Return typed JSON responses.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/routes/series-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/routes/series-routes.ts tests/backend/routes/series-routes.test.ts
git commit -m "feat(api): implement series catalog and search endpoints"
```

---

### Task 3: Chapter Manifest & Navigation Routes

**Files:**
- Create: `src/backend/repositories/chapter-repository.ts`
- Create: `src/backend/routes/chapter-routes.ts`
- Test: `tests/backend/routes/chapter-routes.test.ts`

**Interfaces:**
- Endpoints:
  - `GET /api/v1/chapters/:chapterId` -> returns `{ chapter, pages: [...], prevChapterId, nextChapterId }`
  - `POST /api/v1/chapters/ingest` -> accepts source archive / path and registers chapter in database

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/routes/chapter-routes.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations } from '../../../src/backend/db/database';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository';
import Database from 'better-sqlite3';

describe('Chapter Routes & Navigation Pointers', () => {
  let app: any;
  let db: Database.Database;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    const chapRepo = new ChapterRepository(db);

    db.prepare(`INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s1', 'one-piece', 'One Piece', 'manga', 'ongoing')`).run();

    chapRepo.createChapter({ id: 'c1', seriesId: 's1', chapterNumber: 1, title: 'Romance Dawn', storagePath: 'series/one-piece/v1/c1' });
    chapRepo.createChapter({ id: 'c2', seriesId: 's1', chapterNumber: 2, title: 'Luffy', storagePath: 'series/one-piece/v1/c2' });
    chapRepo.addPages('c1', [
      { pageNumber: 1, fileName: '001.webp', width: 1440, height: 2160, aspectRatio: 0.666 },
      { pageNumber: 2, fileName: '002.webp', width: 1440, height: 2160, aspectRatio: 0.666 }
    ]);

    app = buildApp({ db, storageRoot: './tmp' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('returns chapter manifest with pages and next/prev pointers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/chapters/c1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.chapter.chapterNumber).toBe(1);
    expect(body.pages.length).toBe(2);
    expect(body.prevChapterId).toBeNull();
    expect(body.nextChapterId).toBe('c2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/routes/chapter-routes.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `ChapterRepository` and `chapter-routes.ts`**

Query chapter details and pages ordered by `page_number ASC`. Query `prevChapterId` (`chapter_number < current ORDER BY chapter_number DESC LIMIT 1`) and `nextChapterId` (`chapter_number > current ORDER BY chapter_number ASC LIMIT 1`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/routes/chapter-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/repositories/chapter-repository.ts src/backend/routes/chapter-routes.ts tests/
git commit -m "feat(api): implement chapter manifest and adjacent navigation endpoints"
```

---

### Task 4: Reading Progress Synchronization Routes

**Files:**
- Create: `src/backend/routes/progress-routes.ts`
- Test: `tests/backend/routes/progress-routes.test.ts`

**Interfaces:**
- Endpoints:
  - `GET /api/v1/progress/:seriesId?userId=` -> returns latest read chapter and page offset
  - `POST /api/v1/progress` -> upserts `{ userId, seriesId, chapterId, pageNumber, scrollOffsetY, isCompleted }`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/routes/progress-routes.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations } from '../../../src/backend/db/database';
import Database from 'better-sqlite3';

describe('Progress Routes', () => {
  let app: any;
  let db: Database.Database;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    db.prepare(`INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s1', 'chainsaw-man', 'Chainsaw Man', 'manga', 'ongoing')`).run();
    db.prepare(`INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES ('c1', 's1', 1, 'path')`).run();

    app = buildApp({ db, storageRoot: './tmp' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('upserts reading progress cleanly without duplicate error', async () => {
    const payload = {
      userId: 'carlos_local',
      seriesId: 's1',
      chapterId: 'c1',
      pageNumber: 18,
      scrollOffsetY: 1250.5,
      isCompleted: false
    };

    const res1 = await app.inject({ method: 'POST', url: '/api/v1/progress', payload });
    expect(res1.statusCode).toBe(200);

    // Update with new offset
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/progress',
      payload: { ...payload, pageNumber: 19, isCompleted: true }
    });
    expect(res2.statusCode).toBe(200);

    const getRes = await app.inject({ method: 'GET', url: '/api/v1/progress/s1?userId=carlos_local' });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().pageNumber).toBe(19);
    expect(getRes.json().isCompleted).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/routes/progress-routes.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `progress-routes.ts`**

Execute SQLite `INSERT INTO user_progress (...) VALUES (...) ON CONFLICT(user_id, series_id) DO UPDATE SET chapter_id = excluded.chapter_id, page_number = excluded.page_number, scroll_offset_y = excluded.scroll_offset_y, is_completed = excluded.is_completed, updated_at = CURRENT_TIMESTAMP`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/routes/progress-routes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/routes/progress-routes.ts tests/backend/routes/progress-routes.test.ts
git commit -m "feat(api): implement reading progress upsert and sync routes"
```
