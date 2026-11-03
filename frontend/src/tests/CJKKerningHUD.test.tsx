import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CJKKerningHUD } from '../components/reader/CJKKerningHUD';

describe('CJKKerningHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<CJKKerningHUD seriesId="series-cjk-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open CJK Kerning & Stroke Density HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('cjk-kerning-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/CJK Kerning & Stroke Density/i)).toBeDefined();
    expect(screen.getByText(/SLA 88/i)).toBeDefined();
  });

  it('allows switching presets and adjusts sliders', () => {
    render(<CJKKerningHUD seriesId="series-cjk-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open CJK Kerning & Stroke Density HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getAllByText(/Kerning Offset/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Optical Weight/i)).toBeDefined();

    // Switch preset
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'webtoon_hangul_flow' } });
    expect(screen.getByText(/Harmonious letter-spacing for Korean hangul syllables/i)).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(Hotkey: K\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('cjk-kerning-hud')).toBeNull();
  });
});
