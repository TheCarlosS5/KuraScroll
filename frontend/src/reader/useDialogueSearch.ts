/**
 * Sprint 60 - Client-Side Dialogue OCR Search Hook
 *
 * Provides reactive debounced search across in-manga speech bubbles
 * with anti-spoiler causal chapter constraints.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface DialogueSearchResultItem {
  bubbleId: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle?: string;
  pageNumber: number;
  text: string;
  snippet?: string;
  boundingBox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  bubbleType: string;
  language: string;
  confidence: number;
}

export interface UseDialogueSearchOptions {
  seriesId?: string;
  chapterId?: string;
  currentChapterNumber?: number;
  initialProtectSpoilers?: boolean;
}

export interface UseDialogueSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: DialogueSearchResultItem[];
  isLoading: boolean;
  error: string | null;
  protectSpoilers: boolean;
  setProtectSpoilers: (protect: boolean) => void;
  totalMatches: number;
  queryTimeMs: number;
  clear: () => void;
  executeSearch: (customQuery?: string) => Promise<void>;
}

export function useDialogueSearch(options: UseDialogueSearchOptions = {}): UseDialogueSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DialogueSearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protectSpoilers, setProtectSpoilers] = useState(options.initialProtectSpoilers ?? true);
  const [totalMatches, setTotalMatches] = useState(0);
  const [queryTimeMs, setQueryTimeMs] = useState(0);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeSearch = useCallback(
    async (customQuery?: string) => {
      const q = (customQuery !== undefined ? customQuery : query).trim();
      if (!q) {
        setResults([]);
        setTotalMatches(0);
        setQueryTimeMs(0);
        setIsLoading(false);
        setError(null);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set('q', q);

        if (options.seriesId) {
          params.set('seriesId', options.seriesId);
        }
        if (options.chapterId) {
          params.set('chapterId', options.chapterId);
        }
        if (protectSpoilers && options.currentChapterNumber !== undefined) {
          params.set('maxChapter', String(options.currentChapterNumber));
        }

        const res = await fetch(`/api/v1/dialogue/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error ${res.status}`);
        }

        const data = await res.json();
        setResults(data.results || []);
        setTotalMatches(data.count || 0);
        setQueryTimeMs(data.queryTimeMs || 0);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Error executing dialogue search');
          setResults([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [query, options.seriesId, options.chapterId, options.currentChapterNumber, protectSpoilers]
  );

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setTotalMatches(0);
      setIsLoading(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch();
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, executeSearch]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setTotalMatches(0);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    protectSpoilers,
    setProtectSpoilers,
    totalMatches,
    queryTimeMs,
    clear,
    executeSearch,
  };
}
