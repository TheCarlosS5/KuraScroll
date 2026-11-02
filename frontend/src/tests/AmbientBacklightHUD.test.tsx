import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmbientBacklightHUD } from '../components/reader/AmbientBacklightHUD';

describe('Sprint 80 - AmbientBacklightHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <AmbientBacklightHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        kelvin={6500}
        luminance={1.0}
        blueLightReduction={0.0}
        paperTintMode="neutral"
        circadianAuto={false}
        onToggleEnabled={vi.fn()}
        onChangeKelvin={vi.fn()}
        onChangeLuminance={vi.fn()}
        onChangeBlueLightReduction={vi.fn()}
        onChangePaperTintMode={vi.fn()}
        onToggleCircadianAuto={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and controls when isOpen is true', () => {
    render(
      <AmbientBacklightHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        kelvin={4500}
        luminance={0.95}
        blueLightReduction={0.25}
        paperTintMode="warm_amber"
        circadianAuto={false}
        onToggleEnabled={vi.fn()}
        onChangeKelvin={vi.fn()}
        onChangeLuminance={vi.fn()}
        onChangeBlueLightReduction={vi.fn()}
        onChangePaperTintMode={vi.fn()}
        onToggleCircadianAuto={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Luz Ambiental & Circadiana/i)).toBeDefined();
    expect(screen.getByText('4500 K')).toBeDefined();
    expect(screen.getByText('95%')).toBeDefined();
    expect(screen.getByText('25%')).toBeDefined();
    expect(screen.getByText('Activado')).toBeDefined();
  });

  it('triggers onToggleEnabled when main toggle is clicked', () => {
    const onToggleEnabled = vi.fn();
    render(
      <AmbientBacklightHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        kelvin={6500}
        luminance={1.0}
        blueLightReduction={0.0}
        paperTintMode="neutral"
        circadianAuto={false}
        onToggleEnabled={onToggleEnabled}
        onChangeKelvin={vi.fn()}
        onChangeLuminance={vi.fn()}
        onChangeBlueLightReduction={vi.fn()}
        onChangePaperTintMode={vi.fn()}
        onToggleCircadianAuto={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const toggleBtn = screen.getByText('Activado');
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleCircadianAuto when circadian button is clicked', () => {
    const onToggleCircadianAuto = vi.fn();
    render(
      <AmbientBacklightHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        kelvin={6500}
        luminance={1.0}
        blueLightReduction={0.0}
        paperTintMode="neutral"
        circadianAuto={false}
        onToggleEnabled={vi.fn()}
        onChangeKelvin={vi.fn()}
        onChangeLuminance={vi.fn()}
        onChangeBlueLightReduction={vi.fn()}
        onChangePaperTintMode={vi.fn()}
        onToggleCircadianAuto={onToggleCircadianAuto}
        onResetToDefaults={vi.fn()}
      />
    );

    const circadianBtn = screen.getByText('Manual');
    fireEvent.click(circadianBtn);
    expect(onToggleCircadianAuto).toHaveBeenCalledWith(true);
  });

  it('triggers onChangePaperTintMode when a preset is clicked', () => {
    const onChangePaperTintMode = vi.fn();
    render(
      <AmbientBacklightHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        kelvin={6500}
        luminance={1.0}
        blueLightReduction={0.0}
        paperTintMode="neutral"
        circadianAuto={false}
        onToggleEnabled={vi.fn()}
        onChangeKelvin={vi.fn()}
        onChangeLuminance={vi.fn()}
        onChangeBlueLightReduction={vi.fn()}
        onChangePaperTintMode={onChangePaperTintMode}
        onToggleCircadianAuto={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const sunsetBtn = screen.getByText('Atardecer');
    fireEvent.click(sunsetBtn);
    expect(onChangePaperTintMode).toHaveBeenCalledWith('sunset');
  });

  it('triggers slider changes and reset', () => {
    const onChangeKelvin = vi.fn();
    const onResetToDefaults = vi.fn();

    render(
      <AmbientBacklightHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        kelvin={6500}
        luminance={1.0}
        blueLightReduction={0.0}
        paperTintMode="neutral"
        circadianAuto={false}
        onToggleEnabled={vi.fn()}
        onChangeKelvin={onChangeKelvin}
        onChangeLuminance={vi.fn()}
        onChangeBlueLightReduction={vi.fn()}
        onChangePaperTintMode={vi.fn()}
        onToggleCircadianAuto={vi.fn()}
        onResetToDefaults={onResetToDefaults}
      />
    );

    const kelvinSlider = screen.getByLabelText(/Temperatura de color en grados Kelvin/i);
    fireEvent.change(kelvinSlider, { target: { value: '3000' } });
    expect(onChangeKelvin).toHaveBeenCalledWith(3000);

    const resetBtn = screen.getByText('Restablecer Ajustes Predeterminados');
    fireEvent.click(resetBtn);
    expect(onResetToDefaults).toHaveBeenCalledTimes(1);
  });
});
