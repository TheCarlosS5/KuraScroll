import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDialogueTTS, ResolvedSpeechItem } from '../reader/useDialogueTTS';

describe('Sprint 75 - useDialogueTTS Hook Tests', () => {
  const mockQueue: ResolvedSpeechItem[] = [
    {
      bubbleId: 'b-1',
      pageIndex: 0,
      characterName: 'Narrador',
      role: 'narrator',
      text: 'En un mundo lejano...',
      pitch: 1.0,
      rate: 1.0,
      volume: 1.0,
    },
    {
      bubbleId: 'b-2',
      pageIndex: 0,
      characterName: 'Luffy',
      role: 'male_hero',
      text: '¡Vamos allá!',
      pitch: 0.95,
      rate: 1.1,
      volume: 1.0,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    // Setup window.speechSynthesis mock
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        getVoices: vi.fn(() => []),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      useDialogueTTS({ enableKeyboard: false, initialQueue: mockQueue })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentBubbleId).toBe('b-1');
    expect(result.current.masterRate).toBe(1.0);
    expect(result.current.autoAdvance).toBe(true);
    expect(result.current.queue).toHaveLength(2);
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      useDialogueTTS({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openHUD();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeHUD();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('handles play, pause, resume, and stop playback states', () => {
    const duckingFn = vi.fn();
    const bubbleFn = vi.fn();

    const { result } = renderHook(() =>
      useDialogueTTS({
        enableKeyboard: false,
        initialQueue: mockQueue,
        onDuckingChange: duckingFn,
        onBubbleChange: bubbleFn,
      })
    );

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.isPaused).toBe(false);
    expect(bubbleFn).toHaveBeenCalledWith('b-1');

    act(() => {
      result.current.pause();
    });
    expect(result.current.isPaused).toBe(true);
    expect(result.current.isPlaying).toBe(false);

    act(() => {
      result.current.resume();
    });
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.isPaused).toBe(false);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(bubbleFn).toHaveBeenCalledWith(null);
  });

  it('skips to next and previous bubbles in queue', () => {
    const { result } = renderHook(() =>
      useDialogueTTS({ enableKeyboard: false, initialQueue: mockQueue })
    );

    act(() => {
      result.current.skipNext();
    });
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentBubbleId).toBe('b-2');

    act(() => {
      result.current.skipPrevious();
    });
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentBubbleId).toBe('b-1');
  });

  it('updates master rate and clamps to bounds [0.5, 2.5]', () => {
    const { result } = renderHook(() =>
      useDialogueTTS({ enableKeyboard: false })
    );

    act(() => {
      result.current.setMasterRate(1.5);
    });
    expect(result.current.masterRate).toBe(1.5);

    act(() => {
      result.current.setMasterRate(10.0);
    });
    expect(result.current.masterRate).toBe(2.5);

    act(() => {
      result.current.setMasterRate(0.1);
    });
    expect(result.current.masterRate).toBe(0.5);
  });

  it('toggles auto-advance flag', () => {
    const { result } = renderHook(() =>
      useDialogueTTS({ enableKeyboard: false, defaultAutoAdvance: true })
    );

    expect(result.current.autoAdvance).toBe(true);

    act(() => {
      result.current.setAutoAdvance(false);
    });
    expect(result.current.autoAdvance).toBe(false);
  });
});
