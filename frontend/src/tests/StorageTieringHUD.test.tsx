/**
 * KuraScroll Sprint 94: StorageTieringHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StorageTieringHUD } from '../components/reader/StorageTieringHUD';

describe('StorageTieringHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <StorageTieringHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="balanced_hybrid"
        onModeChange={vi.fn()}
        hotRetentionDays={14}
        onHotDaysChange={vi.fn()}
        warmRetentionDays={60}
        onWarmDaysChange={vi.fn()}
        diskQuotaTargetGb={3500}
        onQuotaChange={vi.fn()}
        isAutoEvictionEnabled={true}
        onToggleAutoEvict={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        usedHotGb={320}
        usedWarmGb={1850}
        usedColdGb={980}
        diskTotalGb={4000}
        totalUsedGb={3150}
        freeGb={850}
        quotaPercent={90}
        evictionCandidateCount={18}
        reclaimableGb={145}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry and handles interactions when visible', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleEnabled = vi.fn();
    const onQuotaChange = vi.fn();

    render(
      <StorageTieringHUD
        isVisible={true}
        onClose={onClose}
        mode="balanced_hybrid"
        onModeChange={onModeChange}
        hotRetentionDays={14}
        onHotDaysChange={vi.fn()}
        warmRetentionDays={60}
        onWarmDaysChange={vi.fn()}
        diskQuotaTargetGb={3500}
        onQuotaChange={onQuotaChange}
        isAutoEvictionEnabled={true}
        onToggleAutoEvict={vi.fn()}
        isPinned={false}
        onTogglePin={vi.fn()}
        usedHotGb={320}
        usedWarmGb={1850}
        usedColdGb={980}
        diskTotalGb={4000}
        totalUsedGb={3150}
        freeGb={850}
        quotaPercent={90}
        evictionCandidateCount={18}
        reclaimableGb={145}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByRole('region', { name: /Storage Tiering & Eviction HUD/i })).toBeDefined();
    expect(screen.getByText('STORAGE TIERING & EVICTION [V]')).toBeDefined();
    expect(screen.getByText('18 chapters')).toBeDefined();
    expect(screen.getByText('145 GB')).toBeDefined();

    // Mode selection
    const aggressiveBtn = screen.getByRole('button', { name: 'Aggressive' });
    fireEvent.click(aggressiveBtn);
    expect(onModeChange).toHaveBeenCalledWith('aggressive_evict');

    // Slider adjustment
    const quotaSlider = screen.getByRole('slider', { name: 'Disk Quota Target' });
    fireEvent.change(quotaSlider, { target: { value: '3200' } });
    expect(onQuotaChange).toHaveBeenCalledWith(3200);

    // Toggle enabled button
    const toggleBtn = screen.getByRole('button', { name: 'Disable Tiering Engine' });
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close HUD' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
