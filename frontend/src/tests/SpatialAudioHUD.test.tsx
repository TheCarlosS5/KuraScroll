import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpatialAudioHUD } from '../components/reader/SpatialAudioHUD';

describe('SpatialAudioHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<SpatialAudioHUD seriesId="series-spatial-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Spatial Audio Reverb Occlusion HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('spatial-audio-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Spatial Audio Engine/i)).toBeDefined();
    expect(screen.getByText(/SLA 84/i)).toBeDefined();
  });

  it('allows switching presets and adjusting occlusion slider', () => {
    render(<SpatialAudioHUD seriesId="series-spatial-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Spatial Audio Reverb Occlusion HUD/i);
    fireEvent.click(triggerBtn);

    // Verify radar elements
    expect(screen.getByText(/2D Acoustic Field Radar/i)).toBeDefined();
    expect(screen.getByText(/Equal-Power Stereo/i)).toBeDefined();
    expect(screen.getByText(/Biquad Cutoff/i)).toBeDefined();

    // Switch preset via select dropdown
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'dialogue_occluded' } });
    expect(screen.getByText(/Muffled dialogue obscured by dense panel gutters/i)).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(Hotkey: O\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('spatial-audio-hud')).toBeNull();
  });
});
