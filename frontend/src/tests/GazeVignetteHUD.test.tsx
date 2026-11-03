import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GazeVignetteHUD } from '../components/reader/GazeVignetteHUD';

describe('GazeVignetteHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<GazeVignetteHUD seriesId="series-gaze-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Gaze Stabilizer & Peripheral Vignette HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', { name: /Kinetic Peripheral Vignette & Micro-Saccade Gaze Stabilizer HUD/i });
    expect(hud).toBeDefined();
    expect(screen.getByText(/GAZE STABILIZER/i)).toBeDefined();
    expect(screen.getAllByText(/SLA 93/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows switching presets, toggling bypass, and closing HUD', () => {
    render(<GazeVignetteHUD seriesId="series-gaze-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Gaze Stabilizer & Peripheral Vignette HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Oscillator Frequency \(ω\):/i)).toBeDefined();
    expect(screen.getByText(/Saccade Dead-Zone:/i)).toBeDefined();
    expect(screen.getByText(/Snap Jump Threshold:/i)).toBeDefined();
    expect(screen.getByText(/Deep Focus Tunnel/i)).toBeDefined();

    // Select preset option button
    const burstBtn = screen.getByText(/Shōnen Action Burst/i);
    fireEvent.click(burstBtn);

    // Toggle active/bypass
    const bypassBtn = screen.getByText('ACTIVE');
    fireEvent.click(bypassBtn);
    expect(screen.getByText('BYPASS')).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close HUD \(V\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
