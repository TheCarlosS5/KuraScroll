/**
 * KuraScroll Sprint 103: InkBleedHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InkBleedHUD } from '../components/reader/InkBleedHUD';
import { InkBleedProfile, InkBleedCompensationResult } from '../reader/useInkBleed';

describe('InkBleedHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: InkBleedProfile = {
    seriesId: 'test-series-103',
    compensationMode: 'vintage_newsprint',
    blackPointLift: 0.08,
    whitePointCompression: 0.95,
    gammaExponent: 1.15,
    inkBleedThreshold: 0.18,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: InkBleedCompensationResult = {
    compensationMode: 'vintage_newsprint',
    effectiveGamma: 1.15,
    contrastMultiplier: 87,
    brightnessOffset: 105,
    svgFilterSlope: 0.87,
    svgFilterIntercept: 0.08,
    cssFilterString: 'contrast(87%) brightness(105%)',
    latencyUs: 1.12,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <InkBleedHUD
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

  it('renders HUD with telemetry and SVG transfer curve when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <InkBleedHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByRole('region', { name: 'Ink Bleed HUD' })).toBeDefined();
    expect(screen.getByText('Ink Bleed & Tone Compensator')).toBeDefined();
    expect(screen.getByText('SLA 67')).toBeDefined();

    // Check telemetry values
    expect(screen.getByText('87%')).toBeDefined();
    expect(screen.getByText('105%')).toBeDefined();

    // Interaction with preset button
    const presetBtn = screen.getByText('Halftone Clarity');
    fireEvent.click(presetBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('halftone_clarity');

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
