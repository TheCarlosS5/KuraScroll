/**
 * KuraScroll Sprint 106: BalloonFontHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BalloonFontHUD } from '../components/reader/BalloonFontHUD';
import { BalloonFontProfile, BalloonFontScaleResult } from '../reader/useBalloonFont';

describe('BalloonFontHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: BalloonFontProfile = {
    seriesId: 'test-series-106',
    scalingMode: 'comfort_legibility',
    minFontSizePx: 12,
    maxFontSizePx: 28,
    targetDensityRatio: 0.65,
    isFuriganaPreserved: true,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: BalloonFontScaleResult = {
    optimalFontSizePx: 18,
    scaleRatio: 1.29,
    lineCapacityEstimate: 18,
    maxCharsEstimate: 72,
    isFuriganaSafe: true,
    isOverflowSafe: true,
    scalingMode: 'comfort_legibility',
    latencyUs: 0.75,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <BalloonFontHUD
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

  it('renders HUD with telemetry and SVG bubble preview when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <BalloonFontHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByRole('region', { name: /balloon font hud/i })).toBeDefined();
    expect(screen.getByText('Balloon Font Auto-Scaler')).toBeDefined();
    expect(screen.getByText('SLA 70')).toBeDefined();
    expect(screen.getByText(/18px \(1.29x\)/i)).toBeDefined();
    expect(screen.getByText('ふりがな')).toBeDefined();

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /close hud/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click Large Print preset
    const largePrintBtn = screen.getByRole('button', { name: /large print/i });
    fireEvent.click(largePrintBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('large_print');
  });
});
