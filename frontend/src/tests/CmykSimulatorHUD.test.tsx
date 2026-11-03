import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CmykSimulatorHUD } from '../components/reader/CmykSimulatorHUD';

describe('CmykSimulatorHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<CmykSimulatorHUD seriesId="series-cmyk-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open CMYK Ink Density Simulator HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', { name: /CMYK Ink Density & Perceptual Gamut Simulator HUD/i });
    expect(hud).toBeDefined();
    expect(screen.getByText(/CMYK SIMULATOR/i)).toBeDefined();
    expect(screen.getByText(/SLA 92/i)).toBeDefined();
  });

  it('allows switching presets and closing HUD', () => {
    render(<CmykSimulatorHUD seriesId="series-cmyk-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open CMYK Ink Density Simulator HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Total Area Coverage \(TAC\):/i)).toBeDefined();
    expect(screen.getByText(/Mechanical Dot Gain:/i)).toBeDefined();
    expect(screen.getByText(/K-Absorption Bleed:/i)).toBeDefined();

    // Select preset option
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'vintage_faded_pulp' } });

    // Close HUD
    const closeBtn = screen.getByTitle(/Close HUD \(Shift\+C\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
