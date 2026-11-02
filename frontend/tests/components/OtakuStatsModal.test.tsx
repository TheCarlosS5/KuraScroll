import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OtakuStatsModal } from '../../src/components/stats/OtakuStatsModal.js';

describe('OtakuStatsModal Component Unit Suite (Sprint 41)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('stats-radar')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                userId: 'local_user',
                totalGenresTracked: 3,
                maxChapters: 10,
                axes: [
                  { genreId: 1, genreName: 'Acción', chaptersRead: 10, readingSeconds: 2000, score: 100 },
                  { genreId: 2, genreName: 'Fantasía', chaptersRead: 8, readingSeconds: 1600, score: 80 },
                  { genreId: 3, genreName: 'Romance', chaptersRead: 5, readingSeconds: 1000, score: 50 },
                ],
              }),
          });
        }
        if (url.includes('activity-heatmap')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                userId: 'local_user',
                totalDaysActive: 12,
                totalPagesPeriod: 450,
                totalReadingSeconds: 12000,
                days: [
                  { date: '2026-10-01', pages: 20, seconds: 600, intensity: 2 },
                  { date: '2026-10-02', pages: 55, seconds: 1800, intensity: 3 },
                ],
                hourlyDistribution: [],
              }),
          });
        }
        return Promise.reject(new Error('not found'));
      })
    );
  });

  it('renders modal dialog and header when isOpen is true', async () => {
    render(<OtakuStatsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('otaku-stats-modal')).toBeDefined();
    expect(screen.getByText('Estadísticas Otaku')).toBeDefined();
    expect(screen.getByText('Polígono de Preferencias por Género')).toBeDefined();
    expect(screen.getByText('Mapa de Calor de Lectura Anual')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Acción')).toBeDefined();
    });
  });

  it('does not render when isOpen is false', () => {
    render(<OtakuStatsModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('otaku-stats-modal')).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<OtakuStatsModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByLabelText('Cerrar modal de estadísticas');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledOnce();
  });
});
