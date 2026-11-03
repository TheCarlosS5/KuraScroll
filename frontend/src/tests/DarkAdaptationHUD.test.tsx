import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DarkAdaptationHUD } from '../components/reader/DarkAdaptationHUD';

describe('DarkAdaptationHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<DarkAdaptationHUD seriesId="series-da-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Dark Adaptation Retinal HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('dark-adaptation-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Retinal Adaptation/i)).toBeDefined();
    expect(screen.getByText(/SLA 82/i)).toBeDefined();
  });

  it('allows switching presets and triggering luminance simulation', () => {
    render(<DarkAdaptationHUD seriesId="series-da-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Dark Adaptation Retinal HUD/i);
    fireEvent.click(triggerBtn);

    // Switch preset
    const shonenBtn = screen.getByText(/Night Shonen \(Action Contrast\)/i);
    fireEvent.click(shonenBtn);

    // Click splash simulation
    const splashBtn = screen.getByText(/Splash \(95%\)/i);
    fireEvent.click(splashBtn);

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(Hotkey: D\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('dark-adaptation-hud')).toBeNull();
  });
});
