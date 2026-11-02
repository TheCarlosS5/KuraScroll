/**
 * KuraScroll Sprint 93: PageCurlHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageCurlHUD } from '../components/reader/PageCurlHUD';

describe('PageCurlHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <PageCurlHUD
        isVisible={false}
        onClose={vi.fn()}
        preset="tankobon_stiff"
        onPresetChange={vi.fn()}
        paperStiffness={0.85}
        onStiffnessChange={vi.fn()}
        maxCurlAngleDeg={45.0}
        onMaxAngleChange={vi.fn()}
        shadowDepth={0.40}
        onShadowDepthChange={vi.fn()}
        isPeelCornerEnabled={true}
        onToggleCornerPeel={vi.fn()}
        dragProgress={0.0}
        onDragProgressChange={vi.fn()}
        effectiveAngleDeg={0}
        cornerPeelPercent={0}
        shadowOpacity={0}
        isCompleted={false}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
        isRtl={true}
        onToggleRtl={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry and handles interactions when visible', () => {
    const onClose = vi.fn();
    const onPresetChange = vi.fn();
    const onToggleEnabled = vi.fn();
    const onStiffnessChange = vi.fn();

    render(
      <PageCurlHUD
        isVisible={true}
        onClose={onClose}
        preset="tankobon_stiff"
        onPresetChange={onPresetChange}
        paperStiffness={0.85}
        onStiffnessChange={onStiffnessChange}
        maxCurlAngleDeg={45.0}
        onMaxAngleChange={vi.fn()}
        shadowDepth={0.40}
        onShadowDepthChange={vi.fn()}
        isPeelCornerEnabled={true}
        onToggleCornerPeel={vi.fn()}
        dragProgress={0.50}
        onDragProgressChange={vi.fn()}
        effectiveAngleDeg={-22.5}
        cornerPeelPercent={38.5}
        shadowOpacity={0.40}
        isCompleted={false}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
        isRtl={true}
        onToggleRtl={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: /Page Curl Physics HUD/i })).toBeDefined();
    expect(screen.getByText('PAGE CURL & TURN HUD [K]')).toBeDefined();
    expect(screen.getByText('-22.5°')).toBeDefined();
    expect(screen.getByText('38.5%')).toBeDefined();
    expect(screen.getByText('Peeling')).toBeDefined();

    // Preset selection
    const silkBtn = screen.getByRole('button', { name: 'Silk' });
    fireEvent.click(silkBtn);
    expect(onPresetChange).toHaveBeenCalledWith('doujin_silk');

    // Slider adjustment
    const stiffnessSlider = screen.getByRole('slider', { name: 'Paper Stiffness' });
    fireEvent.change(stiffnessSlider, { target: { value: '0.70' } });
    expect(onStiffnessChange).toHaveBeenCalledWith(0.70);

    // Toggle enabled button
    const toggleBtn = screen.getByRole('button', { name: 'Disable Page Curl Engine' });
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close HUD' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
