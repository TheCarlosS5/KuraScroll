import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EyeCareFilterHUD } from '../../src/components/reader/EyeCareFilterHUD.js';

describe('EyeCareFilterHUD Component Unit Tests (Sprint 50)', () => {
  it('renders all filter preset options and slider controls', () => {
    render(
      <EyeCareFilterHUD
        currentMode="default"
        brightnessPct={100}
        contrastPct={100}
        blueLightPct={0}
        isMonochromePage={true}
        onSelectMode={vi.fn()}
        onChangeBrightness={vi.fn()}
        onChangeContrast={vi.fn()}
        onChangeBlueLight={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByTestId('eye-care-hud')).toBeDefined();
    expect(screen.getByTestId('filter-btn-default')).toBeDefined();
    expect(screen.getByTestId('filter-btn-sepia_warm')).toBeDefined();
    expect(screen.getByTestId('filter-btn-oled_dark')).toBeDefined();
    expect(screen.getByTestId('filter-btn-smart_invert')).toBeDefined();
    expect(screen.getByTestId('filter-btn-e_ink_high_contrast')).toBeDefined();
    expect(screen.getByTestId('slider-brightness')).toBeDefined();
    expect(screen.getByTestId('slider-contrast')).toBeDefined();
    expect(screen.getByTestId('slider-blue-light')).toBeDefined();
  });

  it('selects preset mode when button clicked', () => {
    const handleSelectMode = vi.fn();
    render(
      <EyeCareFilterHUD
        currentMode="default"
        brightnessPct={100}
        contrastPct={100}
        blueLightPct={0}
        isMonochromePage={true}
        onSelectMode={handleSelectMode}
        onChangeBrightness={vi.fn()}
        onChangeContrast={vi.fn()}
        onChangeBlueLight={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('filter-btn-smart_invert'));
    expect(handleSelectMode).toHaveBeenCalledWith('smart_invert');
  });

  it('displays active smart invert status badge depending on monochrome page status', () => {
    const { rerender } = render(
      <EyeCareFilterHUD
        currentMode="smart_invert"
        brightnessPct={100}
        contrastPct={100}
        blueLightPct={0}
        isMonochromePage={true}
        onSelectMode={vi.fn()}
        onChangeBrightness={vi.fn()}
        onChangeContrast={vi.fn()}
        onChangeBlueLight={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByTestId('smart-invert-badge')).toBeDefined();
    expect(screen.getByText(/Inversión OLED activa/i)).toBeDefined();

    rerender(
      <EyeCareFilterHUD
        currentMode="smart_invert"
        brightnessPct={100}
        contrastPct={100}
        blueLightPct={0}
        isMonochromePage={false}
        onSelectMode={vi.fn()}
        onChangeBrightness={vi.fn()}
        onChangeContrast={vi.fn()}
        onChangeBlueLight={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText(/Fidelidad cromática preservada/i)).toBeDefined();
  });

  it('handles slider adjustments and reset action', () => {
    const handleBrightness = vi.fn();
    const handleContrast = vi.fn();
    const handleReset = vi.fn();

    render(
      <EyeCareFilterHUD
        currentMode="sepia_warm"
        brightnessPct={90}
        contrastPct={110}
        blueLightPct={30}
        isMonochromePage={true}
        onSelectMode={vi.fn()}
        onChangeBrightness={handleBrightness}
        onChangeContrast={handleContrast}
        onChangeBlueLight={vi.fn()}
        onReset={handleReset}
      />
    );

    fireEvent.change(screen.getByTestId('slider-brightness'), { target: { value: '95' } });
    expect(handleBrightness).toHaveBeenCalledWith(95);

    fireEvent.change(screen.getByTestId('slider-contrast'), { target: { value: '115' } });
    expect(handleContrast).toHaveBeenCalledWith(115);

    fireEvent.click(screen.getByTestId('reset-filters-btn'));
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('cycles filter mode on "I" keyboard shortcut', () => {
    const handleSelectMode = vi.fn();
    render(
      <EyeCareFilterHUD
        currentMode="default"
        brightnessPct={100}
        contrastPct={100}
        blueLightPct={0}
        isMonochromePage={true}
        onSelectMode={handleSelectMode}
        onChangeBrightness={vi.fn()}
        onChangeContrast={vi.fn()}
        onChangeBlueLight={vi.fn()}
        onReset={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'i' });
    expect(handleSelectMode).toHaveBeenCalledWith('sepia_warm');
  });
});
