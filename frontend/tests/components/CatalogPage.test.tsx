import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CatalogPage } from '../../src/pages/CatalogPage';
import { localClientStorage } from '../../src/services/local-storage-service';
import 'fake-indexeddb/auto';

describe('CatalogPage Component', () => {
  const dummyItems = [
    {
      id: 's1',
      slug: 'solo-leveling',
      titlePrimary: 'Solo Leveling',
      type: 'manhwa',
      status: 'completed',
      coverImage: 'https://example.com/solo.jpg',
      genres: ['Acción', 'Fantasía'],
    },
    {
      id: 's2',
      slug: 'one-piece',
      titlePrimary: 'One Piece',
      type: 'manga',
      status: 'ongoing',
      coverImage: 'https://example.com/op.jpg',
      genres: ['Shonen', 'Aventura'],
    },
    {
      id: 's3',
      slug: 'tales-of-demons',
      titlePrimary: 'Tales of Demons and Gods',
      type: 'manhua',
      status: 'ongoing',
      coverImage: 'https://example.com/todg.jpg',
      genres: ['Fantasía', 'Isekai'],
    },
  ];

  beforeEach(async () => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: dummyItems }),
    } as any);

    // Seed mock storage
    await localClientStorage.setSeriesShelf('solo-leveling', 'reading', true);
    await localClientStorage.setSeriesShelf('one-piece', 'completed', false);
  });

  it('renders series and displays shelf status badges from storage', async () => {
    render(<CatalogPage onSelectSeries={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('series-card-solo-leveling')).toBeDefined();
      expect(screen.getByTestId('series-card-one-piece')).toBeDefined();
      expect(screen.getByTestId('series-card-tales-of-demons')).toBeDefined();
    });

    // Check that Solo Leveling has "Leyendo" badge
    const badge = screen.getByTestId('shelf-badge-solo-leveling');
    expect(badge.textContent).toBe('Leyendo');
  });

  it('filters by favorites when "Mis Favoritos" button is clicked', async () => {
    render(<CatalogPage onSelectSeries={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('series-card-solo-leveling')).toBeDefined();
      expect(screen.getByTestId('series-card-one-piece')).toBeDefined();
    });

    const favToggle = screen.getByTestId('toggle-favorites-filter');
    fireEvent.click(favToggle);

    await waitFor(() => {
      // Solo Leveling is favorite, One Piece is not
      expect(screen.getByTestId('series-card-solo-leveling')).toBeDefined();
      expect(screen.queryByTestId('series-card-one-piece')).toBeNull();
      expect(screen.queryByTestId('series-card-tales-of-demons')).toBeNull();
    });
  });

  it('filters by collection shelf when a shelf pill is clicked', async () => {
    render(<CatalogPage onSelectSeries={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('series-card-solo-leveling')).toBeDefined();
    });

    // Click "Completado" collection filter
    const completedShelfPill = screen.getByTestId('filter-shelf-completed');
    fireEvent.click(completedShelfPill);

    await waitFor(() => {
      // One Piece is shelved as completed
      expect(screen.getByTestId('series-card-one-piece')).toBeDefined();
      expect(screen.queryByTestId('series-card-solo-leveling')).toBeNull();
      expect(screen.queryByTestId('series-card-tales-of-demons')).toBeNull();
    });
  });

  it('toggles favorite directly on SeriesCard and updates storage', async () => {
    const setShelfSpy = vi.spyOn(localClientStorage, 'setSeriesShelf');

    render(<CatalogPage onSelectSeries={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('favorite-btn-one-piece')).toBeDefined();
    });

    const favBtn = screen.getByTestId('favorite-btn-one-piece');
    fireEvent.click(favBtn);

    expect(setShelfSpy).toHaveBeenCalledWith('one-piece', 'completed', true);
  });
});
