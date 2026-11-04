/**
 * KuraScroll Adaptive Panel Dynamic Cropping & Smart Margin Trimming HUD
 * Sprint 84 - SmartCrop Engine
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { SmartCropMode, CropBox, CROP_MODE_LABELS } from '../../reader/useSmartCrop';

export interface SmartCropHUDProps {
  isOpen: boolean;
  onClose: () => void;
  isEnabled: boolean;
  mode: SmartCropMode;
  marginThreshold: number;
  aspectRatioLock: boolean;
  targetAspectRatio: number;
  paddingPx: number;
  cropBox: CropBox | null;
  marginSavedPct: number;
  isCropped: boolean;
  onToggleEnabled: () => void;
  onToggleAspectRatioLock: () => void;
  onChangeMode: (mode: SmartCropMode) => void;
  onChangeMarginThreshold: (val: number) => void;
  onChangeTargetAspectRatio: (val: number) => void;
  onChangePaddingPx: (val: number) => void;
  onResetCrop: () => void;
}

export const SmartCropHUD: React.FC<SmartCropHUDProps> = ({
  isOpen,
  onClose,
  isEnabled,
  mode,
  marginThreshold,
  aspectRatioLock,
  targetAspectRatio,
  paddingPx,
  cropBox,
  marginSavedPct,
  isCropped,
  onToggleEnabled,
  onToggleAspectRatioLock,
  onChangeMode,
  onChangeMarginThreshold,
  onChangeTargetAspectRatio,
  onChangePaddingPx,
  onResetCrop,
}) => {
  // ESC and 'K' key listener to close HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'k') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modeList: SmartCropMode[] = ['dialogue_safe', 'conservative', 'aggressive'];
  const commonRatios = [
    { label: 'Auto (0.70)', value: 0.70 },
    { label: 'B6 Tankōbon (0.71)', value: 0.71 },
    { label: 'A5 Wide (0.69)', value: 0.69 },
    { label: '16:9 Móvil (0.56)', value: 0.56 },
  ];

  return (
    <div
      role="dialog"
      aria-label="Panel de Recorte Inteligente y Ajuste de Márgenes"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        contain: 'layout style',
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-700 shadow-2xl p-6 flex flex-col gap-5"
        style={{
          backgroundColor: '#18181b', // Pure solid containment for GMA 4500MHD
          color: '#f4f4f5',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg border border-cyan-500/30">
              CROP
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                SmartCrop • Recorte Automático
              </h2>
              <p className="text-xs text-zinc-400">
                Ajuste dinámico de márgenes y proporción (Atajo: 'K')
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Cerrar panel de recorte inteligente"
          >&times;</button>
        </div>

        {/* Master Toggle */}
        <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
          <div>
            <span className="text-sm font-medium text-zinc-200">
              Recorte Inteligente de Márgenes
            </span>
            <p className="text-xs text-zinc-400">
              Elimina franjas blancas o negras sin cortar texto ni viñetas
            </p>
          </div>
          <button
            role="switch"
            aria-checked={isEnabled}
            onClick={onToggleEnabled}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              isEnabled
                ? 'bg-cyan-600 border-cyan-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {isEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-300">
            Modo de Protección de Contorno
          </label>
          <div className="grid grid-cols-3 gap-2">
            {modeList.map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => onChangeMode(m)}
                  className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-colors ${
                    active
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  <span className="text-xs font-semibold">{CROP_MODE_LABELS[m].name}</span>
                  <span className="text-[10px] text-zinc-500 line-clamp-1">
                    {CROP_MODE_LABELS[m].description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders & Aspect Ratio */}
        <div className="flex flex-col gap-3 bg-zinc-900/80 p-3.5 rounded-lg border border-zinc-800">
          {/* Padding */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Margen de Resguardo (Padding)</span>
              <span className="text-cyan-400 font-mono">{paddingPx} px</span>
            </div>
            <input
              type="range"
              min="0"
              max="48"
              step="2"
              value={paddingPx}
              onChange={(e) => onChangePaddingPx(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500 bg-zinc-800 cursor-pointer h-1.5 rounded"
            />
          </div>

          {/* Margin Threshold */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300">Umbral de Detección de Blanco</span>
              <span className="text-cyan-400 font-mono">{(marginThreshold * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.80"
              max="0.99"
              step="0.01"
              value={marginThreshold}
              onChange={(e) => onChangeMarginThreshold(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 bg-zinc-800 cursor-pointer h-1.5 rounded"
            />
          </div>

          {/* Aspect Ratio Lock Toggle & Selectors */}
          <div className="pt-2 border-t border-zinc-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-300 font-medium">Bloqueo de Proporción</span>
                <p className="text-[10px] text-zinc-500">Mantiene una relación de aspecto estable</p>
              </div>
              <button
                role="switch"
                aria-checked={aspectRatioLock}
                onClick={onToggleAspectRatioLock}
                className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                  aspectRatioLock
                    ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}
              >
                {aspectRatioLock ? 'BLOQUEADO' : 'LIBRE'}
              </button>
            </div>

            {aspectRatioLock && (
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {commonRatios.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => onChangeTargetAspectRatio(r.value)}
                    className={`py-1 px-1.5 text-[10px] rounded border transition-colors ${
                      Math.abs(targetAspectRatio - r.value) < 0.02
                        ? 'border-cyan-500 bg-cyan-900/40 text-cyan-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Telemetry Readout */}
        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-zinc-500">Caja: </span>
            <span className="text-zinc-300">
              {cropBox ? `${cropBox.width}x${cropBox.height}` : 'Original'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Ahorro: </span>
            <span className={isCropped ? 'text-cyan-400 font-bold' : 'text-zinc-500'}>
              +{marginSavedPct.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Estado: </span>
            <span className={isCropped ? 'text-emerald-400' : 'text-zinc-400'}>
              {isCropped ? 'RECORTADA' : 'INTEGRA'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-1 border-t border-zinc-800 text-xs">
          <button
            onClick={onResetCrop}
            className="text-zinc-400 hover:text-zinc-200 underline transition-colors"
          >
            Restablecer Recorte
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors shadow"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
