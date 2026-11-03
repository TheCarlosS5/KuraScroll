import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MotionDeblurHUD } from '../components/reader/MotionDeblurHUD';

describe('MotionDeblurHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<MotionDeblurHUD seriesId="series-md-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Motion Deblur & Response Overdrive HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', {
      name: /Kinetic Scrolling Motion Deblur & Retinal Persistence Overdrive HUD/i,
    });
    expect(hud).toBeDefined();
    expect(screen.getByText(/MOTION OVERDRIVE/i)).toBeDefined();
    expect(screen.getAllByText(/SLA 96/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows switching presets, toggling bypass, and closing HUD', () => {
    render(<MotionDeblurHUD seriesId="series-md-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Motion Deblur & Response Overdrive HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Overdrive Gain \(k_od\):/i)).toBeDefined();
    expect(screen.getByText(/Velocity Half-Point:/i)).toBeDefined();
    expect(screen.getByText(/Max Impulse Clamp:/i)).toBeDefined();
    expect(screen.getByText(/TN Panel Response Overdrive/i)).toBeDefined();

    // Select preset option button
    const flickBtn = screen.getByText(/Webtoon High-Speed Flick/i);
    fireEvent.click(flickBtn);

    // Toggle active/bypass
    const bypassBtn = screen.getByText('ACTIVE');
    fireEvent.click(bypassBtn);
    expect(screen.getByText('BYPASS')).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close HUD \(Shift\+M\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
