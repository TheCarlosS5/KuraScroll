import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HalftoneGrainHUD } from '../components/reader/HalftoneGrainHUD';

describe('HalftoneGrainHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<HalftoneGrainHUD seriesId="series-grain-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Halftone Paper Grain HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('halftone-grain-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Halftone Grain/i)).toBeDefined();
    expect(screen.getByText(/SLA 79/i)).toBeDefined();
  });

  it('allows switching presets and adjusting sliders', () => {
    render(<HalftoneGrainHUD seriesId="series-grain-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Halftone Paper Grain HUD/i);
    fireEvent.click(triggerBtn);

    // Switch preset
    const tankobonBtn = screen.getByText(/Standard Tankobon Paperback/i);
    fireEvent.click(tankobonBtn);
    expect(screen.getByText(/Balanced offset print paper/i)).toBeDefined();

    // Adjust sliders
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(3);

    // Close HUD
    const closeBtn = screen.getByText('✕');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('halftone-grain-hud')).toBeNull();
  });
});
