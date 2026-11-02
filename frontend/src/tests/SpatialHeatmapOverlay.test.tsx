import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpatialHeatmapOverlay } from '../components/reader/SpatialHeatmapOverlay.js';

describe('Sprint 61 - SpatialHeatmapOverlay Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock HTML5 Canvas 2D context for headless jsdom test environment
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      imageSmoothingEnabled: true,
      globalAlpha: 1.0,
      fillStyle: '',
    }) as any;
  });

  const dummyGrid: number[][] = Array.from({ length: 16 }, () =>
    Array.from({ length: 16 }, () => 0)
  );
  dummyGrid[8][8] = 0.9; // Peak cell

  it('does not render when isVisible is false', () => {
    const { container } = render(
      <SpatialHeatmapOverlay
        isVisible={false}
        opacity={0.5}
        gridData={dummyGrid}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders canvas and control HUD chip when isVisible is true', () => {
    render(
      <SpatialHeatmapOverlay
        isVisible={true}
        opacity={0.6}
        gridData={dummyGrid}
        totalDwellMs={14200}
        peakIntensity={230}
      />
    );

    expect(screen.getByText('Spatial Heatmap')).toBeDefined();
    expect(screen.getByText('14.2s')).toBeDefined();
    expect(screen.getByText('Peak: 230')).toBeDefined();
    expect(screen.getByText('H')).toBeDefined();
  });

  it('triggers onToggleVisibility when toggle button is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <SpatialHeatmapOverlay
        isVisible={true}
        opacity={0.6}
        gridData={dummyGrid}
        onToggleVisibility={handleToggle}
      />
    );

    const toggleBtn = screen.getByTitle('Toggle Overlay [H]');
    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('triggers onOpacityChange when opacity slider is dragged', () => {
    const handleOpacity = vi.fn();
    render(
      <SpatialHeatmapOverlay
        isVisible={true}
        opacity={0.5}
        gridData={dummyGrid}
        onOpacityChange={handleOpacity}
      />
    );

    const slider = screen.getByTitle('Overlay Opacity');
    fireEvent.change(slider, { target: { value: '0.75' } });
    expect(handleOpacity).toHaveBeenCalledWith(0.75);
  });
});
