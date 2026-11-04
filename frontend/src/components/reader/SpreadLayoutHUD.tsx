import React, { useEffect } from 'react';

export type SpreadViewMode =
  | 'auto_split'
  | 'force_single'
  | 'dual_spread'
  | 'webtoon_stitch';

export interface SpreadLayoutHUDProps {
  currentMode: SpreadViewMode;
  readingDirection: 'rtl' | 'ltr';
  seamBleedPx: number; // 0.0 to 3.0
  isSpreadCandidate?: boolean;
  onSelectMode: (mode: SpreadViewMode) => void;
  onToggleReadingDirection: () => void;
  onChangeSeamBleed: (px: number) => void;
  onClose?: () => void;
}

export const SPREAD_OPTIONS: Array<{
  id: SpreadViewMode;
  label: string;
  icon: string;
  desc: string;
}> = [
  { id: 'auto_split', label: 'Auto-Split', icon: 'CUT', desc: 'Divide dobles páginas anchas automáticamente' },
  { id: 'force_single', label: 'Página Simple', icon: 'PAGE', desc: 'Muestra cada archivo íntegro sin división' },
  { id: 'dual_spread', label: 'Doble Página', icon: 'SPREAD', desc: 'Lado a lado estilo tomo Tankōbon abierto' },
  { id: 'webtoon_stitch', label: 'Webtoon Stitch', icon: 'STITCH', desc: 'Tira continua vertical con eliminación de fisuras' },
];

export const SpreadLayoutHUD: React.FC<SpreadLayoutHUDProps> = ({
  currentMode,
  readingDirection,
  seamBleedPx,
  isSpreadCandidate = false,
  onSelectMode,
  onToggleReadingDirection,
  onChangeSeamBleed,
  onClose,
}) => {
  // Global shortcut 'S' to cycle spread modes quickly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;

      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        const modes = SPREAD_OPTIONS.map((m) => m.id);
        const nextIdx = (modes.indexOf(currentMode) + 1) % modes.length;
        onSelectMode(modes[nextIdx]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMode, onSelectMode]);

  return (
    <aside
      data-testid="spread-layout-hud"
      role="region"
      aria-label="Control de Distribución de Páginas y Unión Webtoon"
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
        maxWidth: '380px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          
          <span style={{ fontWeight: 600, color: '#f4f4f5' }}>Geometría & Spreads (S)</span>
        </div>
        <button
          data-testid="direction-toggle-btn"
          onClick={onToggleReadingDirection}
          title="Alternar sentido de lectura (Japón RTL vs Manhwa LTR)"
          style={{
            background: '#27272a',
            border: '1px solid #3f3f46',
            color: '#a1a1aa',
            fontSize: '11px',
            cursor: 'pointer',
            padding: '3px 8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>{readingDirection === 'rtl' ? 'Manga (RTL)' : 'Manhwa (LTR)'}</span>
        </button>
      </div>

      {/* Mode Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
        }}
      >
        {SPREAD_OPTIONS.map((opt) => {
          const isActive = currentMode === opt.id;
          return (
            <button
              key={opt.id}
              data-testid={`spread-mode-${opt.id}`}
              onClick={() => onSelectMode(opt.id)}
              title={opt.desc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: isActive ? '1px solid #6366f1' : '1px solid #27272a',
                backgroundColor: isActive ? '#312e81' : '#27272a',
                color: isActive ? '#ffffff' : '#a1a1aa',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '14px' }}>{opt.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500 }}>{opt.label}</span>
                <span style={{ fontSize: '9px', color: isActive ? '#c7d2fe' : '#71717a' }}>
                  {opt.id === 'auto_split' ? 'Recomendado' : opt.id === 'webtoon_stitch' ? '0px Fisuras' : 'Manual'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Spread Candidate Indicator */}
      {isSpreadCandidate && (
        <div
          data-testid="spread-candidate-pill"
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            borderRadius: '6px',
            backgroundColor: '#064e3b',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span className="text-emerald-400 font-bold">[OK]</span>
          <span>Doble página detectada (Aspect ratio &gt; 1.25) — Dividida virtualmente</span>
        </div>
      )}

      {/* Webtoon Seam Bleed Slider (visible in webtoon_stitch or auto) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '6px 8px',
          backgroundColor: '#202023',
          borderRadius: '8px',
          border: '1px solid #2e2e33',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#a1a1aa', fontSize: '11px' }}>
            Compensación Subpíxel Webtoon (Seam Bleed):
          </span>
          <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '11px' }}>
            {seamBleedPx.toFixed(2)}px
          </span>
        </div>
        <input
          data-testid="slider-seam-bleed"
          type="range"
          min="0.0"
          max="2.0"
          step="0.25"
          value={seamBleedPx}
          onChange={(e) => onChangeSeamBleed(Number(e.target.value))}
          aria-label="Compensación de fisuras subpíxel"
          style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '9px', color: '#71717a' }}>
          Solapamiento visual puro: 0 CLS, no acumula márgenes negativos en el scroll.
        </span>
      </div>
    </aside>
  );
};
