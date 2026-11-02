/**
 * KuraScroll Sprint 89: DynamicToneHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DynamicToneHUD } from '../components/reader/DynamicToneHUD';

describe('DynamicToneHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <DynamicToneHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="cinema_night"
        onModeChange={vi.fn()}
        gammaExponent={1.15}
        onGammaChange={vi.fn()}
        blackPointLift={0.04}
        onBlackLiftChange={vi.fn()}
        whitePointCompress={0.92}
        onWhiteCompressChange={vi.fn()}
        contrastPercent={96}
        brightnessPercent={96}
        cssFilterString="contrast(96%) brightness(96%)"
        estimatedNitsDelta={-8.0}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry when visible', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleEnabled = vi.fn();

    render(
      <DynamicToneHUD
        isVisible={true}
        onClose={onClose}
        mode="cinema_night"
        onModeChange={onModeChange}
        gammaExponent={1.15}
        onGammaChange={vi.fn()}
        blackPointLift={0.04}
        onBlackLiftChange={vi.fn()}
        whitePointCompress={0.92}
        onWhiteCompressChange={vi.fn()}
        contrastPercent={95}
        brightnessPercent={98}
        cssFilterString="contrast(95%) brightness(98%)"
        estimatedNitsDelta={-8.0}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByText('HDR Tone-Mapper HUD [X]')).toBeDefined();
    expect(screen.getByText('contrast(95%) brightness(98%)')).toBeDefined();
    expect(screen.getByText('95%')).toBeDefined();
    expect(screen.getByText('98%')).toBeDefined();
    expect(screen.getByText('-8 nits')).toBeDefined();

    // Test close button
    const closeBtn = screen.getByRole('button', { name: /Close Tone HUD/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    // Test preset buttons
    const oledBtn = screen.getByText('OLED Pure');
    fireEvent.click(oledBtn);
    expect(onModeChange).toHaveBeenCalledWith('oled_pure_black');

    // Test toggle enable button
    const toggleBtn = screen.getByRole('button', { name: /Tone Mapping Active/i });
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalled();
  });
});
