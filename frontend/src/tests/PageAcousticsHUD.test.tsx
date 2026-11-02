import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageAcousticsHUD } from '../components/reader/PageAcousticsHUD';

describe('Sprint 82 - PageAcousticsHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <PageAcousticsHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        paperSubstrate="tankobon"
        volume={0.65}
        stereoPanningEnabled={true}
        hapticPulseEnabled={true}
        hapticIntensity={0.5}
        onToggleEnabled={vi.fn()}
        onToggleStereoPanning={vi.fn()}
        onToggleHapticPulse={vi.fn()}
        onChangePaperSubstrate={vi.fn()}
        onChangeVolume={vi.fn()}
        onChangeHapticIntensity={vi.fn()}
        onPlayTestAcoustic={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and controls when isOpen is true', () => {
    render(
      <PageAcousticsHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        paperSubstrate="tankobon"
        volume={0.7}
        stereoPanningEnabled={true}
        hapticPulseEnabled={true}
        hapticIntensity={0.6}
        onToggleEnabled={vi.fn()}
        onToggleStereoPanning={vi.fn()}
        onToggleHapticPulse={vi.fn()}
        onChangePaperSubstrate={vi.fn()}
        onChangeVolume={vi.fn()}
        onChangeHapticIntensity={vi.fn()}
        onPlayTestAcoustic={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Acústica de Páginas & Háptica/i)).toBeDefined();
    expect(screen.getByText('Tankōbon Estándar')).toBeDefined();
    expect(screen.getByText('Papel Periódico Pulpa')).toBeDefined();
    expect(screen.getByText('70%')).toBeDefined();
    expect(screen.getByText('60%')).toBeDefined();
    expect(screen.getByText('Activado')).toBeDefined();
  });

  it('triggers onToggleEnabled when main toggle button is clicked', () => {
    const onToggleEnabled = vi.fn();
    render(
      <PageAcousticsHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        paperSubstrate="tankobon"
        volume={0.65}
        stereoPanningEnabled={true}
        hapticPulseEnabled={true}
        hapticIntensity={0.5}
        onToggleEnabled={onToggleEnabled}
        onToggleStereoPanning={vi.fn()}
        onToggleHapticPulse={vi.fn()}
        onChangePaperSubstrate={vi.fn()}
        onChangeVolume={vi.fn()}
        onChangeHapticIntensity={vi.fn()}
        onPlayTestAcoustic={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const toggleBtn = screen.getByText('Activado');
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });

  it('triggers onChangePaperSubstrate when substrate button is clicked', () => {
    const onChangePaperSubstrate = vi.fn();
    render(
      <PageAcousticsHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        paperSubstrate="tankobon"
        volume={0.65}
        stereoPanningEnabled={true}
        hapticPulseEnabled={true}
        hapticIntensity={0.5}
        onToggleEnabled={vi.fn()}
        onToggleStereoPanning={vi.fn()}
        onToggleHapticPulse={vi.fn()}
        onChangePaperSubstrate={onChangePaperSubstrate}
        onChangeVolume={vi.fn()}
        onChangeHapticIntensity={vi.fn()}
        onPlayTestAcoustic={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const newsprintBtn = screen.getByText('Papel Periódico Pulpa');
    fireEvent.click(newsprintBtn);
    expect(onChangePaperSubstrate).toHaveBeenCalledWith('newsprint');
  });

  it('triggers onPlayTestAcoustic when test button is clicked', () => {
    const onPlayTestAcoustic = vi.fn();
    render(
      <PageAcousticsHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        paperSubstrate="tankobon"
        volume={0.65}
        stereoPanningEnabled={true}
        hapticPulseEnabled={true}
        hapticIntensity={0.5}
        onToggleEnabled={vi.fn()}
        onToggleStereoPanning={vi.fn()}
        onToggleHapticPulse={vi.fn()}
        onChangePaperSubstrate={vi.fn()}
        onChangeVolume={vi.fn()}
        onChangeHapticIntensity={vi.fn()}
        onPlayTestAcoustic={onPlayTestAcoustic}
        onResetToDefaults={vi.fn()}
      />
    );

    const testBtn = screen.getByText(/Probar Crujido/i);
    fireEvent.click(testBtn);
    expect(onPlayTestAcoustic).toHaveBeenCalledTimes(1);
  });

  it('triggers slider adjustments and reset button', () => {
    const onChangeVolume = vi.fn();
    const onResetToDefaults = vi.fn();

    render(
      <PageAcousticsHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        paperSubstrate="tankobon"
        volume={0.5}
        stereoPanningEnabled={true}
        hapticPulseEnabled={true}
        hapticIntensity={0.5}
        onToggleEnabled={vi.fn()}
        onToggleStereoPanning={vi.fn()}
        onToggleHapticPulse={vi.fn()}
        onChangePaperSubstrate={vi.fn()}
        onChangeVolume={onChangeVolume}
        onChangeHapticIntensity={vi.fn()}
        onPlayTestAcoustic={vi.fn()}
        onResetToDefaults={onResetToDefaults}
      />
    );

    const volumeSlider = screen.getByLabelText(/Nivel de volumen acústico/i);
    fireEvent.change(volumeSlider, { target: { value: '0.85' } });
    expect(onChangeVolume).toHaveBeenCalledWith(0.85);

    const resetBtn = screen.getByText('Restablecer Ajustes Predeterminados');
    fireEvent.click(resetBtn);
    expect(onResetToDefaults).toHaveBeenCalledTimes(1);
  });
});
