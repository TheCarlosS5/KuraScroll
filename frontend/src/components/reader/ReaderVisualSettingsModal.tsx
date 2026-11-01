import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  Sun,
  Contrast,
  Sliders,
  Sparkles,
  LayoutList,
  RotateCcw,
  X,
  Eye,
  Check,
} from 'lucide-react';

export interface ReaderDisplaySettings {
  brightness: number; // 50 to 150, default 100 (%)
  contrast: number; // 50 to 150, default 100 (%)
  sepia: number; // 0 to 100, default 0 (%)
  invert: boolean; // default false
  grayscale: boolean; // default false
  webtoonMaxWidth: '700px' | '900px' | '1100px' | '100%'; // default '900px'
  webtoonGap: '0px' | '8px' | '16px' | '24px'; // default '0px'
  ambilightEnabled: boolean; // default true
  ambilightIntensity: number; // 20 to 100, default 100 (%)
}

export const STORAGE_KEY = 'kura_reader_display_settings';

export const DEFAULT_DISPLAY_SETTINGS: ReaderDisplaySettings = {
  brightness: 100,
  contrast: 100,
  sepia: 0,
  invert: false,
  grayscale: false,
  webtoonMaxWidth: '900px',
  webtoonGap: '0px',
  ambilightEnabled: true,
  ambilightIntensity: 100,
};

export function loadReaderDisplaySettings(): ReaderDisplaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_DISPLAY_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Fallback on restricted storage frames
  }
  return DEFAULT_DISPLAY_SETTINGS;
}

export function saveReaderDisplaySettings(settings: ReaderDisplaySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // LocalStorage quota or access error
  }
}

export function buildImageFilter(settings?: ReaderDisplaySettings): string {
  if (!settings) return 'none';
  const filters: string[] = [];

  if (settings.brightness !== 100) {
    filters.push(`brightness(${settings.brightness}%)`);
  }
  if (settings.contrast !== 100) {
    filters.push(`contrast(${settings.contrast}%)`);
  }
  if (settings.sepia > 0) {
    filters.push(`sepia(${settings.sepia}%)`);
  }
  if (settings.grayscale) {
    filters.push('grayscale(100%)');
  }
  if (settings.invert) {
    filters.push('invert(100%)');
  }

  return filters.length > 0 ? filters.join(' ') : 'none';
}

export interface ReaderVisualSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderDisplaySettings;
  onChangeSettings: (settings: ReaderDisplaySettings) => void;
  readerMode?: 'webtoon' | 'manga-rtl' | 'manga-ltr';
}

