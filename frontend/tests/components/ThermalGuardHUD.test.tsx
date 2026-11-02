import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThermalGuardHUD } from '../../src/components/reader/ThermalGuardHUD.js';

describe('ThermalGuardHUD Component Unit Tests (Sprint 54)', () => {
  it('renders nominal_60 state with green 60 FPS label', () => {
    render(
      <ThermalGuardHUD
        governorState="nominal_60"
        fps={59.8}
        dropRatePct={1.2}
      />
    );

    expect(screen.getByTestId('thermal-guard-hud')).toBeDefined();
    expect(screen.getByTestId('governor-label')).toBeDefined();
    expect(screen.getByText('60 FPS')).toBeDefined();
  });

  it('renders paced_30 state with yellow label', () => {
    render(
      <ThermalGuardHUD
        governorState="paced_30"
        fps={30.0}
        dropRatePct={16.5}
      />
    );

    expect(screen.getByText('30 FPS Paced')).toBeDefined();
  });

  it('renders emergency_step state with orange label', () => {
    render(
      <ThermalGuardHUD
        governorState="emergency_step"
        fps={18.0}
        dropRatePct={28.0}
      />
    );

    expect(screen.getByText('Step Mode')).toBeDefined();
  });

  it('triggers onToggleOverride when clicked', () => {
    const handleToggle = vi.fn();
    render(
      <ThermalGuardHUD
        governorState="nominal_60"
        fps={60.0}
        dropRatePct={0.0}
        onToggleOverride={handleToggle}
      />
    );

    fireEvent.click(screen.getByTestId('thermal-guard-hud'));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('displays manual override chip when isManualOverride is true', () => {
    render(
      <ThermalGuardHUD
        governorState="paced_30"
        fps={30.0}
        dropRatePct={0.0}
        isManualOverride={true}
      />
    );

    expect(screen.getByTestId('manual-override-chip')).toBeDefined();
  });

  it('renders dot mode correctly', () => {
    render(
      <ThermalGuardHUD
        governorState="nominal_60"
        fps={60.0}
        dropRatePct={0.0}
        displayMode="dot"
      />
    );

    expect(screen.getByTestId('thermal-guard-dot')).toBeDefined();
  });
});
