/**
 * KuraScroll Sprint 96: CreaseShadowHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreaseShadowHUD } from '../components/reader/CreaseShadowHUD';

describe('CreaseShadowHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <CreaseShadowHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="tankobon_tight"
        onModeChange={vi.fn()}
        spineShadowIntensity={0.65}
        onIntensityChange={vi.fn()}
        gutterWidthPx={24}
        onGutterWidthChange={vi.fn()}
        asymmetryRatio={0.50}
        onAsymmetryChange={vi.fn()}
        isRtl={true}
        onToggleRtl={vi.fn()}
        progressRatio={0.50}
        onProgressChange={vi.fn()}
        leftGutterWidthPx={12}
        rightGutterWidthPx={12}
        leftShadowOpacity={0.36}
        rightShadowOpacity={0.36}
        effectiveAsymmetry={0.00}
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
    const onGutterWidthChange = vi.fn();

    render(
      <CreaseShadowHUD
        isVisible={true}
        onClose={onClose}
        mode="tankobon_tight"
        onModeChange={onModeChange}
        spineShadowIntensity={0.65}
        onIntensityChange={vi.fn()}
        gutterWidthPx={24}
        onGutterWidthChange={onGutterWidthChange}
        asymmetryRatio={0.50}
        onAsymmetryChange={vi.fn()}
        isRtl={true}
        onToggleRtl={vi.fn()}
        progressRatio={0.50}
        onProgressChange={vi.fn()}
        leftGutterWidthPx={14}
        rightGutterWidthPx={10}
        leftShadowOpacity={0.42}
        rightShadowOpacity={0.30}
        effectiveAsymmetry={0.20}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByRole('region', { name: /Dual-Page Crease Shadow HUD/i })).toBeDefined();
    expect(screen.getByText('CREASE SHADOW & GUTTER [C]')).toBeDefined();
    expect(screen.getByText('14 px')).toBeDefined();
    expect(screen.getByText('10 px')).toBeDefined();
    expect(screen.getByText('42%')).toBeDefined();
    expect(screen.getByText('30%')).toBeDefined();

    // Mode selection
    const flatBtn = screen.getByRole('button', { name: 'Flat-Lay' });
    fireEvent.click(flatBtn);
    expect(onModeChange).toHaveBeenCalledWith('flat_lay');

    // Slider adjustment
    const gutterSlider = screen.getByRole('slider', { name: 'Gutter Base Width' });
    fireEvent.change(gutterSlider, { target: { value: '32' } });
    expect(onGutterWidthChange).toHaveBeenCalledWith(32);

    // Toggle enabled button
    const toggleBtn = screen.getByRole('button', { name: 'Disable Crease Engine' });
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close HUD' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
