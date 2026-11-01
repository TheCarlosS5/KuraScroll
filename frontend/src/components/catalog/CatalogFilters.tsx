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
  // Sprint 10.4: User Bookshelf & Collections Filters
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
      className="bg-[#0b101b]/90 border border-gray-800/80 rounded-2xl p-4 md:p-5 mb-8 shadow-xl backdrop-blur-md transition-all"
    >
      {/* Top Bar: Title, Favorites Toggle & Results Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-800/60">
        <div className="flex flex-wrap items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#dc2626]/10 text-[#dc2626] border border-[#dc2626]/30">
            <Filter className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-gray-200 tracking-wide">
            Filtros de Catálogo
          </span>

          {/* Quick Toggle: Mis Favoritos */}
          {onToggleOnlyFavorites && (
            <button
              type="button"
              data-testid="toggle-favorites-filter"
              onClick={() => onToggleOnlyFavorites(!onlyFavorites)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ml-1 ${
                onlyFavorites
                  ? 'bg-[#dc2626]/20 border-[#dc2626] text-[#dc2626] shadow-[0_0_10px_rgba(220,38,38,0.3)]'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  onlyFavorites ? 'fill-[#dc2626] text-[#dc2626]' : 'text-gray-400'
                }`}
              />
              <span>Mis Favoritos</span>
            </button>
          )}

          {isAnyFilterActive && onResetFilters && (
            <button
              data-testid="reset-filters-btn"
              onClick={onResetFilters}
              className="flex items-center gap-1 text-xs text-[#dc2626] hover:text-red-400 font-medium ml-2 transition-colors cursor-pointer"
              title="Restablecer todos los filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Filtered count badge */}
        <div
          data-testid="filter-results-counter"
          className="text-xs font-medium text-gray-400 bg-gray-900/90 border border-gray-800 px-3 py-1 rounded-full shadow-inner"
        >
          Mostrando <strong className="text-cyan-400 font-bold">{filteredCount}</strong> de {totalCount} series
        </div>
      </div>

      {/* Filter Rows */}
      <div className="flex flex-col gap-3.5">
        {/* Row 0 (Sprint 10.4): Mi Biblioteca / Estantería */}
        {onSelectShelf && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtro por Colección">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 w-20 shrink-0 flex items-center gap-1">
              <Bookmark className="w-3 h-3" />
              <span>Colección:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {SHELF_OPTIONS.map((opt) => {
                const isActive = selectedShelf.toLowerCase() === opt.id.toLowerCase();
                return (
                  <button
                    key={opt.id}
                    data-testid={`filter-shelf-${opt.id}`}
                    onClick={() => onSelectShelf(opt.id)}
                    aria-pressed={isActive}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-[#dc2626]/20 border border-[#dc2626] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.25)]'
                        : 'bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800 text-gray-400 hover:text-white'
                    }`}
                    style={{
                      borderColor: isActive ? '#dc2626' : undefined,
                      backgroundColor: isActive ? 'rgba(220, 38, 38, 0.2)' : undefined,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 1: Tipo */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtro por Tipo">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 w-20 shrink-0">
            Tipo:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {TYPE_OPTIONS.map((opt) => {
              const isActive = selectedType.toLowerCase() === opt.id.toLowerCase();
              return (
                <button
                  key={opt.id}
                  data-testid={`filter-type-${opt.id}`}
                  onClick={() => onSelectType(opt.id)}
                  aria-pressed={isActive}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#dc2626]/20 border border-[#dc2626] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.25)]'
                      : 'bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800 text-gray-400 hover:text-white'
                  }`}
                  style={{
                    borderColor: isActive ? '#dc2626' : undefined,
                    backgroundColor: isActive ? 'rgba(220, 38, 38, 0.2)' : undefined,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Estado */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtro por Estado">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 w-20 shrink-0">
            Estado:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_OPTIONS.map((opt) => {
              const isActive = selectedStatus.toLowerCase() === opt.id.toLowerCase();
              return (
                <button
                  key={opt.id}
                  data-testid={`filter-status-${opt.id}`}
                  onClick={() => onSelectStatus(opt.id)}
                  aria-pressed={isActive}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#dc2626]/20 border border-[#dc2626] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.25)]'
                      : 'bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800 text-gray-400 hover:text-white'
                  }`}
                  style={{
                    borderColor: isActive ? '#dc2626' : undefined,
                    backgroundColor: isActive ? 'rgba(220, 38, 38, 0.2)' : undefined,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Géneros populares */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtro por Géneros">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 w-20 shrink-0">
            Género:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {GENRE_OPTIONS.map((opt) => {
              const isActive = selectedGenre.toLowerCase() === opt.id.toLowerCase();
              return (
                <button
                  key={opt.id}
                  data-testid={`filter-genre-${opt.id.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => onSelectGenre(opt.id)}
                  aria-pressed={isActive}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#dc2626]/20 border border-[#dc2626] text-white font-semibold shadow-[0_0_10px_rgba(220,38,38,0.25)]'
                      : 'bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800 text-gray-400 hover:text-white'
                  }`}
                  style={{
                    borderColor: isActive ? '#dc2626' : undefined,
                    backgroundColor: isActive ? 'rgba(220, 38, 38, 0.2)' : undefined,
                  }}
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
