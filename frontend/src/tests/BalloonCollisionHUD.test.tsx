/**
 * KuraScroll Sprint 102: BalloonCollisionHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BalloonCollisionHUD } from '../components/reader/BalloonCollisionHUD';
import { BalloonCollisionProfile, CollisionAvoidanceResult } from '../reader/useBalloonCollision';

describe('BalloonCollisionHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockProfile: BalloonCollisionProfile = {
    seriesId: 'test-series-102',
    avoidanceStrategy: 'minimal_euclidean',
    safetyMarginPx: 12,
    maxDisplacementPx: 120,
    preferVerticalShift: true,
    isEnabled: true,
    createdAt: 0,
    updatedAt: 0,
  };

  const mockResult: CollisionAvoidanceResult = {
    displacedBox: { x: 200, y: 292, width: 140, height: 70 },
    dx: 0,
    dy: 92,
    displacementMagnitude: 92,
    hasCollision: true,
    collidingBalloonIndices: [0],
    strategyApplied: 'minimal_euclidean',
    latencyUs: 1.45,
  };

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <BalloonCollisionHUD
        isVisible={false}
        onClose={vi.fn()}
        profile={mockProfile}
        onProfileChange={vi.fn()}
        result={mockResult}
        onApplyPreset={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders HUD with telemetry and 2D radar when isVisible is true', () => {
    const onClose = vi.fn();
    const onProfileChange = vi.fn();
    const onApplyPreset = vi.fn();

    render(
      <BalloonCollisionHUD
        isVisible={true}
        onClose={onClose}
        profile={mockProfile}
        onProfileChange={onProfileChange}
        result={mockResult}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(screen.getByRole('region', { name: 'Balloon Collision HUD' })).toBeDefined();
    expect(screen.getByText('Balloon Collision Avoider')).toBeDefined();
    expect(screen.getByText('SLA 66')).toBeDefined();
    expect(screen.getByText('OCCLUSION DETECTED')).toBeDefined();

    // Check telemetry values
    expect(screen.getByText('92px')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();

    // Interaction with preset button
    const presetBtn = screen.getByText('Reading Gravity Downward');
    fireEvent.click(presetBtn);
    expect(onApplyPreset).toHaveBeenCalledWith('reading_gravity_downward');

    // Close button
    const closeBtn = screen.getByLabelText('Close HUD');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
