/**
 * KuraScroll Sprint 92: AmbientGlowHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmbientGlowHUD } from '../components/reader/AmbientGlowHUD';

describe('AmbientGlowHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <AmbientGlowHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="cinematic_reactive"
        onModeChange={vi.fn()}
        glowSpreadPx={64}
        onSpreadChange={vi.fn()}
        glowOpacity={0.45}
        onOpacityChange={vi.fn()}
        featherSmoothness={1.20}
        onSmoothnessChange={vi.fn()}
        topGradientCss="linear-gradient(to top, rgba(40, 40, 50, 0.45) 0%, transparent 77px)"
        combinedBoxGlowCss="inset 0 0 77px rgba(40, 40, 50, 0.23)"
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry and handles interactions when visible', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleEnabled = vi.fn();

    render(
      <AmbientGlowHUD
        isVisible={true}
        onClose={onClose}
        mode="cinematic_reactive"
        onModeChange={onModeChange}
        glowSpreadPx={64}
        onSpreadChange={vi.fn()}
        glowOpacity={0.45}
        onOpacityChange={vi.fn()}
        featherSmoothness={1.20}
        onSmoothnessChange={vi.fn()}
        topGradientCss="linear-gradient(to top, rgba(40, 40, 50, 0.45) 0%, transparent 77px)"
        combinedBoxGlowCss="inset 0 0 77px rgba(40, 40, 50, 0.23)"
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByText('Ambient Border Bleed HUD [G]')).toBeDefined();
    expect(screen.getAllByText('64px').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('45%')).toBeDefined();
    expect(screen.getAllByText('1.20x').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('77px')).toBeDefined();

    // Test close button
    const closeBtn = screen.getByRole('button', { name: /Close Glow HUD/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    // Test mode button
    const darkMonoBtn = screen.getByText('Dark Mono');
    fireEvent.click(darkMonoBtn);
    expect(onModeChange).toHaveBeenCalledWith('dark_monochrome_dim');

    // Test toggle enable button
    const toggleBtn = screen.getByRole('button', { name: /Border Bleed Active/i });
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalled();
  });
});
