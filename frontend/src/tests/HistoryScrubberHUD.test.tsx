/**
 * KuraScroll Sprint 90: HistoryScrubberHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryScrubberHUD } from '../components/reader/HistoryScrubberHUD';

describe('HistoryScrubberHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <HistoryScrubberHUD
        isVisible={false}
        onClose={vi.fn()}
        scrubberMode="webtoon_continuous"
        onModeChange={vi.fn()}
        currentIndex={10}
        totalItems={100}
        tapeThicknessPx={48}
        onThicknessChange={vi.fn()}
        heatmapIntensity={0.65}
        onHeatmapIntensityChange={vi.fn()}
        velocityMultiplier={1.2}
        onVelocityMultiplierChange={vi.fn()}
        isSnapToChapter={true}
        onToggleSnap={vi.fn()}
        normalizedPosition={0.10}
        pixelOffset={60}
        isAtStart={false}
        isAtEnd={false}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
        onScrubRatio={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry and handles interactions when visible', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleSnap = vi.fn();
    const onToggleEnabled = vi.fn();
    const onScrubRatio = vi.fn();

    render(
      <HistoryScrubberHUD
        isVisible={true}
        onClose={onClose}
        scrubberMode="webtoon_continuous"
        onModeChange={onModeChange}
        currentIndex={24}
        totalItems={100}
        tapeThicknessPx={48}
        onThicknessChange={vi.fn()}
        heatmapIntensity={0.65}
        onHeatmapIntensityChange={vi.fn()}
        velocityMultiplier={1.2}
        onVelocityMultiplierChange={vi.fn()}
        isSnapToChapter={true}
        onToggleSnap={onToggleSnap}
        normalizedPosition={0.25}
        pixelOffset={150}
        isAtStart={false}
        isAtEnd={false}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
        onScrubRatio={onScrubRatio}
      />
    );

    expect(screen.getByText('History Scrubber & Heatmap [Z]')).toBeDefined();
    expect(screen.getByText('25 / 100')).toBeDefined();
    expect(screen.getByText('150px')).toBeDefined();
    expect(screen.getByText('25.0%')).toBeDefined();

    // Test close button
    const closeBtn = screen.getByRole('button', { name: /Close Scrubber HUD/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    // Test mode button
    const rtlBtn = screen.getByText('Manga RTL');
    fireEvent.click(rtlBtn);
    expect(onModeChange).toHaveBeenCalledWith('manga_rtl_continuous');

    // Test snap toggle
    const snapBtn = screen.getByText('Magnet ON');
    fireEvent.click(snapBtn);
    expect(onToggleSnap).toHaveBeenCalled();

    // Test toggle enabled
    const toggleEnabledBtn = screen.getByRole('button', { name: /Scrubber Active/i });
    fireEvent.click(toggleEnabledBtn);
    expect(onToggleEnabled).toHaveBeenCalled();
  });
});
