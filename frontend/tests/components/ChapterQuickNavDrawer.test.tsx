import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChapterQuickNavDrawer, QuickIndexData, SeriesBookmarkItem } from '../../src/components/reader/ChapterQuickNavDrawer';

describe('ChapterQuickNavDrawer Component Unit Suite', () => {
  const dummyIndex: QuickIndexData = {
    seriesId: 'series-test',
    totalChapters: 3,
    readChapters: 1,
    totalBookmarks: 2,
    chapters: [
      {
        chapterId: 'ch-1',
        chapterNumber: 1,
        title: 'Inicio de la Aventura',
        pageCount: 20,
        lastPageIndex: 20,
        completed: true,
        bookmarkCount: 0,
      },
      {
        chapterId: 'ch-2',
        chapterNumber: 2,
        title: 'El Despertar',
        pageCount: 22,
        lastPageIndex: 10,
        completed: false,
        bookmarkCount: 2,
      },
      {
        chapterId: 'ch-3',
        chapterNumber: 3,
        title: 'Batalla en la Cueva',
        pageCount: 18,
        lastPageIndex: 1,
        completed: false,
        bookmarkCount: 0,
      },
    ],
  };

  const dummyBookmarks: SeriesBookmarkItem[] = [
    {
      id: 101,
      chapterId: 'ch-2',
      chapterNumber: 2,
      pageIndex: 5,
      note: 'Doble panel impactante',
      createdAt: '2026-11-01T20:00:00Z',
    },
  ];

  it('renders drawer and chapter list when isOpen is true', () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();

    render(
      <ChapterQuickNavDrawer
        isOpen={true}
        onClose={handleClose}
        seriesId="series-test"
        currentChapterId="ch-1"
        currentPage={1}
        onSelectChapter={handleSelect}
        quickIndexData={dummyIndex}
        bookmarks={dummyBookmarks}
      />
    );

    expect(screen.getByText('Navegación de Capítulos')).toBeDefined();
    expect(screen.getByText(/1 \/ 3 leídos/)).toBeDefined();
    expect(screen.getByText('Inicio de la Aventura')).toBeDefined();
    expect(screen.getByText('El Despertar')).toBeDefined();
  });

  it('filters chapters in real time when typing in search input', () => {
    render(
      <ChapterQuickNavDrawer
        isOpen={true}
        onClose={vi.fn()}
        seriesId="series-test"
        onSelectChapter={vi.fn()}
        quickIndexData={dummyIndex}
      />
    );

    const searchInput = screen.getByPlaceholderText('Buscar capítulo...');
    fireEvent.change(searchInput, { target: { value: 'Despertar' } });

    expect(screen.getByText('El Despertar')).toBeDefined();
    expect(screen.queryByText('Inicio de la Aventura')).toBeNull();
  });

  it('switches to bookmarks tab and displays bookmark details', () => {
    const handleSelect = vi.fn();

    render(
      <ChapterQuickNavDrawer
        isOpen={true}
        onClose={vi.fn()}
        seriesId="series-test"
        onSelectChapter={handleSelect}
        quickIndexData={dummyIndex}
        bookmarks={dummyBookmarks}
      />
    );

    const bookmarksTabBtn = screen.getByRole('button', { name: /Marcadores/i });
    fireEvent.click(bookmarksTabBtn);

    expect(screen.getByText(/Cap\. 2 • Pág\. 5/)).toBeDefined();
    expect(screen.getByText('Doble panel impactante')).toBeDefined();

    // Click bookmark item to jump
    fireEvent.click(screen.getByText('Doble panel impactante'));
    expect(handleSelect).toHaveBeenCalledWith('ch-2', 5);
  });

  it('triggers onSelectChapter and onClose when clicking a chapter row', () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();

    render(
      <ChapterQuickNavDrawer
        isOpen={true}
        onClose={handleClose}
        seriesId="series-test"
        onSelectChapter={handleSelect}
        quickIndexData={dummyIndex}
      />
    );

    const chRow = screen.getByText('El Despertar');
    fireEvent.click(chRow);

    expect(handleSelect).toHaveBeenCalledWith('ch-2');
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();

    render(
      <ChapterQuickNavDrawer
        isOpen={true}
        onClose={handleClose}
        seriesId="series-test"
        onSelectChapter={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });
});
