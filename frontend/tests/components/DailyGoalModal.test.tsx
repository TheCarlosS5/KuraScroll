import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { DailyGoalModal } from '../../src/components/habits/DailyGoalModal';

describe('DailyGoalModal Component', () => {
  it('renders modal with target values, progress and 7-day calendar', () => {
    const calendarMock = [
      { date: '2026-10-27', pagesRead: 30, readingSeconds: 600, goalCompleted: true },
      { date: '2026-10-28', pagesRead: 10, readingSeconds: 200, goalCompleted: false },
      { date: '2026-10-29', pagesRead: 40, readingSeconds: 800, goalCompleted: true },
      { date: '2026-10-30', pagesRead: 0, readingSeconds: 0, goalCompleted: false },
      { date: '2026-10-31', pagesRead: 35, readingSeconds: 700, goalCompleted: true },
      { date: '2026-11-01', pagesRead: 50, readingSeconds: 1000, goalCompleted: true },
      { date: '2026-11-02', pagesRead: 20, readingSeconds: 400, goalCompleted: false },
    ];

    render(
      <DailyGoalModal
        isOpen={true}
        onClose={vi.fn()}
        initialGoal={{ targetType: 'pages', targetValue: 30, notificationsEnabled: true }}
        todayProgress={{ pagesRead: 20, readingSeconds: 400, goalCompleted: false, progressPercentage: 66.7 }}
        calendar={calendarMock}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Meta Diaria de Lectura')).toBeDefined();
    expect(screen.getByText('20 / 30 páginas')).toBeDefined();
    expect(screen.getByText('Faltan 10 páginas')).toBeDefined();
    expect(screen.getByText('ÚLTIMOS 7 DÍAS')).toBeDefined();
  });

  it('allows switching target type and selecting preset values', () => {
    render(
      <DailyGoalModal
        isOpen={true}
        onClose={vi.fn()}
        initialGoal={{ targetType: 'pages', targetValue: 30, notificationsEnabled: true }}
      />
    );

    // Switch to minutes
    const minutesBtn = screen.getByText('Minutos de lectura');
    fireEvent.click(minutesBtn);

    // Click preset 50
    const preset50 = screen.getByText('50');
    fireEvent.click(preset50);

    const input = screen.getByLabelText('Cantidad objetivo diaria') as HTMLInputElement;
    expect(input.value).toBe('50');
  });

  it('calls onSaveGoal with customized values when saving', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <DailyGoalModal
        isOpen={true}
        onClose={handleClose}
        initialGoal={{ targetType: 'pages', targetValue: 30, notificationsEnabled: true }}
        onSaveGoal={handleSave}
      />
    );

    const preset15 = screen.getByText('15');
    fireEvent.click(preset15);

    const saveBtn = screen.getByText('Guardar Meta');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        targetType: 'pages',
        targetValue: 15,
        notificationsEnabled: true,
      });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    render(<DailyGoalModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
