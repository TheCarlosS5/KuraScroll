/**
 * KuraScroll Sprint 105: ChapterSeamHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChapterSeamHUD } from '../components/reader/ChapterSeamHUD';
import { ChapterSeamProfile, ChapterSeamKinematicsResult } from '../reader/useChapterSeam';

describe('ChapterSeamHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: ChapterSeamProfile = {
    seriesId: 'test-series-105',
    decelerationMode: 'smooth_continuous',
    seamThresholdPx: 160,
    dampingFactor: 0.85,
    preBakePanels: 4,
    isMagneticSnap: true,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: ChapterSeamKinematicsResult = {
    adjustedVelocity: 350.2,
    distanceToSeamPx: 120,
    seamResistancePct: 22,
    isPreBakeActive: true,
    preBakePanels: 4,
    isMagneticSnapped: false,
    decelerationMode: 'smooth_continuous',
    latencyUs: 0.85,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <ChapterSeamHUD
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

  it('renders HUD with telemetry and SVG seam radar when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <ChapterSeamHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByRole('region', { name: /chapter seam hud/i })).toBeDefined();
    expect(screen.getByText('Chapter Seam Decelerator')).toBeDefined();
    expect(screen.getByText('SLA 69')).toBeDefined();
    expect(screen.getByText(/120px TO SEAM/i)).toBeDefined();
    expect(screen.getByText('22%')).toBeDefined();

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /close hud/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click Tactile Snap preset
    const tactileBtn = screen.getByRole('button', { name: /tactile volume snap/i });
    fireEvent.click(tactileBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('tactile_snap');
  });
});
