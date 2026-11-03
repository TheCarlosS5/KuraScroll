import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperLightingHUD } from '../components/reader/PaperLightingHUD';

describe('PaperLightingHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<PaperLightingHUD seriesId="series-pl-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Paper Lighting & Reflection HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', {
      name: /Subpixel Matte Paper Specular Reflection & Angular Lighting Modulator HUD/i,
    });
    expect(hud).toBeDefined();
    expect(screen.getByText(/PAPER LIGHTING/i)).toBeDefined();
    expect(screen.getAllByText(/SLA 94/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows switching presets, toggling bypass, and closing HUD', () => {
    render(<PaperLightingHUD seriesId="series-pl-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Paper Lighting & Reflection HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Lamp Altitude \(Z\):/i)).toBeDefined();
    expect(screen.getByText(/Diffuse \(k_d\):/i)).toBeDefined();
    expect(screen.getByText(/Specular \(k_s\):/i)).toBeDefined();
    expect(screen.getByText(/Tankōbon Deluxe Matte Paper/i)).toBeDefined();

    // Select preset option button
    const satinBtn = screen.getByText(/Doujinshi Satin Coated Paper/i);
    fireEvent.click(satinBtn);

    // Toggle active/bypass
    const bypassBtn = screen.getByText('ACTIVE');
    fireEvent.click(bypassBtn);
    expect(screen.getByText('BYPASS')).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close HUD \(Shift\+L\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
