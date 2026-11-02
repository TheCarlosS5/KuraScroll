import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageBevelHUD } from '../components/reader/PageBevelHUD';
import {
  PageBevelProfile,
  PageBevelResult,
  PAGE_BEVEL_PRESETS,
} from '../reader/usePageBevel';

describe('PageBevelHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: PageBevelProfile = {
    seriesId: 'test-series-109',
    ...PAGE_BEVEL_PRESETS.tankobon_silk_110um,
    readingDirection: 'rtl',
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: PageBevelResult = {
    leftThicknessPx: 6,
    rightThicknessPx: 18,
    leftPagesCount: 49,
    rightPagesCount: 150,
    progressRatio: 0.2462,
    readingDirection: 'rtl',
    leftBevelGradient: 'linear-gradient(to right, rgba(0, 0, 0, 0.40) 0%, rgba(255, 255, 255, 0.06) 60%, rgba(0, 0, 0, 0.2) 100%)',
    rightBevelGradient: 'linear-gradient(to left, rgba(0, 0, 0, 0.40) 0%, rgba(255, 255, 255, 0.06) 60%, rgba(0, 0, 0, 0.2) 100%)',
    sagOffsetPx: 2,
    latencyUs: 0.65,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <PageBevelHUD
        isVisible={false}
        onClose={vi.fn()}
        profile={mockProfile}
        onProfileChange={vi.fn()}
        result={mockResult}
        currentPage={50}
        totalPages={200}
        onPageChange={vi.fn()}
        onApplyPreset={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders HUD with cross-section telemetry and handles interactions when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onPageChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <PageBevelHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        currentPage={50}
        totalPages={200}
        onPageChange={onPageChange}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByText('Tactile Page Edge Bevel')).toBeDefined();
    expect(screen.getByText('SLA 73')).toBeDefined();
    expect(screen.getByText(/LEFT STACK: 6px/)).toBeDefined();
    expect(screen.getByText(/RIGHT STACK: 18px/)).toBeDefined();

    // Toggle enabled button
    const enabledBtn = screen.getByText('Enabled');
    fireEvent.click(enabledBtn);
    expect(onProfileChange).toHaveBeenCalledWith({ isEnabled: false });

    // Direction switch
    const ltrBtn = screen.getByText('LTR');
    fireEvent.click(ltrBtn);
    expect(onProfileChange).toHaveBeenCalledWith({ readingDirection: 'ltr' });

    // Preset button
    const newsprintBtn = screen.getByText('Weekly Anthology Newsprint');
    fireEvent.click(newsprintBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('newsprint_65um');

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
