# KuraScroll - Part 4: Reader UI & Dual-Engine Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React 19 + Vite frontend application featuring instant multilingual search, catalog browsing, and the dual-engine reader (Webtoon continuous vertical strip + Manga RTL/LTR paginated).

**Architecture:** Client-side React SPA styled with Tailwind CSS v4. An IndexedDB layer (`idb`) provides immediate offline reading state (bookmarks, last read page, scroll offset) without requiring account creation. The reader uses zero-layout-shift aspect ratio containers and virtualized windowing to stream 100+ high-res manhwa images seamlessly without memory exhaustion.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React, idb (IndexedDB), Vitest + React Testing Library.

**Spec:** [2026-11-01-kura-scroll-design.md](file:///C:/Users/Admin/dev/kura-scroll/docs/superpowers/specs/2026-11-01-kura-scroll-design.md)

## Global Constraints

- Design system must adopt the KuraStream sister aesthetic: Deep Void `#080c14`, Card Dark `#111827`, Neon Cyan `#00e5ff`, and Violet Accent `#8b5cf6`.
- Branding: Feature the shared **KS** monogram logo prominently in the navbar.
- Zero Layout Shift: Reader page containers must calculate and set `aspect-ratio` before the image finishes loading.
- Reader Modes: Support instantaneous toggle between `Webtoon` (vertical continuous strip) and `Manga` (paginated Right-to-Left / Left-to-Right).
- Hotkeys: Manga mode must respond to `ArrowLeft`, `ArrowRight`, `KeyA`, `KeyD`, and `Spacebar`.

## Review Focus

1. **Cumulative Layout Shift (CLS) on slow disk reads:** Ensure placeholder divs preserve exact page aspect ratios while images stream from the 4TB HDD.
2. **Memory leak in continuous Webtoon scroll:** Unmount or virtualize offscreen images in long chapters (80-120 panels) to prevent mobile/tablet browser crashes.
3. **Manga RTL vs LTR page inversion:** In Japanese RTL mode, the right arrow (`→`) or clicking the left side must advance to the NEXT page, adhering to manga reading conventions.
4. **IndexedDB fallback on private/incognito mode:** Gracefully fallback to in-memory state if `IndexedDB` is restricted by private browsing permissions.
5. **Debounce on multilingual search bar:** Debounce search input (300ms) to prevent sending rapid-fire requests on every keystroke.

---

### Task 1: Frontend App Scaffolding & Design System

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/index.css`
- Create: `frontend/src/components/common/Navbar.tsx`
- Test: `frontend/tests/components/Navbar.test.tsx`

**Interfaces:**
- Produces: Base layout with responsive header, KuraScroll KS logo badge, navigation links (Manga, Manhwa, Manhua, Bookmarks), and search input placeholder.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/tests/components/Navbar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Navbar } from '../../src/components/common/Navbar';
import React from 'react';

describe('Navbar Component', () => {
  it('renders KuraScroll branding with KS badge', () => {
    render(<Navbar />);
    expect(screen.getByText('KuraScroll')).toBeDefined();
    expect(screen.getByText('KS')).toBeDefined();
  });

  it('renders navigation category links', () => {
    render(<Navbar />);
    expect(screen.getByText('Manga')).toBeDefined();
    expect(screen.getByText('Manhwa')).toBeDefined();
    expect(screen.getByText('Manhua')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test tests/components/Navbar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `frontend/src/components/common/Navbar.tsx` and theme**

Set up Tailwind dark palette, create `Navbar` component with Lucide icons (`BookOpen`, `Search`, `Bookmark`), and style the neon cyan KS monogram.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test tests/components/Navbar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(ui): scaffold frontend application and KuraScroll KS navbar"
```

---

### Task 2: Multilingual Search & Catalog Grid

**Files:**
- Create: `frontend/src/hooks/useDebounce.ts`
- Create: `frontend/src/components/catalog/SearchBar.tsx`
- Create: `frontend/src/components/catalog/MangaCard.tsx`
- Create: `frontend/src/pages/CatalogPage.tsx`
- Test: `frontend/tests/components/SearchBar.test.tsx`

**Interfaces:**
- Consumes: User search input, API series items.
- Produces: Debounced search triggering `GET /api/v1/series?q=...`, displaying cover image, badges for type (Manhwa/Manga), latest chapter, and localized matching titles.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/tests/components/SearchBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '../../src/components/catalog/SearchBar';
import React from 'react';

describe('SearchBar', () => {
  it('calls onSearch callback after debounce delay', async () => {
    vi.useFakeTimers();
    const handleSearch = vi.fn();
    render(<SearchBar onSearch={handleSearch} debounceMs={300} />);

    const input = screen.getByPlaceholderText(/buscar por nombre/i);
    fireEvent.change(input, { target: { value: 'Solo Leveling' } });

    expect(handleSearch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    expect(handleSearch).toHaveBeenCalledWith('Solo Leveling');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test tests/components/SearchBar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `useDebounce`, `SearchBar`, and `CatalogPage`**

Implement debouncing hook, input component with clear button and loading spinner, and responsive grid layout with hover zoom effects on manga cards.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test tests/components/SearchBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/ frontend/src/components/catalog/ frontend/src/pages/CatalogPage.tsx
git commit -m "feat(ui): implement debounced multilingual SearchBar and CatalogPage"
```

---

### Task 3: Dual-Engine Reader Component (Webtoon + Manga RTL/LTR)

**Files:**
- Create: `frontend/src/components/reader/WebtoonReader.tsx`
- Create: `frontend/src/components/reader/MangaReader.tsx`
- Create: `frontend/src/components/reader/ReaderControls.tsx`
- Create: `frontend/src/pages/ReaderPage.tsx`
- Test: `frontend/tests/components/MangaReader.test.tsx`

**Interfaces:**
- Consumes: Chapter manifest `{ chapter, pages: [{ pageNumber, fileName, width, height, aspectRatio }], prevChapterId, nextChapterId }`
- Produces:
  - `WebtoonReader`: Seamless vertical scrolling with aspect ratio placeholders and progressive image loading.
  - `MangaReader`: Interactive flipbook supporting RTL (Japanese) and LTR modes, responding to keyboard arrow keys and touch tap zones.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/tests/components/MangaReader.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MangaReader } from '../../src/components/reader/MangaReader';
import React from 'react';

describe('MangaReader RTL mode', () => {
  const dummyPages = [
    { pageNumber: 1, fileName: '001.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { pageNumber: 2, fileName: '002.webp', width: 1000, height: 1500, aspectRatio: 0.666 }
  ];

  it('in RTL mode, ArrowLeft key advances to next page', () => {
    const handlePageChange = vi.fn();
    render(
      <MangaReader
        pages={dummyPages}
        currentPage={1}
        mode="RTL"
        storageBaseUrl="/storage/series/test/c1"
        onPageChange={handlePageChange}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test tests/components/MangaReader.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `WebtoonReader`, `MangaReader`, and `ReaderControls`**

In `WebtoonReader`, render each image inside a `<div style={{ aspectRatio: page.aspectRatio }} className="w-full max-w-3xl mx-auto relative bg-gray-900">` with `loading="lazy"`. In `MangaReader`, handle page state and keyboard listeners for RTL and LTR. Include floating drawer overlay (`ReaderControls`) to adjust zoom, switch modes, and toggle fullscreen.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test tests/components/MangaReader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/reader/ frontend/src/pages/ReaderPage.tsx
git commit -m "feat(ui): implement dual-engine Webtoon and Manga RTL reader with zero CLS"
```

---

### Task 4: Client-Side IndexedDB Storage & Progress Sync

**Files:**
- Create: `frontend/src/services/local-storage-service.ts`
- Create: `frontend/src/hooks/useReadingProgress.ts`
- Test: `frontend/tests/services/local-storage-service.test.ts`

**Interfaces:**
- Consumes: Series ID, Chapter ID, page number, scroll offset.
- Produces: Instant local saving to browser IndexedDB and debounced background sync to `/api/v1/progress`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/tests/services/local-storage-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageService } from '../../src/services/local-storage-service';
import 'fake-indexeddb/auto';

describe('LocalStorageService with IndexedDB', () => {
  let storage: LocalStorageService;

  beforeEach(async () => {
    storage = new LocalStorageService('kura-scroll-test-db');
    await storage.init();
  });

  it('saves and retrieves reading progress locally without login', async () => {
    await storage.saveProgress({
      seriesId: 'solo-leveling',
      chapterId: 'c15',
      pageNumber: 22,
      scrollOffsetY: 1400,
      timestamp: Date.now()
    });

    const progress = await storage.getProgress('solo-leveling');
    expect(progress?.chapterId).toBe('c15');
    expect(progress?.pageNumber).toBe(22);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test tests/services/local-storage-service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `LocalStorageService` with `idb`**

Initialize object stores `bookmarks` and `reading_progress` using `idb`. Implement `saveProgress`, `getProgress`, `toggleBookmark`, `getBookmarks`. Add background sync hook `useReadingProgress` that posts updates to backend when online.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test tests/services/local-storage-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/local-storage-service.ts frontend/src/hooks/useReadingProgress.ts
git commit -m "feat(client): implement offline-first IndexedDB reading progress and bookmark sync"
```
