import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeepZoomTileHUD } from '../components/reader/DeepZoomTileHUD';

describe('Sprint 66 - DeepZoomTileHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    isPyramidal: true,
    scale: 1.5,
    level: 3,
    maxLevel: 4,
    totalVisible: 6,
    vramMbEstimated: 4.5,
    panX: -200,
    panY: -150,
    viewportWidth: 1920,
    viewportHeight: 1080,
    onToggle: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders floating toggle button when isOpen is false', () => {
    render(<DeepZoomTileHUD {...defaultProps} isOpen={false} />);

    const toggleBtn = screen.getByTestId('deep-zoom-toggle-btn');
    expect(toggleBtn).toBeDefined();
    expect(screen.queryByTestId('deep-zoom-hud-panel')).toBeNull();

    fireEvent.click(toggleBtn);
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders HUD panel and diagnostics when isOpen is true', () => {
    render(<DeepZoomTileHUD {...defaultProps} />);

    expect(screen.getByTestId('deep-zoom-hud-panel')).toBeDefined();
    expect(screen.getByTestId('deep-zoom-level-stat').textContent).toBe('L3 / L4');
    expect(screen.getByTestId('deep-zoom-tiles-stat').textContent).toContain('6 teselas');
    expect(screen.getByTestId('deep-zoom-vram-stat').textContent).toContain('4.5 MB');
    expect(screen.getByTestId('deep-zoom-scale-stat').textContent).toBe('150%');
  });

  it('renders radar mini-map with viewport locator rectangle', () => {
    render(<DeepZoomTileHUD {...defaultProps} />);

    const radar = screen.getByTestId('deep-zoom-radar');
    expect(radar).toBeDefined();

    const rect = screen.getByTestId('deep-zoom-radar-rect');
    expect(rect).toBeDefined();
    expect(rect.style.width).toBeDefined();
    expect(rect.style.height).toBeDefined();
  });

  it('triggers onZoomIn, onZoomOut, and onReset when control buttons are clicked', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onReset = vi.fn();

    render(
      <DeepZoomTileHUD
        {...defaultProps}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onReset={onReset}
      />
    );

    fireEvent.click(screen.getByTestId('deep-zoom-zoom-in-btn'));
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('deep-zoom-zoom-out-btn'));
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('deep-zoom-reset-btn'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('displays direct fallback for non-pyramidal standard pages', () => {
    render(
      <DeepZoomTileHUD
        {...defaultProps}
        isPyramidal={false}
        level={0}
        maxLevel={0}
        totalVisible={1}
      />
    );

    expect(screen.getByTestId('deep-zoom-level-stat').textContent).toBe('L0 (Direct)');
    expect(screen.getByTestId('deep-zoom-tiles-stat').textContent).toContain('1 tesela');
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<DeepZoomTileHUD {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('deep-zoom-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
