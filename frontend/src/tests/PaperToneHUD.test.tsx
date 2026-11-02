import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperToneHUD } from '../components/reader/PaperToneHUD.js';

describe('Sprint 64 - PaperToneHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    preset: 'SEPIA_CALIDO' as const,
    warmth: 0.25,
    contrast: 1.1,
    brightness: 0.95,
    svgMatrix: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0',
    onSelectPreset: vi.fn(),
    onChangeWarmth: vi.fn(),
    onChangeContrast: vi.fn(),
    onChangeBrightness: vi.fn(),
    onSave: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders SVG filter element in DOM even when modal is closed', () => {
    const { container } = render(<PaperToneHUD {...defaultProps} isOpen={false} />);
    const filter = container.querySelector('#kura-paper-tone-filter');
    expect(filter).not.toBeNull();
    // Modal dialog itself should not exist
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal dialog when isOpen is true with preset options', () => {
    render(<PaperToneHUD {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Tinte de Papel & Remapeo E-Ink')).toBeDefined();
    expect(screen.getByText('Original')).toBeDefined();
    expect(screen.getByText('Sepia Cálido')).toBeDefined();
    expect(screen.getByText('Papel E-Ink')).toBeDefined();
    expect(screen.getByText('Periódico Vintage')).toBeDefined();
    expect(screen.getByText('Ámbar Medianoche')).toBeDefined();
    expect(screen.getByText('Noir Alto Contraste')).toBeDefined();
  });

  it('calls onSelectPreset when a preset button is clicked', () => {
    const onSelectPreset = vi.fn();
    render(<PaperToneHUD {...defaultProps} onSelectPreset={onSelectPreset} />);

    const einkBtn = screen.getByText('Papel E-Ink');
    fireEvent.click(einkBtn);
    expect(onSelectPreset).toHaveBeenCalledWith('PAPEL_E_INK');
  });

  it('calls onChangeWarmth, onChangeContrast, and onChangeBrightness on slider events', () => {
    const onChangeWarmth = vi.fn();
    const onChangeContrast = vi.fn();
    const onChangeBrightness = vi.fn();

    render(
      <PaperToneHUD
        {...defaultProps}
        onChangeWarmth={onChangeWarmth}
        onChangeContrast={onChangeContrast}
        onChangeBrightness={onChangeBrightness}
      />
    );

    const warmthSlider = screen.getByLabelText('Ajustar calidez');
    fireEvent.change(warmthSlider, { target: { value: '0.6' } });
    expect(onChangeWarmth).toHaveBeenCalledWith(0.6);

    const contrastSlider = screen.getByLabelText('Ajustar contraste');
    fireEvent.change(contrastSlider, { target: { value: '1.3' } });
    expect(onChangeContrast).toHaveBeenCalledWith(1.3);

    const brightnessSlider = screen.getByLabelText('Ajustar brillo');
    fireEvent.change(brightnessSlider, { target: { value: '1.1' } });
    expect(onChangeBrightness).toHaveBeenCalledWith(1.1);
  });

  it('calls onClose when close button or Escape key is triggered', () => {
    const onClose = vi.fn();
    render(<PaperToneHUD {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByLabelText('Cerrar modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('calls onSave and onReset when respective action buttons are clicked', () => {
    const onSave = vi.fn();
    const onReset = vi.fn();

    render(<PaperToneHUD {...defaultProps} onSave={onSave} onReset={onReset} />);

    const saveBtn = screen.getByText('Guardar Perfil');
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);

    const resetBtn = screen.getByText('Restablecer');
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
