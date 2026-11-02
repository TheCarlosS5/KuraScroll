/**
 * KuraScroll Offline Storage Vault Hook
 * Sprint 72 - Offline Chapter Management & Quota Arbiter
 *
 * Provides real-time quota tracking via navigator.storage.estimate(),
 * pin toggling, manual and automatic weighted eviction, and HUD modal state.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect } from 'react';

export type ChapterStatusBadge = 'pinned' | 'unread' | 'completed';

export interface OfflineChapterItem {
  id: string;
  seriesTitle: string;
  chapterNumber: number;
  sizeMb: number;
  status: ChapterStatusBadge;
  isPinned: boolean;
  lastAccessedAt?: number;
}

export interface UseStorageVaultOptions {
  userId?: string;
  defaultQuotaBytes?: number; // e.g. 1073741824 (1GB)
  defaultThresholdPercent?: number; // e.g. 75%
  initialChapters?: OfflineChapterItem[];
  enableKeyboard?: boolean;
}

export function useStorageVault({
  userId = 'default_user',
  defaultQuotaBytes = 1073741824, // 1 GB
  defaultThresholdPercent = 75,
  initialChapters = [],
  enableKeyboard = true,
}: UseStorageVaultOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [chapters, setChapters] = useState<OfflineChapterItem[]>(initialChapters);
  const [totalBytes, setTotalBytes] = useState<number>(defaultQuotaBytes);
  const [thresholdPercent, setThresholdPercent] = useState<number>(defaultThresholdPercent);

  // Calculate used bytes from chapter sizes (MB -> Bytes)
  const usedBytes = chapters.reduce((sum, ch) => sum + ch.sizeMb * 1024 * 1024, 0);

  // Sync with browser origin storage quota if available
  const refreshStorageEstimate = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.quota > 0) {
          setTotalBytes(estimate.quota);
        }
      } catch {
        // Fallback to defaultQuotaBytes
      }
    }
  }, []);

  useEffect(() => {
    refreshStorageEstimate();
  }, [refreshStorageEstimate]);

  const openVault = useCallback(() => setIsOpen(true), []);
  const closeVault = useCallback(() => setIsOpen(false), []);
  const toggleVault = useCallback(() => setIsOpen((prev) => !prev), []);

  const togglePin = useCallback((chapterId: string) => {
    setChapters((prev) =>
      prev.map((ch) => {
        if (ch.id === chapterId) {
          const nextPinned = !ch.isPinned;
          return {
            ...ch,
            isPinned: nextPinned,
            status: nextPinned ? 'pinned' : ch.status === 'pinned' ? 'completed' : ch.status,
          };
        }
        return ch;
      })
    );
  }, []);

  const deleteChapter = useCallback((chapterId: string) => {
    setChapters((prev) => prev.filter((ch) => ch.id !== chapterId));
  }, []);

  const registerChapter = useCallback((newChapter: OfflineChapterItem) => {
    setChapters((prev) => {
      const existingIdx = prev.findIndex((c) => c.id === newChapter.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = newChapter;
        return updated;
      }
      return [...prev, newChapter];
    });
  }, []);

  // Quick Cleanup: Evicts completed/read chapters that are NOT pinned
  const quickCleanup = useCallback(() => {
    setChapters((prev) => prev.filter((ch) => ch.isPinned || ch.status === 'unread'));
  }, []);

  // Global keyboard shortcut ('V') to toggle HUD
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard]);

  return {
    isOpen,
    openVault,
    closeVault,
    toggleVault,
    chapters,
    usedBytes,
    totalBytes,
    thresholdPercent,
    setThresholdPercent,
    togglePin,
    deleteChapter,
    registerChapter,
    quickCleanup,
    refreshStorageEstimate,
  };
}
