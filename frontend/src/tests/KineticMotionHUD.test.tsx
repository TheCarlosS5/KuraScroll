import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KineticMotionHUD } from '../components/reader/KineticMotionHUD';

describe('Sprint 70 - KineticMotionHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders HUD container, status dot, and letterbox shutters', () => {
    render(
      <KineticMotionHUD
        isClimaxPanel={true}
        isKineticActive={true}
        isShutterActive={true}
        intensity="normal"
      />
    );

    expect(screen.getByTestId('kinetic-motion-hud')).toBeDefined();
    expect(screen.getByTestId('letterbox-shutter-top')).toBeDefined();
    expect(screen.getByTestId('letterbox-shutter-bottom')).toBeDefined();
    expect(screen.getByText('2.5D Clímax Activo')).toBeDefined();

    // Shutter height should be 10% when active
    const topShutter = screen.getByTestId('letterbox-shutter-top');
    expect(topShutter.style.height).toBe('10%');
  });

  it('triggers onToggleKinetic when toggle button is clicked', () => {
    const onToggleMock = vi.fn();
    render(
      <KineticMotionHUD
        isClimaxPanel={true}
        isKineticActive={true}
        onToggleKinetic={onToggleMock}
      />
    );

    const toggleBtn = screen.getByTestId('kinetic-toggle-btn');
    fireEvent.click(toggleBtn);
    expect(onToggleMock).toHaveBeenCalledTimes(1);
  });

  it('triggers onChangeIntensity when intensity button is clicked', () => {
    const onChangeIntensityMock = vi.fn();
    render(
      <KineticMotionHUD
        isClimaxPanel={true}
        isKineticActive={true}
        intensity="normal"
        onChangeIntensity={onChangeIntensityMock}
      />
    );

    const subtleBtn = screen.getByTestId('intensity-btn-subtle');
    fireEvent.click(subtleBtn);
    expect(onChangeIntensityMock).toHaveBeenCalledWith('subtle');

    const intenseBtn = screen.getByTestId('intensity-btn-intense');
    fireEvent.click(intenseBtn);
    expect(onChangeIntensityMock).toHaveBeenCalledWith('intense');
  });

  it('triggers onToggleKinetic when pressing K key', () => {
    const onToggleMock = vi.fn();
    render(
      <KineticMotionHUD
        isClimaxPanel={true}
        isKineticActive={true}
        onToggleKinetic={onToggleMock}
      />
    );

    fireEvent.keyDown(window, { key: 'k' });
    expect(onToggleMock).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'K' });
    expect(onToggleMock).toHaveBeenCalledTimes(2);
  });

  it('does not render HUD pill when isClimaxPanel is false', () => {
    render(
      <KineticMotionHUD
        isClimaxPanel={false}
        isKineticActive={false}
        isShutterActive={false}
      />
    );

    expect(screen.queryByTestId('kinetic-motion-hud')).toBeNull();
    // But shutter DOM elements exist with 0px height
    expect(screen.getByTestId('letterbox-shutter-top').style.height).toBe('0px');
  });
});
