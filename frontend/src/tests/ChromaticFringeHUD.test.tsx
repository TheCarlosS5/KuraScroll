/**
 * KuraScroll Sprint 91: ChromaticFringeHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChromaticFringeHUD } from '../components/reader/ChromaticFringeHUD';

describe('ChromaticFringeHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <ChromaticFringeHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="subpixel_rgb"
        onModeChange={vi.fn()}
        fringeRadiusPx={0.75}
        onFringeRadiusChange={vi.fn()}
        desaturationStrength={0.60}
        onDesaturationStrengthChange={vi.fn()}
        sharpeningAmount={1.25}
        onSharpeningAmountChange={vi.fn()}
        cssFilterString="saturate(64%) contrast(106%)"
        svgMatrixString="0 -0.375 0 -0.375 2.5 -0.375 0 -0.375 0"
        effectiveContrastMultiplier={1.34}
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

    render(
      <ChromaticFringeHUD
        isVisible={true}
        onClose={onClose}
        mode="subpixel_rgb"
        onModeChange={onModeChange}
        fringeRadiusPx={0.75}
        onFringeRadiusChange={vi.fn()}
        desaturationStrength={0.60}
        onDesaturationStrengthChange={vi.fn()}
        sharpeningAmount={1.25}
        onSharpeningAmountChange={vi.fn()}
        cssFilterString="saturate(64%) contrast(106%)"
        svgMatrixString="0 -0.375 0 -0.375 2.5 -0.375 0 -0.375 0"
        effectiveContrastMultiplier={1.34}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByText('Subpixel ClearType HUD [U]')).toBeDefined();
    expect(screen.getAllByText('0.75px').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('60%')).toBeDefined();
    expect(screen.getAllByText('1.25x').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1.34x')).toBeDefined();
    expect(screen.getByText('saturate(64%) contrast(106%)')).toBeDefined();

    // Test close button
    const closeBtn = screen.getByRole('button', { name: /Close Fringe HUD/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    // Test preset button
    const inkBtn = screen.getByText('Pure Ink');
    fireEvent.click(inkBtn);
    expect(onModeChange).toHaveBeenCalledWith('monochrome_ink');

    // Test toggle enable button
    const toggleBtn = screen.getByRole('button', { name: /Neutralizer Active/i });
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalled();
  });
});
