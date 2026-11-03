import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoireSuppressorHUD } from '../components/reader/MoireSuppressorHUD';

describe('MoireSuppressorHUD Component', () => {
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
    render(<MoireSuppressorHUD seriesId="series-ms-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Moiré Suppressor HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', { name: /Adaptive Moiré Pattern Suppressor HUD/i });
    expect(hud).toBeDefined();
    expect(screen.getByText(/MOIRÉ SUPPRESSOR/i)).toBeDefined();
    expect(screen.getByText(/SLA 91/i)).toBeDefined();
  });

  it('allows switching presets and closing HUD', () => {
    render(<MoireSuppressorHUD seriesId="series-ms-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Moiré Suppressor HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Suppression Strength/i)).toBeDefined();
    expect(screen.getByText(/Delta Clamp Limit/i)).toBeDefined();
    expect(screen.getByText(/Edge Barrier Threshold/i)).toBeDefined();

    // Select preset option
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'dense_crosshatch_calm' } });

    // Close HUD
    const closeBtn = screen.getByTitle(/Close HUD \(M\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
