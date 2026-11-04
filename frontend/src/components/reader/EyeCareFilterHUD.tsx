import React, { useEffect } from 'react';

export type EyeCareFilterMode =
  | 'default'
  | 'sepia_warm'
  | 'oled_dark'
  | 'smart_invert'
  | 'e_ink_high_contrast';

export interface EyeCareFilterHUDProps {
  currentMode: EyeCareFilterMode;
  brightnessPct: number;
  contrastPct: number;
  blueLightPct: number;
  isMonochromePage?: boolean;
  onSelectMode: (mode: EyeCareFilterMode) => void;
  onChangeBrightness: (val: number) => void;
  onChangeContrast: (val: number) => void;
  onChangeBlueLight: (val: number) => void;
  onReset: () => void;
}

export const PRESET_OPTIONS: Array<{
  id: EyeCareFilterMode;
  label: string;
  icon: string;
  desc: string;
}> = [
  { id: 'default', label: 'Normal', icon: 'NORM', desc: 'Fidelidad original sin alteraciones' },
  { id: 'sepia_warm', label: 'Sepia Cálido', icon: 'WARM', desc: 'Atenuación de luz azul para noche' },
  { id: 'oled_dark', label: 'OLED Puro', icon: 'OLED', desc: 'Fondo negro profundo de alto contraste' },
  { id: 'smart_invert', label: 'Smart Invert', icon: 'INV', desc: 'Inversión respetando portadas a color' },
  { id: 'e_ink_high_contrast', label: 'E-Ink Papel', icon: 'E-INK', desc: 'Textura mate monocromática para lectura' },
];

export const EyeCareFilterHUD: React.FC<EyeCareFilterHUDProps> = ({
  currentMode,
  brightnessPct,
  contrastPct,
  blueLightPct,
  isMonochromePage = true,
  onSelectMode,
  onChangeBrightness,
  onChangeContrast,
  onChangeBlueLight,
  onReset,
}) => {
  // Global shortcut 'I' to cycle filter modes quickly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;

      if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        const ids = PRESET_OPTIONS.map((p) => p.id);
        const nextIdx = (ids.indexOf(currentMode) + 1) % ids.length;
        onSelectMode(ids[nextIdx]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMode, onSelectMode]);

  return (
    <aside
      data-testid="eye-care-hud"
      role="region"
      aria-label="Filtros de Cuidado Visual y Pantalla"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '16px',
        fontSize: '12px',
        color: '#e4e4e7',
        contain: 'layout paint',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
        userSelect: 'none',
        maxWidth: '360px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="text-xs font-mono text-cyan-400">EYE</span>
          <span style={{ fontWeight: 600, color: '#f4f4f5' }}>Cuidado Visual (OLED / E-Ink)</span>
        </div>
        <button
          data-testid="reset-filters-btn"
          onClick={onReset}
          title="Restablecer ajustes a valores estándar"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#a1a1aa',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          Restablecer
        </button>
      </div>

      {/* Preset Pills */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
        }}
      >
        {PRESET_OPTIONS.map((preset) => {
          const isActive = currentMode === preset.id;
          return (
            <button
              key={preset.id}
              data-testid={`filter-btn-${preset.id}`}
              onClick={() => onSelectMode(preset.id)}
              title={preset.desc}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                padding: '6px 4px',
                borderRadius: '8px',
                border: isActive ? '1px solid #6366f1' : '1px solid #27272a',
                backgroundColor: isActive ? '#312e81' : '#27272a',
                color: isActive ? '#ffffff' : '#a1a1aa',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
            >
              <span style={{ fontSize: '13px' }}>{preset.icon}</span>
              <span style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400, textAlign: 'center' }}>
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Smart Invert Status Indicator */}
      {currentMode === 'smart_invert' && (
        <div
          data-testid="smart-invert-badge"
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: isMonochromePage ? '#064e3b' : '#78350f',
            color: isMonochromePage ? '#34d399' : '#fcd34d',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>{isMonochromePage ? '[OK]' : '[INFO]'}</span>
          <span>
            {isMonochromePage
              ? 'Página monocromo: Inversión OLED activa'
              : 'Página a color detectada: Fidelidad cromática preservada'}
          </span>
        </div>
      )}

      {/* Sliders Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
        {/* Brightness */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ width: '80px', color: '#a1a1aa' }}>Brillo: {brightnessPct}%</span>
          <input
            data-testid="slider-brightness"
            type="range"
            min="20"
            max="180"
            step="5"
            value={brightnessPct}
            onChange={(e) => onChangeBrightness(Number(e.target.value))}
            aria-label="Ajuste de Brillo"
            style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
          />
        </div>

        {/* Contrast */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ width: '80px', color: '#a1a1aa' }}>Contraste: {contrastPct}%</span>
          <input
            data-testid="slider-contrast"
            type="range"
            min="60"
            max="200"
            step="5"
            value={contrastPct}
            onChange={(e) => onChangeContrast(Number(e.target.value))}
            aria-label="Ajuste de Contraste"
            style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
          />
        </div>

        {/* Blue Light */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ width: '80px', color: '#a1a1aa' }}>Filtro Azul: {blueLightPct}%</span>
          <input
            data-testid="slider-blue-light"
            type="range"
            min="0"
            max="100"
            step="5"
            value={blueLightPct}
            onChange={(e) => onChangeBlueLight(Number(e.target.value))}
            aria-label="Reducción de Luz Azul"
            style={{ flex: 1, accentColor: '#f59e0b', cursor: 'pointer' }}
          />
        </div>
      </div>
    </aside>
  );
};
