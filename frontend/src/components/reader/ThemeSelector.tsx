import React, { useState, useEffect } from 'react';
import { Sun, Moon, Eye, Sparkles } from 'lucide-react';

export type ReaderTheme = 'oled' | 'sepia' | 'carbon' | 'midnight';

export interface ThemeOption {
  id: ReaderTheme;
  name: string;
  description: string;
  bgHex: string;
  textHex: string;
  icon: React.ReactNode;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'carbon',
    name: 'Carbon',
    description: 'Modo oscuro balanceado para el día a día',
    bgHex: '#18181A',
    textHex: '#E4E4E7',
    icon: <Moon className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'oled',
    name: 'OLED Negro',
    description: 'Negro absoluto (#000000) de máximo ahorro de batería',
    bgHex: '#000000',
    textHex: '#E5E7EB',
    icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'sepia',
    name: 'Sepia Cálido',
    description: 'Tono papel antiguo sin luz azul para lectura nocturna',
    bgHex: '#F4ECD8',
    textHex: '#3D3028',
    icon: <Eye className="w-4 h-4 text-amber-600" />,
  },
  {
    id: 'midnight',
    name: 'Medianoche',
    description: 'Azul pizarra profundo (#0F172A) de bajo deslumbramiento',
    bgHex: '#0F172A',
    textHex: '#CBD5E1',
    icon: <Sun className="w-4 h-4 text-sky-400" />,
  },
];

export interface ThemeSelectorProps {
  currentTheme?: ReaderTheme;
  onThemeChange?: (theme: ReaderTheme) => void;
  userId?: string;
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme = 'carbon',
  onThemeChange,
  userId = 'default-user',
  className = '',
}) => {
  const [selectedTheme, setSelectedTheme] = useState<ReaderTheme>(currentTheme);

  // Sync preference with backend Fastify API
  const applyTheme = (theme: ReaderTheme) => {
    setSelectedTheme(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-reader-theme', theme);
    }
    if (onThemeChange) {
      onThemeChange(theme);
    }

    // Fire-and-forget sync to backend
    fetch('/api/v1/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, readerTheme: theme }),
    }).catch(() => {
      // Offline fallback
    });
  };

  useEffect(() => {
    if (currentTheme) {
      setSelectedTheme(currentTheme);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-reader-theme', currentTheme);
      }
    }
  }, [currentTheme]);

  return (
    <div
      className={`p-4 bg-gray-950 border border-gray-800 rounded-xl ${className}`}
      data-testid="theme-selector"
      role="radiogroup"
      aria-label="Selector de temas ambientales de lectura"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-indigo-400" />
          Paleta Ambiental (0 CLS)
        </h4>
        <span className="text-[11px] text-gray-500">Sin luz azul / Ahorro GPU</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {THEME_OPTIONS.map((theme) => {
          const isSelected = selectedTheme === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => applyTheme(theme.id)}
              role="radio"
              aria-checked={isSelected}
              data-testid={`theme-option-${theme.id}`}
              className={`p-3 rounded-lg border text-left transition-all duration-150 flex flex-col justify-between ${
                isSelected
                  ? 'border-indigo-500 bg-gray-900 ring-1 ring-indigo-500/40'
                  : 'border-gray-800/80 bg-gray-900/40 hover:border-gray-700 hover:bg-gray-900/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="w-4 h-4 rounded-full border border-gray-700 shadow-sm"
                  style={{ backgroundColor: theme.bgHex }}
                  aria-hidden="true"
                />
                {theme.icon}
              </div>
              <span className="text-xs font-semibold text-gray-200 line-clamp-1">
                {theme.name}
              </span>
              <span className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                {theme.id === 'oled'
                  ? '0% emisión'
                  : theme.id === 'sepia'
                  ? 'Anti-fatiga'
                  : theme.id === 'carbon'
                  ? 'Equilibrado'
                  : 'Bajo reflejo'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
