import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SmartCropHUD } from '../components/reader/SmartCropHUD';

describe('Sprint 84 - SmartCropHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <SmartCropHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        mode="dialogue_safe"
        marginThreshold={0.96}
        aspectRatioLock={false}
        targetAspectRatio={0.70}
        paddingPx={12}
        cropBox={null}
        marginSavedPct={0}
        isCropped={false}
        onToggleEnabled={vi.fn()}
        onToggleAspectRatioLock={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeMarginThreshold={vi.fn()}
        onChangeTargetAspectRatio={vi.fn()}
        onChangePaddingPx={vi.fn()}
        onResetCrop={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and controls when isOpen is true', () => {
    render(
      <SmartCropHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        mode="dialogue_safe"
        marginThreshold={0.95}
        aspectRatioLock={false}
        targetAspectRatio={0.70}
        paddingPx={14}
        cropBox={{ x: 50, y: 30, width: 900, height: 1400 }}
        marginSavedPct={15.2}
        isCropped={true}
        onToggleEnabled={vi.fn()}
        onToggleAspectRatioLock={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeMarginThreshold={vi.fn()}
        onChangeTargetAspectRatio={vi.fn()}
        onChangePaddingPx={vi.fn()}
        onResetCrop={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/SmartCrop • Recorte Automático/i)).toBeDefined();
    expect(screen.getByText('ACTIVADO')).toBeDefined();
    expect(screen.getByText('900x1400')).toBeDefined();
    expect(screen.getByText('+15.2%')).toBeDefined();
  });

  it('handles mode switching, padding adjustment, and reset clicks', () => {
    const onToggleEnabled = vi.fn();
    const onChangeMode = vi.fn();
    const onResetCrop = vi.fn();

    render(
      <SmartCropHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        mode="dialogue_safe"
        marginThreshold={0.96}
        aspectRatioLock={false}
        targetAspectRatio={0.70}
        paddingPx={12}
        cropBox={null}
        marginSavedPct={0}
        isCropped={false}
        onToggleEnabled={onToggleEnabled}
        onToggleAspectRatioLock={vi.fn()}
        onChangeMode={onChangeMode}
        onChangeMarginThreshold={vi.fn()}
        onChangeTargetAspectRatio={vi.fn()}
        onChangePaddingPx={vi.fn()}
        onResetCrop={onResetCrop}
      />
    );

    // Toggle button
    fireEvent.click(screen.getByText('ACTIVADO'));
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);

    // Conservative mode
    fireEvent.click(screen.getByText('Conservador (24px)'));
    expect(onChangeMode).toHaveBeenCalledWith('conservative');

    // Reset crop button
    fireEvent.click(screen.getByText('Restablecer Recorte'));
    expect(onResetCrop).toHaveBeenCalledTimes(1);
  });
});
