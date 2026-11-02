import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpineDewarpHUD } from '../components/reader/SpineDewarpHUD';

describe('Sprint 74 - SpineDewarpHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <SpineDewarpHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        gutterSide="auto"
        curvatureDepth={0.25}
        spineWidthPct={0.20}
        shadowCompensation={0.15}
        onToggleEnabled={vi.fn()}
        onChangeGutterSide={vi.fn()}
        onChangeCurvatureDepth={vi.fn()}
        onChangeSpineWidthPct={vi.fn()}
        onChangeShadowCompensation={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog, sliders, and controls when isOpen is true', () => {
    render(
      <SpineDewarpHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        gutterSide="auto"
        curvatureDepth={0.30}
        spineWidthPct={0.25}
        shadowCompensation={0.20}
        onToggleEnabled={vi.fn()}
        onChangeGutterSide={vi.fn()}
        onChangeCurvatureDepth={vi.fn()}
        onChangeSpineWidthPct={vi.fn()}
        onChangeShadowCompensation={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByTestId('spine-dewarp-modal')).toBeDefined();
    expect(screen.getByText(/Aplanador de Lomo Tankōbon/i)).toBeDefined();
    expect(screen.getByTestId('dewarp-enable-toggle')).toBeDefined();
    expect(screen.getByText('30%')).toBeDefined(); // Curvature depth
    expect(screen.getByText('25%')).toBeDefined(); // Spine width
    expect(screen.getByText('20%')).toBeDefined(); // Shadow compensation

    expect(screen.getByTestId('gutter-side-auto')).toBeDefined();
    expect(screen.getByTestId('gutter-side-left')).toBeDefined();
    expect(screen.getByTestId('gutter-side-right')).toBeDefined();
    expect(screen.getByTestId('gutter-side-center')).toBeDefined();
  });

  it('calls onToggleEnabled when toggle button is clicked', () => {
    const handleToggle = vi.fn();
    render(
      <SpineDewarpHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        gutterSide="auto"
        curvatureDepth={0.25}
        spineWidthPct={0.20}
        shadowCompensation={0.15}
        onToggleEnabled={handleToggle}
        onChangeGutterSide={vi.fn()}
        onChangeCurvatureDepth={vi.fn()}
        onChangeSpineWidthPct={vi.fn()}
        onChangeShadowCompensation={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const btn = screen.getByTestId('dewarp-enable-toggle');
    fireEvent.click(btn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onChangeGutterSide when side button is clicked', () => {
    const handleChangeSide = vi.fn();
    render(
      <SpineDewarpHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        gutterSide="auto"
        curvatureDepth={0.25}
        spineWidthPct={0.20}
        shadowCompensation={0.15}
        onToggleEnabled={vi.fn()}
        onChangeGutterSide={handleChangeSide}
        onChangeCurvatureDepth={vi.fn()}
        onChangeSpineWidthPct={vi.fn()}
        onChangeShadowCompensation={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const rightBtn = screen.getByTestId('gutter-side-right');
    fireEvent.click(rightBtn);
    expect(handleChangeSide).toHaveBeenCalledWith('right');
  });

  it('calls onChangeCurvatureDepth when depth slider changes', () => {
    const handleDepth = vi.fn();
    render(
      <SpineDewarpHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        gutterSide="auto"
        curvatureDepth={0.25}
        spineWidthPct={0.20}
        shadowCompensation={0.15}
        onToggleEnabled={vi.fn()}
        onChangeGutterSide={vi.fn()}
        onChangeCurvatureDepth={handleDepth}
        onChangeSpineWidthPct={vi.fn()}
        onChangeShadowCompensation={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const slider = screen.getByTestId('curvature-depth-slider');
    fireEvent.change(slider, { target: { value: '45' } });
    expect(handleDepth).toHaveBeenCalledWith(0.45);
  });

  it('calls onResetToDefaults when reset button is clicked', () => {
    const handleReset = vi.fn();
    render(
      <SpineDewarpHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        gutterSide="auto"
        curvatureDepth={0.25}
        spineWidthPct={0.20}
        shadowCompensation={0.15}
        onToggleEnabled={vi.fn()}
        onChangeGutterSide={vi.fn()}
        onChangeCurvatureDepth={vi.fn()}
        onChangeSpineWidthPct={vi.fn()}
        onChangeShadowCompensation={vi.fn()}
        onResetToDefaults={handleReset}
      />
    );

    const resetBtn = screen.getByTestId('dewarp-reset-btn');
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('closes on close button, Escape key, or "w" key', () => {
    const handleClose = vi.fn();
    render(
      <SpineDewarpHUD
        isOpen={true}
        onClose={handleClose}
        isEnabled={true}
        gutterSide="auto"
        curvatureDepth={0.25}
        spineWidthPct={0.20}
        shadowCompensation={0.15}
        onToggleEnabled={vi.fn()}
        onChangeGutterSide={vi.fn()}
        onChangeCurvatureDepth={vi.fn()}
        onChangeSpineWidthPct={vi.fn()}
        onChangeShadowCompensation={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const closeBtn = screen.getByTestId('dewarp-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'w' });
    expect(handleClose).toHaveBeenCalledTimes(3);
  });
});
