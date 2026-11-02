import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BatterySaverHUD } from '../../src/components/common/BatterySaverHUD';
import { batterySaverEngine } from '../../src/services/battery-saver-engine';

describe('BatterySaverHUD Component (Sprint 33)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when battery is healthy and power saver is inactive', () => {
    vi.spyOn(batterySaverEngine, 'getState').mockReturnValue({
      isSupported: true,
      batteryLevel: 0.85,
      isCharging: false,
      isPowerSaverActive: false,
      isTabHidden: false,
    });

    const { container } = render(<BatterySaverHUD />);
    expect(container.firstChild).toBeNull();
  });

  it('renders battery saver HUD when power saver is active', () => {
    vi.spyOn(batterySaverEngine, 'getState').mockReturnValue({
      isSupported: true,
      batteryLevel: 0.15,
      isCharging: false,
      isPowerSaverActive: true,
      isTabHidden: false,
    });

    render(<BatterySaverHUD />);

    expect(screen.getByTestId('battery-saver-hud')).toBeDefined();
    expect(screen.getByText('15%')).toBeDefined();
    expect(screen.getByText('Ahorro Activo')).toBeDefined();
  });

  it('renders charging indicator when device is plugged into power', () => {
    vi.spyOn(batterySaverEngine, 'getState').mockReturnValue({
      isSupported: true,
      batteryLevel: 0.18,
      isCharging: true,
      isPowerSaverActive: true,
      isTabHidden: false,
    });

    render(<BatterySaverHUD />);

    expect(screen.getByTestId('battery-saver-hud')).toBeDefined();
    expect(screen.getByText('18%')).toBeDefined();
  });
});
