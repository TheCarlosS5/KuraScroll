import React from 'react';
import { Filter, RotateCcw, Heart, Bookmark } from 'lucide-react';

export interface CatalogFiltersProps {
  selectedType: string;
  onSelectType: (type: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  selectedGenre: string;
  onSelectGenre: (genre: string) => void;
  filteredCount: number;
  totalCount: number;
  onResetFilters?: () => void;
  // User Bookshelf & Collections Filters
  selectedShelf?: string;
  onSelectShelf?: (shelf: string) => void;
  onlyFavorites?: boolean;
  onToggleOnlyFavorites?: (onlyFavs: boolean) => void;
}

export const TYPE_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'manga', label: 'Manga' },
  { id: 'manhwa', label: 'Manhwa' },
  { id: 'manhua', label: 'Manhua' },
] as const;

export const STATUS_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'ongoing', label: 'En emisión' },
  { id: 'completed', label: 'Finalizado' },
] as const;

export const SHELF_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'favorites', label: 'Favoritos' },
  { id: 'reading', label: 'Leyendo' },
  { id: 'plan_to_read', label: 'Por Leer' },
  { id: 'completed', label: 'Completado' },
] as const;

export const GENRE_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'Acción', label: 'Acción' },
  { id: 'Fantasía', label: 'Fantasía' },
  { id: 'Romance', label: 'Romance' },
  { id: 'Isekai', label: 'Isekai' },
  { id: 'Shonen', label: 'Shonen' },
  { id: 'Slice of Life', label: 'Slice of Life' },
] as const;

export const CatalogFilters: React.FC<CatalogFiltersProps> = ({
  selectedType,
  onSelectType,
  selectedStatus,
  onSelectStatus,
  selectedGenre,
  onSelectGenre,
  filteredCount,
  totalCount,
  onResetFilters,
  selectedShelf = 'all',
  onSelectShelf,
  onlyFavorites = false,
  onToggleOnlyFavorites,
}) => {
  const isAnyFilterActive =
    selectedType !== 'all' ||
    selectedStatus !== 'all' ||
    selectedGenre !== 'all' ||
    selectedShelf !== 'all' ||
    onlyFavorites;

  return (
    <div
      data-testid="catalog-filters"
      className="w-full max-w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 sm:p-4 mb-6 shadow-sm transition-all overflow-hidden"
    >
      {/* Top Bar: Title, Favorites Toggle & Results Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 pb-2.5 border-b border-zinc-800/60">
        <div className="flex flex-wrap items-center gap-2">
          <div className="p-1 rounded bg-zinc-800 text-zinc-300">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold text-zinc-200">
            Filtros
          </span>

          {/* Quick Toggle: Mis Favoritos */}
          {onToggleOnlyFavorites && (
            <button
              type="button"
              data-testid="toggle-favorites-filter"
              onClick={() => onToggleOnlyFavorites(!onlyFavorites)}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                onlyFavorites
                  ? 'bg-rose-950/60 border-rose-800/80 text-rose-300'
                  : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-white'
              }`}
            >
              <Heart
                className={`w-3 h-3 ${
                  onlyFavorites ? 'fill-rose-400 text-rose-400' : 'text-zinc-400'
                }`}
              />
              <span>Mis Favoritos</span>
            </button>
          )}

          {isAnyFilterActive && onResetFilters && (
            <button
              data-testid="reset-filters-btn"
              onClick={onResetFilters}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 font-medium ml-1 transition-colors cursor-pointer"
              title="Restablecer todos los filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Filtered count badge */}
        <div
          data-testid="filter-results-counter"
          className="text-[11px] text-zinc-400 bg-zinc-800/60 border border-zinc-800 px-2.5 py-0.5 rounded-full w-fit self-start sm:self-auto"
        >
          Mostrando <strong className="text-zinc-200 font-semibold">{filteredCount}</strong> de {totalCount} series
        </div>
      </div>

      {/* Filter Rows */}
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Row 0: Colección */}
        {onSelectShelf && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5" role="group" aria-label="Filtro por Colección">
            <span className="text-[11px] font-medium text-zinc-400 w-16 shrink-0 flex items-center gap-1">
              <Bookmark className="w-3 h-3 text-zinc-400" />
              <span>Colección:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
              {SHELF_OPTIONS.map((opt) => {
                const isActive = selectedShelf.toLowerCase() === opt.id.toLowerCase();
                return (
                  <button
                    key={opt.id}
                    data-testid={`filter-shelf-${opt.id}`}
                    onClick={() => onSelectShelf(opt.id)}
                    aria-pressed={isActive}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'border-[#dc2626] bg-[#dc2626]/20 text-white font-semibold'
                        : 'bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 1: Tipo */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5" role="group" aria-label="Filtro por Tipo">
          <span className="text-[11px] font-medium text-zinc-400 w-16 shrink-0">
            Tipo:
          </span>
          <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
            {TYPE_OPTIONS.map((opt) => {
              const isActive = selectedType.toLowerCase() === opt.id.toLowerCase();
              return (
                <button
                  key={opt.id}
                  data-testid={`filter-type-${opt.id}`}
                  onClick={() => onSelectType(opt.id)}
                  aria-pressed={isActive}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[#dc2626] bg-[#dc2626]/20 text-white font-semibold'
                      : 'bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Estado */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5" role="group" aria-label="Filtro por Estado">
          <span className="text-[11px] font-medium text-zinc-400 w-16 shrink-0">
            Estado:
          </span>
          <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
            {STATUS_OPTIONS.map((opt) => {
              const isActive = selectedStatus.toLowerCase() === opt.id.toLowerCase();
              return (
                <button
                  key={opt.id}
                  data-testid={`filter-status-${opt.id}`}
                  onClick={() => onSelectStatus(opt.id)}
                  aria-pressed={isActive}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[#dc2626] bg-[#dc2626]/20 text-white font-semibold'
                      : 'bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Géneros populares */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5" role="group" aria-label="Filtro por Géneros">
          <span className="text-[11px] font-medium text-zinc-400 w-16 shrink-0">
            Género:
          </span>
          <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
            {GENRE_OPTIONS.map((opt) => {
              const isActive = selectedGenre.toLowerCase() === opt.id.toLowerCase();
              return (
                <button
                  key={opt.id}
                  data-testid={`filter-genre-${opt.id.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => onSelectGenre(opt.id)}
                  aria-pressed={isActive}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[#dc2626] bg-[#dc2626]/20 text-white font-semibold'
                      : 'bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogFilters;
