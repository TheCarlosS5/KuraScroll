import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InkTrappingHUD } from '../components/reader/InkTrappingHUD';

describe('InkTrappingHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<InkTrappingHUD seriesId="series-it-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Ink Trapping & Misregistration HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', {
      name: /Subpixel Mechanical Rotary Press Plate Misregistration & Ink Trapping HUD/i,
    });
    expect(hud).toBeDefined();
    expect(screen.getByText(/INK TRAPPING/i)).toBeDefined();
    expect(screen.getAllByText(/SLA 95/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows switching presets, trapping modes, and closing HUD', () => {
    render(<InkTrappingHUD seriesId="series-it-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Ink Trapping & Misregistration HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Cyan ΔX:/i)).toBeDefined();
    expect(screen.getByText(/Magenta ΔX:/i)).toBeDefined();
    expect(screen.getByText(/Yellow ΔX:/i)).toBeDefined();
    expect(screen.getByText(/Trapping Dilation Width:/i)).toBeDefined();

    // Select preset option button
    const centerfoldBtn = screen.getByText(/Shōnen Color Centerfold/i);
    fireEvent.click(centerfoldBtn);

    // Switch mode to spread
    const spreadBtn = screen.getByRole('button', { name: /^spread$/i });
    fireEvent.click(spreadBtn);

    // Toggle active/bypass
    const bypassBtn = screen.getByText('ACTIVE');
    fireEvent.click(bypassBtn);
    expect(screen.getByText('BYPASS')).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close HUD \(Shift\+T\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
