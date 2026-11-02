import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlatterDefragHUD } from '../components/reader/PlatterDefragHUD.js';
import type { DefragOptimizationResult } from '../reader/usePlatterDefrag.js';

describe('Sprint 63 - PlatterDefragHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockResult: DefragOptimizationResult = {
    seriesId: 'ser-hud-test',
    initialPli: 0.62,
    optimizedPli: 0.97,
    chaptersProcessed: 15,
    bytesReordered: 45 * 1024 * 1024,
    durationMs: 380,
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <PlatterDefragHUD
        isOpen={false}
        status="idle"
        fragmentationPercent={25}
        pli={0.75}
        onStartDefrag={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog when isOpen is true with fragmentation and PLI', () => {
    render(
      <PlatterDefragHUD
        isOpen={true}
        status="idle"
        fragmentationPercent={35}
        pli={0.65}
        onStartDefrag={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Optimizador de Plato HDD & Cilindros')).toBeDefined();
    expect(screen.getByText('35%')).toBeDefined();
    expect(screen.getByText('65%')).toBeDefined();
    expect(screen.getByText('Listo para optimizar')).toBeDefined();
    expect(screen.getByText('Optimizar Cilindros')).toBeDefined();
  });

  it('calls onStartDefrag when action button is clicked in idle state', () => {
    const onStartDefrag = vi.fn();
    render(
      <PlatterDefragHUD
        isOpen={true}
        status="idle"
        fragmentationPercent={20}
        pli={0.8}
        onStartDefrag={onStartDefrag}
        onClose={vi.fn()}
      />
    );

    const button = screen.getByText('Optimizar Cilindros');
    fireEvent.click(button);
    expect(onStartDefrag).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked or Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <PlatterDefragHUD
        isOpen={true}
        status="idle"
        fragmentationPercent={10}
        pli={0.9}
        onStartDefrag={vi.fn()}
        onClose={onClose}
      />
    );

    const closeBtn = screen.getByLabelText('Cerrar modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('displays optimization metrics when lastResult is provided', () => {
    render(
      <PlatterDefragHUD
        isOpen={true}
        status="complete"
        fragmentationPercent={3}
        pli={0.97}
        lastResult={mockResult}
        onStartDefrag={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Optimización completada con éxito')).toBeDefined();
    expect(screen.getByText('Capítulos reordenados:')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('45.00 MB')).toBeDefined();
    expect(screen.getByText('380 ms')).toBeDefined();
  });
});
