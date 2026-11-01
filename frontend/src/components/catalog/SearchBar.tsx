import React, { useState, useEffect } from 'react';
import { Search, X, Globe, Sparkles } from 'lucide-react';

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
    <div className="w-full max-w-3xl mx-auto my-6 px-4">
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 rounded-2xl blur-md group-hover:blur-lg transition-all opacity-70 group-hover:opacity-100" />
        <div className="relative flex items-center bg-[#0d131f] border border-gray-800 rounded-2xl px-4 py-3 shadow-2xl focus-within:border-cyan-500/80 transition-all">
          <Search className="w-5 h-5 text-gray-400 group-focus-within:text-cyan-400 transition-colors mr-3" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Buscar por título en Español, Romaji, English o 漢字..."
            className="w-full bg-transparent text-white placeholder-gray-500 text-sm md:text-base outline-none"
          />
          {value && (
            <button
              onClick={() => setValue('')}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Multilingual Support Badges */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5 text-xs text-gray-400">
        <span className="flex items-center gap-1 text-[11px] text-gray-400">
          <Globe className="w-3 h-3 text-cyan-400" />
          Búsqueda unificada:
        </span>
        <span className="px-2 py-0.5 rounded-full bg-gray-900 border border-gray-800 text-gray-400">
          Romaji
        </span>
        <span className="px-2 py-0.5 rounded-full bg-gray-900 border border-gray-800 text-gray-400">
          English
        </span>
        <span className="px-2 py-0.5 rounded-full bg-gray-900 border border-gray-800 text-gray-400">
          Español
        </span>
        <span className="px-2 py-0.5 rounded-full bg-gray-900 border border-gray-800 text-gray-400">
          Kanji / Hangul
        </span>
      </div>
    </div>
  );
};
