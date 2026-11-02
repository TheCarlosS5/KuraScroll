import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ReadingDwellHeatmapOverlay,
  PageDwellRecord,
  ChapterAttentionMetrics
} from '../../src/components/reader/ReadingDwellHeatmapOverlay.js';

describe('ReadingDwellHeatmapOverlay Component Unit Suite (Sprint 45)', () => {
  const mockHeatmap: PageDwellRecord[] = [
    { pageNumber: 1, totalReads: 10, totalDwellSeconds: 150, avgDwellSeconds: 15, intensityScore: 20, tier: 'breeze' },
    { pageNumber: 2, totalReads: 10, totalDwellSeconds: 350, avgDwellSeconds: 35, intensityScore: 46.7, tier: 'flow' },
    { pageNumber: 3, totalReads: 10, totalDwellSeconds: 550, avgDwellSeconds: 55, intensityScore: 73.3, tier: 'deep' },
    { pageNumber: 4, totalReads: 10, totalDwellSeconds: 750, avgDwellSeconds: 75, intensityScore: 100, tier: 'epic' },
  ];

  const mockMetrics: ChapterAttentionMetrics = {
    totalSessionViews: 10,
    totalDwellSeconds: 1800,
    chapterAvgDwellSeconds: 45,
    peakAttentionPage: 4,
    peakDwellSeconds: 75
  };

  it('renders heatmap overlay, vertical track, and peak pill', () => {
    render(
      <ReadingDwellHeatmapOverlay
        chapterId="ch-100"
        totalPages={4}
        currentPage={1}
        heatmap={mockHeatmap}
        metrics={mockMetrics}
        onJumpToPage={vi.fn()}
      />
    );

    expect(screen.getByTestId('dwell-heatmap-overlay')).toBeDefined();
    expect(screen.getByTestId('dwell-peak-pill')).toBeDefined();
    expect(screen.getByText(/Peak: P\.4 \(75\.0s\)/)).toBeDefined();
    expect(screen.getByTestId('dwell-heatmap-track')).toBeDefined();
    expect(screen.getByTestId('dwell-page-slice-1')).toBeDefined();
    expect(screen.getByTestId('dwell-page-slice-4')).toBeDefined();
  });

  it('toggles visibility when clicking toggle button', () => {
    const onToggleVisibility = vi.fn();
    render(
      <ReadingDwellHeatmapOverlay
        chapterId="ch-100"
        totalPages={4}
        currentPage={1}
        heatmap={mockHeatmap}
        metrics={mockMetrics}
        onJumpToPage={vi.fn()}
        onToggleVisibility={onToggleVisibility}
      />
    );

    const toggleBtn = screen.getByTestId('dwell-heatmap-toggle');
    expect(screen.getByTestId('dwell-heatmap-track')).toBeDefined();

    // Click to hide
    fireEvent.click(toggleBtn);
    expect(onToggleVisibility).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('dwell-heatmap-track')).toBeNull();

    // Click to restore
    fireEvent.click(toggleBtn);
    expect(onToggleVisibility).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('dwell-heatmap-track')).toBeDefined();
  });

  it('triggers onJumpToPage when clicking a page slice', () => {
    const onJumpToPage = vi.fn();
    render(
      <ReadingDwellHeatmapOverlay
        chapterId="ch-100"
        totalPages={4}
        currentPage={1}
        heatmap={mockHeatmap}
        metrics={mockMetrics}
        onJumpToPage={onJumpToPage}
      />
    );

    const slice4 = screen.getByTestId('dwell-page-slice-4');
    fireEvent.click(slice4);

    expect(onJumpToPage).toHaveBeenCalledTimes(1);
    expect(onJumpToPage).toHaveBeenCalledWith(4);
  });

  it('shows hover detail card when mouse enters a slice and hides on leave', () => {
    render(
      <ReadingDwellHeatmapOverlay
        chapterId="ch-100"
        totalPages={4}
        currentPage={1}
        heatmap={mockHeatmap}
        metrics={mockMetrics}
        onJumpToPage={vi.fn()}
      />
    );

    expect(screen.queryByTestId('dwell-hover-card')).toBeNull();

    const slice3 = screen.getByTestId('dwell-page-slice-3');
    fireEvent.mouseEnter(slice3);

    expect(screen.getByTestId('dwell-hover-card')).toBeDefined();
    expect(screen.getByText('Page 3')).toBeDefined();
    expect(screen.getByText('⚡ DEEP')).toBeDefined();
    expect(screen.getByText('55.0s')).toBeDefined();

    fireEvent.mouseLeave(slice3);
    expect(screen.queryByTestId('dwell-hover-card')).toBeNull();
  });

  it('highlights current page slice with active ring', () => {
    render(
      <ReadingDwellHeatmapOverlay
        chapterId="ch-100"
        totalPages={4}
        currentPage={2}
        heatmap={mockHeatmap}
        metrics={mockMetrics}
        onJumpToPage={vi.fn()}
      />
    );

    const slice2 = screen.getByTestId('dwell-page-slice-2');
    expect(slice2.className).toContain('ring-2 ring-white');

    const slice1 = screen.getByTestId('dwell-page-slice-1');
    expect(slice1.className).not.toContain('ring-2 ring-white');
  });
});
