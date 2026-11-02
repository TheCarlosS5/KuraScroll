/**
 * KuraScroll Sprint 95: MotionStabilizerHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MotionStabilizerHUD } from '../components/reader/MotionStabilizerHUD';

describe('MotionStabilizerHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <MotionStabilizerHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="smooth_spring"
        onModeChange={vi.fn()}
        dampingCoefficient={0.75}
        onDampingChange={vi.fn()}
        velocityThresholdPx={350.0}
        onThresholdChange={vi.fn()}
        contrastBoostFactor={1.25}
        onContrastBoostChange={vi.fn()}
        isAntiGhostingEnabled={true}
        onToggleAntiGhosting={vi.fn()}
        currentVelocityPx={0}
        smoothedVelocityPx={0}
        stabilizedDeltaY={0}
        contrastScale={1.00}
        isHighSpeedDrag={false}
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
    const onDampingChange = vi.fn();

    render(
      <MotionStabilizerHUD
        isVisible={true}
        onClose={onClose}
        mode="smooth_spring"
        onModeChange={onModeChange}
        dampingCoefficient={0.75}
        onDampingChange={onDampingChange}
        velocityThresholdPx={350.0}
        onThresholdChange={vi.fn()}
        contrastBoostFactor={1.25}
        onContrastBoostChange={vi.fn()}
        isAntiGhostingEnabled={true}
        onToggleAntiGhosting={vi.fn()}
        currentVelocityPx={400}
        smoothedVelocityPx={220}
        stabilizedDeltaY={18.5}
        contrastScale={1.15}
        isHighSpeedDrag={false}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByRole('region', { name: /Motion Deblur & Stabilizer HUD/i })).toBeDefined();
    expect(screen.getByText('MOTION STABILIZER HUD [M]')).toBeDefined();
    expect(screen.getByText('220 px/s (63%)')).toBeDefined();
    expect(screen.getByText('18.5 px')).toBeDefined();
    expect(screen.getByText('×1.15')).toBeDefined();

    // Mode selection
    const heavyBtn = screen.getByRole('button', { name: 'Heavy Inertia' });
    fireEvent.click(heavyBtn);
    expect(onModeChange).toHaveBeenCalledWith('high_inertia_damping');

    // Slider adjustment
    const dampingSlider = screen.getByRole('slider', { name: 'Damping Coefficient' });
    fireEvent.change(dampingSlider, { target: { value: '0.85' } });
    expect(onDampingChange).toHaveBeenCalledWith(0.85);

    // Toggle enabled button
    const toggleBtn = screen.getByRole('button', { name: 'Disable Motion Stabilizer' });
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close HUD' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
