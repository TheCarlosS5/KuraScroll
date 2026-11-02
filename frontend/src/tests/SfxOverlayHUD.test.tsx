import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SfxOverlayHUD } from '../components/reader/SfxOverlayHUD';
import type { SfxPageAnnotation } from '../reader/useSfxOverlay';

describe('Sprint 67 - SfxOverlayHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockAnnotation: SfxPageAnnotation = {
    id: 1,
    chapterId: 'ch_onepiece_1',
    pageNumber: 10,
    sfxId: 102,
    normX: 0.3,
    normY: 0.4,
    normW: 0.2,
    normH: 0.2,
    rotationDeg: -5,
    isVertical: false,
    sfx: {
      id: 102,
      surface: 'ドン!!',
      normalizedSurface: 'ドン',
      languageCode: 'ja',
      category: 'GIONGO',
      romanization: 'Don!!',
      meaningEs: 'Revelación impactante',
      meaningEn: 'Dramatic reveal',
      translationEs: '¡DON!!',
      translationEn: '¡BOOM!!',
      stylePreset: 'IMPACT_BOLD',
      intensity: 1.0,
    },
    displayTranslation: '¡DON!!',
  };

  const defaultProps = {
    isVisible: true,
    mode: 'TRANSLATED_OVERLAY' as const,
    targetLanguage: 'es' as const,
    annotations: [mockAnnotation],
    selectedAnnotation: null,
    onToggleVisibility: vi.fn(),
    onSelectMode: vi.fn(),
    onSelectLanguage: vi.fn(),
    onSelectAnnotation: vi.fn(),
  };

  it('renders HUD controls bar with mode and language selectors', () => {
    render(<SfxOverlayHUD {...defaultProps} />);

    expect(screen.getByTestId('sfx-hud-controls')).toBeDefined();
    expect(screen.getByTestId('sfx-mode-selector')).toBeDefined();
    expect(screen.getByTestId('sfx-lang-selector')).toBeDefined();
    expect(screen.getByTestId('sfx-count-badge').textContent).toContain('1 SFX');
  });

  it('renders SVG translation layer with comic manga text when in TRANSLATED_OVERLAY mode', () => {
    render(<SfxOverlayHUD {...defaultProps} />);

    const svgLayer = screen.getByTestId('sfx-svg-layer');
    expect(svgLayer).toBeDefined();

    const sfxItem = screen.getByTestId('sfx-item-1');
    expect(sfxItem).toBeDefined();
    expect(sfxItem.textContent).toContain('¡DON!!');
  });

  it('triggers onToggleVisibility when toggle button is clicked', () => {
    const onToggle = vi.fn();
    render(<SfxOverlayHUD {...defaultProps} onToggleVisibility={onToggle} />);

    fireEvent.click(screen.getByTestId('sfx-toggle-btn'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('switches modes and languages when buttons are clicked', () => {
    const onSelectMode = vi.fn();
    const onSelectLanguage = vi.fn();

    render(
      <SfxOverlayHUD
        {...defaultProps}
        onSelectMode={onSelectMode}
        onSelectLanguage={onSelectLanguage}
      />
    );

    fireEvent.click(screen.getByTestId('sfx-mode-tooltip-btn'));
    expect(onSelectMode).toHaveBeenCalledWith('INTERACTIVE_TOOLTIP');

    fireEvent.click(screen.getByTestId('sfx-lang-en-btn'));
    expect(onSelectLanguage).toHaveBeenCalledWith('en');
  });

  it('renders interactive popover dialog when an annotation is selected', () => {
    render(<SfxOverlayHUD {...defaultProps} selectedAnnotation={mockAnnotation} />);

    expect(screen.getByTestId('sfx-detail-popover')).toBeDefined();
    expect(screen.getByText('ドン!!')).toBeDefined();
    expect(screen.getByText('(Don!!)')).toBeDefined();
    expect(screen.getByTestId('sfx-meaning-text').textContent).toBe('Revelación impactante');
    expect(screen.getByTestId('sfx-translation-text').textContent).toBe('¡DON!!');
  });

  it('calls onSelectAnnotation(null) when popover close button is clicked', () => {
    const onSelectAnnotation = vi.fn();
    render(
      <SfxOverlayHUD
        {...defaultProps}
        selectedAnnotation={mockAnnotation}
        onSelectAnnotation={onSelectAnnotation}
      />
    );

    fireEvent.click(screen.getByTestId('sfx-popover-close-btn'));
    expect(onSelectAnnotation).toHaveBeenCalledWith(null);
  });
});
