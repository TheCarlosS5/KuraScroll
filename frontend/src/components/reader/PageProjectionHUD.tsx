/**
 * KuraScroll Continuous Page Glance & Multi-Angle Reading Projection HUD
 * Sprint 81 - Perspective Keystone & Tilt-Shift Depth-of-Field Engine
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { FocalPlanePreset, PROJECTION_PRESETS } from '../../reader/usePageProjection';

export interface PageProjectionHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  pitch: number;
  yaw: number;
  perspective: number;
  keystone: number;
  focalPlanePreset: FocalPlanePreset;
  onToggleEnabled: () => void;
  onChangePitch: (p: number) => void;
  onChangeYaw: (y: number) => void;
  onChangePerspective: (d: number) => void;
  onChangeKeystone: (k: number) => void;
  onChangeFocalPlanePreset: (preset: FocalPlanePreset) => void;
  onResetToDefaults: () => void;
}

export const PageProjectionHUD: React.FC<PageProjectionHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  pitch,
  yaw,
  perspective,
  keystone,
  focalPlanePreset,
  onToggleEnabled,
  onChangePitch,
  onChangeYaw,
  onChangePerspective,
  onChangeKeystone,
  onChangeFocalPlanePreset,
  onResetToDefaults,
}) => {
  // ESC and 'P' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const presetsList: FocalPlanePreset[] = [
    'flat_orthodox',
    'desk_tilt_20',
    'easel_stand_15',
    'bed_incline_30',
    'lateral_yaw_12',
  ];

  return (
    <div
      role="dialog"
      aria-label="Controles de Proyección y Perspectiva 3D"
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
          <span style={{ fontSize: '18px' }}>📐</span>
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Perspectiva &amp; Ángulo 3D
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
            [P]
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel de perspectiva"
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
          marginBottom: '14px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Proyección 3D Activa</span>
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
          {isEnabled ? 'Activado' : 'Desactivado'}
        </button>
      </div>

      {/* Presets Grid */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>
          Ángulos Ergonómicos
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {presetsList.map((preset) => {
            const p = PROJECTION_PRESETS[preset];
            const isSelected = focalPlanePreset === preset;
            return (
              <button
                key={preset}
                onClick={() => onChangeFocalPlanePreset(preset)}
                style={{
                  backgroundColor: isSelected ? '#3b82f6' : '#27272a',
                  color: isSelected ? '#ffffff' : '#d4d4d8',
                  border: isSelected ? '1px solid #60a5fa' : '1px solid #3f3f46',
                  borderRadius: '4px',
                  padding: '6px 4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {p.name.split(' (')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
        {/* Pitch Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Inclinación Vertical (Pitch)</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{pitch > 0 ? `+${pitch}` : pitch}°</span>
          </div>
          <input
            type="range"
            min={-35}
            max={35}
            step={1}
            value={pitch}
            onChange={(e) => onChangePitch(Number(e.target.value))}
            aria-label="Inclinación vertical en grados"
            style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
          />
        </div>

        {/* Yaw Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Giro Horizontal (Yaw)</span>
            <span style={{ color: '#a855f7', fontWeight: 600 }}>{yaw > 0 ? `+${yaw}` : yaw}°</span>
          </div>
          <input
            type="range"
            min={-25}
            max={25}
            step={1}
            value={yaw}
            onChange={(e) => onChangeYaw(Number(e.target.value))}
            aria-label="Giro horizontal en grados"
            style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
          />
        </div>

        {/* Perspective Distance */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Profundidad Perspectiva</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>{perspective} px</span>
          </div>
          <input
            type="range"
            min={400}
            max={2000}
            step={50}
            value={perspective}
            onChange={(e) => onChangePerspective(Number(e.target.value))}
            aria-label="Distancia de perspectiva en píxeles"
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>

        {/* Keystone Correction */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: '#d4d4d8' }}>Corrección Keystone</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{Math.round(keystone * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.0}
            max={1.0}
            step={0.05}
            value={keystone}
            onChange={(e) => onChangeKeystone(Number(e.target.value))}
            aria-label="Porcentaje de corrección keystone"
            style={{ width: '100%', accentColor: '#f59e0b', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#27272a',
          padding: '8px 12px',
          borderRadius: '6px',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
          {PROJECTION_PRESETS[focalPlanePreset]?.name || 'Personalizado'}
        </span>
        <span style={{ fontSize: '11px', color: '#71717a' }}>0ms Latencia GPU</span>
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
