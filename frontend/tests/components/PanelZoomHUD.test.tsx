import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelZoomHUD } from '../../src/components/reader/PanelZoomHUD';
import { PanelBox } from '../../src/reader/usePanelNavigation';

describe('Sprint 55: PanelZoomHUD Component Suite', () => {
  const mockPanel: PanelBox = {
    id: 'p1',
    chapterId: 'ch1',
    pageNumber: 1,
    panelIndex: 0,
    x: 50,
    y: 0,
    w: 50,
    h: 40,
    aspectRatio: 1.25,
    readingOrder: 0
  };

  it('renders nothing if totalPanels is zero', () => {
    const { container } = render(
      <PanelZoomHUD
        isZoomed={false}
        activePanelIndex={0}
        totalPanels={0}
        activePanel={null}
        onToggleZoom={vi.fn()}
        onNextPanel={vi.fn()}
        onPrevPanel={vi.fn()}
        onResetZoom={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders unzoomed HUD with toggle button', () => {
    const onToggleZoom = vi.fn();
    render(
      <PanelZoomHUD
        isZoomed={false}
        activePanelIndex={0}
        totalPanels={4}
        activePanel={null}
        onToggleZoom={onToggleZoom}
        onNextPanel={vi.fn()}
        onPrevPanel={vi.fn()}
        onResetZoom={vi.fn()}
      />
    );

    const toggleBtn = screen.getByTestId('toggle-zoom-btn');
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.textContent).toContain('Modo Viñetas');

    fireEvent.click(toggleBtn);
    expect(onToggleZoom).toHaveBeenCalledTimes(1);

    // Counter and navigation buttons not visible when unzoomed
    expect(screen.queryByTestId('panel-counter')).toBeNull();
  });

  it('renders active zoomed HUD with counter and triggers navigation buttons', () => {
    const onNextPanel = vi.fn();
    const onPrevPanel = vi.fn();
    const onResetZoom = vi.fn();

    render(
      <PanelZoomHUD
        isZoomed={true}
        activePanelIndex={1}
        totalPanels={5}
        activePanel={mockPanel}
        onToggleZoom={vi.fn()}
        onNextPanel={onNextPanel}
        onPrevPanel={onPrevPanel}
        onResetZoom={onResetZoom}
        readingDirection="RTL"
      />
    );

    expect(screen.getByTestId('panel-counter').textContent).toBe('2 / 5');
    expect(screen.getByTestId('direction-badge').textContent).toBe('RTL');

    const nextBtn = screen.getByTestId('next-panel-btn');
    const prevBtn = screen.getByTestId('prev-panel-btn');
    const resetBtn = screen.getByTestId('reset-zoom-btn');

    fireEvent.click(nextBtn);
    expect(onNextPanel).toHaveBeenCalledTimes(1);

    fireEvent.click(prevBtn);
    expect(onPrevPanel).toHaveBeenCalledTimes(1);

    fireEvent.click(resetBtn);
    expect(onResetZoom).toHaveBeenCalledTimes(1);
  });
});
