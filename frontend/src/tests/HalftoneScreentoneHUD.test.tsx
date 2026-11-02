import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HalftoneScreentoneHUD } from '../components/reader/HalftoneScreentoneHUD';

describe('Sprint 77 - HalftoneScreentoneHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <HalftoneScreentoneHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={false}
        presetName="pristine"
        dotPitchLpi={60}
        dotAngleDeg={45.0}
        dotIntensity={0.0}
        paperAgePct={0.0}
        foxingIntensity={0.0}
        onToggleEnabled={vi.fn()}
        onSelectPreset={vi.fn()}
        onChangeDotPitchLpi={vi.fn()}
        onChangeDotAngleDeg={vi.fn()}
        onChangeDotIntensity={vi.fn()}
        onChangePaperAgePct={vi.fn()}
        onChangeFoxingIntensity={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and controls when isOpen is true', () => {
    render(
      <HalftoneScreentoneHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        presetName="shonen_90s"
        dotPitchLpi={60}
        dotAngleDeg={45.0}
        dotIntensity={0.35}
        paperAgePct={0.20}
        foxingIntensity={0.05}
        onToggleEnabled={vi.fn()}
        onSelectPreset={vi.fn()}
        onChangeDotPitchLpi={vi.fn()}
        onChangeDotAngleDeg={vi.fn()}
        onChangeDotIntensity={vi.fn()}
        onChangePaperAgePct={vi.fn()}
        onChangeFoxingIntensity={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Trama Halftone & Papel Retro/i)).toBeDefined();
    expect(screen.getByText('Shōnen 90s')).toBeDefined();
    expect(screen.getByText('Tankōbon')).toBeDefined();
    expect(screen.getByText('60 LPI')).toBeDefined();
    expect(screen.getByText('35%')).toBeDefined();
    expect(screen.getByText(/activado/i)).toBeDefined();
  });

  it('triggers onSelectPreset when a preset button is clicked', () => {
    const onSelectPreset = vi.fn();

    render(
      <HalftoneScreentoneHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        presetName="pristine"
        dotPitchLpi={60}
        dotAngleDeg={45.0}
        dotIntensity={0.0}
        paperAgePct={0.0}
        foxingIntensity={0.0}
        onToggleEnabled={vi.fn()}
        onSelectPreset={onSelectPreset}
        onChangeDotPitchLpi={vi.fn()}
        onChangeDotAngleDeg={vi.fn()}
        onChangeDotIntensity={vi.fn()}
        onChangePaperAgePct={vi.fn()}
        onChangeFoxingIntensity={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const presetBtn = screen.getByText('Tankōbon');
    fireEvent.click(presetBtn);

    expect(onSelectPreset).toHaveBeenCalledWith('tankobon_retro');
  });

  it('triggers onChangeDotPitchLpi when LPI range slider is adjusted', () => {
    const onChangeDotPitchLpi = vi.fn();

    render(
      <HalftoneScreentoneHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        presetName="shonen_90s"
        dotPitchLpi={60}
        dotAngleDeg={45.0}
        dotIntensity={0.35}
        paperAgePct={0.20}
        foxingIntensity={0.05}
        onToggleEnabled={vi.fn()}
        onSelectPreset={vi.fn()}
        onChangeDotPitchLpi={onChangeDotPitchLpi}
        onChangeDotAngleDeg={vi.fn()}
        onChangeDotIntensity={vi.fn()}
        onChangePaperAgePct={vi.fn()}
        onChangeFoxingIntensity={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const slider = screen.getByLabelText(/Resolución Trama LPI/i);
    fireEvent.change(slider, { target: { value: '85' } });

    expect(onChangeDotPitchLpi).toHaveBeenCalledWith(85);
  });

  it('closes dialog on ESC key or close button', () => {
    const onClose = vi.fn();

    render(
      <HalftoneScreentoneHUD
        isOpen={true}
        onClose={onClose}
        isEnabled={true}
        presetName="pristine"
        dotPitchLpi={60}
        dotAngleDeg={45.0}
        dotIntensity={0.0}
        paperAgePct={0.0}
        foxingIntensity={0.0}
        onToggleEnabled={vi.fn()}
        onSelectPreset={vi.fn()}
        onChangeDotPitchLpi={vi.fn()}
        onChangeDotAngleDeg={vi.fn()}
        onChangeDotIntensity={vi.fn()}
        onChangePaperAgePct={vi.fn()}
        onChangeFoxingIntensity={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const closeBtn = screen.getByLabelText('Cerrar panel de halftone');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
