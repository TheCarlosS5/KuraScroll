/**
 * KuraScroll Sprint 101: PageTileRecyclerHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageTileRecyclerHUD } from '../components/reader/PageTileRecyclerHUD';
import { PageBufferProfile, PageTileRecyclingMatrixResult } from '../reader/usePageTileRecycler';

describe('PageTileRecyclerHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: PageBufferProfile = {
    seriesId: 'test-series-101',
    ringCapacity: 7,
    forwardLookahead: 3,
    backwardLookahead: 2,
    slotRecyclingStrategy: 'circular_lru',
    zeroCopySliceEnabled: true,
    maxMemoryPoolBytes: 33554432,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockMatrixResult: PageTileRecyclingMatrixResult = {
    recycledSlotIndex: 0,
    evictedPageIndex: 12,
    hitRatio: 0.86,
    slots: [
      { slotIndex: 0, pageIndex: 0, isPinned: false, state: 'active', byteLength: 1048576 },
      { slotIndex: 1, pageIndex: 1, isPinned: false, state: 'prefetched', byteLength: 1048576 },
      { slotIndex: 2, pageIndex: 2, isPinned: false, state: 'prefetched', byteLength: 1048576 },
      { slotIndex: 3, pageIndex: 3, isPinned: false, state: 'prefetched', byteLength: 1048576 },
      { slotIndex: 4, pageIndex: -1, isPinned: false, state: 'idle', byteLength: 0 },
      { slotIndex: 5, pageIndex: -1, isPinned: false, state: 'idle', byteLength: 0 },
      { slotIndex: 6, pageIndex: -1, isPinned: false, state: 'idle', byteLength: 0 },
    ],
    memoryPoolUsageBytes: 4194304,
    zeroCopySubarrays: [
      { slotIndex: 0, byteOffset: 0, byteLength: 524288, pageIndex: 0 },
      { slotIndex: 0, byteOffset: 524288, byteLength: 524288, pageIndex: 0 },
    ],
    latencyUs: 1.25,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <PageTileRecyclerHUD
        isVisible={false}
        onClose={vi.fn()}
        profile={mockProfile}
        onProfileChange={vi.fn()}
        matrixResult={mockMatrixResult}
        onApplyPreset={vi.fn()}
        zeroCopyHitCount={5}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders HUD with telemetry and slot cards when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <PageTileRecyclerHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        matrixResult={mockMatrixResult}
        onApplyPreset={onApplyPreset}
        zeroCopyHitCount={42}
      />
    );

    expect(screen.getByRole('region', { name: 'Page Tile Recycler HUD' })).toBeDefined();
    expect(screen.getByText('Page Buffer & Tile Recycler')).toBeDefined();
    expect(screen.getByText('SLA 65')).toBeDefined();

    // Check slot capsules
    expect(screen.getByText('S0')).toBeDefined();
    expect(screen.getByText('P0')).toBeDefined();

    // Check telemetry
    expect(screen.getByText('86%')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('P12')).toBeDefined();

    // Interaction with preset button
    const presetBtn = screen.getByText('Ultra-Low RAM');
    fireEvent.click(presetBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('low_ram');

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
