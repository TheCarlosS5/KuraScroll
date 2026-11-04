/**
 * Sprint 63 - Platter Defrag & HDD Cylinder Re-Alignment HUD
 *
 * Visualizes 4TB Mechanical HDD physical track fragmentation (PLI),
 * estimated voice-coil seek penalty, and executes zero-thrash cylinder reordering.
 * Optimized for Intel GMA 4500MHD: 0 CSS blur, 0 backdrop-filter, contain: layout paint (CLS = 0).
 */

import React, { useEffect, useCallback } from 'react';
import type { DefragStatus, DefragOptimizationResult } from '../../reader/usePlatterDefrag';

export interface PlatterDefragHUDProps {
  isOpen: boolean;
  status: DefragStatus;
  fragmentationPercent: number;
  pli?: number;
  currentCylinder?: number;
  totalCylinders?: number;
  lastResult?: DefragOptimizationResult | null;
  onStartDefrag: () => void;
  onClose: () => void;
}

export const PlatterDefragHUD: React.FC<PlatterDefragHUDProps> = ({
  isOpen,
  status,
  fragmentationPercent,
  pli = 1.0,
  currentCylinder,
  totalCylinders,
  lastResult,
  onStartDefrag,
  onClose,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const getStatusLabel = () => {
    switch (status) {
      case 'idle':
        return 'Listo para optimizar';
      case 'analyzing':
        return 'Analizando sectores de plato...';
      case 'defragmenting':
        return 'Optimizando cilindros contiguos...';
      case 'complete':
        return 'Optimización completada con éxito';
    }
  };

  const getHealthColor = () => {
    if (fragmentationPercent > 30) return 'text-amber-400';
    if (fragmentationPercent > 10) return 'text-yellow-300';
    return 'text-emerald-400';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        contain: 'layout paint',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="defrag-modal-title"
    >
      <div
        className="rounded-2xl w-full max-w-md p-6 text-gray-100 shadow-2xl"
        style={{
          backgroundColor: '#18181b', // Solid pure background (no blur for Intel GMA 4500MHD)
          border: '1px solid #27272a',
          contain: 'layout paint',
          transform: 'translateZ(0)',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
            <h2 id="defrag-modal-title" className="text-sm font-bold text-indigo-400">
              Optimizador de Plato HDD & Cilindros
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 text-sm font-bold"
            aria-label="Cerrar modal"
          >&times;</button>
        </div>

        {/* Fragmentation & PLI Card */}
        <div className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
          <div className="flex justify-around items-center">
            <div>
              <span className={`text-3xl font-extrabold ${getHealthColor()}`}>
                {fragmentationPercent}%
              </span>
              <p className="text-[11px] text-zinc-400 mt-1">Fragmentación de Pistas</p>
            </div>
            <div className="h-10 w-[1px] bg-zinc-800" />
            <div>
              <span className="text-3xl font-extrabold text-indigo-300">
                {(pli * 100).toFixed(0)}%
              </span>
              <p className="text-[11px] text-zinc-400 mt-1">Índice de Localidad (PLI)</p>
            </div>
          </div>
        </div>

        {/* Real-Time Status & Progress */}
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Estado del Disco:</span>
            <span className="font-semibold text-indigo-300">{getStatusLabel()}</span>
          </div>

          {currentCylinder !== undefined && totalCylinders !== undefined && (
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Cilindro actual:</span>
              <span>
                {currentCylinder} / {totalCylinders}
              </span>
            </div>
          )}

          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                status === 'complete' ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{
                width: `${status === 'complete' ? 100 : Math.max(5, fragmentationPercent)}%`,
              }}
            />
          </div>

          {lastResult && (
            <div className="mt-3 p-2.5 bg-zinc-900/80 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>Capítulos reordenados:</span>
                <span className="text-zinc-200 font-mono">{lastResult.chaptersProcessed}</span>
              </div>
              <div className="flex justify-between">
                <span>Bytes en cilindros contiguos:</span>
                <span className="text-zinc-200 font-mono">
                  {(lastResult.bytesReordered / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tiempo de reescritura:</span>
                <span className="text-zinc-200 font-mono">{lastResult.durationMs} ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={onStartDefrag}
            disabled={status === 'analyzing' || status === 'defragmenting'}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {status === 'idle'
              ? 'Optimizar Cilindros'
              : status === 'complete'
              ? 'Re-optimizar'
              : 'Procesando...'}
          </button>
        </div>
      </div>
    </div>
  );
};
