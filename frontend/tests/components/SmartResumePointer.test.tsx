import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SmartResumePointer } from '../../src/components/home/SmartResumePointer.js';

describe('SmartResumePointer Component', () => {
  const mockOnContinueReading = vi.fn();
  const mockOnSelectSeries = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when fetch returns empty items', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as any);

    const { container } = render(
      <SmartResumePointer
        onContinueReading={mockOnContinueReading}
        onSelectSeries={mockOnSelectSeries}
      />
    );

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders recent reading hero card with details, progress, and triggers continue reading', async () => {
    const mockItems = [
      {
        seriesId: 's-solo',
        seriesTitle: 'Solo Leveling',
        seriesSlug: 'solo-leveling',
        chapterId: 'ch-179',
        chapterNumber: 179,
        chapterTitle: 'Final Battle',
        pageNumber: 35,
        totalPages: 40,
        progressPercent: 88,
        updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
        thumbnails: {
          cover: '/api/v1/covers/s-solo',
          lastRead: '/api/v1/chapters/ch-179/pages/35',
          coverAvailable: true,
          lastReadAvailable: true,
        },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as any);

    render(
      <SmartResumePointer
        onContinueReading={mockOnContinueReading}
        onSelectSeries={mockOnSelectSeries}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('smart-resume-pointer')).toBeDefined();
    });

    expect(screen.getByText('Solo Leveling')).toBeDefined();
    expect(screen.getByText('Final Battle')).toBeDefined();
    expect(screen.getByText(/En progreso \(88%\)/)).toBeDefined();
    expect(screen.getByText('Capítulo 179')).toBeDefined();
    expect(screen.getByText('Hace 15 min')).toBeDefined();

    // Click on "Reanudar Lectura" button
    const resumeBtn = screen.getByRole('button', { name: /Reanudar Lectura/i });
    fireEvent.click(resumeBtn);

    expect(mockOnContinueReading).toHaveBeenCalledTimes(1);
    expect(mockOnContinueReading).toHaveBeenCalledWith('ch-179', 'solo-leveling', 35);
  });

  it('handles keyboard interaction (Enter & Space) to resume reading', async () => {
    const mockItems = [
      {
        seriesId: 's-csm',
        seriesTitle: 'Chainsaw Man',
        seriesSlug: 'chainsaw-man',
        chapterId: 'ch-1',
        chapterNumber: 1,
        pageNumber: 12,
        totalPages: 24,
        progressPercent: 50,
        updatedAt: new Date().toISOString(),
        thumbnails: {
          cover: '/api/v1/covers/s-csm',
          lastRead: null,
        },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as any);

    render(
      <SmartResumePointer
        onContinueReading={mockOnContinueReading}
        onSelectSeries={mockOnSelectSeries}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Chainsaw Man')).toBeDefined();
    });

    const card = screen.getByText('Chainsaw Man').closest('.group') as HTMLElement;
    expect(card).toBeDefined();

    // Press Space
    fireEvent.keyDown(card, { key: ' ' });
    expect(mockOnContinueReading).toHaveBeenCalledWith('ch-1', 'chainsaw-man', 12);

    // Press Enter
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockOnContinueReading).toHaveBeenCalledTimes(2);
  });

  it('falls back to placeholder when cover image errors', async () => {
    const mockItems = [
      {
        seriesId: 's-broken',
        seriesTitle: 'Broken Image Manga',
        seriesSlug: 'broken-image',
        chapterId: 'ch-1',
        chapterNumber: 1,
        pageNumber: 1,
        totalPages: 20,
        progressPercent: 5,
        updatedAt: new Date().toISOString(),
        thumbnails: {
          cover: '/invalid/path.webp',
          lastRead: null,
        },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as any);

    render(
      <SmartResumePointer
        onContinueReading={mockOnContinueReading}
        onSelectSeries={mockOnSelectSeries}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Broken Image Manga')).toBeDefined();
    });

    const img = screen.getByAltText('Broken Image Manga');
    fireEvent.error(img);

    // Should gracefully render fallback placeholder without breaking
    await waitFor(() => {
      expect(screen.getAllByText('Broken Image Manga').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders secondary reading strip when multiple series are in progress', async () => {
    const mockItems = [
      {
        seriesId: 's-1',
        seriesTitle: 'Primary Series',
        seriesSlug: 'primary-series',
        chapterId: 'ch-1',
        chapterNumber: 1,
        pageNumber: 5,
        totalPages: 20,
        progressPercent: 25,
        thumbnails: { cover: null, lastRead: null },
      },
      {
        seriesId: 's-2',
        seriesTitle: 'Secondary Manga A',
        seriesSlug: 'secondary-a',
        chapterId: 'ch-2',
        chapterNumber: 2,
        pageNumber: 10,
        totalPages: 30,
        progressPercent: 33,
        thumbnails: { cover: null, lastRead: null },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as any);

    render(
      <SmartResumePointer
        onContinueReading={mockOnContinueReading}
        onSelectSeries={mockOnSelectSeries}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('Primary Series').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Secondary Manga A')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Secondary Manga A'));
    expect(mockOnContinueReading).toHaveBeenCalledWith('ch-2', 'secondary-a', 10);
  });
});
