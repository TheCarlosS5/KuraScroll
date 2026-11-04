/**
 * KuraScroll Intelligent Chapter Transition Curtain & HUD
 * Sprint 79 - Zero-Latency Chapter Flip & Continuous Visual Curtain
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { TransitionStyle, NextChapterInfo } from '../../reader/useChapterTransition';

export interface ChapterTransitionCurtainProps {
  // Curtain State
  isCurtainVisible: boolean;
  nextChapter: NextChapterInfo | null;
  autoAdvanceProgress: number;
  onAdvanceImmediately: () => void;
  onDismissCurtain: () => void;

  // Settings HUD State
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  transitionStyle: TransitionStyle;
  prebakeTriggerPageOffset: number;
  autoAdvanceDelayMs: number;
  showReadingSummary: boolean;
  onToggleEnabled: () => void;
  onChangeStyle: (style: TransitionStyle) => void;
  onChangeOffset: (offset: number) => void;
  onChangeDelayMs: (delay: number) => void;
  onToggleShowSummary: () => void;
  onResetToDefaults: () => void;
}

const STYLES: { id: TransitionStyle; label: string; desc: string }[] = [
  { id: 'curtain', label: 'Cortina', desc: 'Pausa elegante con resumen y avance automático' },
  { id: 'infinite_scroll', label: 'Scroll Infinito', desc: 'Conexión vertical sin cortes para webtoons' },
  { id: 'page_turn', label: 'Paso Clásico', desc: 'Pase instantáneo al estilo tomo Tankōbon' },
];

export const ChapterTransitionCurtain: React.FC<ChapterTransitionCurtainProps> = ({
  isCurtainVisible,
  nextChapter,
  autoAdvanceProgress,
  onAdvanceImmediately,
  onDismissCurtain,
  isOpen,
  onClose,
  isEnabled,
  transitionStyle,
  prebakeTriggerPageOffset,
  autoAdvanceDelayMs,
  showReadingSummary,
  onToggleEnabled,
  onChangeStyle,
  onChangeOffset,
  onChangeDelayMs,
  onToggleShowSummary,
  onResetToDefaults,
}) => {
  // ESC listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Render Full Visual Curtain at Chapter Boundary
  if (isCurtainVisible) {
    const isLast = !nextChapter;

    return (
      <div
        role="dialog"
        aria-label="Cortina de Transición de Capítulo"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#18181b',
          color: '#f4f4f5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            width: '100%',
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '12px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          }}
        >
          {isLast ? (
            <>
              <div className="text-indigo-400 font-bold text-sm tracking-wider uppercase mb-3">CAPÍTULO COMPLETADO</div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>
                ¡Capítulo Final Alcanzado!
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                Has completado todos los capítulos disponibles de esta serie.
              </p>
              <button
                onClick={onDismissCurtain}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Volver a la Biblioteca
              </button>
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#60a5fa',
                  marginBottom: '6px',
                }}
              >
                Siguiente Capítulo
              </div>
              <h2
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  margin: '0 0 6px 0',
                  color: '#ffffff',
                }}
              >
                Capítulo {nextChapter?.chapterNumber}: {nextChapter?.title}
              </h2>

              {showReadingSummary && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#a1a1aa',
                    backgroundColor: '#18181b',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <span className="text-zinc-500 font-mono text-xs">TIEMPO:</span>
                  <span>~{nextChapter?.estimatedReadMinutes ?? 3} min de lectura estimada</span>
                </div>
              )}

              {/* Countdown Progress Bar */}
              {autoAdvanceDelayMs > 0 && (
                <div
                  style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#18181b',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginBottom: '20px',
                  }}
                >
                  <div
                    style={{
                      width: `${autoAdvanceProgress}%`,
                      height: '100%',
                      backgroundColor: '#3b82f6',
                      transition: 'width 0.05s linear',
                    }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={onAdvanceImmediately}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Continuar Lectura [Espacio]
                </button>
                <button
                  onClick={onDismissCurtain}
                  style={{
                    backgroundColor: '#18181b',
                    color: '#a1a1aa',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Pausa
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render Configuration HUD Dialog
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Configuración de Transición de Capítulos"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '380px',
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        color: '#f4f4f5',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 9999,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Transición de Capítulos
          </span>
          <span
            style={{
              fontSize: '11px',
              backgroundColor: '#27272a',
              color: '#a1a1aa',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            [C]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de transición"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '4px',
          }}
        >&times;</button>
      </div>

      {/* Main Switch */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#27272a',
          padding: '8px 12px',
          borderRadius: '6px',
          marginBottom: '14px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Pre-Carga Activa</span>
        <button
          onClick={onToggleEnabled}
          aria-pressed={isEnabled}
          style={{
            backgroundColor: isEnabled ? '#22c55e' : '#3f3f46',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
        </button>
      </div>

      {/* Styles Grid */}
      <div style={{ marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: '#a1a1aa',
            marginBottom: '6px',
          }}
        >
          Estilo de Transición
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {STYLES.map((st) => {
            const isSelected = transitionStyle === st.id;
            return (
              <button
                key={st.id}
                onClick={() => onChangeStyle(st.id)}
                style={{
                  backgroundColor: isSelected ? '#3b82f6' : '#27272a',
                  color: isSelected ? '#ffffff' : '#d4d4d8',
                  border: isSelected ? '1px solid #60a5fa' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>{st.label}</div>
                  <div style={{ fontSize: '10px', color: isSelected ? '#e0f2fe' : '#a1a1aa' }}>
                    {st.desc}
                  </div>
                </div>
                {isSelected && <span className="text-emerald-400 font-bold text-xs">[OK]</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Trigger Page Offset Slider */}
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            marginBottom: '4px',
          }}
        >
          <span style={{ color: '#d4d4d8' }}>Disparo de Pre-Carga</span>
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>{prebakeTriggerPageOffset} págs antes</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={prebakeTriggerPageOffset}
          aria-label="Disparo de Pre-Carga"
          onChange={(e) => onChangeOffset(parseInt(e.target.value, 10))}
          style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
        />
      </div>

      {/* Auto Advance Delay Slider */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            marginBottom: '4px',
          }}
        >
          <span style={{ color: '#d4d4d8' }}>Espera de Avance Automático</span>
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>
            {autoAdvanceDelayMs === 0 ? 'Inmediato (0s)' : `${(autoAdvanceDelayMs / 1000).toFixed(1)}s`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={5000}
          step={500}
          value={autoAdvanceDelayMs}
          aria-label="Espera de Avance Automático"
          onChange={(e) => onChangeDelayMs(parseInt(e.target.value, 10))}
          style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
        />
      </div>

      {/* Summary Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <span style={{ fontSize: '12px', color: '#d4d4d8' }}>Mostrar Resumen de Lectura</span>
        <input
          type="checkbox"
          checked={showReadingSummary}
          aria-label="Mostrar Resumen de Lectura"
          onChange={onToggleShowSummary}
          style={{ width: '16px', height: '16px', accentColor: '#3b82f6', cursor: 'pointer' }}
        />
      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={onResetToDefaults}
          style={{
            backgroundColor: '#27272a',
            color: '#d4d4d8',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Restaurar Predeterminado
        </button>
      </div>
    </div>
  );
};
