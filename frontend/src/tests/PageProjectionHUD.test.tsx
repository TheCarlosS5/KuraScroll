import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageProjectionHUD } from '../components/reader/PageProjectionHUD';

describe('Sprint 81 - PageProjectionHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <PageProjectionHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        pitch={0.0}
        yaw={0.0}
        perspective={1000}
        keystone={0.0}
        focalPlanePreset="flat_orthodox"
        onToggleEnabled={vi.fn()}
        onChangePitch={vi.fn()}
        onChangeYaw={vi.fn()}
        onChangePerspective={vi.fn()}
        onChangeKeystone={vi.fn()}
        onChangeFocalPlanePreset={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and controls when isOpen is true', () => {
    render(
      <PageProjectionHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        pitch={18.0}
        yaw={5.0}
        perspective={1200}
        keystone={0.25}
        focalPlanePreset="desk_tilt_20"
        onToggleEnabled={vi.fn()}
        onChangePitch={vi.fn()}
        onChangeYaw={vi.fn()}
        onChangePerspective={vi.fn()}
        onChangeKeystone={vi.fn()}
        onChangeFocalPlanePreset={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Perspectiva & Ángulo 3D/i)).toBeDefined();
    expect(screen.getByText('+18°')).toBeDefined();
    expect(screen.getByText('+5°')).toBeDefined();
    expect(screen.getByText('1200 px')).toBeDefined();
    expect(screen.getByText('25%')).toBeDefined();
    expect(screen.getByText('Activado')).toBeDefined();
  });

  it('triggers onToggleEnabled when main toggle button is clicked', () => {
    const onToggleEnabled = vi.fn();
    render(
      <PageProjectionHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        pitch={0.0}
        yaw={0.0}
        perspective={1000}
        keystone={0.0}
        focalPlanePreset="flat_orthodox"
        onToggleEnabled={onToggleEnabled}
        onChangePitch={vi.fn()}
        onChangeYaw={vi.fn()}
        onChangePerspective={vi.fn()}
        onChangeKeystone={vi.fn()}
        onChangeFocalPlanePreset={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const toggleBtn = screen.getByText('Activado');
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });

  it('triggers onChangeFocalPlanePreset when preset button is clicked', () => {
    const onChangeFocalPlanePreset = vi.fn();
    render(
      <PageProjectionHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        pitch={0.0}
        yaw={0.0}
        perspective={1000}
        keystone={0.0}
        focalPlanePreset="flat_orthodox"
        onToggleEnabled={vi.fn()}
        onChangePitch={vi.fn()}
        onChangeYaw={vi.fn()}
        onChangePerspective={vi.fn()}
        onChangeKeystone={vi.fn()}
        onChangeFocalPlanePreset={onChangeFocalPlanePreset}
        onResetToDefaults={vi.fn()}
      />
    );

    const deskBtn = screen.getByText('Atril de Mesa');
    fireEvent.click(deskBtn);
    expect(onChangeFocalPlanePreset).toHaveBeenCalledWith('desk_tilt_20');
  });

  it('triggers slider changes and reset button', () => {
    const onChangePitch = vi.fn();
    const onResetToDefaults = vi.fn();

    render(
      <PageProjectionHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        pitch={0.0}
        yaw={0.0}
        perspective={1000}
        keystone={0.0}
        focalPlanePreset="flat_orthodox"
        onToggleEnabled={vi.fn()}
        onChangePitch={onChangePitch}
        onChangeYaw={vi.fn()}
        onChangePerspective={vi.fn()}
        onChangeKeystone={vi.fn()}
        onChangeFocalPlanePreset={vi.fn()}
        onResetToDefaults={onResetToDefaults}
      />
    );

    const pitchSlider = screen.getByLabelText(/Inclinación vertical en grados/i);
    fireEvent.change(pitchSlider, { target: { value: '25' } });
    expect(onChangePitch).toHaveBeenCalledWith(25);

    const resetBtn = screen.getByText('Restablecer Ajustes Predeterminados');
    fireEvent.click(resetBtn);
    expect(onResetToDefaults).toHaveBeenCalledTimes(1);
  });
});
