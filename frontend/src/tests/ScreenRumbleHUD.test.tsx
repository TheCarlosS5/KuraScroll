import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ScreenRumbleHUD } from '../components/reader/ScreenRumbleHUD.js';

describe('Sprint 56 - ScreenRumbleHUD Component Tests', () => {
  it('renders correctly with default values and accessible controls', () => {
    const mockUpdatePreferences = vi.fn();
    const mockTestVibration = vi.fn().mockReturnValue(true);
    const mockTestRumble = vi.fn().mockReturnValue(true);

    const mockEngine = {
      preferences: {
        hapticsEnabled: false,
        screenRumbleEnabled: false,
        maxHapticIntensity: 1 as const,
        maxRumbleIntensity: 1 as const,
        hapticsWithReducedMotion: false,
      },
      reducedMotion: false,
      isHapticSupported: true,
      updatePreferences: mockUpdatePreferences,
      dispatchImpact: vi.fn(),
      testVibration: mockTestVibration,
      testRumble: mockTestRumble,
      flushTelemetry: vi.fn(),
    };

    render(<ScreenRumbleHUD engine={mockEngine as any} />);

    expect(screen.getByRole('region')).toBeDefined();
    expect(screen.getByText('Tactile & Rumble Engine')).toBeDefined();
    expect(screen.getByText('Haptics: Ready')).toBeDefined();
    expect(screen.getByText('Motion: Normal')).toBeDefined();

    // Check toggles
    const hapticCheckbox = screen.getByLabelText('Toggle physical haptics') as HTMLInputElement;
    expect(hapticCheckbox.checked).toBe(false);

    fireEvent.click(hapticCheckbox);
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ hapticsEnabled: true });

    // Check test buttons
    const testVibButton = screen.getByText('Test Vibration');
    fireEvent.click(testVibButton);
    expect(mockTestVibration).toHaveBeenCalled();

    const testRumbleButton = screen.getByText('Test Rumble');
    fireEvent.click(testRumbleButton);
    expect(mockTestRumble).toHaveBeenCalled();
  });

  it('displays reduced motion override when prefers-reduced-motion is active', () => {
    const mockUpdatePreferences = vi.fn();
    const mockEngine = {
      preferences: {
        hapticsEnabled: true,
        screenRumbleEnabled: true,
        maxHapticIntensity: 2 as const,
        maxRumbleIntensity: 2 as const,
        hapticsWithReducedMotion: false,
      },
      reducedMotion: true,
      isHapticSupported: false,
      updatePreferences: mockUpdatePreferences,
      dispatchImpact: vi.fn(),
      testVibration: vi.fn(),
      testRumble: vi.fn(),
      flushTelemetry: vi.fn(),
    };

    render(<ScreenRumbleHUD engine={mockEngine as any} />);

    expect(screen.getByText('Reduced Motion: ON')).toBeDefined();
    expect(screen.getByText('Haptics: No Actuator')).toBeDefined();

    const overrideCheckbox = screen.getByLabelText('Toggle haptics during reduced motion') as HTMLInputElement;
    expect(overrideCheckbox).toBeDefined();
    expect(overrideCheckbox.checked).toBe(false);

    fireEvent.click(overrideCheckbox);
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ hapticsWithReducedMotion: true });
  });
});
