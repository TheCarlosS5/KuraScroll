import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MagnifierLoupeHUD } from '../components/reader/MagnifierLoupeHUD';

describe('Sprint 78 - MagnifierLoupeHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <MagnifierLoupeHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        shape="circle"
        zoomFactor={2.0}
        lensRadiusPx={120}
        smoothingFactor={0.15}
        borderColor="#3b82f6"
        onToggleEnabled={vi.fn()}
        onChangeShape={vi.fn()}
        onChangeZoomFactor={vi.fn()}
        onChangeLensRadiusPx={vi.fn()}
        onChangeSmoothingFactor={vi.fn()}
        onChangeBorderColor={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and controls when isOpen is true', () => {
    render(
      <MagnifierLoupeHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        shape="circle"
        zoomFactor={2.5}
        lensRadiusPx={130}
        smoothingFactor={0.15}
        borderColor="#3b82f6"
        onToggleEnabled={vi.fn()}
        onChangeShape={vi.fn()}
        onChangeZoomFactor={vi.fn()}
        onChangeLensRadiusPx={vi.fn()}
        onChangeSmoothingFactor={vi.fn()}
        onChangeBorderColor={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Lupa Óptica & Retícula/i)).toBeDefined();
    expect(screen.getByText('Lente Circular')).toBeDefined();
    expect(screen.getByText('Retícula Rectangular')).toBeDefined();
    expect(screen.getByText('2.50x')).toBeDefined();
    expect(screen.getByText('130 px')).toBeDefined();
    expect(screen.getByText(/activado/i)).toBeDefined();
  });

  it('switches shape when geometry button is clicked', () => {
    const onChangeShape = vi.fn();

    render(
      <MagnifierLoupeHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        shape="circle"
        zoomFactor={2.0}
        lensRadiusPx={120}
        smoothingFactor={0.15}
        borderColor="#3b82f6"
        onToggleEnabled={vi.fn()}
        onChangeShape={onChangeShape}
        onChangeZoomFactor={vi.fn()}
        onChangeLensRadiusPx={vi.fn()}
        onChangeSmoothingFactor={vi.fn()}
        onChangeBorderColor={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const rectBtn = screen.getByText('Retícula Rectangular');
    fireEvent.click(rectBtn);

    expect(onChangeShape).toHaveBeenCalledWith('rectangle');
  });

  it('triggers onChangeZoomFactor when zoom slider is adjusted', () => {
    const onChangeZoomFactor = vi.fn();

    render(
      <MagnifierLoupeHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        shape="circle"
        zoomFactor={2.0}
        lensRadiusPx={120}
        smoothingFactor={0.15}
        borderColor="#3b82f6"
        onToggleEnabled={vi.fn()}
        onChangeShape={vi.fn()}
        onChangeZoomFactor={onChangeZoomFactor}
        onChangeLensRadiusPx={vi.fn()}
        onChangeSmoothingFactor={vi.fn()}
        onChangeBorderColor={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const slider = screen.getByLabelText(/Factor de Aumento/i);
    fireEvent.change(slider, { target: { value: '3.25' } });

    expect(onChangeZoomFactor).toHaveBeenCalledWith(3.25);
  });

  it('closes dialog on ESC key or close button', () => {
    const onClose = vi.fn();

    render(
      <MagnifierLoupeHUD
        isOpen={true}
        onClose={onClose}
        isEnabled={true}
        shape="circle"
        zoomFactor={2.0}
        lensRadiusPx={120}
        smoothingFactor={0.15}
        borderColor="#3b82f6"
        onToggleEnabled={vi.fn()}
        onChangeShape={vi.fn()}
        onChangeZoomFactor={vi.fn()}
        onChangeLensRadiusPx={vi.fn()}
        onChangeSmoothingFactor={vi.fn()}
        onChangeBorderColor={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const closeBtn = screen.getByLabelText('Cerrar panel de lupa');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
