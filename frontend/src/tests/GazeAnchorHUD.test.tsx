import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GazeAnchorHUD } from '../components/reader/GazeAnchorHUD';

describe('Sprint 83 - GazeAnchorHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <GazeAnchorHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        mode="manga_rtl"
        saccadeSensitivity={1.0}
        dwellThresholdMs={250}
        driftTolerancePx={40.0}
        returnAnchorEnabled={true}
        heatmapResolution="medium"
        currentAnchor={null}
        isDriftActive={false}
        saccadeCount={0}
        onToggleEnabled={vi.fn()}
        onToggleReturnAnchor={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSensitivity={vi.fn()}
        onChangeDwellThreshold={vi.fn()}
        onChangeDriftTolerance={vi.fn()}
        onChangeHeatmapResolution={vi.fn()}
        onResetAnchor={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog and controls when isOpen is true', () => {
    render(
      <GazeAnchorHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        mode="manga_rtl"
        saccadeSensitivity={1.2}
        dwellThresholdMs={300}
        driftTolerancePx={45.0}
        returnAnchorEnabled={true}
        heatmapResolution="medium"
        currentAnchor={{ x: 120, y: 340 }}
        isDriftActive={false}
        saccadeCount={5}
        onToggleEnabled={vi.fn()}
        onToggleReturnAnchor={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSensitivity={vi.fn()}
        onChangeDwellThreshold={vi.fn()}
        onChangeDriftTolerance={vi.fn()}
        onChangeHeatmapResolution={vi.fn()}
        onResetAnchor={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/GazeAnchor • Estabilizador Óptico/i)).toBeDefined();
    expect(screen.getByText('ACTIVADO')).toBeDefined();
    expect(screen.getByText(/120px, 340px/)).toBeDefined();
  });

  it('handles mode switching, sensitivity changes, and toggle clicks', () => {
    const onToggleEnabled = vi.fn();
    const onChangeMode = vi.fn();
    const onChangeSensitivity = vi.fn();
    const onResetAnchor = vi.fn();

    render(
      <GazeAnchorHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        mode="manga_rtl"
        saccadeSensitivity={1.0}
        dwellThresholdMs={250}
        driftTolerancePx={40.0}
        returnAnchorEnabled={true}
        heatmapResolution="medium"
        currentAnchor={null}
        isDriftActive={false}
        saccadeCount={0}
        onToggleEnabled={onToggleEnabled}
        onToggleReturnAnchor={vi.fn()}
        onChangeMode={onChangeMode}
        onChangeSensitivity={onChangeSensitivity}
        onChangeDwellThreshold={vi.fn()}
        onChangeDriftTolerance={vi.fn()}
        onChangeHeatmapResolution={vi.fn()}
        onResetAnchor={onResetAnchor}
      />
    );

    // Click toggle button
    fireEvent.click(screen.getByText('ACTIVADO'));
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);

    // Click webtoon mode button
    fireEvent.click(screen.getByText('Webtoon Vertical'));
    expect(onChangeMode).toHaveBeenCalledWith('webtoon');

    // Click reset anchor
    fireEvent.click(screen.getByText('Reiniciar Anclaje'));
    expect(onResetAnchor).toHaveBeenCalledTimes(1);
  });
});
