/**
 * KuraScroll Dynamic Dialogue Text-to-Speech HUD
 * Sprint 75 - Client-Side Multi-Voice Speech Synthesis & Queue Dispatch
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { VoiceRole } from '../../reader/useDialogueTTS';

export interface DialogueTtsHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  isPaused: boolean;
  currentIndex: number;
  totalBubbles: number;
  currentBubbleText?: string;
  currentSpeaker?: string;
  currentRole?: VoiceRole;
  masterRate: number;
  autoAdvance: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onChangeMasterRate: (rate: number) => void;
  onToggleAutoAdvance: () => void;
}

const ROLE_LABELS: Record<VoiceRole, { label: string; bg: string }> = {
  narrator: { label: 'Narrador', bg: '#3f3f46' },
  male_hero: { label: 'Héroe', bg: '#2563eb' },
  female_hero: { label: 'Heroína', bg: '#db2777' },
  child_creature: { label: 'Criatura', bg: '#16a34a' },
  villain: { label: 'Antagonista', bg: '#7c3aed' },
  elder: { label: 'Sabio', bg: '#d97706' },
};

export const DialogueTtsHUD: React.FC<DialogueTtsHUDProps> = ({
  isOpen,
  onClose,
  isPlaying,
  isPaused,
  currentIndex,
  totalBubbles,
  currentBubbleText = '',
  currentSpeaker = 'Narrador',
  currentRole = 'narrator',
  masterRate,
  autoAdvance,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipNext,
  onSkipPrevious,
  onChangeMasterRate,
  onToggleAutoAdvance,
}) => {
  // ESC and 'T' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 't') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const roleInfo = ROLE_LABELS[currentRole] ?? ROLE_LABELS.narrator;

  return (
    <div
      role="dialog"
      aria-label="Controles de Sintetizador TTS"
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
          <span style={{ fontSize: '18px' }}>🎙️</span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Voz Dinámica &amp; TTS
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
            [T]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel TTS"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Current Bubble Status Card */}
      <div
        style={{
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                backgroundColor: roleInfo.bg,
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {roleInfo.label}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7' }}>
              {currentSpeaker}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#71717a' }}>
            {totalBubbles > 0
              ? `${currentIndex + 1} / ${totalBubbles}`
              : 'Sin bocadillos'}
          </span>
        </div>

        <p
          style={{
            fontSize: '13px',
            lineHeight: '1.4',
            color: '#d4d4d8',
            margin: 0,
            maxHeight: '60px',
            overflowY: 'auto',
            fontStyle: currentBubbleText ? 'normal' : 'italic',
          }}
        >
          {currentBubbleText || 'Listo para comenzar síntesis de diálogo...'}
        </p>
      </div>

      {/* Transport Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={onSkipPrevious}
          disabled={currentIndex <= 0}
          aria-label="Bocadillo anterior"
          style={{
            backgroundColor: '#27272a',
            border: 'none',
            color: '#f4f4f5',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex <= 0 ? 0.4 : 1.0,
            fontSize: '14px',
          }}
        >
          ⏮
        </button>

        {isPlaying ? (
          <button
            onClick={onPause}
            aria-label="Pausar lectura"
            style={{
              backgroundColor: '#e11d48',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '10px 18px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            ⏸ Pausar
          </button>
        ) : isPaused ? (
          <button
            onClick={onResume}
            aria-label="Reanudar lectura"
            style={{
              backgroundColor: '#2563eb',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '10px 18px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            ▶ Reanudar
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={totalBubbles === 0}
            aria-label="Comenzar lectura"
            style={{
              backgroundColor: '#2563eb',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              padding: '10px 18px',
              cursor: totalBubbles === 0 ? 'not-allowed' : 'pointer',
              opacity: totalBubbles === 0 ? 0.4 : 1.0,
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            ▶ Leer
          </button>
        )}

        <button
          onClick={onStop}
          disabled={!isPlaying && !isPaused}
          aria-label="Detener lectura"
          style={{
            backgroundColor: '#27272a',
            border: 'none',
            color: '#f4f4f5',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: !isPlaying && !isPaused ? 'not-allowed' : 'pointer',
            opacity: !isPlaying && !isPaused ? 0.4 : 1.0,
            fontSize: '14px',
          }}
        >
          ⏹
        </button>

        <button
          onClick={onSkipNext}
          disabled={currentIndex >= totalBubbles - 1}
          aria-label="Siguiente bocadillo"
          style={{
            backgroundColor: '#27272a',
            border: 'none',
            color: '#f4f4f5',
            borderRadius: '6px',
            padding: '8px 12px',
            cursor: currentIndex >= totalBubbles - 1 ? 'not-allowed' : 'pointer',
            opacity: currentIndex >= totalBubbles - 1 ? 0.4 : 1.0,
            fontSize: '14px',
          }}
        >
          ⏭
        </button>
      </div>

      {/* Cadence Speed Slider */}
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#a1a1aa',
            marginBottom: '4px',
          }}
        >
          <span>Velocidad de Lectura</span>
          <span style={{ fontWeight: 600, color: '#f4f4f5' }}>
            {masterRate.toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min="0.75"
          max="1.75"
          step="0.05"
          value={masterRate}
          aria-label="Velocidad de Lectura"
          onChange={(e) => onChangeMasterRate(parseFloat(e.target.value))}
          style={{
            width: '100%',
            accentColor: '#2563eb',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Auto-Advance Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '8px',
          borderTop: '1px solid #27272a',
        }}
      >
        <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
          Avance Automático de Página
        </span>
        <button
          onClick={onToggleAutoAdvance}
          aria-label="Alternar avance automático"
          style={{
            backgroundColor: autoAdvance ? '#2563eb' : '#27272a',
            border: 'none',
            color: '#ffffff',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {autoAdvance ? 'Activado' : 'Manual'}
        </button>
      </div>
    </div>
  );
};
