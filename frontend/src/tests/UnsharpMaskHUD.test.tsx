import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnsharpMaskHUD } from '../components/reader/UnsharpMaskHUD';

describe('UnsharpMaskHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<UnsharpMaskHUD seriesId="series-unsharp-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Unsharp Mask Sharpening HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('unsharp-mask-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Unsharp Mask Sharpening/i)).toBeDefined();
    expect(screen.getByText(/SLA 86/i)).toBeDefined();
  });

  it('allows switching presets and adjusts sliders', () => {
    render(<UnsharpMaskHUD seriesId="series-unsharp-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Unsharp Mask Sharpening HUD/i);
    fireEvent.click(triggerBtn);

    // Verify 5-point stencil grid and status
    expect(screen.getByText(/5-Point Cross Stencil/i)).toBeDefined();
    expect(screen.getByText(/Adaptive Weight/i)).toBeDefined();
    expect(screen.getByText(/Anti-Halo Ringing Guard/i)).toBeDefined();

    // Switch preset
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'tankobon_ink_accent' } });
    expect(screen.getByText(/Deepened ink boundaries and linework definition/i)).toBeDefined();

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(Hotkey: U\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('unsharp-mask-hud')).toBeNull();
  });
});
