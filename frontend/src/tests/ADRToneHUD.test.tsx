import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ADRToneHUD } from '../components/reader/ADRToneHUD';

describe('ADRToneHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<ADRToneHUD seriesId="series-adr-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open ADR Tone Curve & Black-Crush HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('adr-tone-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/ADR Tone & Black-Crush Recovery/i)).toBeDefined();
    expect(screen.getByText(/SLA 87/i)).toBeDefined();
  });

  it('allows switching presets and adjusts sliders', () => {
    render(<ADRToneHUD seriesId="series-adr-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open ADR Tone Curve & Black-Crush HUD/i);
    fireEvent.click(triggerBtn);

    // Verify curve elements and status
    expect(screen.getByText(/Piecewise Dynamic Range Transfer/i)).toBeDefined();
    expect(screen.getByText(/Shadow Lift \(Toe\)/i)).toBeDefined();
    expect(screen.getByText(/Highlight Shoulder/i)).toBeDefined();

    // Switch preset
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'shonen_deep_black' } });
    expect(screen.getByText(/Punchy shonen dynamics keeping deep silhouettes crisp/i)).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(Hotkey: R\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('adr-tone-hud')).toBeNull();
  });
});
