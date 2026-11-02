/**
 * Sprint 62 - Client-Side Furigana & Manga Lore Lexicon Hook
 *
 * Provides reactive point lookup, popover anchoring, caching, and keyboard accessibility ('L').
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type LexiconCategory = 'KANJI' | 'VOCAB' | 'SERIES_LORE' | 'NAME' | 'SFX';

export interface LexiconEntry {
  id: string;
  term: string;
  reading: string;
  romaji: string;
  category: LexiconCategory;
  definitionEs: string;
  definitionEn?: string;
  seriesId: string | null;
  frequency: number;
}

export interface UseFuriganaLexiconOptions {
  seriesId?: string;
  apiBaseUrl?: string;
}

export interface UseFuriganaLexiconReturn {
  activeEntry: LexiconEntry | null;
  isOpen: boolean;
  position: { x: number; y: number };
  isLoading: boolean;
  error: string | null;
  lookupTerm: (term: string, clientPos?: { x: number; y: number }) => Promise<void>;
  close: () => void;
  openAt: (entry: LexiconEntry, pos: { x: number; y: number }) => void;
}

export function useFuriganaLexicon(
  options: UseFuriganaLexiconOptions = {}
): UseFuriganaLexiconReturn {
  const { seriesId, apiBaseUrl = '' } = options;

  const [activeEntry, setActiveEntry] = useState<LexiconEntry | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client memory cache for immediate hover re-use
  const localCacheRef = useRef<Map<string, LexiconEntry>>(new Map());

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveEntry(null);
    setError(null);
  }, []);

  const openAt = useCallback((entry: LexiconEntry, pos: { x: number; y: number }) => {
    setActiveEntry(entry);
    setPosition(pos);
    setIsOpen(true);
    setError(null);
  }, []);

  const lookupTerm = useCallback(
    async (term: string, clientPos?: { x: number; y: number }) => {
      const cleanTerm = term.trim();
      if (!cleanTerm) return;

      if (clientPos) {
        setPosition(clientPos);
      }

      // Check client-side memory cache first
      const cacheKey = `${seriesId ?? 'global'}:${cleanTerm}`;
      const cached = localCacheRef.current.get(cacheKey);
      if (cached) {
        setActiveEntry(cached);
        setIsOpen(true);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({ term: cleanTerm });
        if (seriesId) queryParams.set('seriesId', seriesId);

        const res = await fetch(`${apiBaseUrl}/api/v1/lexicon/lookup?${queryParams.toString()}`);
        if (res.status === 404) {
          setError(`No se encontró glosario para "${cleanTerm}"`);
          setActiveEntry(null);
          setIsOpen(true);
          return;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.entry) {
          localCacheRef.current.set(cacheKey, data.entry);
          setActiveEntry(data.entry);
          setIsOpen(true);
        }
      } catch (err: any) {
        setError(err?.message || 'Error al consultar léxico');
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, seriesId]
  );

  // Global keydown: ESC closes HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  return {
    activeEntry,
    isOpen,
    position,
    isLoading,
    error,
    lookupTerm,
    close,
    openAt,
  };
}
