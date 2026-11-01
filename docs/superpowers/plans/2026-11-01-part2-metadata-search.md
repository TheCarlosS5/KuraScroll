# KuraScroll - Part 2: Multilingual Metadata & Search Subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the database storage layer (SQLite WAL mode), multilingual full-text search (FTS5), and external API integration (MangaDex v5 + AniList GraphQL) for automatic title, synopsis, tag, and alias resolution.

**Architecture:** A repository layer backed by `better-sqlite3` runs database migrations and exposes strongly-typed query methods. An FTS5 virtual table indexes localized titles (`ja`, `ja-ro`, `en`, `es`, `ko`, `zh`) with SQLite triggers. Dedicated clients communicate with MangaDex REST and AniList GraphQL to query and hydrate series metadata with zero duplicate records.

**Tech Stack:** Node.js v24, TypeScript, Better-Sqlite3, Undici / Native Fetch, Vitest.

**Spec:** [2026-11-01-kura-scroll-design.md](file:///C:/Users/Admin/dev/kura-scroll/docs/superpowers/specs/2026-11-01-kura-scroll-design.md)

## Global Constraints

- SQLite database must use Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) and enforce foreign keys (`PRAGMA foreign_keys = ON;`).
- Multi-language search must resolve interchangeably: typing "Kimetsu no Yaiba", "Demon Slayer", "Guardianes de la Noche", or "鬼滅の刃" must retrieve the identical series record.
- External API calls must feature timeout limits (5000ms), user-agent identification, and graceful fallbacks when offline.
- Data consistency: Inserting or deleting titles in `series_titles` automatically synchronizes `series_search_fts` via triggers.

## Review Focus

1. **FTS5 special character escaping:** Queries containing punctuation, dashes, or quotes (e.g. `SPY x FAMILY`, `Re:Zero`, `Solo-Leveling`) must not trigger SQLite FTS5 syntax errors.
2. **AniList / MangaDex rate limiting:** Respect external API rate limits and handle HTTP 429 / 5xx cleanly without crashing the server.
3. **Foreign key cascade deletions:** Deleting a series must cascade cleanly to `series_titles`, `series_genres`, `volumes`, `chapters`, and `chapter_pages`.
4. **Duplicate series prevention:** Disallow creating duplicate series under the same normalized slug or duplicate external IDs.
5. **Decimal chapter numbers:** Database schema must support float chapter values (`10.5`, `0.1`, `99.2`) without floating point truncation.

---

### Task 1: SQLite Connection & Migration Engine

**Files:**
- Create: `src/backend/db/database.ts`
- Create: `src/backend/db/schema.sql`
- Create: `src/backend/db/migrate.ts`
- Test: `tests/backend/db/database.test.ts`

**Interfaces:**
- Consumes: Database file path (e.g. `./data/kura-scroll.db` or `:memory:`)
- Produces: `getDb(dbPath?: string): Database.Database` and `runMigrations(db: Database.Database): void`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/db/database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations } from '../../../src/backend/db/database';
import Database from 'better-sqlite3';

