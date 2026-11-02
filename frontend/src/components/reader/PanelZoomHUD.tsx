/**
 * KuraScroll Sprint 55: Floating Panel Zoom & Speech Bubble Inspector HUD
 * Zero CSS blur, zero backdrop-filter for Intel GMA 4500MHD (CLS = 0)
 */

import React from 'react';
import { PanelBox } from '../../reader/usePanelNavigation';

export interface PanelZoomHUDProps {
  isZoomed: boolean;
  activePanelIndex: number;
  totalPanels: number;
  activePanel: PanelBox | null;
  onToggleZoom: () => void;
  onNextPanel: () => void;
  onPrevPanel: () => void;
  onResetZoom: () => void;
  readingDirection?: 'RTL' | 'LTR' | 'VERTICAL_SCROLL';
}

export const PanelZoomHUD: React.FC<PanelZoomHUDProps> = ({
  isZoomed,
  activePanelIndex,
  totalPanels,
  activePanel,
  onToggleZoom,
  onNextPanel,
  onPrevPanel,
  onResetZoom,
  readingDirection = 'RTL'
}) => {
  if (totalPanels <= 0) return null;

  return (
    <div
      data-testid="panel-zoom-hud"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        backgroundColor: '#0a0f18',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#f8fafc',
        fontSize: '13px',
        fontFamily: 'monospace',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.7)',
        contain: 'layout paint'
      }}
    >
      <button
        data-testid="toggle-zoom-btn"
        onClick={onToggleZoom}
        style={{
          backgroundColor: isZoomed ? '#00e5ff' : '#1e293b',
          color: isZoomed ? '#000000' : '#f8fafc',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 10px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background-color 0.15s ease'
        }}
        title="Alternar Zoom de Viñeta (Z)"
      >
        {isZoomed ? '🔍 Viñeta Enfocada' : '🔍 Modo Viñetas'}
      </button>

      {isZoomed && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              data-testid="prev-panel-btn"
              onClick={onPrevPanel}
              disabled={activePanelIndex === 0}
              style={{
                backgroundColor: activePanelIndex === 0 ? '#111827' : '#1e293b',
                color: activePanelIndex === 0 ? '#4b5563' : '#f8fafc',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: activePanelIndex === 0 ? 'not-allowed' : 'pointer'
              }}
              title="Viñeta previa (P o Flecha Izquierda)"
            >
              ◀
            </button>

            <span data-testid="panel-counter" style={{ minWidth: '70px', textAlign: 'center' }}>
              {activePanelIndex + 1} / {totalPanels}
            </span>

            <button
              data-testid="next-panel-btn"
              onClick={onNextPanel}
              disabled={activePanelIndex === totalPanels - 1}
              style={{
                backgroundColor: activePanelIndex === totalPanels - 1 ? '#111827' : '#1e293b',
                color: activePanelIndex === totalPanels - 1 ? '#4b5563' : '#f8fafc',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: activePanelIndex === totalPanels - 1 ? 'not-allowed' : 'pointer'
              }}
              title="Siguiente viñeta (N o Flecha Derecha)"
            >
              ▶
            </button>
          </div>

          <span
            data-testid="direction-badge"
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              backgroundColor: '#1e1b4b',
              color: '#818cf8',
              borderRadius: '4px'
            }}
          >
            {readingDirection}
          </span>

          <button
            data-testid="reset-zoom-btn"
            onClick={onResetZoom}
            style={{
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: '12px'
            }}
            title="Salir del zoom (Esc)"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
};
