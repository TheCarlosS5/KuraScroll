import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SeriesDetailPage } from '../../src/pages/SeriesDetailPage';
import { localClientStorage } from '../../src/services/local-storage-service';
import 'fake-indexeddb/auto';

describe('SeriesDetailPage Component', () => {
  const dummySeries = {
    id: 'series-123',
    slug: 'chainsaw-man',
    titlePrimary: 'Chainsaw Man',
    type: 'manga',
    status: 'ongoing',
    synopsis: 'Denji becomes Chainsaw Man.',
    coverImage: 'https://example.com/csm.jpg',
    chapters: [
      { id: 'ch-1', chapterNumber: 1, title: 'Dog and Chainsaw' },
      { id: 'ch-2', chapterNumber: 2, title: 'The Way to Tokyo' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => dummySeries,
    } as any);
  });

  it('renders series details and chapter list', async () => {
    render(
      <SeriesDetailPage
        slug="chainsaw-man"
        onBack={vi.fn()}
        onReadChapter={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Chainsaw Man')).toBeDefined();
      expect(screen.getByText(/Denji becomes Chainsaw Man/)).toBeDefined();
      expect(screen.getByText('Capítulo 1')).toBeDefined();
    });
  });

  it('allows user to change bookshelf status and persists to storage', async () => {
    const setShelfSpy = vi.spyOn(localClientStorage, 'setSeriesShelf');

    render(
      <SeriesDetailPage
        slug="chainsaw-man"
        onBack={vi.fn()}
        onReadChapter={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('shelf-select')).toBeDefined();
    });

    const select = screen.getByTestId('shelf-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'reading' } });

    expect(setShelfSpy).toHaveBeenCalledWith('chainsaw-man', 'reading', false);
  });

  it('toggles favorite and saves to bookshelf storage', async () => {
    const setShelfSpy = vi.spyOn(localClientStorage, 'setSeriesShelf');

    render(
      <SeriesDetailPage
        slug="chainsaw-man"
        onBack={vi.fn()}
        onReadChapter={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('favorite-toggle-btn')).toBeDefined();
    });

    const favBtn = screen.getByTestId('favorite-toggle-btn');
    fireEvent.click(favBtn);

    expect(setShelfSpy).toHaveBeenCalledWith('chainsaw-man', 'none', true);
  });
});