export const ReaderVisualSettingsModal: React.FC<ReaderVisualSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
  readerMode = 'manga-rtl',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.94, y: 15 },
        { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'power3.out' }
      );
    }
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && (e.key === 'Escape' || e.key === 'Esc')) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const updateField = <K extends keyof ReaderDisplaySettings>(
    field: K,
    value: ReaderDisplaySettings[K]
  ) => {
    const next = { ...settings, [field]: value };
    onChangeSettings(next);
    saveReaderDisplaySettings(next);
  };

  const handleReset = () => {
    onChangeSettings(DEFAULT_DISPLAY_SETTINGS);
    saveReaderDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
  };

  const isWebtoon = readerMode === 'webtoon';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes visuales del lector"
      data-testid="reader-visual-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity select-none"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0f172a]/95 border border-white/10 rounded-3xl p-6 shadow-2xl text-white transform-gpu relative max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">Ajustes Visuales & Ambilight</h3>
              <p className="text-xs text-slate-400">Ergonomía, filtros de imagen y atmósfera</p>
            </div>
          </div>
          <button
            data-testid="close-visual-settings-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            aria-label="Cerrar ajustes visuales"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Section 1: Image Filters (Brightness & Contrast) */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" />
              <span>Filtros de Imagen</span>
            </h4>

            {/* Brightness Slider */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span className="font-medium">Brillo de Página</span>
                <span className="font-mono text-cyan-400 font-bold">{settings.brightness}%</span>
              </div>
              <input
                data-testid="brightness-slider"
                type="range"
                min="50"
                max="150"
                step="5"
                value={settings.brightness}
                onChange={(e) => updateField('brightness', parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                aria-label="Brillo"
              />
            </div>

            {/* Contrast Slider */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span className="font-medium">Contraste</span>
                <span className="font-mono text-cyan-400 font-bold">{settings.contrast}%</span>
              </div>
              <input
                data-testid="contrast-slider"
                type="range"
                min="50"
                max="150"
                step="5"
                value={settings.contrast}
                onChange={(e) => updateField('contrast', parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                aria-label="Contraste"
              />
            </div>

            {/* Sepia Slider & Warm Toggle */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <span className="font-medium">Tono Sepia (Lectura Cálida)</span>
                <div className="flex items-center gap-2">
                  <button
                    data-testid="toggle-sepia-preset"
                    onClick={() => updateField('sepia', settings.sepia > 0 ? 0 : 50)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                      settings.sepia > 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-gray-800/80 text-gray-400 border-gray-700 hover:text-white'
                    }`}
                  >
                    {settings.sepia > 0 ? 'Cálido Activo' : 'Activar Cálido'}
                  </button>
                  <span className="font-mono text-amber-400 font-bold">{settings.sepia}%</span>
                </div>
              </div>
              <input
                data-testid="sepia-slider"
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.sepia}
                onChange={(e) => updateField('sepia', parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                aria-label="Tono sepia"
              />
            </div>

            {/* Invert & Grayscale Toggles */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                data-testid="toggle-grayscale-btn"
                onClick={() => updateField('grayscale', !settings.grayscale)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  settings.grayscale
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-gray-900/80 text-gray-400 border-gray-800 hover:text-white'
                }`}
                aria-pressed={settings.grayscale}
              >
                <span>Escala de Grises</span>
                {settings.grayscale && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>

              <button
                data-testid="toggle-invert-btn"
                onClick={() => updateField('invert', !settings.invert)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                  settings.invert
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-gray-900/80 text-gray-400 border-gray-800 hover:text-white'
                }`}
                aria-pressed={settings.invert}
              >
                <span>Invertir (Modo OLED)</span>
                {settings.invert && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
            </div>
          </div>

          {/* Section 2: Ambilight Atmospheric Depth */}
          <div className="space-y-3 pt-3 border-t border-gray-800/80">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Atmósfera Ambilight</span>
              </h4>
              <button
                data-testid="toggle-ambilight-btn"
                onClick={() => updateField('ambilightEnabled', !settings.ambilightEnabled)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  settings.ambilightEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-gray-800/60 text-gray-400 border-gray-700'
                }`}
                aria-pressed={settings.ambilightEnabled}
              >
                {settings.ambilightEnabled ? 'Activado' : 'Desactivado'}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Halo dinámico de luz ambiental suave detrás de la página que refleja la paleta y tono del cómic.
            </p>

            {settings.ambilightEnabled && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                  <span className="font-medium">Intensidad del Halo</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {settings.ambilightIntensity}%
                  </span>
                </div>
                <input
                  data-testid="ambilight-intensity-slider"
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={settings.ambilightIntensity}
                  onChange={(e) => updateField('ambilightIntensity', parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  aria-label="Intensidad Ambilight"
                />
              </div>
            )}
          </div>

          {/* Section 3: Webtoon Format Adjustments */}
          <div className="space-y-3 pt-3 border-t border-gray-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <LayoutList className="w-3.5 h-3.5" />
              <span>Ajustes de Formato Webtoon</span>
            </h4>

            {/* Max Width Selector */}
            <div>
              <span className="text-xs font-medium text-slate-300 block mb-1.5">
                Ancho Máximo de Columna
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {(['700px', '900px', '1100px', '100%'] as const).map((w) => (
                  <button
                    key={w}
                    data-testid={`webtoon-width-${w}`}
                    onClick={() => updateField('webtoonMaxWidth', w)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                      settings.webtoonMaxWidth === w
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                        : 'bg-gray-900/80 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-800/60'
                    }`}
                  >
                    {w === '100%' ? 'Completo' : w}
                  </button>
                ))}
              </div>
            </div>

            {/* Page Separation / Gap Selector */}
            <div>
              <span className="text-xs font-medium text-slate-300 block mb-1.5">
                Separación entre Paneles (Gap)
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {(['0px', '8px', '16px', '24px'] as const).map((g) => (
                  <button
                    key={g}
                    data-testid={`webtoon-gap-${g}`}
                    onClick={() => updateField('webtoonGap', g)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-all ${
                      settings.webtoonGap === g
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                        : 'bg-gray-900/80 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-800/60'
                    }`}
                  >
                    {g === '0px' ? '0 (Sin corte)' : g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between">
          <button
            data-testid="reset-visual-settings-btn"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
