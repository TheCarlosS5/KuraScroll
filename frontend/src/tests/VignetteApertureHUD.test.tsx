import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VignetteApertureHUD } from '../components/reader/VignetteApertureHUD';

describe('VignetteApertureHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<VignetteApertureHUD seriesId="series-vignette-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Vignette & Aperture DoF HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('vignette-aperture-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Atmospheric Vignette & DoF/i)).toBeDefined();
    expect(screen.getByText(/SLA 85/i)).toBeDefined();
  });

  it('allows switching presets and adjusting focus center', () => {
    render(<VignetteApertureHUD seriesId="series-vignette-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Vignette & Aperture DoF HUD/i);
    fireEvent.click(triggerBtn);

    // Verify reticle and meters
    expect(screen.getByText(/Focal Aperture Reticle/i)).toBeDefined();
    expect(screen.getByText(/Vignette Alpha/i)).toBeDefined();
    expect(screen.getByText(/Edge Contrast/i)).toBeDefined();

    // Switch preset
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'action_tunnel' } });
    expect(screen.getByText(/Intense speed tunnel effect/i)).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(Hotkey: V\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('vignette-aperture-hud')).toBeNull();
  });
});
