import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CelluloseReliefHUD } from '../components/reader/CelluloseReliefHUD';

describe('CelluloseReliefHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<CelluloseReliefHUD seriesId="series-cr-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Cellulose Relief & Paper Texture HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', {
      name: /Cellulose Fiber Micro-Relief & Paper Grain Texture HUD/i,
    });
    expect(hud).toBeDefined();
    expect(screen.getByText(/CELLULOSE RELIEF/i)).toBeDefined();
    expect(screen.getAllByText(/SLA 97/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows switching presets, toggling bypass, and closing HUD', () => {
    render(<CelluloseReliefHUD seriesId="series-cr-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Cellulose Relief & Paper Texture HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Grain Scale/i)).toBeDefined();
    expect(screen.getByText(/Relief Depth/i)).toBeDefined();
    expect(screen.getByText(/Fiber Density/i)).toBeDefined();
    expect(screen.getByText(/Grazing Light Angle/i)).toBeDefined();
    expect(screen.getByText(/Ink Absorption Barrier Probe/i)).toBeDefined();

    // Select preset option from dropdown
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'shonen_pulp_unbleached' } });
    expect(screen.getByText(/Rustic recycled thermomechanical wood pulp/i)).toBeDefined();

    // Toggle enabled / bypass
    const enabledBtn = screen.getByText('ENABLED');
    fireEvent.click(enabledBtn);
    expect(screen.getByText('BYPASS')).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close HUD \(Shift \+ F\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
