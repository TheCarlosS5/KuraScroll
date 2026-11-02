import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadingVelocityHUD } from '../../src/components/reader/ReadingVelocityHUD.js';

describe('ReadingVelocityHUD Component Unit Tests (Sprint 53)', () => {
  it('renders time remaining mode and displays calculated time', () => {
    render(
      <ReadingVelocityHUD
        estimatedMinutes={4}
        estimatedSeconds={240}
        pagesRemaining={10}
        effectiveSecondsPerPage={24.0}
        isOutlier={false}
      />
    );

    expect(screen.getByTestId('reading-velocity-hud')).toBeDefined();
    expect(screen.getByTestId('time-remaining-label')).toBeDefined();
    expect(screen.getByText('~4 min restantes')).toBeDefined();
  });

  it('displays outlier indicator when outlier is detected', () => {
    render(
      <ReadingVelocityHUD
        estimatedMinutes={2}
        estimatedSeconds={120}
        pagesRemaining={5}
        effectiveSecondsPerPage={24.0}
        isOutlier={true}
      />
    );

    expect(screen.getByTestId('outlier-indicator')).toBeDefined();
  });

  it('cycles through display modes when clicked', () => {
    const handleModeChange = vi.fn();
    render(
      <ReadingVelocityHUD
        estimatedMinutes={3}
        estimatedSeconds={180}
        pagesRemaining={8}
        effectiveSecondsPerPage={22.5}
        initialMode="time_remaining"
        onModeChange={handleModeChange}
      />
    );

    const hud = screen.getByTestId('reading-velocity-hud');

    // Click 1: Switch to pages_per_minute
    fireEvent.click(hud);
    expect(handleModeChange).toHaveBeenCalledWith('pages_per_minute');
    expect(screen.getByTestId('ppm-label')).toBeDefined();

    // Click 2: Switch to subtle_dot
    fireEvent.click(hud);
    expect(handleModeChange).toHaveBeenCalledWith('subtle_dot');
    expect(screen.getByTestId('subtle-dot')).toBeDefined();

    // Click 3: Switch to disabled
    fireEvent.click(hud);
    expect(handleModeChange).toHaveBeenCalledWith('disabled');
    expect(screen.getByTestId('velocity-hud-restore')).toBeDefined();

    // Click restore button
    fireEvent.click(screen.getByTestId('velocity-hud-restore'));
    expect(screen.getByTestId('reading-velocity-hud')).toBeDefined();
  });

  it('renders finished chapter badge when pagesRemaining is zero', () => {
    render(
      <ReadingVelocityHUD
        estimatedMinutes={0}
        estimatedSeconds={0}
        pagesRemaining={0}
        effectiveSecondsPerPage={20.0}
      />
    );

    expect(screen.getByText('Capítulo finalizado')).toBeDefined();
  });
});
