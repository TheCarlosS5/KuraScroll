import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaperTone } from '../reader/usePaperTone.js';

describe('Sprint 64 - usePaperTone Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default ORIGINAL preset and identity settings', () => {
    const { result } = renderHook(() => usePaperTone({ enableKeyboardShortcut: false }));

    expect(result.current.preset).toBe('ORIGINAL');
    expect(result.current.warmth).toBe(0.0);
    expect(result.current.contrast).toBe(1.0);
    expect(result.current.brightness).toBe(1.0);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.filterStyle).toEqual({});
  });

  it('updates preset and recomputes SVG matrix and filterStyle', () => {
    const { result } = renderHook(() => usePaperTone({ enableKeyboardShortcut: false }));

    act(() => {
      result.current.setPreset('SEPIA_CALIDO');
    });

    expect(result.current.preset).toBe('SEPIA_CALIDO');
    expect(result.current.svgMatrix).toContain('0.393');
    expect(result.current.filterStyle).toEqual({
      filter: 'url(#kura-paper-tone-filter)',
    });
  });

  it('adjusts warmth, contrast, and brightness with proper clamping', () => {
    const { result } = renderHook(() => usePaperTone({ enableKeyboardShortcut: false }));

    act(() => {
      result.current.setWarmth(2.5); // Should clamp to 1.0
      result.current.setContrast(0.1); // Should clamp to 0.5
      result.current.setBrightness(3.0); // Should clamp to 1.5
    });

    expect(result.current.warmth).toBe(1.0);
    expect(result.current.contrast).toBe(0.5);
    expect(result.current.brightness).toBe(1.5);
  });

  it('saves profile via API POST request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      usePaperTone({ seriesId: 'ser-hook-test', enableKeyboardShortcut: false })
    );

    act(() => {
      result.current.setPreset('PAPEL_E_INK');
    });

    await act(async () => {
      await result.current.saveProfile();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reader/tone/profile'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"preset":"PAPEL_E_INK"'),
      })
    );
  });

  it('manages modal visibility via open, close, and toggleOpen', () => {
    const { result } = renderHook(() => usePaperTone({ enableKeyboardShortcut: false }));

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggleOpen();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleOpen();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('toggles visibility on "t" keyboard event', () => {
    const { result } = renderHook(() => usePaperTone({ enableKeyboardShortcut: true }));

    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T' }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
