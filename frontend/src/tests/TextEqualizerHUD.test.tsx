/**
 * KuraScroll Sprint 97: TextEqualizerHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextEqualizerHUD } from '../components/reader/TextEqualizerHUD';

describe('TextEqualizerHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <TextEqualizerHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="newsprint_vintage"
        onModeChange={vi.fn()}
        blackLevelBoost={0.35}
        onBlackLevelBoostChange={vi.fn()}
        whiteLevelCompression={0.20}
        onWhiteLevelCompressionChange={vi.fn()}
        kanjiClarityFactor={1.30}
        onKanjiClarityFactorChange={vi.fn()}
        isFuriganaSharpenEnabled={true}
        onToggleFuriganaSharpen={vi.fn()}
        effectiveContrast={1.16}
        effectiveBrightness={0.98}
        effectiveGamma={0.92}
        edgeSharpenPx={0.18}
        compositeFilterCss="contrast(1.16) brightness(0.98)"
        subpixelMatrixCss="drop-shadow(0.18px 0 0 rgba(0,0,0,0.40))"
        isHighDensityBoostActive={true}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry and handles interactions when visible', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleEnabled = vi.fn();
    const onToggleFuriganaSharpen = vi.fn();
    const onBlackLevelBoostChange = vi.fn();

    render(
      <TextEqualizerHUD
        isVisible={true}
        onClose={onClose}
        mode="newsprint_vintage"
        onModeChange={onModeChange}
        blackLevelBoost={0.35}
        onBlackLevelBoostChange={onBlackLevelBoostChange}
        whiteLevelCompression={0.20}
        onWhiteLevelCompressionChange={vi.fn()}
        kanjiClarityFactor={1.30}
        onKanjiClarityFactorChange={vi.fn()}
        isFuriganaSharpenEnabled={true}
        onToggleFuriganaSharpen={onToggleFuriganaSharpen}
        effectiveContrast={1.16}
        effectiveBrightness={0.98}
        effectiveGamma={0.92}
        edgeSharpenPx={0.18}
        compositeFilterCss="contrast(1.16) brightness(0.98)"
        subpixelMatrixCss="drop-shadow(0.18px 0 0 rgba(0,0,0,0.40))"
        isHighDensityBoostActive={true}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByRole('region', { name: /Text & Kanji Edge Equalizer HUD/i })).toBeDefined();
    expect(screen.getByText('Text & Kanji Equalizer')).toBeDefined();
    expect(screen.getByText('[E]')).toBeDefined();
    expect(screen.getByText('+35%')).toBeDefined();
    expect(screen.getByText('20%')).toBeDefined();
    expect(screen.getByText('1.30x')).toBeDefined();
    expect(screen.getByText('DYNAMIC BOOST ON')).toBeDefined();
    expect(screen.getByText('ACTIVE')).toBeDefined();
    expect(screen.getByText('ENABLED')).toBeDefined();

    // Mode switch
    const glossyBtn = screen.getByText('💎 Glossy');
    fireEvent.click(glossyBtn);
    expect(onModeChange).toHaveBeenCalledWith('glossy_digital');

    // Furigana toggle
    const furiganaBtn = screen.getByText('ENABLED');
    fireEvent.click(furiganaBtn);
    expect(onToggleFuriganaSharpen).toHaveBeenCalled();

    // Engine toggle
    const activeBtn = screen.getByText('ACTIVE');
    fireEvent.click(activeBtn);
    expect(onToggleEnabled).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByRole('button', { name: /Close HUD/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
