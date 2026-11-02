/**
 * KuraScroll Sprint 88: InertialScrollHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InertialScrollHUD } from '../components/reader/InertialScrollHUD';

describe('InertialScrollHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <InertialScrollHUD
        isVisible={false}
        onClose={vi.fn()}
        preset="natural_paper"
        onPresetChange={vi.fn()}
        currentPos={0}
        targetPos={0}
        velocity={0}
        isResting={true}
        frictionCoefficient={0.90}
        springTension={150.0}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry when visible', () => {
    const onClose = vi.fn();
    const onPresetChange = vi.fn();
    const onToggleEnabled = vi.fn();

    render(
      <InertialScrollHUD
        isVisible={true}
        onClose={onClose}
        preset="natural_paper"
        onPresetChange={onPresetChange}
        currentPos={150}
        targetPos={200}
        velocity={340}
        isResting={false}
        frictionCoefficient={0.90}
        springTension={150.0}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByText('INERTIAL SCROLLER')).toBeDefined();
    expect(screen.getByText('340 px/s')).toBeDefined();
    expect(screen.getByText('GLIDING (60 FPS)')).toBeDefined();
    expect(screen.getByText('90% / step')).toBeDefined();
    expect(screen.getByText('150 N/m')).toBeDefined();
  });

  it('triggers preset change and close actions', () => {
    const onClose = vi.fn();
    const onPresetChange = vi.fn();
    const onToggleEnabled = vi.fn();

    render(
      <InertialScrollHUD
        isVisible={true}
        onClose={onClose}
        preset="natural_paper"
        onPresetChange={onPresetChange}
        currentPos={0}
        targetPos={0}
        velocity={0}
        isResting={true}
        frictionCoefficient={0.90}
        springTension={150.0}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click Glider button
    const gliderBtn = screen.getByText('Glider');
    fireEvent.click(gliderBtn);
    expect(onPresetChange).toHaveBeenCalledWith('smooth_glider');

    // Toggle button
    const toggleBtn = screen.getByText('Scroller Active');
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });
});
