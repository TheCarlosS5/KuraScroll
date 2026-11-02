import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextureAtlasHUD } from '../components/reader/TextureAtlasHUD';
import {
  TextureAtlasProfile,
  TextureAtlasPlacementResult,
  TEXTURE_ATLAS_PRESETS,
} from '../reader/useTextureAtlas';

describe('TextureAtlasHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: TextureAtlasProfile = {
    seriesId: 'test-series-112',
    ...TEXTURE_ATLAS_PRESETS.gma_4500mhd_strict,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: TextureAtlasPlacementResult = {
    tileId: 'tile-001',
    atlasIndex: 0,
    x: 4,
    y: 4,
    w: 512,
    h: 512,
    paddedW: 520,
    paddedH: 520,
    u: 0.002,
    v: 0.002,
    du: 0.25,
    dv: 0.25,
    packingDensityPct: 6.25,
    activeAtlasesCount: 1,
    vramUsageMb: 16,
    isEvictionTriggered: false,
    latencyUs: 0.75,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <TextureAtlasHUD
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
      <TextureAtlasHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        sampleResult={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByText('GPU Texture Atlas')).toBeDefined();
    expect(screen.getByText('SLA 76')).toBeDefined();
    expect(screen.getByText(/2048x2048/)).toBeDefined();
    expect(screen.getByText(/6.25%/)).toBeDefined();

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    // Preset button click
    const presetBtn = screen.getByText('4096 HD');
    fireEvent.click(presetBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('hd_canvas_4096');

    // Checkbox toggle
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onProfileChange).toHaveBeenCalledWith({ isEnabled: false });
  });
});
