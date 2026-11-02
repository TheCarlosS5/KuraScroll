import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TileInvalidatorHUD } from '../components/reader/TileInvalidatorHUD';
import {
  TileInvalidationProfile,
  TileInvalidationResult,
  DEFAULT_TILE_INVALIDATION_PROFILE,
} from '../reader/useTileInvalidator';

describe('TileInvalidatorHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: TileInvalidationProfile = {
    seriesId: 'test-series-107',
    ...DEFAULT_TILE_INVALIDATION_PROFILE,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: TileInvalidationResult = {
    tiles: [
      {
        id: 'tile-1',
        retentionClass: 'ACTIVE_VIEWPORT',
        evictionScore: 0.0,
        distanceSq: 1000,
        ageMs: 500,
        sizeBytes: 150000,
      },
      {
        id: 'tile-2',
        retentionClass: 'EVICT_COOLING',
        evictionScore: 0.65,
        distanceSq: 5000000,
        ageMs: 3000,
        sizeBytes: 150000,
      },
    ],
    totalHeapMb: 54.2,
    evictionCount: 1,
    activeCount: 1,
    warmCount: 0,
    coolingCount: 1,
    immediateCount: 0,
    reclaimedBytes: 150000,
    budgetExceeded: false,
    evaluationLatencyUs: 0.85,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <TileInvalidatorHUD
        isVisible={false}
        onClose={vi.fn()}
        profile={mockProfile}
        onProfileChange={vi.fn()}
        result={mockResult}
        onApplyPreset={vi.fn()}
        onTriggerPurge={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders HUD with telemetry and handles interactions when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();
    const onTriggerPurge = vi.fn();

    render(
      <TileInvalidatorHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        onApplyPreset={onApplyPreset}
        onTriggerPurge={onTriggerPurge}
      />
    );

    expect(screen.getByText('Tile Invalidator & GC')).toBeDefined();
    expect(screen.getByText('SLA 71')).toBeDefined();
    expect(screen.getByText(/54.2 \/ 128 MB/)).toBeDefined();

    // Trigger instant purge button
    const purgeBtn = screen.getByText('Instant Purge');
    fireEvent.click(purgeBtn);
    expect(onTriggerPurge).toHaveBeenCalledTimes(1);

    // Toggle auto-gc button
    const autoGcBtn = screen.getByText('Auto-GC: ON');
    fireEvent.click(autoGcBtn);
    expect(onProfileChange).toHaveBeenCalledWith({ isAutoGcEnabled: false });

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
