import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InkSplatterHUD } from '../components/reader/InkSplatterHUD';

describe('InkSplatterHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<InkSplatterHUD seriesId="series-is-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Ink Splatter & Bleed Feathering HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', {
      name: /Dynamic Ink Splatter & Bleed Feathering Physics HUD/i,
    });
    expect(hud).toBeDefined();
    expect(screen.getByText(/INK SPLATTER/i)).toBeDefined();
    expect(screen.getAllByText(/SLA 98/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows switching presets, toggling bypass, and closing HUD', () => {
    render(<InkSplatterHUD seriesId="series-is-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Ink Splatter & Bleed Feathering HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Stroke Velocity/i)).toBeDefined();
    expect(screen.getByText(/Capillary Bleed Radius/i)).toBeDefined();
    expect(screen.getByText(/Splatter Droplet Density/i)).toBeDefined();
    expect(screen.getByText(/Paper Wicking Porosity/i)).toBeDefined();
    expect(screen.getByText(/Dynamic Impact Ejection Probe/i)).toBeDefined();

    // Select preset option from dropdown
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'vintage_gpen_newsprint' } });
    expect(screen.getByText(/Traditional dip-pen drawing on unsized recycled pulp/i)).toBeDefined();

    // Toggle enabled / bypass
    const enabledBtn = screen.getByText('ENABLED');
    fireEvent.click(enabledBtn);
    expect(screen.getByText('BYPASS')).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close HUD \(Shift \+ S\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
