/**
 * KuraScroll Sprint 98: ReadingDwellHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadingDwellHUD } from '../components/reader/ReadingDwellHUD';

describe('ReadingDwellHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <ReadingDwellHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="cadence_adaptive"
        onModeChange={vi.fn()}
        baseDwellMs={4500}
        onBaseDwellMsChange={vi.fn()}
        complexityWeight={1.25}
        onComplexityWeightChange={vi.fn()}
        urgencyThresholdMs={800}
        onUrgencyThresholdMsChange={vi.fn()}
        isPrefetchTriggerEnabled={true}
        onTogglePrefetchTrigger={vi.fn()}
        elapsedMs={2000}
        predictedTotalDwellMs={5625}
        remainingDwellMs={3625}
        progressPct={36}
        isUrgentPrefetchTriggered={false}
        urgencyRatio={0.36}
        dwellProgressBarColor="#38bdf8"
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry and handles interactions when visible', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleEnabled = vi.fn();
    const onTogglePrefetchTrigger = vi.fn();
    const onBaseDwellMsChange = vi.fn();

    render(
      <ReadingDwellHUD
        isVisible={true}
        onClose={onClose}
        mode="cadence_adaptive"
        onModeChange={onModeChange}
        baseDwellMs={4500}
        onBaseDwellMsChange={onBaseDwellMsChange}
        complexityWeight={1.25}
        onComplexityWeightChange={vi.fn()}
        urgencyThresholdMs={800}
        onUrgencyThresholdMsChange={vi.fn()}
        isPrefetchTriggerEnabled={true}
        onTogglePrefetchTrigger={onTogglePrefetchTrigger}
        elapsedMs={2000}
        predictedTotalDwellMs={5625}
        remainingDwellMs={3625}
        progressPct={36}
        isUrgentPrefetchTriggered={false}
        urgencyRatio={0.36}
        dwellProgressBarColor="#38bdf8"
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByRole('region', { name: /Reading Dwell Predictor HUD/i })).toBeDefined();
    expect(screen.getByText('Cadence & Dwell Predictor')).toBeDefined();
    expect(screen.getByText('[D]')).toBeDefined();
    expect(screen.getByText('SEEK DEFERRED')).toBeDefined();
    expect(screen.getByText('4.5s')).toBeDefined();
    expect(screen.getByText('1.25x')).toBeDefined();
    expect(screen.getByText('800ms')).toBeDefined();
    expect(screen.getByText('ACTIVE')).toBeDefined();
    expect(screen.getByText('ENABLED')).toBeDefined();

    // Mode switch
    const actionBtn = screen.getByText('⚡ Action Fast');
    fireEvent.click(actionBtn);
    expect(onModeChange).toHaveBeenCalledWith('action_heavy');

    // Prefetch toggle
    const prefetchBtn = screen.getByText('ENABLED');
    fireEvent.click(prefetchBtn);
    expect(onTogglePrefetchTrigger).toHaveBeenCalled();

    // Engine toggle
    const activeBtn = screen.getByText('ACTIVE');
    fireEvent.click(activeBtn);
    expect(onToggleEnabled).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByRole('button', { name: /Close HUD/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
