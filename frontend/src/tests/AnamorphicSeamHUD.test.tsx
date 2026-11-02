import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnamorphicSeamHUD } from '../components/reader/AnamorphicSeamHUD';
import {
  AnamorphicSeamProfile,
  AnamorphicSeamResult,
  ANAMORPHIC_SEAM_PRESETS,
} from '../reader/useAnamorphicSeam';

describe('AnamorphicSeamHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: AnamorphicSeamProfile = {
    seriesId: 'test-series-111',
    ...ANAMORPHIC_SEAM_PRESETS.anamorphic_4_3_to_16_9,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: AnamorphicSeamResult = {
    aspectRatioMode: 'anamorphic_4_3_to_16_9',
    unsqueezeFactor: 1.3333,
    seamOverlapPx: 0.75,
    subpixelSnappingMode: 'cumulative_origin',
    sliceIndex: 0,
    rawStartY: 0,
    rawEndY: 1200,
    rawHeight: 1200,
    renderedStartY: 0,
    renderedEndY: 1600,
    renderedHeight: 1600,
    transformCss: 'scaleY(1.3333)',
    marginBottomCss: '-0.75px',
    latencyUs: 0.85,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <AnamorphicSeamHUD
        isVisible={false}
        onClose={vi.fn()}
        profile={mockProfile}
        onProfileChange={vi.fn()}
        sampleResult={mockResult}
        onApplyPreset={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders HUD with telemetry and handles interactions when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <AnamorphicSeamHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        sampleResult={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByText('Seam Stitch & Un-Squeeze')).toBeDefined();
    expect(screen.getByText('SLA 75')).toBeDefined();
    expect(screen.getByText(/anamorphic_4_3_to_16_9/)).toBeDefined();
    expect(screen.getAllByText(/1.3333x/).length).toBeGreaterThan(0);

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    // Preset button click
    const nativeBtn = screen.getByText('1:1 Native');
    fireEvent.click(nativeBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('native');

    // Checkbox toggle
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onProfileChange).toHaveBeenCalledWith({ isEnabled: false });
  });
});
