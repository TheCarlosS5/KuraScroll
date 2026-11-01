import React, { useState, useEffect, useMemo } from 'react';
import { SearchBar } from '../components/catalog/SearchBar.js';
import { MangaCard } from '../components/catalog/MangaCard.js';
import { CatalogFilters } from '../components/catalog/CatalogFilters.js';
import { localClientStorage } from '../services/local-storage-service.js';
import { BookOpen } from 'lucide-react';

export interface CatalogPageProps {
  selectedCategory?: string;
  isBookmarksView?: boolean;
  onSelectSeries: (slug: string) => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({
  selectedCategory,
  isBookmarksView,
  onSelectSeries,
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Pill filter states
  const [selectedType, setSelectedType] = useState<string>(
    selectedCategory ? selectedCategory.toLowerCase() : 'all'
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  useEffect(() => {
    if (selectedCategory) {
      setSelectedType(selectedCategory.toLowerCase());
    }
  }, [selectedCategory]);

  useEffect(() => {
    async function loadSeries() {
      setLoading(true);
      try {
        let url = '/api/v1/series';
        const params = new URLSearchParams();

        if (searchQuery.trim()) {
          params.append('q', searchQuery.trim());
        }

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          let seriesList = data.items || [];

          if (isBookmarksView) {
            const savedSlugs = await localClientStorage.getBookmarks();
            seriesList = seriesList.filter((s: any) => savedSlugs.includes(s.slug));
          }

          setItems(seriesList);
        }
      } catch (e) {
        console.error('Failed to load series catalog:', e);
      } finally {
        setLoading(false);
      }
    }

    loadSeries();
  }, [searchQuery, isBookmarksView]);

  const handleResetFilters = () => {
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedGenre('all');
  };

  // Client-side filtering across Type, Status, and Genres
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Type matching
      if (selectedType !== 'all') {
        if ((item.type || '').toLowerCase() !== selectedType.toLowerCase()) {
          return false;
        }
      }

      // Status matching
      if (selectedStatus !== 'all') {
        if ((item.status || '').toLowerCase() !== selectedStatus.toLowerCase()) {
          return false;
        }
      }

      // Genre matching
      if (selectedGenre !== 'all') {
        const target = selectedGenre.toLowerCase();

        // 1. Check genres array
        if (Array.isArray(item.genres)) {
          const found = item.genres.some((g: any) => {
            const name = (typeof g === 'string' ? g : g?.name || '').toLowerCase();
            return name.includes(target) || target.includes(name);
          });
          if (found) return true;
        }

        // 2. Check single genre string
        if (item.genre && typeof item.genre === 'string' && item.genre.toLowerCase().includes(target)) {
          return true;
        }

        // 3. Check demographic (e.g. Shonen vs shounen)
        if (target.includes('shonen') && item.demographic && item.demographic.toLowerCase().includes('shou')) {
          return true;
        }

        // 4. Check synopsis fallback
        if (item.synopsis && typeof item.synopsis === 'string' && item.synopsis.toLowerCase().includes(target)) {
          return true;
        }

        // 5. Check tags array
        if (Array.isArray(item.tags)) {
          if (item.tags.some((t: any) => String(t).toLowerCase().includes(target))) {
            return true;
          }
        }

        return false;
      }

      return true;
    });
  }, [items, selectedType, selectedStatus, selectedGenre]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-300 to-violet-500 tracking-tight">
          {isBookmarksView
            ? 'Tus Mangas & Manhwas Guardados'
            : selectedCategory
            ? `Biblioteca de ${selectedCategory.toUpperCase()}`
            : 'Explorar Manga, Manhwa & Manhua'}
        </h1>
        <p className="text-gray-400 text-sm md:text-base mt-2 max-w-xl mx-auto">
          {isBookmarksView
            ? 'Lectura local optimizada almacenada en tu navegador.'
            : 'Servidor local KuraScroll con compresión WebP y 4TB de almacenamiento.'}
        </p>
      </div>

      {/* Multilingual Search Bar */}
      {!isBookmarksView && <SearchBar onSearch={setSearchQuery} />}

      {/* Pill Filter Bar (Tipo, Estado, Géneros) */}
      <CatalogFilters
        selectedType={selectedType}
        onSelectType={setSelectedType}
        selectedStatus={selectedStatus}
        onSelectStatus={setSelectedStatus}
        selectedGenre={selectedGenre}
        onSelectGenre={setSelectedGenre}
        filteredCount={filteredItems.length}
        totalCount={items.length}
        onResetFilters={handleResetFilters}
      />

      {/* Grid of Manga Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
          <p className="text-sm text-gray-400">Cargando biblioteca...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 bg-gray-900/40 rounded-3xl border border-gray-800/80 p-8 max-w-lg mx-auto">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-300">No se encontraron series</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {searchQuery
              ? `No hay coincidencias para "${searchQuery}". Prueba con el título en Romaji o Kanji.`
              : items.length > 0
              ? 'No hay series que coincidan con los filtros seleccionados.'
              : 'Usa el comando CLI para importar tu primer capítulo a la biblioteca.'}
          </p>
          {(selectedType !== 'all' || selectedStatus !== 'all' || selectedGenre !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-cyan-400 text-xs font-semibold transition-colors"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {filteredItems.map((item) => (
            <MangaCard
              key={item.id}
              id={item.id}
              slug={item.slug}
              titlePrimary={item.titlePrimary || item.title_primary}
              type={item.type}
              status={item.status}
              coverImage={item.coverImage || item.cover_image}
              onClick={onSelectSeries}
            />
          ))}
        </div>
      )}
    </div>
  );
};
