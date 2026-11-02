import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlyphSharpenerHUD } from '../components/reader/GlyphSharpenerHUD';
import {
  GlyphSharpenerProfile,
  GlyphSharpenerResult,
  GLYPH_SHARPENER_PRESETS,
} from '../reader/useGlyphSharpener';

describe('GlyphSharpenerHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: GlyphSharpenerProfile = {
    seriesId: 'test-series-113',
    ...GLYPH_SHARPENER_PRESETS.adaptive_kanji,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: GlyphSharpenerResult = {
    sharpenerMode: 'adaptive_kanji',
    effectiveContrast: 1.125,
    effectiveBrightness: 0.952,
    strokeProtectionFactor: 0.217,
    cssFilter: 'contrast(1.125) brightness(0.952)',
    textRendering: 'geometricPrecision',
    webkitFontSmoothing: 'antialiased',
    isDenseStrokeCompensated: false,
    latencyUs: 0.65,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <GlyphSharpenerHUD
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
      <GlyphSharpenerHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        sampleResult={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByText('Kanji Glyph Sharpener')).toBeDefined();
    expect(screen.getByText('SLA 77')).toBeDefined();
    expect(screen.getByText(/adaptive_kanji/)).toBeDefined();
    expect(screen.getAllByText(/1.125x/).length).toBeGreaterThan(0);

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    // Preset button click
    const presetBtn = screen.getByText('Ruby Furigana');
    fireEvent.click(presetBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('high_contrast_furigana');

    // Checkbox toggle
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onProfileChange).toHaveBeenCalledWith({ isEnabled: false });
  });
});
