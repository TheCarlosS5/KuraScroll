import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LensDistortionHUD } from '../components/reader/LensDistortionHUD';

describe('LensDistortionHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
    });
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<LensDistortionHUD seriesId="series-ld-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Lens Distortion & Chromatic Aberration HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', { name: /Lens Distortion & Chromatic Compensator HUD/i });
    expect(hud).toBeDefined();
    expect(screen.getByText(/OPTICAL LENS & CHROMA/i)).toBeDefined();
    expect(screen.getByText(/SLA 90/i)).toBeDefined();
  });

  it('allows switching presets and closing HUD', () => {
    render(<LensDistortionHUD seriesId="series-ld-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Lens Distortion & Chromatic Aberration HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Distortion Factor/i)).toBeDefined();
    expect(screen.getByText(/Evaluation Latency/i)).toBeDefined();

    // Switch preset
    const barrelBtn = screen.getByText(/Aged Lens Barrel Distortion/i);
    fireEvent.click(barrelBtn);

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(C\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
