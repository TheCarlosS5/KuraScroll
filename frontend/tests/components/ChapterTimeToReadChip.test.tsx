import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ChapterTimeToReadChip } from '../../src/components/reader/ChapterTimeToReadChip';

describe('ChapterTimeToReadChip Component', () => {
  it('renders remaining time in seconds when remaining time < 60s', () => {
    // 10 pages remaining, 4 seconds per page = 40 seconds remaining (< 60s)
    render(
      <ChapterTimeToReadChip
        currentPage={40}
        totalPages={50}
        averageSecondsPerPage={4}
      />
    );

    expect(screen.getByText('~40s restantes')).toBeDefined();
    expect(screen.getByText('Pág 40 de 50 • ~4s/pág')).toBeDefined();
  });

  it('renders remaining time in minutes when remaining time >= 60s', () => {
    // 5 pages remaining, 30 seconds per page = 150 seconds (2.5 mins -> ceil 3 mins)
    render(
      <ChapterTimeToReadChip
        currentPage={15}
        totalPages={20}
        averageSecondsPerPage={30}
      />
    );

    expect(screen.getByText('~3 min restantes')).toBeDefined();
    expect(screen.getByText('Pág 15 de 20 • ~30s/pág')).toBeDefined();
  });

  it('renders singular minute when remaining time rounds to 1 min', () => {
    // 2 pages remaining, 30 seconds per page = 60 seconds (1 min)
    render(
      <ChapterTimeToReadChip
        currentPage={8}
        totalPages={10}
        averageSecondsPerPage={30}
      />
    );

    expect(screen.getByText('~1 min restante')).toBeDefined();
  });

  it('renders "Completado" when on last page or completed', () => {
    render(
      <ChapterTimeToReadChip
        currentPage={50}
        totalPages={50}
        averageSecondsPerPage={15}
      />
    );

    expect(screen.getByText('Completado')).toBeDefined();
    expect(screen.getByText('Pág 50 de 50 • ~15s/pág')).toBeDefined();
  });

  it('renders "Completado" when current page exceeds total pages', () => {
    render(
      <ChapterTimeToReadChip
        currentPage={52}
        totalPages={50}
        averageSecondsPerPage={15}
      />
    );

    expect(screen.getByText('Completado')).toBeDefined();
  });

  it('correctly sets ARIA attributes (role="timer" and aria-label)', () => {
    render(
      <ChapterTimeToReadChip
        currentPage={10}
        totalPages={20}
        averageSecondsPerPage={20}
      />
    );

    const timerElement = screen.getByRole('timer');
    expect(timerElement).toBeDefined();
    expect(timerElement.getAttribute('aria-label')).toBe('Tiempo estimado de lectura: ~4 min restantes');
  });
});
