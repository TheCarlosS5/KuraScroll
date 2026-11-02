import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChromaBleedHUD } from '../components/reader/ChromaBleedHUD';
import {
  ChromaBleedProfile,
  ChromaBleedResult,
  CHROMA_BLEED_PRESETS,
} from '../reader/useChromaBleed';

describe('ChromaBleedHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: ChromaBleedProfile = {
    seriesId: 'test-series-110',
    ...CHROMA_BLEED_PRESETS.sepia_vintage,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: ChromaBleedResult = {
    colorMode: 'sepia_vintage',
    colorTemperatureK: 3200,
    rgbColor: { r: 255, g: 198, b: 126 },
    hexColor: '#ffc67e',
    perceptualLuminance: 206.74,
    bleedSpreadPx: 32,
    ambientIntensityPct: 45,
    topGradient: 'linear-gradient(to bottom, rgba(255, 198, 126, 0.203) 0%, rgba(255, 198, 126, 0.051) 60%, rgba(0, 0, 0, 0) 100%)',
    bottomGradient: 'linear-gradient(to top, rgba(255, 198, 126, 0.203) 0%, rgba(255, 198, 126, 0.051) 60%, rgba(0, 0, 0, 0) 100%)',
    leftGradient: 'linear-gradient(to right, rgba(255, 198, 126, 0.203) 0%, rgba(255, 198, 126, 0.051) 60%, rgba(0, 0, 0, 0) 100%)',
    rightGradient: 'linear-gradient(to left, rgba(255, 198, 126, 0.203) 0%, rgba(255, 198, 126, 0.051) 60%, rgba(0, 0, 0, 0) 100%)',
    perimeterShadow: 'inset 0 0 0 32px rgba(255, 198, 126, 0.051)',
    latencyUs: 0.45,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <ChromaBleedHUD
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

  it('renders HUD with telemetry and handles interactions when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <ChromaBleedHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByText('Ambient Chroma Bleed')).toBeDefined();
    expect(screen.getByText('SLA 74')).toBeDefined();
    expect(screen.getAllByText(/3200 K/).length).toBeGreaterThan(0);

    // Toggle Active button
    const activeBtn = screen.getByText('Active');
    fireEvent.click(activeBtn);
    expect(onProfileChange).toHaveBeenCalledWith({ isEnabled: false });

    // Preset button
    const neonBtn = screen.getByText('High-Saturation Cyberpunk Neon');
    fireEvent.click(neonBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('cyberpunk_neon');

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
