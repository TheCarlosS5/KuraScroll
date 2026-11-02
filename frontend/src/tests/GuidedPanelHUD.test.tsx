import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuidedPanelHUD } from '../components/reader/GuidedPanelHUD';
import type { UseGuidedPanelPacerResult } from '../reader/useGuidedPanelPacer';

describe('Sprint 68 - GuidedPanelHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMockPacer = (overrides?: Partial<UseGuidedPanelPacerResult>): UseGuidedPanelPacerResult => ({
    isPacingActive: true,
    activePanelIndex: 1,
    activePanel: {
      chapterId: 'ch1',
      pageNumber: 1,
      panelIndex: 1,
      normX: 0.1,
      normY: 0.1,
      normW: 0.4,
      normH: 0.4,
      aspectRatio: 1.0,
      readingOrderScore: 1,
      isSplash: false,
    },
    totalPanels: 4,
    isAutoPlay: false,
    autoPlayIntervalMs: 3500,
    readingMode: 'manga',
    framing: {
      panelIndex: 1,
      panXPercent: 10,
      panYPercent: 10,
      scale: 1.5,
      clamped: false,
      isSplash: false,
      viewportW: 1920,
      viewportH: 1080,
      aspectRatio: 1.0,
    },
    cameraTransformStyle: {
      transform: 'translate3d(10%, 10%, 0) scale(1.5)',
      transition: 'transform 350ms cubic-bezier(0.16, 1, 0.3, 1)',
    },
    togglePacing: vi.fn(),
    setPacingActive: vi.fn(),
    nextPanel: vi.fn(),
    prevPanel: vi.fn(),
    goToPanel: vi.fn(),
    toggleAutoPlay: vi.fn(),
    setAutoPlayIntervalMs: vi.fn(),
    setPanels: vi.fn(),
    ...overrides,
  });

  it('renders HUD container and panel counter badge', () => {
    const pacer = createMockPacer();
    render(<GuidedPanelHUD pacer={pacer} />);

    expect(screen.getByTestId('guided-panel-hud')).toBeDefined();
    expect(screen.getByTestId('panel-counter-badge').textContent).toContain('2');
    expect(screen.getByTestId('panel-counter-badge').textContent).toContain('4');
    expect(screen.getByTestId('reading-mode-badge').textContent).toContain('RTL Manga');
  });

  it('triggers next and prev navigation on button clicks', () => {
    const pacer = createMockPacer();
    render(<GuidedPanelHUD pacer={pacer} />);

    const nextBtn = screen.getByTestId('next-panel-btn');
    fireEvent.click(nextBtn);
    expect(pacer.nextPanel).toHaveBeenCalledTimes(1);

    const prevBtn = screen.getByTestId('prev-panel-btn');
    fireEvent.click(prevBtn);
    expect(pacer.prevPanel).toHaveBeenCalledTimes(1);
  });

  it('triggers pacing mode toggle', () => {
    const pacer = createMockPacer();
    render(<GuidedPanelHUD pacer={pacer} />);

    const toggleBtn = screen.getByTestId('toggle-pacing-btn');
    fireEvent.click(toggleBtn);
    expect(pacer.togglePacing).toHaveBeenCalledTimes(1);
  });

  it('triggers auto-play toggle', () => {
    const pacer = createMockPacer();
    render(<GuidedPanelHUD pacer={pacer} />);

    const autoBtn = screen.getByTestId('autoplay-toggle-btn');
    fireEvent.click(autoBtn);
    expect(pacer.toggleAutoPlay).toHaveBeenCalledTimes(1);
  });

  it('returns null when totalPanels is zero', () => {
    const pacer = createMockPacer({ totalPanels: 0 });
    const { container } = render(<GuidedPanelHUD pacer={pacer} />);
    expect(container.firstChild).toBeNull();
  });
});
