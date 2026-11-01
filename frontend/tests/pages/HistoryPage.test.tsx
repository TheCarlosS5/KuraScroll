import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import 'fake-indexeddb/auto';
import { HistoryPage } from '../../src/pages/HistoryPage';
import { localClientStorage } from '../../src/services/local-storage-service';

describe('HistoryPage Component', () => {
  beforeEach(async () => {
    await localClientStorage.init();
    await localClientStorage.clearAllProgress();
    vi.restoreAllMocks();
  });

  it('renders elegant empty state when there are no reading records in IndexedDB', async () => {
    const handleExplore = vi.fn();
    render(<HistoryPage onExploreCatalog={handleExplore} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('empty-history-state')).toBeDefined();
    });

    expect(screen.getByText('Tu historial de lectura está vacío')).toBeDefined();
    expect(screen.getByText(/Comienza a explorar el catálogo/)).toBeDefined();

    // Clicking "Explorar Catálogo" button
    const exploreBtn = screen.getByTestId('explore-catalog-btn');
    fireEvent.click(exploreBtn);
    expect(handleExplore).toHaveBeenCalled();
  });

  it('renders history cards with progress bar and last read timestamp when records exist', async () => {
    // Save progress in IndexedDB
    await localClientStorage.saveProgress({
      seriesId: 'solo-leveling',
      chapterId: 'c15',
      pageNumber: 22,
      scrollOffsetY: 0,
      timestamp: Date.now() - 1000 * 60 * 5, // 5 mins ago
    });

    // Mock series API response
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'solo-leveling',
            slug: 'solo-leveling',
            titlePrimary: 'Solo Leveling',
            type: 'manhwa',
            totalChapters: 200,
          },
        ],
      }),
    } as Response);

    const handleSelectSeries = vi.fn();
    const handleContinueReading = vi.fn();

    render(
      <HistoryPage
        onSelectSeries={handleSelectSeries}
        onContinueReading={handleContinueReading}
      />
    );

    // Wait for card to render
    await waitFor(() => {
      expect(screen.getByTestId('history-card-solo-leveling')).toBeDefined();
    });

    expect(screen.getByTestId('history-title-solo-leveling').textContent).toBe('Solo Leveling');
    expect(screen.getByText('Capítulo 15')).toBeDefined();
    expect(screen.getByText('Pág. 22')).toBeDefined();
    expect(screen.getByText(/manhwa/i)).toBeDefined();

    // Verify statistics banner
    expect(screen.getByText('Series en Lectura')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();

    // Click "Continuar Leyendo"
    const continueBtn = screen.getByTestId('continue-btn-solo-leveling');
    fireEvent.click(continueBtn);
    expect(handleContinueReading).toHaveBeenCalledWith('c15', 'solo-leveling');
  });

  it('allows deleting an individual series from history', async () => {
    await localClientStorage.saveProgress({
      seriesId: 'demon-slayer',
      chapterId: 'c01',
      pageNumber: 5,
      scrollOffsetY: 0,
      timestamp: Date.now(),
    });

    render(<HistoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('history-card-demon-slayer')).toBeDefined();
    });

    const deleteBtn = screen.getByRole('button', { name: /Eliminar del historial/i });
    fireEvent.click(deleteBtn);

    // After deletion, card should disappear and empty state appear
    await waitFor(() => {
      expect(screen.queryByTestId('history-card-demon-slayer')).toBeNull();
      expect(screen.getByTestId('empty-history-state')).toBeDefined();
    });
  });
});
