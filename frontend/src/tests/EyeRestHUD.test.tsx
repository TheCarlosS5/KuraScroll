/**
 * KuraScroll Sprint 104: EyeRestHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EyeRestHUD } from '../components/reader/EyeRestHUD';
import { EyeRestProfile, EyeRestApertureResult } from '../reader/useEyeRest';

describe('EyeRestHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: EyeRestProfile = {
    seriesId: 'test-series-104',
    shutterMode: 'subtle_vignette',
    apertureRadiusPx: 320,
    falloffPct: 35,
    restIntervalMin: 20,
    eyeCareWarmthK: 3200,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: EyeRestApertureResult = {
    shutterMode: 'subtle_vignette',
    isRestActive: false,
    innerRadiusPx: 208,
    outerRadiusPx: 320,
    radialGradientCss: 'radial-gradient(circle at 640px 360px, rgba(0,0,0,0) 208px, rgba(12,12,14,0.30) 320px)',
    warmthFilterCss: 'sepia(24%)',
    vignetteOpacity: 0.30,
    warmthSepiaPct: 24,
    latencyUs: 1.15,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <EyeRestHUD
        isVisible={false}
        onClose={vi.fn()}
        profile={mockProfile}
        onProfileChange={vi.fn()}
        result={mockResult}
        onApplyPreset={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders HUD with telemetry and SVG focal mask when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <EyeRestHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByRole('region', { name: 'Eye Rest HUD' })).toBeDefined();
    expect(screen.getByText('Eye-Rest Aperture Shutter')).toBeDefined();
    expect(screen.getByText('SLA 68')).toBeDefined();

    // Check telemetry values
    expect(screen.getByText('208px / 320px')).toBeDefined();
    expect(screen.getByText('30%')).toBeDefined();
    expect(screen.getByText('+24% Sepia')).toBeDefined();

    // Interaction with preset button
    const presetBtn = screen.getByText('Focus Spotlight');
    fireEvent.click(presetBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('focus_spotlight');

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
