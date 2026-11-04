import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BalloonTailHUD } from '../components/reader/BalloonTailHUD';

describe('BalloonTailHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<BalloonTailHUD seriesId="series-tail-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Balloon Tail Pointer HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('balloon-tail-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Balloon Tail Vector/i)).toBeDefined();
    expect(screen.getByText(/SLA 80/i)).toBeDefined();
  });

  it('allows switching presets and adjusting sliders', () => {
    render(<BalloonTailHUD seriesId="series-tail-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Balloon Tail Pointer HUD/i);
    fireEvent.click(triggerBtn);

    // Switch preset
    const expressiveBtn = screen.getByText(/Expressive Dramatic Sweep/i);
    fireEvent.click(expressiveBtn);
    expect(screen.getByText(/Sweeping parabolic curve/i)).toBeDefined();

    // Adjust sliders
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(3);

    // Close HUD
    const closeBtn = screen.getByRole('button', { name: /cerrar|×/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('balloon-tail-hud')).toBeNull();
  });
});
