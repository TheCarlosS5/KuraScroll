# KuraScroll - Part 1: Storage & Ingestion Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the high-efficiency image ingestion, archive extraction (CBZ/ZIP), and WebP conversion pipeline optimized for mechanical 4TB HDD storage.

**Architecture:** An asynchronous pipeline extracts incoming archive or folder uploads, detects page image formats, processes images concurrently using `sharp` (libvips), resizes images to a maximum width of 1440px, strips EXIF data, converts to WebP (q=82), extracts dimensions (width, height, aspect ratio) for zero layout shift, and writes structured outputs to `/storage/series/<slug>/<vol>/<chap>/`.

**Tech Stack:** Node.js v24, TypeScript, Sharp (libvips), Adm-Zip, Vitest.

**Spec:** [2026-11-01-kura-scroll-design.md](file:///C:/Users/Admin/dev/kura-scroll/docs/superpowers/specs/2026-11-01-kura-scroll-design.md)

## Global Constraints

- Storage root directory must default to `./data/storage` (configurable via `STORAGE_ROOT` environment variable).
- Target image format is strictly WebP at 82% quality; max width is 1440px (preserve native height proportionally).
- Zero layout shift: each processed page must output a metadata record `{ pageNumber, fileName, width, height, aspectRatio }`.
- Natural alphanumeric sort order for pages (e.g., `page_1.png`, `page_2.png`, `page_10.png` must NOT sort as `1, 10, 2`).
- Safe archive extraction: prevent Zip Slip vulnerabilities (ensure extracted paths do not escape target directory).

## Review Focus

1. **Zip Slip path traversal in CBZ/ZIP archives:** Ensure malicious archive entry names (e.g. `../../evil.png`) are rejected or sanitized.
2. **Natural sort order misordering:** Pages numbered without leading zeroes must sort in natural numerical order.
3. **Corrupted or non-image files inside archives:** Silently ignore OS artifacts like `.DS_Store`, `Thumbs.db` or fail gracefully on damaged images.
4. **Memory spike under large chapters:** Stream or limit concurrent Sharp conversions using a bounded p-limit pool to prevent Node.js OOM crashes.
5. **Disk write integrity:** Atomic or verified writes so partially converted chapters are not left corrupted on disk if interrupted.

---

### Task 1: Project Initialization & Ingestion Engine Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/backend/config/storage-config.ts`
- Test: `tests/backend/config/storage-config.test.ts`

**Interfaces:**
- Consumes: Environment variables (`STORAGE_ROOT`, `MAX_IMAGE_WIDTH`, `WEBP_QUALITY`)
- Produces: `StorageConfig` object `{ storageRoot: string, maxImageWidth: number, webpQuality: number }`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/config/storage-config.test.ts
import { describe, it, expect } from 'vitest';
import { getStorageConfig } from '../../../src/backend/config/storage-config';

describe('getStorageConfig', () => {
  it('returns default storage configuration when env vars are missing', () => {
    const config = getStorageConfig({});
    expect(config.storageRoot).toContain('storage');
    expect(config.maxImageWidth).toBe(1440);
    expect(config.webpQuality).toBe(82);
  });

  it('respects custom environment overrides', () => {
    const config = getStorageConfig({
      STORAGE_ROOT: 'D:/MangaDrive',
      MAX_IMAGE_WIDTH: '1600',
      WEBP_QUALITY: '90'
    });
    expect(config.storageRoot).toBe('D:/MangaDrive');
    expect(config.maxImageWidth).toBe(1600);
    expect(config.webpQuality).toBe(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/config/storage-config.test.ts`
Expected: FAIL with "module not found" or "cannot find getStorageConfig"

- [ ] **Step 3: Implement `src/backend/config/storage-config.ts`**

Export `getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig` reading and validating variables with fallback defaults.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/config/storage-config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts src/backend/config tests/backend/config
git commit -m "feat(storage): initialize project and storage config module"
```

---

### Task 2: Natural Sorter & Archive Extractor with Zip Slip Protection

**Files:**
- Create: `src/backend/services/archive-extractor.ts`
- Create: `src/backend/utils/natural-sort.ts`
- Test: `tests/backend/services/archive-extractor.test.ts`
- Test: `tests/backend/utils/natural-sort.test.ts`

**Interfaces:**
- Consumes: Buffer or file path of a `.cbz` or `.zip` file, destination temporary directory.
- Produces: `extractArchive(archivePath: string, destDir: string): Promise<string[]>` returning sanitized, naturally sorted list of extracted image paths.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/backend/utils/natural-sort.test.ts
import { describe, it, expect } from 'vitest';
import { naturalSort } from '../../../src/backend/utils/natural-sort';

describe('naturalSort', () => {
  it('sorts numeric page filenames in natural order', () => {
    const input = ['p10.jpg', 'p1.jpg', 'p2.jpg', 'p20.jpg', 'p3.jpg'];
    const output = naturalSort(input);
    expect(output).toEqual(['p1.jpg', 'p2.jpg', 'p3.jpg', 'p10.jpg', 'p20.jpg']);
  });
});

// tests/backend/services/archive-extractor.test.ts
import { describe, it, expect } from 'vitest';
import { isPathSafe } from '../../../src/backend/services/archive-extractor';

describe('isPathSafe', () => {
  it('blocks path traversal attempts outside destination', () => {
    expect(isPathSafe('C:/dest', '../../windows/system32/cmd.exe')).toBe(false);
    expect(isPathSafe('C:/dest', 'subfolder/page1.jpg')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/utils/natural-sort.test.ts tests/backend/services/archive-extractor.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement natural-sort and archive-extractor**

Implement natural sort using `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })`. Implement `extractArchive` using `adm-zip` with entry name sanitation and ignore non-image files (`.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/utils/natural-sort.test.ts tests/backend/services/archive-extractor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/utils/natural-sort.ts src/backend/services/archive-extractor.ts tests/
git commit -m "feat(ingestion): add safe archive extraction and natural sorting"
```

---

### Task 3: Image Optimizer & WebP Pipeline via Sharp

**Files:**
- Create: `src/backend/services/image-processor.ts`
- Test: `tests/backend/services/image-processor.test.ts`

**Interfaces:**
- Consumes: Input image file path or Buffer, output file path, `maxImageWidth: number`, `webpQuality: number`.
- Produces: `optimizeImageToWebP(input: string | Buffer, outputPath: string, options?: OptimizeOptions): Promise<PageMetadata>` where:
  ```typescript
  export interface PageMetadata {
    pageNumber: number;
    fileName: string;
    width: number;
    height: number;
    aspectRatio: number;
    fileSizeBytes: number;
  }
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/services/image-processor.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { optimizeImageToWebP } from '../../../src/backend/services/image-processor';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('optimizeImageToWebP', () => {
  const tmpDir = path.join(__dirname, 'tmp-test');
  const dummyInput = path.join(tmpDir, 'raw.png');
  const dummyOutput = path.join(tmpDir, '001.webp');

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    // Create a 2000x3000 test image
    await sharp({
      create: { width: 2000, height: 3000, channels: 3, background: { r: 255, g: 0, b: 0 } }
    }).png().toFile(dummyInput);
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('resizes wide images to max 1440px width and converts to WebP', async () => {
    const meta = await optimizeImageToWebP(dummyInput, dummyOutput, {
      pageNumber: 1,
      maxImageWidth: 1440,
      webpQuality: 82
    });

    expect(meta.width).toBe(1440);
    expect(meta.height).toBe(2160);
    expect(meta.aspectRatio).toBeCloseTo(1440 / 2160, 2);
    expect(meta.fileName).toBe('001.webp');

    const outInfo = await sharp(dummyOutput).metadata();
    expect(outInfo.format).toBe('webp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/services/image-processor.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `optimizeImageToWebP` in `src/backend/services/image-processor.ts`**

Use `sharp(input)`:
- If width > maxImageWidth, resize({ width: maxImageWidth, withoutEnlargement: true }).
- Convert to `.webp({ quality: webpQuality, effort: 4 })`.
- Write to `outputPath`.
- Calculate aspect ratio = `width / height`.
- Return `PageMetadata`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/services/image-processor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/image-processor.ts tests/backend/services/image-processor.test.ts
git commit -m "feat(ingestion): implement Sharp WebP conversion and aspect ratio extraction"
```

---

### Task 4: Chapter Ingestion Coordinator & Manifest Builder

**Files:**
- Create: `src/backend/services/chapter-ingestion-service.ts`
- Test: `tests/backend/services/chapter-ingestion-service.test.ts`

**Interfaces:**
- Consumes: `IngestChapterParams { seriesSlug: string, volumeNumber: number, chapterNumber: number, sourcePath: string, isArchive: boolean }`
- Produces: `ingestChapter(params): Promise<ChapterIngestResult>` generating physical `/storage/series/<slug>/v<vol>/c<chap>/` directory containing zero-padded `001.webp`, `002.webp`, and `manifest.json`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/backend/services/chapter-ingestion-service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ingestChapter } from '../../../src/backend/services/chapter-ingestion-service';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

describe('ingestChapter', () => {
  const testRoot = path.join(__dirname, 'test-storage-root');
  const sourceFolder = path.join(__dirname, 'test-src-folder');

  beforeAll(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    await fs.mkdir(sourceFolder, { recursive: true });
    // Write 3 fake pages
    for (let i = 1; i <= 3; i++) {
      await sharp({
        create: { width: 800, height: 1200, channels: 3, background: { r: 10 * i, g: 20 * i, b: 30 * i } }
      }).jpeg().toFile(path.join(sourceFolder, `page_${i}.jpg`));
    }
  });

  afterAll(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
    await fs.rm(sourceFolder, { recursive: true, force: true });
  });

  it('ingests loose images into structured storage directory with manifest.json', async () => {
    const result = await ingestChapter({
      storageRoot: testRoot,
      seriesSlug: 'solo-leveling',
      volumeNumber: 1,
      chapterNumber: 15,
      sourcePath: sourceFolder,
      isArchive: false
    });

    expect(result.pageCount).toBe(3);
    expect(result.relativeStorageDir).toBe(path.join('series', 'solo-leveling', 'v1', 'c15'));

    const manifestPath = path.join(testRoot, result.relativeStorageDir, 'manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.pages.length).toBe(3);
    expect(manifest.pages[0].fileName).toBe('001.webp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/backend/services/chapter-ingestion-service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `ingestChapter` in `src/backend/services/chapter-ingestion-service.ts`**

Orchestrate extraction if archive, natural sort image file list, execute parallel WebP optimizations with concurrency limit (e.g. `p-limit` 4 workers), pad page filenames `001.webp`, write `manifest.json`, cleanup temporary folders.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/backend/services/chapter-ingestion-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/chapter-ingestion-service.ts tests/backend/services/chapter-ingestion-service.test.ts
git commit -m "feat(ingestion): implement full chapter ingestion coordinator and manifest builder"
```
