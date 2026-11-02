import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStorageVault, OfflineChapterItem } from '../reader/useStorageVault';

describe('Sprint 72 - useStorageVault Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleChapters: OfflineChapterItem[] = [
    {
      id: 'c1',
      seriesTitle: 'Solo Leveling',
      chapterNumber: 1,
      sizeMb: 25,
      status: 'unread',
      isPinned: false,
    },
    {
      id: 'c2',
      seriesTitle: 'Solo Leveling',
      chapterNumber: 2,
      sizeMb: 30,
      status: 'completed',
      isPinned: false,
    },
    {
      id: 'c3',
      seriesTitle: 'Tower of God',
      chapterNumber: 50,
      sizeMb: 45,
      status: 'pinned',
      isPinned: true,
    },
  ];

  it('initializes with default options and calculates usedBytes', () => {
    const { result } = renderHook(() =>
      useStorageVault({
        initialChapters: sampleChapters,
        enableKeyboard: false,
      })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.chapters).toHaveLength(3);
    // (25 + 30 + 45) * 1024 * 1024 = 100 * 1024 * 1024 = 104857600 bytes
    expect(result.current.usedBytes).toBe(100 * 1024 * 1024);
    expect(result.current.totalBytes).toBe(1073741824);
    expect(result.current.thresholdPercent).toBe(75);
  });

  it('controls modal open/close/toggle correctly', () => {
    const { result } = renderHook(() =>
      useStorageVault({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openVault();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeVault();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleVault();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('toggles chapter pin status and updates badges', () => {
    const { result } = renderHook(() =>
      useStorageVault({
        initialChapters: sampleChapters,
        enableKeyboard: false,
      })
    );

    // c1 is unpinned
    expect(result.current.chapters[0].isPinned).toBe(false);

    act(() => {
      result.current.togglePin('c1');
    });

    expect(result.current.chapters[0].isPinned).toBe(true);
    expect(result.current.chapters[0].status).toBe('pinned');

    // Unpin c1
    act(() => {
      result.current.togglePin('c1');
    });

    expect(result.current.chapters[0].isPinned).toBe(false);
  });

  it('deletes a chapter and updates total usedBytes', () => {
    const { result } = renderHook(() =>
      useStorageVault({
        initialChapters: sampleChapters,
        enableKeyboard: false,
      })
    );

    expect(result.current.chapters).toHaveLength(3);
    expect(result.current.usedBytes).toBe(100 * 1024 * 1024);

    act(() => {
      result.current.deleteChapter('c2'); // 30 MB
    });

    expect(result.current.chapters).toHaveLength(2);
    expect(result.current.usedBytes).toBe(70 * 1024 * 1024);
  });

  it('registers a new chapter or updates an existing one', () => {
    const { result } = renderHook(() =>
      useStorageVault({
        initialChapters: sampleChapters,
        enableKeyboard: false,
      })
    );

    const newChapter: OfflineChapterItem = {
      id: 'c4',
      seriesTitle: 'Omniscient Reader',
      chapterNumber: 1,
      sizeMb: 20,
      status: 'unread',
      isPinned: false,
    };

    act(() => {
      result.current.registerChapter(newChapter);
    });

    expect(result.current.chapters).toHaveLength(4);
    expect(result.current.usedBytes).toBe(120 * 1024 * 1024);

    // Update existing chapter
    act(() => {
      result.current.registerChapter({
        ...newChapter,
        sizeMb: 25,
      });
    });

    expect(result.current.chapters).toHaveLength(4);
    expect(result.current.usedBytes).toBe(125 * 1024 * 1024);
  });

  it('executes quickCleanup by evicting unpinned completed chapters only', () => {
    const { result } = renderHook(() =>
      useStorageVault({
        initialChapters: sampleChapters,
        enableKeyboard: false,
      })
    );

    // Initial: c1 (unread, unpinned), c2 (completed, unpinned), c3 (pinned)
    act(() => {
      result.current.quickCleanup();
    });

    // c2 should be removed, c1 and c3 preserved
    expect(result.current.chapters).toHaveLength(2);
    expect(result.current.chapters.map((c) => c.id)).toEqual(['c1', 'c3']);
  });

  it('handles keyboard toggle via "v" key', () => {
    const { result } = renderHook(() =>
      useStorageVault({ enableKeyboard: true })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'V' }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
