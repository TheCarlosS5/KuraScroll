/**
 * KuraScroll Dynamic Dialogue Text-to-Speech Hook
 * Sprint 75 - Client-Side Multi-Voice Speech Synthesis & Queue Dispatch
 *
 * Coordinates Web Speech API (window.speechSynthesis), voice role pitch/rate modulation,
 * bubble synchronization, ambient soundscape audio ducking, and keyboard shortcut 'T'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 server CPU, 0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type VoiceRole = 'narrator' | 'male_hero' | 'female_hero' | 'child_creature' | 'villain' | 'elder';

export interface ResolvedSpeechItem {
  bubbleId: string;
  pageIndex: number;
  characterName: string;
  role: VoiceRole;
  text: string;
  pitch: number;
  rate: number;
  volume: number;
  preferredVoice?: string;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

export interface UseDialogueTTSOptions {
  initialQueue?: ResolvedSpeechItem[];
  defaultMasterRate?: number;
  defaultAutoAdvance?: boolean;
  enableKeyboard?: boolean;
  onDuckingChange?: (ducked: boolean) => void;
  onBubbleChange?: (bubbleId: string | null) => void;
}

export function useDialogueTTS({
  initialQueue = [],
  defaultMasterRate = 1.0,
  defaultAutoAdvance = true,
  enableKeyboard = true,
  onDuckingChange,
  onBubbleChange,
}: UseDialogueTTSOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [queue, setQueue] = useState<ResolvedSpeechItem[]>(initialQueue);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [masterRate, setMasterRateState] = useState<number>(defaultMasterRate);
  const [autoAdvance, setAutoAdvanceState] = useState<boolean>(defaultAutoAdvance);

  const activeUtteranceRef = useRef<any>(null);
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const currentIndexRef = useRef<number>(0);
  const queueRef = useRef<ResolvedSpeechItem[]>(initialQueue);
  const autoAdvanceRef = useRef<boolean>(defaultAutoAdvance);
  const masterRateRef = useRef<number>(defaultMasterRate);

  isPlayingRef.current = isPlaying;
  isPausedRef.current = isPaused;
  currentIndexRef.current = currentIndex;
  queueRef.current = queue;
  autoAdvanceRef.current = autoAdvance;
  masterRateRef.current = masterRate;

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);

  const setMasterRate = useCallback((rate: number) => {
    const clamped = Math.max(0.5, Math.min(2.5, rate));
    setMasterRateState(clamped);
  }, []);

  const setAutoAdvance = useCallback((enabled: boolean) => {
    setAutoAdvanceState(enabled);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Safe catch for headless / mocked environments
      }
    }
    setIsPlaying(false);
    setIsPaused(false);
    activeUtteranceRef.current = null;
    if (onDuckingChange) onDuckingChange(false);
    if (onBubbleChange) onBubbleChange(null);
  }, [onDuckingChange, onBubbleChange]);

  const speakItem = useCallback(
    (index: number) => {
      const currentQueue = queueRef.current;
      if (index < 0 || index >= currentQueue.length) {
        stop();
        return;
      }

      setCurrentIndex(index);
      const item = currentQueue[index];
      if (onBubbleChange) onBubbleChange(item.bubbleId);

      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setIsPlaying(true);
        setIsPaused(false);
        return;
      }

      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignored
      }

      try {
        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.pitch = item.pitch;
        utterance.rate = item.rate * (masterRateRef.current / (item.rate > 0 ? item.rate : 1));
        utterance.volume = item.volume;

        // Try to match preferred voice if available
        if (item.preferredVoice) {
          const voices = window.speechSynthesis.getVoices();
          const matched = voices.find(
            (v) => v.name.toLowerCase() === item.preferredVoice?.toLowerCase()
          );
          if (matched) utterance.voice = matched;
        }

        utterance.onstart = () => {
          setIsPlaying(true);
          setIsPaused(false);
          if (onDuckingChange) onDuckingChange(true);
        };

        utterance.onend = () => {
          if (onDuckingChange) onDuckingChange(false);
          if (autoAdvanceRef.current && isPlayingRef.current) {
            const nextIdx = currentIndexRef.current + 1;
            if (nextIdx < queueRef.current.length) {
              speakItem(nextIdx);
            } else {
              stop();
            }
          } else {
            setIsPlaying(false);
            setIsPaused(false);
          }
        };

        utterance.onerror = () => {
          if (onDuckingChange) onDuckingChange(false);
          setIsPlaying(false);
          setIsPaused(false);
        };

        activeUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
        setIsPaused(false);
      } catch {
        setIsPlaying(true);
        setIsPaused(false);
      }
    },
    [stop, onDuckingChange, onBubbleChange]
  );

  const play = useCallback(() => {
    if (queue.length === 0) return;
    speakItem(currentIndex);
  }, [queue.length, currentIndex, speakItem]);

  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
      } catch {
        // Ignored
      }
    }
    setIsPaused(true);
    setIsPlaying(false);
    if (onDuckingChange) onDuckingChange(false);
  }, [onDuckingChange]);

  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // Ignored
      }
    }
    setIsPaused(false);
    setIsPlaying(true);
    if (onDuckingChange) onDuckingChange(true);
  }, [onDuckingChange]);

  const skipNext = useCallback(() => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < queue.length) {
      speakItem(nextIdx);
    } else {
      stop();
    }
  }, [currentIndex, queue.length, speakItem, stop]);

  const skipPrevious = useCallback(() => {
    const prevIdx = Math.max(0, currentIndex - 1);
    speakItem(prevIdx);
  }, [currentIndex, speakItem]);

  // Clean cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Keyboard shortcut listener ('T' to toggle HUD)
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleHUD]);

  const currentBubbleId = queue[currentIndex]?.bubbleId ?? null;

  return {
    isOpen,
    openHUD,
    closeHUD,
    toggleHUD,
    isPlaying,
    isPaused,
    currentIndex,
    currentBubbleId,
    queue,
    setQueue,
    masterRate,
    setMasterRate,
    autoAdvance,
    setAutoAdvance,
    play,
    pause,
    resume,
    stop,
    skipNext,
    skipPrevious,
  };
}
