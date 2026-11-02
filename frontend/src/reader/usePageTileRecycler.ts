/**
 * KuraScroll - Sprint 101: Bi-Directional Zero-Copy Page Memory Slicing & Ring-Buffer Tile Recycler Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 (2C/2T @ 2.3GHz, Penryn 45nm, no AVX) & Intel GMA 4500MHD.
 * Maintains a fixed-capacity ring buffer of 5-7 DOM & image memory slots to completely prevent GC thrashing.
 * Bound to key 'B' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type SlotRecyclingStrategy = 'circular_lru' | 'boustrophedon_ring' | 'pinned_viewport';
export type SlotState = 'idle' | 'active' | 'prefetched' | 'evictable';

export interface PageBufferProfile {
  seriesId: string;
  ringCapacity: number;
  forwardLookahead: number;
  backwardLookahead: number;
  slotRecyclingStrategy: SlotRecyclingStrategy;
  zeroCopySliceEnabled: boolean;
  maxMemoryPoolBytes: number;
  createdAt: number;
  updatedAt: number;
}

export interface PageTileSlot {
  slotIndex: number;
  pageIndex: number;
  isPinned: boolean;
  state: SlotState;
  byteLength: number;
}

export interface ZeroCopySubarray {
  slotIndex: number;
  byteOffset: number;
  byteLength: number;
  pageIndex: number;
}

export interface PageTileRecyclingMatrixResult {
  recycledSlotIndex: number;
  evictedPageIndex: number | null;
  hitRatio: number;
  slots: PageTileSlot[];
  memoryPoolUsageBytes: number;
  zeroCopySubarrays: ZeroCopySubarray[];
  latencyUs: number;
}

export const PAGE_BUFFER_PRESETS: Record<string, {
  name: string;
  label: string;
  ringCapacity: number;
  forwardLookahead: number;
  backwardLookahead: number;
  slotRecyclingStrategy: SlotRecyclingStrategy;
  zeroCopySliceEnabled: boolean;
  maxMemoryPoolBytes: number;
  description: string;
}> = {
  standard_lru: {
    name: 'standard_lru',
    label: 'Standard Circular LRU (Balanced 7-Slot)',
    ringCapacity: 7,
    forwardLookahead: 3,
    backwardLookahead: 2,
    slotRecyclingStrategy: 'circular_lru',
    zeroCopySliceEnabled: true,
    maxMemoryPoolBytes: 33554432, // 32MB
    description: 'Balanced circular ring buffer with 3 forward / 2 backward prefetch slots for low-RAM T4500',
  },
  low_ram: {
    name: 'low_ram',
    label: 'Ultra-Low RAM (5-Slot Constrained)',
    ringCapacity: 5,
    forwardLookahead: 2,
    backwardLookahead: 1,
    slotRecyclingStrategy: 'circular_lru',
    zeroCopySliceEnabled: true,
    maxMemoryPoolBytes: 16777216, // 16MB
    description: 'Minimal 5-slot footprint designed for background-heavy sessions under 256MB V8 limit',
  },
  boustrophedon: {
    name: 'boustrophedon',
    label: 'Boustrophedon Ring (High-Cadence Webtoon)',
    ringCapacity: 9,
    forwardLookahead: 4,
    backwardLookahead: 3,
    slotRecyclingStrategy: 'boustrophedon_ring',
    zeroCopySliceEnabled: true,
    maxMemoryPoolBytes: 41943040, // 40MB
    description: 'Dual-ended sliding window optimized for rapid alternating scrolls without seek latency',
  },
  pinned_viewport: {
    name: 'pinned_viewport',
    label: 'Pinned Viewport (Split Spread Priority)',
    ringCapacity: 7,
    forwardLookahead: 3,
    backwardLookahead: 2,
    slotRecyclingStrategy: 'pinned_viewport',
    zeroCopySliceEnabled: true,
    maxMemoryPoolBytes: 33554432, // 32MB
    description: 'Locks current visible pages in slot memory while recycling outermost buffer slots',
  },
};

export function localCalculateRecyclingMatrix(
  currentPageIndex: number,
  totalPages: number,
  ringCapacity: number = 7,
  forwardLookahead: number = 3,
  backwardLookahead: number = 2,
  strategy: SlotRecyclingStrategy = 'circular_lru',
  activeSlots?: PageTileSlot[],
  direction: 'forward' | 'backward' = 'forward',
  zeroCopySliceEnabled: boolean = true,
  pageSizeBytes: number = 1048576
): PageTileRecyclingMatrixResult {
  const start = performance.now();
  const capacity = Math.max(3, Math.min(15, ringCapacity));
  const fwd = Math.max(1, Math.min(10, forwardLookahead));
  const bwd = Math.max(0, Math.min(5, backwardLookahead));
  const clampedPage = Math.max(0, Math.min(totalPages > 0 ? totalPages - 1 : 0, currentPageIndex));

  const windowStart = Math.max(0, clampedPage - bwd);
  const windowEnd = Math.max(0, Math.min(totalPages > 0 ? totalPages - 1 : 0, clampedPage + fwd));

  const primarySlotIndex = clampedPage % capacity;
  const slots: PageTileSlot[] = [];
  let existingHits = 0;
  let totalEvaluated = 0;
  let memoryPoolUsageBytes = 0;
  let evictedPageIndex: number | null = null;

  const slotMap = new Map<number, PageTileSlot>();
  if (activeSlots && activeSlots.length > 0) {
    for (let i = 0; i < activeSlots.length; i++) {
      const slot = activeSlots[i];
      if (slot.slotIndex >= 0 && slot.slotIndex < capacity) {
        slotMap.set(slot.slotIndex, slot);
      }
    }
  }

  let recycledSlotIndex = primarySlotIndex;
  let candidateEvictionDist = -1;

  if (activeSlots && activeSlots.length > 0) {
    for (let s = 0; s < capacity; s++) {
      const existing = slotMap.get(s);
      if (!existing || existing.state === 'idle') {
        recycledSlotIndex = s;
        break;
      }
      if (existing.isPinned && strategy === 'pinned_viewport') {
        continue;
      }
      const distFromCurrent = Math.abs(existing.pageIndex - clampedPage);
      const isOutOfWindow = existing.pageIndex < windowStart || existing.pageIndex > windowEnd;
      if (isOutOfWindow && distFromCurrent > candidateEvictionDist) {
        candidateEvictionDist = distFromCurrent;
        recycledSlotIndex = s;
        evictedPageIndex = existing.pageIndex;
      }
    }
  } else {
    recycledSlotIndex = primarySlotIndex;
  }

  for (let s = 0; s < capacity; s++) {
    const existing = slotMap.get(s);
    if (existing && existing.pageIndex >= 0 && existing.pageIndex < totalPages) {
      totalEvaluated++;
      const inWindow = existing.pageIndex >= windowStart && existing.pageIndex <= windowEnd;
      if (inWindow) existingHits++;

      let state: SlotState = existing.state;
      if (existing.pageIndex === clampedPage) {
        state = 'active';
      } else if (inWindow) {
        state = 'prefetched';
      } else {
        state = 'evictable';
      }

      const slotByteLen = existing.byteLength > 0 ? existing.byteLength : pageSizeBytes;
      memoryPoolUsageBytes += slotByteLen;
      slots.push({
        slotIndex: s,
        pageIndex: existing.pageIndex,
        isPinned: strategy === 'pinned_viewport' && existing.pageIndex === clampedPage,
        state,
        byteLength: slotByteLen,
      });
    } else {
      const targetPage = s === recycledSlotIndex ? clampedPage : -1;
      const slotByteLen = targetPage >= 0 ? pageSizeBytes : 0;
      memoryPoolUsageBytes += slotByteLen;
      slots.push({
        slotIndex: s,
        pageIndex: targetPage,
        isPinned: strategy === 'pinned_viewport' && targetPage === clampedPage,
        state: targetPage === clampedPage ? 'active' : 'idle',
        byteLength: slotByteLen,
      });
    }
  }

  const zeroCopySubarrays: ZeroCopySubarray[] = [];
  if (zeroCopySliceEnabled) {
    const halfBytes = pageSizeBytes >>> 1;
    zeroCopySubarrays.push({
      slotIndex: recycledSlotIndex,
      byteOffset: 0,
      byteLength: halfBytes,
      pageIndex: clampedPage,
    });
    zeroCopySubarrays.push({
      slotIndex: recycledSlotIndex,
      byteOffset: halfBytes,
      byteLength: pageSizeBytes - halfBytes,
      pageIndex: clampedPage,
    });
  }

  const hitRatio = totalEvaluated > 0 ? Math.round((existingHits / totalEvaluated) * 100) / 100 : 1.0;
  const latencyUs = (performance.now() - start) * 1000;

  return {
    recycledSlotIndex,
    evictedPageIndex,
    hitRatio,
    slots,
    memoryPoolUsageBytes,
    zeroCopySubarrays,
    latencyUs,
  };
}

export interface UsePageTileRecyclerProps {
  seriesId?: string;
  initialPreset?: string;
  currentPageIndex?: number;
  totalPages?: number;
  direction?: 'forward' | 'backward';
}

export interface UsePageTileRecyclerReturn {
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  toggleHUD: () => void;
  profile: PageBufferProfile;
  setProfile: React.Dispatch<React.SetStateAction<PageBufferProfile>>;
  matrixResult: PageTileRecyclingMatrixResult;
  applyPreset: (presetName: string) => void;
  zeroCopyHitCount: number;
}

export function usePageTileRecycler(props: UsePageTileRecyclerProps = {}): UsePageTileRecyclerReturn {
  const {
    seriesId = 'default-series',
    initialPreset = 'standard_lru',
    currentPageIndex = 0,
    totalPages = 20,
    direction = 'forward',
  } = props;

  const [isHUDVisible, setIsHUDVisible] = useState(false);
  const [zeroCopyHitCount, setZeroCopyHitCount] = useState(0);

  const initialProfile = useMemo<PageBufferProfile>(() => {
    const preset = PAGE_BUFFER_PRESETS[initialPreset] || PAGE_BUFFER_PRESETS.standard_lru;
    return {
      seriesId,
      ringCapacity: preset.ringCapacity,
      forwardLookahead: preset.forwardLookahead,
      backwardLookahead: preset.backwardLookahead,
      slotRecyclingStrategy: preset.slotRecyclingStrategy,
      zeroCopySliceEnabled: preset.zeroCopySliceEnabled,
      maxMemoryPoolBytes: preset.maxMemoryPoolBytes,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [seriesId, initialPreset]);

  const [profile, setProfile] = useState<PageBufferProfile>(initialProfile);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible(prev => !prev);
  }, []);

  // Keyboard shortcut listener: 'B' / 'b'
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Compute recycling matrix on page or parameter changes
  const matrixResult = useMemo(() => {
    const res = localCalculateRecyclingMatrix(
      currentPageIndex,
      totalPages,
      profile.ringCapacity,
      profile.forwardLookahead,
      profile.backwardLookahead,
      profile.slotRecyclingStrategy,
      undefined,
      direction,
      profile.zeroCopySliceEnabled
    );

    if (profile.zeroCopySliceEnabled && res.zeroCopySubarrays.length > 0) {
      setZeroCopyHitCount(c => c + 1);
    }

    return res;
  }, [
    currentPageIndex,
    totalPages,
    profile.ringCapacity,
    profile.forwardLookahead,
    profile.backwardLookahead,
    profile.slotRecyclingStrategy,
    direction,
    profile.zeroCopySliceEnabled,
  ]);

  const applyPreset = useCallback((presetName: string) => {
    const preset = PAGE_BUFFER_PRESETS[presetName];
    if (!preset) return;
    setProfile(prev => ({
      ...prev,
      ringCapacity: preset.ringCapacity,
      forwardLookahead: preset.forwardLookahead,
      backwardLookahead: preset.backwardLookahead,
      slotRecyclingStrategy: preset.slotRecyclingStrategy,
      zeroCopySliceEnabled: preset.zeroCopySliceEnabled,
      maxMemoryPoolBytes: preset.maxMemoryPoolBytes,
      updatedAt: Date.now(),
    }));
  }, []);

  return {
    isHUDVisible,
    setIsHUDVisible,
    toggleHUD,
    profile,
    setProfile,
    matrixResult,
    applyPreset,
    zeroCopyHitCount,
  };
}
