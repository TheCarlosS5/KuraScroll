import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AcousticReverbHUD } from '../components/reader/AcousticReverbHUD';
import {
  AcousticReverbProfile,
  AcousticReverbResult,
  ACOUSTIC_REVERB_PRESETS,
} from '../reader/useAcousticReverb';

describe('AcousticReverbHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: AcousticReverbProfile = {
    seriesId: 'test-series-108',
    ...ACOUSTIC_REVERB_PRESETS.confined_room,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: AcousticReverbResult = {
    sceneEnvironment: 'confined_room',
    t60DecayS: 1.20,
    feedbackGain: 0.817,
    dampingFreqHz: 2800.0,
    earlyReflectionTapsMs: [18, 31, 47, 63],
    wetGain: 0.529,
    dryGain: 0.848,
    isStable: true,
    latencyUs: 0.65,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <AcousticReverbHUD
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
      <AcousticReverbHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByText('Acoustic Echo & Reverb')).toBeDefined();
    expect(screen.getByText('SLA 72')).toBeDefined();
    expect(screen.getByText(/T₆₀: 1.20s/)).toBeDefined();

    // Toggle Reverb button
    const reverbBtn = screen.getByText('Reverb: ACTIVE');
    fireEvent.click(reverbBtn);
    expect(onProfileChange).toHaveBeenCalledWith({ isEnabled: false });

    // Preset click
    const caveBtn = screen.getByText('cave echo');
    fireEvent.click(caveBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('cave_echo');

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
