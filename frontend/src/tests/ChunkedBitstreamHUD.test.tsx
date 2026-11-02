/**
 * KuraScroll Sprint 87: ChunkedBitstreamHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChunkedBitstreamHUD } from '../components/reader/ChunkedBitstreamHUD';

describe('ChunkedBitstreamHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <ChunkedBitstreamHUD
        isVisible={false}
        onClose={vi.fn()}
        preset="webtoon_conservative"
        onPresetChange={vi.fn()}
        totalWidth={1440}
        totalHeight={8000}
        totalSlices={16}
        idleBudgetMs={8.0}
        progressivePass={2}
        totalMemoryMB={43.9}
        isOversized={true}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry when visible', () => {
    const onClose = vi.fn();
    const onPresetChange = vi.fn();
    const onToggleEnabled = vi.fn();

    render(
      <ChunkedBitstreamHUD
        isVisible={true}
        onClose={onClose}
        preset="webtoon_conservative"
        onPresetChange={onPresetChange}
        totalWidth={1440}
        totalHeight={8000}
        totalSlices={16}
        idleBudgetMs={8.0}
        progressivePass={2}
        totalMemoryMB={43.9}
        isOversized={true}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByText('ZERO-JANK STREAMER')).toBeDefined();
    expect(screen.getByText('1440 × 8000')).toBeDefined();
    expect(screen.getByText('TILED (>2048px)')).toBeDefined();
    expect(screen.getByText('16 tiles')).toBeDefined();
    expect(screen.getByText('8 ms / frame')).toBeDefined();
    expect(screen.getByText('Pass 2/2 (Full Fidelity)')).toBeDefined();
  });

  it('triggers preset change and close actions', () => {
    const onClose = vi.fn();
    const onPresetChange = vi.fn();
    const onToggleEnabled = vi.fn();

    render(
      <ChunkedBitstreamHUD
        isVisible={true}
        onClose={onClose}
        preset="webtoon_conservative"
        onPresetChange={onPresetChange}
        totalWidth={800}
        totalHeight={600}
        totalSlices={1}
        idleBudgetMs={8.0}
        progressivePass={1}
        totalMemoryMB={1.8}
        isOversized={false}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click Low VRAM button
    const lowVramBtn = screen.getByText('Low VRAM');
    fireEvent.click(lowVramBtn);
    expect(onPresetChange).toHaveBeenCalledWith('low_vram_aggressive');

    // Toggle button
    const toggleBtn = screen.getByText('Chunking Active');
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });
});
