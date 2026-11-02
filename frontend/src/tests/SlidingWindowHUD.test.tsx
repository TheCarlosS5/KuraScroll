/**
 * KuraScroll Sprint 86: SlidingWindowHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlidingWindowHUD } from '../components/reader/SlidingWindowHUD';

describe('SlidingWindowHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <SlidingWindowHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="conservative"
        onModeChange={vi.fn()}
        currentIndex={5}
        startIndex={3}
        endIndex={8}
        totalCount={30}
        activeCount={6}
        prefetchCount={3}
        evictedCount={24}
        estimatedMemoryMB={15}
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry when visible', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleEnabled = vi.fn();

    render(
      <SlidingWindowHUD
        isVisible={true}
        onClose={onClose}
        mode="conservative"
        onModeChange={onModeChange}
        currentIndex={10}
        startIndex={8}
        endIndex={13}
        totalCount={50}
        activeCount={6}
        prefetchCount={3}
        evictedCount={44}
        estimatedMemoryMB={15.0}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByText('SLIDING WINDOW CACHE')).toBeDefined();
    expect(screen.getByText('Page 11 / 50')).toBeDefined();
    expect(screen.getByText('[9 - 14]')).toBeDefined();
    expect(screen.getByText('+3 pages')).toBeDefined();
    expect(screen.getByText('44 pages')).toBeDefined();
  });

  it('triggers mode change and close actions', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleEnabled = vi.fn();

    render(
      <SlidingWindowHUD
        isVisible={true}
        onClose={onClose}
        mode="conservative"
        onModeChange={onModeChange}
        currentIndex={0}
        startIndex={0}
        endIndex={3}
        totalCount={20}
        activeCount={4}
        prefetchCount={3}
        evictedCount={16}
        estimatedMemoryMB={10.0}
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    // Click close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click aggressive mode button
    const aggressiveBtn = screen.getByText('aggressive');
    fireEvent.click(aggressiveBtn);
    expect(onModeChange).toHaveBeenCalledWith('aggressive');

    // Click toggle enable button
    const toggleBtn = screen.getByText('Micro-Cache Active');
    fireEvent.click(toggleBtn);
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);
  });
});
