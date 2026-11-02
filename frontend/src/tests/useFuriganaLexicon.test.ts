import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFuriganaLexicon } from '../reader/useFuriganaLexicon.js';

describe('Sprint 62 - useFuriganaLexicon Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default closed state', () => {
    const { result } = renderHook(() => useFuriganaLexicon());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeEntry).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('lookups term via API and stores result in activeEntry', async () => {
    const mockEntry = {
      id: 'lex-1',
      term: '卍解',
      reading: 'ばんかい',
      romaji: 'bankai',
      category: 'SERIES_LORE' as const,
      definitionEs: 'Liberación final en Bleach.',
      seriesId: null,
      frequency: 10,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        entry: mockEntry,
      }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useFuriganaLexicon());

    await act(async () => {
      await result.current.lookupTerm('卍解', { x: 150, y: 250 });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeEntry).toEqual(mockEntry);
    expect(result.current.position).toEqual({ x: 150, y: 250 });
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('term=%E5%8D%8D%E8%A7%A3'));
  });

  it('handles 404 gracefully with user-friendly error message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() => useFuriganaLexicon());

    await act(async () => {
      await result.current.lookupTerm('未知の単語');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.activeEntry).toBeNull();
    expect(result.current.error).toContain('No se encontró glosario');
  });

  it('closes popover on close() call or Escape key', () => {
    const { result } = renderHook(() => useFuriganaLexicon());

    act(() => {
      result.current.openAt(
        {
          id: 'lex-2',
          term: '螺旋丸',
          reading: 'らせんがん',
          romaji: 'rasengan',
          category: 'SERIES_LORE',
          definitionEs: 'Esfera espiral',
          seriesId: null,
          frequency: 5,
        },
        { x: 50, y: 50 }
      );
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeEntry).toBeNull();
  });
});
