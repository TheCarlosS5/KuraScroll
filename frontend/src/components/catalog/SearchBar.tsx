import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchBarProps {
  onSearch: (query: string) => void;
  debounceMs?: number;
  initialValue?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  debounceMs = 300,
  initialValue = '',
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(value);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, debounceMs, onSearch]);

  return (
    <div className="w-full max-w-2xl mx-auto my-5">
      <div className="relative flex items-center bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700/80 focus-within:border-zinc-600 rounded-xl px-3.5 py-2.5 shadow-sm transition-all min-w-0">
        <Search className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Buscar por título..."
          className="w-full min-w-0 bg-transparent text-zinc-100 placeholder-zinc-500 text-sm outline-none"
        />
        {value && (
          <button
            onClick={() => setValue('')}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Multilingual Support Badges (Discreet, responsive) */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2 text-[11px] text-zinc-500 select-none">
        <span className="text-zinc-500">Búsqueda:</span>
        <span className="px-1.5 py-0.2 rounded bg-zinc-900/60 border border-zinc-800/80 text-zinc-400">
          Español
        </span>
        <span className="px-1.5 py-0.2 rounded bg-zinc-900/60 border border-zinc-800/80 text-zinc-400">
          Romaji
        </span>
        <span className="px-1.5 py-0.2 rounded bg-zinc-900/60 border border-zinc-800/80 text-zinc-400">
          Kanji
        </span>
      </div>
    </div>
  );
};
