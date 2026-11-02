/**
 * KuraScroll Sprint 99: PanelPacingHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PanelPacingHUD } from '../components/reader/PanelPacingHUD';

describe('PanelPacingHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <PanelPacingHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="cinematic_smooth"
        onModeChange={vi.fn()}
        transitionDurationMs={280}
        onTransitionDurationMsChange={vi.fn()}
        zoomOvershootRatio={1.05}
        onZoomOvershootRatioChange={vi.fn()}
        edgePaddingPx={16}
        onEdgePaddingPxChange={vi.fn()}
        isMotionReduced={false}
        onToggleMotionReduced={vi.fn()}
        sourceAabb={{ x: 0, y: 0, width: 800, height: 600 }}
        targetAabb={{ x: 200, y: 400, width: 600, height: 450 }}
        translateX={120}
        translateY={80}
        scale={1.35}
        isOvershootActive={true}
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
    const onToggleMotionReduced = vi.fn();
    const onTransitionDurationMsChange = vi.fn();

    render(
      <PanelPacingHUD
        isVisible={true}
        onClose={onClose}
        mode="cinematic_smooth"
        onModeChange={onModeChange}
        transitionDurationMs={280}
        onTransitionDurationMsChange={onTransitionDurationMsChange}
        zoomOvershootRatio={1.05}
        onZoomOvershootRatioChange={vi.fn()}
        edgePaddingPx={16}
        onEdgePaddingPxChange={vi.fn()}
        isMotionReduced={false}
        onToggleMotionReduced={onToggleMotionReduced}
        sourceAabb={{ x: 0, y: 0, width: 800, height: 600 }}
        targetAabb={{ x: 200, y: 400, width: 600, height: 450 }}
        translateX={120}
        translateY={80}
        scale={1.35}
        isOvershootActive={true}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByRole('region', { name: /Panel Pacing & Zoom HUD/i })).toBeDefined();
    expect(screen.getByText('Panel Pacing & Zoom')).toBeDefined();
    expect(screen.getByText('[P]')).toBeDefined();
    expect(screen.getByText('OVERSHOOT PRIMED')).toBeDefined();
    expect(screen.getAllByText('280ms').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1.05x')).toBeDefined();
    expect(screen.getByText('16px')).toBeDefined();
    expect(screen.getByText('NORMAL')).toBeDefined();
    expect(screen.getByText('ACTIVE')).toBeDefined();

    // Mode switch
    const actionBtn = screen.getByText('⚡ Fast Action');
    fireEvent.click(actionBtn);
    expect(onModeChange).toHaveBeenCalledWith('dynamic_action');

    // Motion toggle
    const motionBtn = screen.getByText('NORMAL');
    fireEvent.click(motionBtn);
    expect(onToggleMotionReduced).toHaveBeenCalled();

    // Engine toggle
    const activeBtn = screen.getByText('ACTIVE');
    fireEvent.click(activeBtn);
    expect(onToggleEnabled).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByRole('button', { name: /Close HUD/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
