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
});
