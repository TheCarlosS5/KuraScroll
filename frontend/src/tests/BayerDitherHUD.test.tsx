import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BayerDitherHUD } from '../components/reader/BayerDitherHUD';

describe('BayerDitherHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<BayerDitherHUD seriesId="series-bayer-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Bayer Dither De-Banding HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('bayer-dither-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Bayer Dither Matrix/i)).toBeDefined();
    expect(screen.getByText(/SLA 83/i)).toBeDefined();
  });

  it('allows switching presets and adjusting matrix size', () => {
    render(<BayerDitherHUD seriesId="series-bayer-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Bayer Dither De-Banding HUD/i);
    fireEvent.click(triggerBtn);

    // Switch preset
    const darkBtn = screen.getByText(/Dark Interface Minimal/i);
    fireEvent.click(darkBtn);

    // Toggle 4x4
    const grid4Btn = screen.getByText('4×4 Grid');
    fireEvent.click(grid4Btn);
    expect(screen.getByText(/4×4 Ordered Bayer Grid/i)).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(Hotkey: B\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('bayer-dither-hud')).toBeNull();
  });
});
