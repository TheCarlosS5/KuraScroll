/**
 * KuraScroll Binaural Page Rustle & Tactile Leaf Turn Acoustics HUD
 * Sprint 82 - Low-Frequency Sub-Bass Page Flip Haptic Synthesizer
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { PaperSubstrate, SUBSTRATE_PRESETS } from '../../reader/usePageAcoustics';

export interface PageAcousticsHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  paperSubstrate: PaperSubstrate;
  volume: number;
  stereoPanningEnabled: boolean;
  hapticPulseEnabled: boolean;
  hapticIntensity: number;
  onToggleEnabled: () => void;
  onToggleStereoPanning: () => void;
  onToggleHapticPulse: () => void;
  onChangePaperSubstrate: (substrate: PaperSubstrate) => void;
  onChangeVolume: (vol: number) => void;
  onChangeHapticIntensity: (intensity: number) => void;
  onPlayTestAcoustic: () => void;
  onResetToDefaults: () => void;
}

export const PageAcousticsHUD: React.FC<PageAcousticsHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  paperSubstrate,
  volume,
  stereoPanningEnabled,
  hapticPulseEnabled,
  hapticIntensity,
  onToggleEnabled,
  onToggleStereoPanning,
  onToggleHapticPulse,
  onChangePaperSubstrate,
  onChangeVolume,
  onChangeHapticIntensity,
  onPlayTestAcoustic,
  onResetToDefaults,
}) => {
  // ESC and 'A' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'a') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const substrateList: PaperSubstrate[] = ['tankobon', 'newsprint', 'glossy', 'silk_ribbon'];

  return (
    <div
      role="dialog"
      aria-label="Controles Acústicos de Crujido de Páginas"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '390px',
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
          <span style={{ fontSize: '18px' }}>📖🔊</span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Acústica de Páginas &amp; Háptica
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
            [A]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de acústica"
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '4px',
          }}
        >
          ✕
        </button>
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
          marginBottom: '10px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Crujido de Página Activo</span>
        <button
          onClick={onToggleEnabled}
          aria-pressed={isEnabled}
          style={{
            backgroundColor: isEnabled ? '#3b82f6' : '#3f3f46',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {isEnabled ? 'Activado' : 'Silenciado'}
        </button>
      </div>

      {/* Stereo Panning Switch */}
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
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>Barrido Estéreo (Binaural)</div>
          <div style={{ fontSize: '11px', color: '#a1a1aa' }}>Paneo espacial según sentido de lectura</div>
        </div>
        <button
          onClick={onToggleStereoPanning}
          aria-pressed={stereoPanningEnabled}
          style={{
            backgroundColor: stereoPanningEnabled ? '#10b981' : '#3f3f46',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {stereoPanningEnabled ? '3D Estéreo' : 'Mono'}
        </button>
      </div>

      {/* Substrates Selector */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', color: '#d4d4d8', marginBottom: '6px' }}>
          Sustrato de Papel
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {substrateList.map((sub) => {
            const conf = SUBSTRATE_PRESETS[sub];
            const isSelected = paperSubstrate === sub;
            return (
              <button
                key={sub}
                onClick={() => onChangePaperSubstrate(sub)}
                style={{
                  backgroundColor: isSelected ? '#3b82f6' : '#27272a',
                  color: isSelected ? '#ffffff' : '#d4d4d8',
                  border: isSelected ? '1px solid #60a5fa' : '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '8px 6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <div>{conf.name}</div>
                <div style={{ fontSize: '10px', color: isSelected ? '#e0f2fe' : '#71717a', marginTop: '2px' }}>
                  {conf.cutoffHz} Hz
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
        {/* Volume Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Volumen Acústico</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={1.0}
            step={0.05}
            value={volume}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            aria-label="Nivel de volumen acústico"
            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
          />
        </div>

        {/* Haptic Intensity Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Intensidad Háptica</span>
            <span style={{ color: '#a855f7', fontWeight: 600 }}>{Math.round(hapticIntensity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={1.0}
            step={0.05}
            value={hapticIntensity}
            disabled={!hapticPulseEnabled}
            onChange={(e) => onChangeHapticIntensity(Number(e.target.value))}
            aria-label="Intensidad de vibración háptica"
            style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Test Button & Action Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={onPlayTestAcoustic}
          style={{
            flex: 1,
            backgroundColor: '#27272a',
            border: '1px solid #3b82f6',
            color: '#38bdf8',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          🔊 Probar Crujido
        </button>
      </div>

      {/* Reset button */}
      <button
        onClick={onResetToDefaults}
        style={{
          width: '100%',
          backgroundColor: 'transparent',
          border: '1px solid #3f3f46',
          color: '#a1a1aa',
          padding: '6px',
          borderRadius: '4px',
          fontSize: '11px',
          cursor: 'pointer',
        }}
      >
        Restablecer Ajustes Predeterminados
      </button>
    </div>
  );
};
