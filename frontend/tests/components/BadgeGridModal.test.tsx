import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BadgeGridModal, UserBadgeItem } from '../../src/components/habits/BadgeGridModal';

describe('BadgeGridModal Component', () => {
  const mockBadges: UserBadgeItem[] = [
    {
      id: 'first_step',
      title: 'Primer Paso',
      description: 'Lee tu primera página',
      icon: 'footprints',
      category: 'volume',
      targetValue: 1,
      rarity: 'common',
      currentValue: 1,
      isUnlocked: true,
      unlockedAt: '2026-11-01T20:00:00Z',
      progressPercent: 100,
    },
    {
      id: 'page_devourer_100',
      title: 'Devorador de Páginas I',
      description: 'Lee 100 páginas',
      icon: 'book-open',
      category: 'volume',
      targetValue: 100,
      rarity: 'common',
      currentValue: 40,
      isUnlocked: false,
      unlockedAt: null,
      progressPercent: 40,
    },
    {
      id: 'night_owl',
      title: 'Búho Nocturno',
      description: 'Lee en la noche',
      icon: 'moon',
      category: 'time',
      targetValue: 1,
      rarity: 'rare',
      currentValue: 0,
      isUnlocked: false,
      unlockedAt: null,
      progressPercent: 0,
    },
  ];

  it('renders modal dialog with badge items and summary metrics', () => {
    render(
      <BadgeGridModal
        isOpen={true}
        onClose={vi.fn()}
        badges={mockBadges}
        summary={{ total: 3, unlocked: 1, inProgress: 1, percentage: 33 }}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Logros & Medallas de Lectura')).toBeDefined();
    expect(screen.getByText('Primer Paso')).toBeDefined();
    expect(screen.getByText('Devorador de Páginas I')).toBeDefined();
    expect(screen.getByText('Búho Nocturno')).toBeDefined();
    expect(screen.getByText('Desbloqueada')).toBeDefined();
    expect(screen.getByText('40 / 100')).toBeDefined();
  });

  it('filters badges by category when tab clicked', () => {
    render(
      <BadgeGridModal
        isOpen={true}
        onClose={vi.fn()}
        badges={mockBadges}
      />
    );

    const timeTab = screen.getByText('Horarios');
    fireEvent.click(timeTab);

    expect(screen.getByText('Búho Nocturno')).toBeDefined();
    expect(screen.queryByText('Primer Paso')).toBeNull();
  });

  it('filters only unlocked badges when checkbox checked', () => {
    render(
      <BadgeGridModal
        isOpen={true}
        onClose={vi.fn()}
        badges={mockBadges}
      />
    );

    const checkbox = screen.getByLabelText('Solo desbloqueadas');
    fireEvent.click(checkbox);

    expect(screen.getByText('Primer Paso')).toBeDefined();
    expect(screen.queryByText('Devorador de Páginas I')).toBeNull();
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    render(<BadgeGridModal isOpen={true} onClose={handleClose} badges={mockBadges} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
