import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AmbilightBackdrop } from '../../src/components/reader/AmbilightBackdrop';
import { RGBColor } from '../../src/utils/ambient-color-extractor';

describe('AmbilightBackdrop Component (Intel GMA 4500MHD Target)', () => {
  const sampleColor: RGBColor = { r: 50, g: 120, b: 240 };

  it('renders hardware-accelerated presentation container with zero-blur guarantee', () => {
    const { container } = render(
      <AmbilightBackdrop
        ambientColor={sampleColor}
        enabled={true}
        opacity={0.3}
        theme="midnight"
      />
    );

    const backdrop = screen.getByTestId('ambilight-backdrop');
    expect(backdrop).toBeDefined();
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');

    // Strict zero-blur assertion for Intel GMA 4500MHD
    const styleAttr = backdrop.getAttribute('style') || '';
    const classAttr = backdrop.getAttribute('class') || '';

    expect(styleAttr).not.toContain('blur');
    expect(classAttr).not.toContain('blur');
    expect(styleAttr).toContain('radial-gradient');
    expect(styleAttr).toContain('rgba(50, 120, 240');
  });

  it('clamps effective opacity on OLED theme to prevent blinding contrast', () => {
    render(
      <AmbilightBackdrop
        ambientColor={sampleColor}
        enabled={true}
        opacity={0.4}
        theme="oled"
      />
    );

    const backdrop = screen.getByTestId('ambilight-backdrop');
    const styleAttr = backdrop.getAttribute('style') || '';

    // Opacity should be clamped to <= 0.14
    expect(styleAttr).toContain('0.14');
  });

  it('degrades to flat dark background when thermalSaverActive is true', () => {
    render(
      <AmbilightBackdrop
        ambientColor={sampleColor}
        enabled={true}
        thermalSaverActive={true}
      />
    );

    const backdrop = screen.getByTestId('ambilight-backdrop');
    const styleAttr = backdrop.getAttribute('style') || '';

    expect(styleAttr).not.toContain('radial-gradient');
    expect(styleAttr).toContain('background-color: rgb(8, 12, 20)');
  });

  it('degrades to pure black when theme is OLED and disabled', () => {
    render(
      <AmbilightBackdrop
        ambientColor={sampleColor}
        enabled={false}
        theme="oled"
      />
    );

    const backdrop = screen.getByTestId('ambilight-backdrop');
    const styleAttr = backdrop.getAttribute('style') || '';

    expect(styleAttr).not.toContain('radial-gradient');
    expect(styleAttr).toContain('background-color: rgb(0, 0, 0)');
  });
});
