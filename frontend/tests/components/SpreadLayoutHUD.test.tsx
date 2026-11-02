import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpreadLayoutHUD } from '../../src/components/reader/SpreadLayoutHUD.js';

describe('SpreadLayoutHUD Component Unit Tests (Sprint 51)', () => {
  it('renders all layout options and direction toggle', () => {
    render(
      <SpreadLayoutHUD
        currentMode="auto_split"
        readingDirection="rtl"
        seamBleedPx={0.75}
        isSpreadCandidate={true}
        onSelectMode={vi.fn()}
        onToggleReadingDirection={vi.fn()}
        onChangeSeamBleed={vi.fn()}
      />
    );

    expect(screen.getByTestId('spread-layout-hud')).toBeDefined();
    expect(screen.getByTestId('spread-mode-auto_split')).toBeDefined();
    expect(screen.getByTestId('spread-mode-force_single')).toBeDefined();
    expect(screen.getByTestId('spread-mode-dual_spread')).toBeDefined();
    expect(screen.getByTestId('spread-mode-webtoon_stitch')).toBeDefined();
    expect(screen.getByTestId('direction-toggle-btn')).toBeDefined();
    expect(screen.getByTestId('spread-candidate-pill')).toBeDefined();
    expect(screen.getByTestId('slider-seam-bleed')).toBeDefined();
  });

  it('triggers onSelectMode when mode button clicked', () => {
    const handleSelectMode = vi.fn();
    render(
      <SpreadLayoutHUD
        currentMode="auto_split"
        readingDirection="rtl"
        seamBleedPx={0.75}
        onSelectMode={handleSelectMode}
        onToggleReadingDirection={vi.fn()}
        onChangeSeamBleed={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('spread-mode-webtoon_stitch'));
    expect(handleSelectMode).toHaveBeenCalledWith('webtoon_stitch');
  });

  it('toggles reading direction when direction button clicked', () => {
    const handleToggleDirection = vi.fn();
    render(
      <SpreadLayoutHUD
        currentMode="auto_split"
        readingDirection="rtl"
        seamBleedPx={0.75}
        onSelectMode={vi.fn()}
        onToggleReadingDirection={handleToggleDirection}
        onChangeSeamBleed={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('direction-toggle-btn'));
    expect(handleToggleDirection).toHaveBeenCalledTimes(1);
  });

  it('adjusts seam bleed slider value', () => {
    const handleSeamBleed = vi.fn();
    render(
      <SpreadLayoutHUD
        currentMode="webtoon_stitch"
        readingDirection="ltr"
        seamBleedPx={0.75}
        onSelectMode={vi.fn()}
        onToggleReadingDirection={vi.fn()}
        onChangeSeamBleed={handleSeamBleed}
      />
    );

    const slider = screen.getByTestId('slider-seam-bleed');
    fireEvent.change(slider, { target: { value: '1.25' } });
    expect(handleSeamBleed).toHaveBeenCalledWith(1.25);
  });

  it('cycles mode on "S" keyboard shortcut', () => {
    const handleSelectMode = vi.fn();
    render(
      <SpreadLayoutHUD
        currentMode="auto_split"
        readingDirection="rtl"
        seamBleedPx={0.75}
        onSelectMode={handleSelectMode}
        onToggleReadingDirection={vi.fn()}
        onChangeSeamBleed={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 's' });
    expect(handleSelectMode).toHaveBeenCalledWith('force_single');
  });
});
