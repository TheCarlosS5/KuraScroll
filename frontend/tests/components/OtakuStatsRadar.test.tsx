import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OtakuStatsRadar, GenreRadarAxis } from '../../src/components/stats/OtakuStatsRadar.js';

describe('OtakuStatsRadar Component Unit Suite (Sprint 41)', () => {
  const sampleAxes: GenreRadarAxis[] = [
    { genreId: 1, genreName: 'Acción', chaptersRead: 25, readingSeconds: 5000, score: 100 },
    { genreId: 2, genreName: 'Fantasía', chaptersRead: 20, readingSeconds: 4000, score: 80 },
    { genreId: 3, genreName: 'Romance', chaptersRead: 10, readingSeconds: 2000, score: 40 },
    { genreId: 4, genreName: 'Isekai', chaptersRead: 15, readingSeconds: 3000, score: 60 },
    { genreId: 5, genreName: 'Comedia', chaptersRead: 5, readingSeconds: 1000, score: 20 },
    { genreId: 6, genreName: 'Sci-Fi', chaptersRead: 12, readingSeconds: 2400, score: 48 },
  ];

  it('renders SVG radar chart with all genre labels and player polygon', () => {
    render(<OtakuStatsRadar axes={sampleAxes} size={300} />);

    expect(screen.getByTestId('otaku-stats-radar')).toBeDefined();
    expect(screen.getByTestId('radar-player-polygon')).toBeDefined();

    for (const axis of sampleAxes) {
      expect(screen.getByText(axis.genreName)).toBeDefined();
    }
  });

  it('renders default fallback axes when empty axes array is provided', () => {
    render(<OtakuStatsRadar axes={[]} size={300} />);

    expect(screen.getByTestId('otaku-stats-radar')).toBeDefined();
    expect(screen.getByText('Acción')).toBeDefined();
    expect(screen.getByText('Fantasía')).toBeDefined();
    expect(screen.getByText('Romance')).toBeDefined();
  });

  it('applies hardware-accelerated style contain: layout paint to enforce 0 CLS', () => {
    const { container } = render(<OtakuStatsRadar axes={sampleAxes} size={280} />);
    const radar = container.querySelector('[data-testid="otaku-stats-radar"]') as HTMLElement;

    expect(radar.style.contain).toBe('layout paint');
    expect(radar.style.width).toBe('280px');
    expect(radar.style.height).toBe('280px');
  });
});