describe('Database and Migrations', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('enables WAL mode and foreign keys', () => {
    const fk = db.pragma('foreign_keys', { simple: true });
    expect(fk).toBe(1);
  });

  it('creates all required tables including series, series_titles and series_search_fts', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);

    expect(tables).toContain('series');
    expect(tables).toContain('series_titles');
    expect(tables).toContain('series_search_fts');
    expect(tables).toContain('volumes');
    expect(tables).toContain('chapters');
    expect(tables).toContain('chapter_pages');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/db/database.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement SQLite connection and DDL migration**

Load `schema.sql` containing full DDL from design spec with FTS5 table and triggers. Configure `better-sqlite3` instance with pragmas (`foreign_keys = ON`, `journal_mode = WAL`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/db/database.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/db/ tests/backend/db/
git commit -m "feat(db): implement SQLite WAL schema and migration engine"
```

---

### Task 2: Multilingual Search Repository

**Files:**
- Create: `src/backend/repositories/series-repository.ts`
- Create: `src/backend/utils/fts-sanitizer.ts`
- Test: `tests/backend/repositories/series-repository.test.ts`
- Test: `tests/backend/utils/fts-sanitizer.test.ts`

**Interfaces:**
- Consumes: Database instance, series data, search query string.
- Produces: 
  - `createSeries(data: InsertSeriesInput): Series`
  - `addSeriesTitles(seriesId: string, titles: { languageCode: string, title: string, isPrimary?: boolean }[]): void`
  - `searchSeries(query: string, limit?: number): Series[]`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/backend/utils/fts-sanitizer.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeFtsQuery } from '../../../src/backend/utils/fts-sanitizer';

describe('sanitizeFtsQuery', () => {
  it('strips special FTS characters and formats words into prefix tokens', () => {
    expect(sanitizeFtsQuery('SPY x FAMILY')).toBe('"SPY"* "x"* "FAMILY"*');
    expect(sanitizeFtsQuery('Re:Zero - Starting')).toBe('"Re"* "Zero"* "Starting"*');
  });
});

// tests/backend/repositories/series-repository.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';
import Database from 'better-sqlite3';

describe('SeriesRepository multilingual search', () => {
  let db: Database.Database;
  let repo: SeriesRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    repo = new SeriesRepository(db);

    repo.createSeries({
      id: 'demon-slayer',
      slug: 'demon-slayer',
      titlePrimary: 'Demon Slayer: Kimetsu no Yaiba',
      type: 'manga',
      status: 'completed'
    });

    repo.addSeriesTitles('demon-slayer', [
      { languageCode: 'en', title: 'Demon Slayer: Kimetsu no Yaiba', isPrimary: true },
      { languageCode: 'ja-ro', title: 'Kimetsu no Yaiba' },
      { languageCode: 'ja', title: '鬼滅の刃' },
      { languageCode: 'es', title: 'Guardianes de la Noche' }
    ]);
  });

  afterEach(() => {
    db.close();
  });

  it('retrieves the same series searching by Romaji, English, Spanish or Kanji', () => {
    const byRomaji = repo.searchSeries('Kimetsu');
    expect(byRomaji.length).toBe(1);
    expect(byRomaji[0].id).toBe('demon-slayer');

    const bySpanish = repo.searchSeries('Guardianes de la Noche');
    expect(bySpanish.length).toBe(1);
    expect(bySpanish[0].id).toBe('demon-slayer');

    const byKanji = repo.searchSeries('鬼滅');
    expect(byKanji.length).toBe(1);
    expect(byKanji[0].id).toBe('demon-slayer');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/utils/fts-sanitizer.test.ts tests/backend/repositories/series-repository.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `sanitizeFtsQuery` and `SeriesRepository`**

Implement sanitization in `fts-sanitizer.ts`. In `SeriesRepository`, construct prepared statements for insertion and querying `series_search_fts` joined with `series`. Deduplicate results by `series.id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/utils/fts-sanitizer.test.ts tests/backend/repositories/series-repository.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/repositories/ src/backend/utils/fts-sanitizer.ts tests/
git commit -m "feat(metadata): implement SeriesRepository and multilingual FTS search"
```

---

### Task 3: MangaDex API v5 Client

**Files:**
- Create: `src/backend/clients/mangadex-client.ts`
- Test: `tests/backend/clients/mangadex-client.test.ts`

**Interfaces:**
- Consumes: Search query string or MangaDex UUID
- Produces: `searchMangaDex(query: string): Promise<MangaDexSearchResult[]>` extracting canonical titles, `altTitles` (all languages), synopsis, publication status, and cover artwork URL.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/clients/mangadex-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MangaDexClient } from '../../../src/backend/clients/mangadex-client';

describe('MangaDexClient', () => {
  it('parses title and altTitles array correctly from MangaDex v5 JSON response', async () => {
    const mockResponse = {
      result: 'ok',
      data: [
        {
          id: '1e74ab46-bda8-493e-bcaa-6d1a50f1a91e',
          type: 'manga',
          attributes: {
            title: { en: 'SPY×FAMILY' },
            altTitles: [
              { ja: 'スパイファミリー' },
              { 'ja-ro': 'Spy x Family' },
              { es: 'Spy x Family (España)' }
            ],
            description: { en: 'A master spy...' },
            status: 'ongoing',
            originalLanguage: 'ja'
          }
        }
      ]
    };

    const client = new MangaDexClient({
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as any)
    });

    const results = await client.search('Spy Family');
    expect(results.length).toBe(1);
    expect(results[0].primaryTitle).toBe('SPY×FAMILY');
    expect(results[0].titles).toContainEqual({ languageCode: 'ja', title: 'スパイファミリー' });
    expect(results[0].titles).toContainEqual({ languageCode: 'ja-ro', title: 'Spy x Family' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/clients/mangadex-client.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `MangaDexClient`**

Fetch `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&includes[]=cover_art`. Parse the nested localized dictionary structures safely, normalize language tags, extract highest-resolution cover URL, return typed DTOs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/clients/mangadex-client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/clients/mangadex-client.ts tests/backend/clients/mangadex-client.test.ts
git commit -m "feat(clients): implement MangaDex v5 client with altTitles parsing"
```

---

### Task 4: AniList GraphQL Client & Metadata Resolver

**Files:**
- Create: `src/backend/clients/anilist-client.ts`
- Create: `src/backend/services/metadata-resolver-service.ts`
- Test: `tests/backend/clients/anilist-client.test.ts`
- Test: `tests/backend/services/metadata-resolver-service.test.ts`

**Interfaces:**
- Consumes: Manga title / query string.
- Produces: `resolveMetadata(query: string): Promise<ResolvedSeriesMetadata>` merging AniList (Romaji, English, Native, Synonyms) and MangaDex attributes with deduplication.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/backend/clients/anilist-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AniListClient } from '../../../src/backend/clients/anilist-client';

describe('AniListClient', () => {
  it('extracts romaji, english, native titles and synonyms', async () => {
    const mockGqlResponse = {
      data: {
        Page: {
          media: [
            {
              id: 30002,
              title: {
                romaji: 'Berserk',
                english: 'Berserk',
                native: 'ベルセルク'
              },
              synonyms: ['Berserk: The Prototype', 'Kenpuu Denki Berserk'],
              status: 'RELEASING',
              format: 'MANGA',
              genres: ['Action', 'Dark Fantasy', 'Horror']
            }
          ]
        }
      }
    };

    const client = new AniListClient({
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGqlResponse
      } as any)
    });

    const results = await client.search('Berserk');
    expect(results.length).toBe(1);
    expect(results[0].titleRomaji).toBe('Berserk');
    expect(results[0].titleNative).toBe('ベルセルク');
    expect(results[0].synonyms).toContain('Kenpuu Denki Berserk');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/clients/anilist-client.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement AniList GraphQL client and Resolver Service**

Send POST to `https://graphql.anilist.co` with GraphQL query for `Page { media(search: $search, type: MANGA) }`. Build `MetadataResolverService` that queries AniList and MangaDex, normalizes genre names, gathers all localized variations, and produces clean database input records.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/clients/anilist-client.test.ts tests/backend/services/metadata-resolver-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/clients/anilist-client.ts src/backend/services/metadata-resolver-service.ts tests/
git commit -m "feat(metadata): implement AniList GraphQL client and unified MetadataResolverService"
```
