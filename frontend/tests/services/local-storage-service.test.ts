import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageService } from '../../src/services/local-storage-service';
import 'fake-indexeddb/auto';

describe('LocalStorageService with IndexedDB', () => {
  let storage: LocalStorageService;

  beforeEach(async () => {
    storage = new LocalStorageService('kura-scroll-test-db-' + Math.random());
    await storage.init();
  });

  it('saves and retrieves reading progress locally without requiring login', async () => {
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
    expect(progress?.scrollOffsetY).toBe(1400);
  });

  it('toggles bookmarks and lists saved series locally', async () => {
    await storage.toggleBookmark('demon-slayer', true);
    let bookmarks = await storage.getBookmarks();
    expect(bookmarks).toContain('demon-slayer');

    await storage.toggleBookmark('demon-slayer', false);
    bookmarks = await storage.getBookmarks();
    expect(bookmarks).not.toContain('demon-slayer');
  });

  it('manages series shelf and collections status in IndexedDB', async () => {
    // 1. Set shelf to reading with favorite = true
    await storage.setSeriesShelf('solo-leveling', 'reading', true);

    let shelf = await storage.getSeriesShelf('solo-leveling');
    expect(shelf).not.toBeNull();
    expect(shelf?.shelf).toBe('reading');
    expect(shelf?.favorite).toBe(true);

    // 2. Update shelf to completed, keeping favorite
    await storage.setSeriesShelf('solo-leveling', 'completed');
    shelf = await storage.getSeriesShelf('solo-leveling');
    expect(shelf?.shelf).toBe('completed');
    expect(shelf?.favorite).toBe(true);

    // 3. Add second series
    await storage.setSeriesShelf('one-piece', 'plan_to_read', false);

    // 4. Retrieve all shelved series
    const all = await storage.getAllShelvedSeries();
    expect(all['solo-leveling']).toEqual({ shelf: 'completed', favorite: true });
    expect(all['one-piece']).toEqual({ shelf: 'plan_to_read', favorite: false });

    // 5. Remove from shelf and favorite
    await storage.setSeriesShelf('one-piece', 'none', false);
    const removed = await storage.getSeriesShelf('one-piece');
    expect(removed).toBeNull();
  });
});
