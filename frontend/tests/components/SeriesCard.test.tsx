import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SeriesCard } from '../../src/components/catalog/SeriesCard';

describe('SeriesCard Component', () => {
  const defaultProps = {
    id: 'series-1',
    slug: 'solo-leveling',
    titlePrimary: 'Solo Leveling',
    type: 'manhwa',
    status: 'completed',
    coverImage: 'https://example.com/solo.jpg',
    latestChapter: 179,
    onClick: vi.fn(),
    onToggleFavorite: vi.fn(),
  };

  it('renders title, type badge, and cover image', () => {
    render(<SeriesCard {...defaultProps} />);

    expect(screen.getByText('Solo Leveling')).toBeDefined();
    expect(screen.getByText('manhwa')).toBeDefined();
    expect(screen.getByText(/Cap. 179/)).toBeDefined();

    const img = screen.getByAltText('Solo Leveling') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/solo.jpg');
  });

  it('toggles favorite when heart button is clicked without triggering card onClick', () => {
    const handleCardClick = vi.fn();
    const handleToggleFav = vi.fn();

    render(
      <SeriesCard
        {...defaultProps}
        isFavorite={false}
        onClick={handleCardClick}
        onToggleFavorite={handleToggleFav}
      />
    );

    const heartBtn = screen.getByTestId('favorite-btn-solo-leveling');
    fireEvent.click(heartBtn);

    expect(handleToggleFav).toHaveBeenCalledWith('solo-leveling', true);
    expect(handleCardClick).not.toHaveBeenCalled();
  });

  it('triggers card onClick when clicking card body', () => {
    const handleCardClick = vi.fn();

    render(
      <SeriesCard
        {...defaultProps}
        onClick={handleCardClick}
      />
    );

    const card = screen.getByTestId('series-card-solo-leveling');
    fireEvent.click(card);

    expect(handleCardClick).toHaveBeenCalledWith('solo-leveling');
  });

  it('renders shelf badges correctly according to user library status', () => {
    const { rerender } = render(
      <SeriesCard
        {...defaultProps}
        shelf="reading"
      />
    );

    let badge = screen.getByTestId('shelf-badge-solo-leveling');
    expect(badge.textContent).toBe('Leyendo');
    expect(badge.className).toContain('text-cyan-300');

    rerender(
      <SeriesCard
        {...defaultProps}
        shelf="completed"
      />
    );
    badge = screen.getByTestId('shelf-badge-solo-leveling');
    expect(badge.textContent).toBe('Completado');
    expect(badge.className).toContain('text-emerald-300');

    rerender(
      <SeriesCard
        {...defaultProps}
        shelf="plan_to_read"
      />
    );
    badge = screen.getByTestId('shelf-badge-solo-leveling');
    expect(badge.textContent).toBe('Por Leer');
    expect(badge.className).toContain('text-violet-300');

    rerender(
      <SeriesCard
        {...defaultProps}
        shelf="dropped"
      />
    );
    badge = screen.getByTestId('shelf-badge-solo-leveling');
    expect(badge.textContent).toBe('Pausado');
    expect(badge.className).toContain('text-amber-300');
  });

  it('renders highlighted title and snippet when search matches are present', () => {
    render(
      <SeriesCard
        {...defaultProps}
        highlightedTitle='Solo <mark class="bg-indigo-500/25 text-indigo-300 rounded px-1 font-semibold">Leveling</mark>'
        highlightedSnippet='...in a world of dungeons and hunters, <mark class="bg-indigo-500/25 text-indigo-300 rounded px-1 font-semibold">Leveling</mark> up alone...'
      />
    );

    const titleEl = screen.getByTestId('series-card-highlighted-title');
    expect(titleEl).toBeDefined();
    expect(titleEl.innerHTML).toContain('<mark class="bg-indigo-500/25 text-indigo-300 rounded px-1 font-semibold">Leveling</mark>');

    const snippetEl = screen.getByTestId('series-card-highlighted-snippet');
    expect(snippetEl).toBeDefined();
    expect(snippetEl.innerHTML).toContain('...in a world of dungeons');
  });
});
