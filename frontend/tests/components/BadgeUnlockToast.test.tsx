import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BadgeUnlockToast } from '../../src/components/habits/BadgeUnlockToast';
import { UserBadgeItem } from '../../src/components/habits/BadgeGridModal';

describe('BadgeUnlockToast Component', () => {
  const sampleBadge: UserBadgeItem = {
    id: 'streak_7',
    title: 'Racha de Fuego',
    description: 'Mantén una racha de 7 días consecutivos',
    icon: 'flame',
    category: 'streak',
    targetValue: 7,
    rarity: 'rare',
    currentValue: 7,
    isUnlocked: true,
    unlockedAt: '2026-11-02T10:00:00Z',
    progressPercent: 100,
  };

  it('renders celebratory toast alert with badge title and description', () => {
    render(<BadgeUnlockToast badge={sampleBadge} onDismiss={vi.fn()} />);

    expect(screen.getByRole('complementary')).toBeDefined();
    expect(screen.getByText('¡Nueva Medalla Desbloqueada!')).toBeDefined();
    expect(screen.getByText('Racha de Fuego')).toBeDefined();
    expect(screen.getByText('Mantén una racha de 7 días consecutivos')).toBeDefined();
  });

  it('calls onDismiss when close button clicked', () => {
    const handleDismiss = vi.fn();
    render(<BadgeUnlockToast badge={sampleBadge} onDismiss={handleDismiss} />);

    const closeBtn = screen.getByLabelText('Cerrar notificación');
    fireEvent.click(closeBtn);

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders null when badge is null', () => {
    const { container } = render(<BadgeUnlockToast badge={null} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
