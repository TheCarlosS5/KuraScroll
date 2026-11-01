import React from 'react';
import { BookOpen, Bookmark, Sparkles, History, Database } from 'lucide-react';

export interface NavbarProps {
  currentView?: string;
  selectedCategory?: string;
  onNavigate?: (view: string, category?: string) => void;
  onOpenBackup?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView = 'catalog',
  selectedCategory,
  onNavigate,
  onOpenBackup,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#080c14]/90 backdrop-blur-md border-b border-gray-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & KS Monogram */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onNavigate?.('catalog')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-xl shadow-[0_0_20px_rgba(0,229,255,0.3)] group-hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all">
            KS
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                KuraScroll
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300 border border-violet-700/50">
                Sister to KS
              </span>
            </div>
            <p className="text-[11px] text-gray-400 -mt-0.5">Manga • Manhwa • Manhua</p>
          </div>
        </div>

        {/* Category Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-gray-900/60 p-1 rounded-xl border border-gray-800/60">
          <button
            onClick={() => onNavigate?.('catalog', '')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentView === 'catalog' && !selectedCategory
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manga')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'manga'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Manga
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manhwa')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'manhwa'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Manhwa
          </button>
          <button
            onClick={() => onNavigate?.('catalog', 'manhua')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'manhua'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Manhua
          </button>
        </nav>

        {/* Bookmarks, History & Storage Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            data-testid="nav-history-btn"
            onClick={() => onNavigate?.('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              currentView === 'history'
                ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                : 'bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-gray-700 hover:text-white'
            }`}
            title="Historial de lectura"
            aria-label="Historial de lectura"
          >
            <History className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Historial</span>
          </button>

          <button
            onClick={() => onNavigate?.('bookmarks')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              currentView === 'bookmarks'
                ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                : 'bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-gray-700 hover:text-white'
            }`}
          >
            <Bookmark className="w-4 h-4 text-violet-400" />
            <span className="hidden sm:inline">Guardados</span>
          </button>

          {onOpenBackup && (
            <button
              data-testid="nav-backup-btn"
              onClick={onOpenBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all bg-gray-900/80 text-gray-300 border border-gray-800 hover:border-cyan-500/50 hover:text-cyan-400"
              title="Copias de Seguridad y Migración"
              aria-label="Copias de Seguridad y Migración"
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Respaldos</span>
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-950/80 border border-cyan-500/20 text-xs text-gray-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>4TB Local Host</span>
          </div>
        </div>
      </div>
    </header>
  );
};
