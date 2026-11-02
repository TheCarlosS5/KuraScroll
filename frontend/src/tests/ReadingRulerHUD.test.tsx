import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadingRulerHUD } from '../components/reader/ReadingRulerHUD';

describe('Sprint 71 - ReadingRulerHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultGeometry = {
    apertureStart: 200,
    apertureEnd: 280,
    shutterBeforeSize: 200,
    shutterAfterSize: 500,
    cssVars: {
      '--ruler-aperture-start': '200px',
      '--ruler-slot-size': '80px',
      '--ruler-tint-color': '#ffb74d',
    },
  };

  it('renders nothing when isEnabled is false', () => {
    const { container } = render(
      <ReadingRulerHUD
        isEnabled={false}
        mode="ruler"
        orientation="horizontal"
        slotSize={64}
        dimOpacity={0.50}
        tintColor="amber"
        pacerSpeedWpm={250}
        isPaused={false}
        geometry={defaultGeometry}
        onToggleVisibility={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSlotSize={vi.fn()}
        onChangeOpacity={vi.fn()}
        onChangeTint={vi.fn()}
        onTogglePause={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders floating HUD card and slot overlay when isEnabled is true', () => {
    render(
      <ReadingRulerHUD
        isEnabled={true}
        mode="ruler"
        orientation="horizontal"
        slotSize={80}
        dimOpacity={0.50}
        tintColor="amber"
        pacerSpeedWpm={250}
        isPaused={false}
        geometry={defaultGeometry}
        onToggleVisibility={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSlotSize={vi.fn()}
        onChangeOpacity={vi.fn()}
        onChangeTint={vi.fn()}
        onTogglePause={vi.fn()}
      />
    );

    expect(screen.getByTestId('reading-ruler-hud')).toBeDefined();
    expect(screen.getByTestId('reading-ruler-slot')).toBeDefined();
    expect(screen.getByText('Regla Óptica (U)')).toBeDefined();

    // Verify pointer-events: none invariant on overlay slot
    const slot = screen.getByTestId('reading-ruler-slot');
    expect(slot.style.pointerEvents).toBe('none');
  });

  it('renders top and bottom shutters in shutter mode with pointer-events: none', () => {
    render(
      <ReadingRulerHUD
        isEnabled={true}
        mode="shutter"
        orientation="horizontal"
        slotSize={80}
        dimOpacity={0.65}
        tintColor="mint"
        pacerSpeedWpm={250}
        isPaused={false}
        geometry={defaultGeometry}
        onToggleVisibility={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSlotSize={vi.fn()}
        onChangeOpacity={vi.fn()}
        onChangeTint={vi.fn()}
        onTogglePause={vi.fn()}
      />
    );

    const maskBefore = screen.getByTestId('reading-ruler-mask-before');
    const maskAfter = screen.getByTestId('reading-ruler-mask-after');

    expect(maskBefore).toBeDefined();
    expect(maskAfter).toBeDefined();
    expect(maskBefore.style.pointerEvents).toBe('none');
    expect(maskAfter.style.pointerEvents).toBe('none');
    expect(maskBefore.style.opacity).toBe('0.65');
  });

  it('switches modes when mode buttons are clicked', () => {
    const onChangeModeMock = vi.fn();
    render(
      <ReadingRulerHUD
        isEnabled={true}
        mode="ruler"
        orientation="horizontal"
        slotSize={80}
        dimOpacity={0.50}
        tintColor="amber"
        pacerSpeedWpm={250}
        isPaused={false}
        geometry={defaultGeometry}
        onToggleVisibility={vi.fn()}
        onChangeMode={onChangeModeMock}
        onChangeSlotSize={vi.fn()}
        onChangeOpacity={vi.fn()}
        onChangeTint={vi.fn()}
        onTogglePause={vi.fn()}
      />
    );

    const shutterBtn = screen.getByTestId('mode-btn-shutter');
    fireEvent.click(shutterBtn);
    expect(onChangeModeMock).toHaveBeenCalledWith('shutter');

    const pacerBtn = screen.getByTestId('mode-btn-saccadic_pacer');
    fireEvent.click(pacerBtn);
    expect(onChangeModeMock).toHaveBeenCalledWith('saccadic_pacer');
  });

  it('switches optical tints when tint swatches are clicked', () => {
    const onChangeTintMock = vi.fn();
    render(
      <ReadingRulerHUD
        isEnabled={true}
        mode="ruler"
        orientation="horizontal"
        slotSize={80}
        dimOpacity={0.50}
        tintColor="amber"
        pacerSpeedWpm={250}
        isPaused={false}
        geometry={defaultGeometry}
        onToggleVisibility={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSlotSize={vi.fn()}
        onChangeOpacity={vi.fn()}
        onChangeTint={onChangeTintMock}
        onTogglePause={vi.fn()}
      />
    );

    const roseBtn = screen.getByTestId('tint-btn-rose');
    fireEvent.click(roseBtn);
    expect(onChangeTintMock).toHaveBeenCalledWith('rose');

    const mintBtn = screen.getByTestId('tint-btn-mint');
    fireEvent.click(mintBtn);
    expect(onChangeTintMock).toHaveBeenCalledWith('mint');
  });

  it('triggers onToggleVisibility when close button is clicked', () => {
    const onToggleMock = vi.fn();
    render(
      <ReadingRulerHUD
        isEnabled={true}
        mode="ruler"
        orientation="horizontal"
        slotSize={80}
        dimOpacity={0.50}
        tintColor="amber"
        pacerSpeedWpm={250}
        isPaused={false}
        geometry={defaultGeometry}
        onToggleVisibility={onToggleMock}
        onChangeMode={vi.fn()}
        onChangeSlotSize={vi.fn()}
        onChangeOpacity={vi.fn()}
        onChangeTint={vi.fn()}
        onTogglePause={vi.fn()}
      />
    );

    const closeBtn = screen.getByTestId('ruler-close-btn');
    fireEvent.click(closeBtn);
    expect(onToggleMock).toHaveBeenCalledTimes(1);
  });
});
