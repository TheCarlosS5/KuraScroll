import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeedLineHUD } from '../components/reader/SpeedLineHUD';

describe('SpeedLineHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // HTMLCanvasElement mock for jsdom
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
      lineCap: '',
      lineWidth: 1,
      globalAlpha: 1,
      font: '',
      textAlign: '',
    });
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<SpeedLineHUD seriesId="series-sl-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Speed-Line Synthesizer HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByRole('dialog', { name: /Speed-Line Synthesizer HUD/i });
    expect(hud).toBeDefined();
    expect(screen.getByText(/SPEED-LINE FOCUS/i)).toBeDefined();
    expect(screen.getByText(/SLA 89/i)).toBeDefined();
  });

  it('allows switching presets and triggering impact pulse', () => {
    render(<SpeedLineHUD seriesId="series-sl-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Speed-Line Synthesizer HUD/i);
    fireEvent.click(triggerBtn);

    // Verify elements
    expect(screen.getByText(/Lines Rendered/i)).toBeDefined();
    expect(screen.getByText(/Synthesis Latency/i)).toBeDefined();

    // Switch preset
    const dashBtn = screen.getByText(/Dash & Sprint Parallel Sweep/i);
    fireEvent.click(dashBtn);

    // Trigger pulse
    const pulseBtn = screen.getByText(/TRIGGER IMPACT PULSE/i);
    fireEvent.click(pulseBtn);

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(L\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
