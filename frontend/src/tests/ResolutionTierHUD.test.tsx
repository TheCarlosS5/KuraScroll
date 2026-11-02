import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResolutionTierHUD } from '../components/reader/ResolutionTierHUD.js';
import { UseAdaptiveResolutionReturn } from '../reader/useAdaptiveResolution.js';

describe('Sprint 58 - ResolutionTierHUD Component Tests', () => {
  it('renders correctly with accessible controls and current tier badge', () => {
    const mockSetOverride = vi.fn();
    const mockEngine: UseAdaptiveResolutionReturn = {
      targetWidth: 1200,
      tierName: 'laptop',
      dpr: 1.0,
      isAuto: true,
      override: 'auto',
      setOverride: mockSetOverride,
      buildTranscodeUrl: vi.fn(),
    };

    render(<ResolutionTierHUD resolutionEngine={mockEngine} />);

    expect(screen.getByRole('region')).toBeDefined();
    expect(screen.getByText('1200px')).toBeDefined();
    expect(screen.getByText('laptop (Auto)')).toBeDefined();

    const select = screen.getByLabelText('Seleccionar resolución de imagen') as HTMLSelectElement;
    expect(select.value).toBe('auto');

    fireEvent.change(select, { target: { value: '800' } });
    expect(mockSetOverride).toHaveBeenCalledWith(800);
  });

  it('renders manual override mode correctly', () => {
    const mockSetOverride = vi.fn();
    const mockEngine: UseAdaptiveResolutionReturn = {
      targetWidth: 1600,
      tierName: 'desktop',
      dpr: 2.0,
      isAuto: false,
      override: 1600,
      setOverride: mockSetOverride,
      buildTranscodeUrl: vi.fn(),
    };

    render(<ResolutionTierHUD resolutionEngine={mockEngine} />);

    expect(screen.getByText('1600px')).toBeDefined();
    expect(screen.getByText('desktop (Manual)')).toBeDefined();

    const select = screen.getByLabelText('Seleccionar resolución de imagen') as HTMLSelectElement;
    expect(select.value).toBe('1600');

    fireEvent.change(select, { target: { value: 'auto' } });
    expect(mockSetOverride).toHaveBeenCalledWith('auto');
  });
});
