import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  X,
  RefreshCw,
  Zap,
  Trash2,
  Database,
  CheckCircle,
  Cpu,
  Activity,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface StorageTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StorageTelemetryModal({ isOpen, onClose }: StorageTelemetryModalProps) {
  const [telemetry, setTelemetry] = useState<any | null>(null);
  const [adaptive, setAdaptive] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushSuccess, setFlushSuccess] = useState(false);
  const [healing, setHealing] = useState(false);
  const [healingSuccess, setHealingSuccess] = useState(false);
  const [togglingIngestion, setTogglingIngestion] = useState(false);

  const modalRef = useFocusTrap({ isOpen, onClose });

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const [storageRes, adaptiveRes] = await Promise.all([
        fetch('/api/v1/storage/telemetry'),
        fetch('/api/v1/telemetry/adaptive').catch(() => null),
      ]);

      if (storageRes.ok) {
        const data = await storageRes.json();
        setTelemetry(data.telemetry);
      }
      if (adaptiveRes && adaptiveRes.ok) {
        const data = await adaptiveRes.json();
        if (data.success) {
          setAdaptive(data.status);
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
      setFlushSuccess(false);
      setHealingSuccess(false);
    }
  }, [isOpen]);

  const handleFlushCache = async () => {
    setFlushing(true);
    try {
      const res = await fetch('/api/v1/storage/cache/flush', { method: 'POST' });
      if (res.ok) {
        setFlushSuccess(true);
        await fetchTelemetry();
        setTimeout(() => setFlushSuccess(false), 3000);
      }
    } catch {} finally {
      setFlushing(false);
    }
  };

  const handleSelfHeal = async () => {
    setHealing(true);
    try {
      const res = await fetch('/api/v1/admin/self-heal', { method: 'POST' });
      if (res.ok) {
        setHealingSuccess(true);
        await fetchTelemetry();
        setTimeout(() => setHealingSuccess(false), 4000);
      }
    } catch {} finally {
      setHealing(false);
    }
  };

  const handleToggleAdaptiveState = async () => {
    if (!adaptive) return;
    setTogglingIngestion(true);
    const nextAction = adaptive.state === 'PAUSED' ? 'resume' : 'pause';
    try {
      const res = await fetch('/api/v1/telemetry/adaptive/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          setAdaptive(data.status);
        }
      }
    } catch {} finally {
      setTogglingIngestion(false);
    }
  };

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const adaptiveState = adaptive?.state || 'RUNNING';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="storage-modal-title"
        className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-[#0d121f] p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(0,229,255,0.4)]">
              <HardDrive className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="storage-modal-title" className="text-xl font-bold tracking-tight text-white">
                  Telemetría 4TB & Perfil T4500
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  Pentium T4500 Host
                </span>
              </div>
              <p className="text-xs text-slate-400">Eficiencia WebP & control de saturación de disco mecánico</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar telemetría"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && !telemetry ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mb-2" />
            <p className="text-xs">Consultando estadísticas físicas del repositorio 4TB...</p>
          </div>
        ) : (
          <div className="my-5 space-y-4">
            {/* 4TB Capacity & Savings Hero */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
                <span className="text-[11px] font-medium text-cyan-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Ahorro por WebP (q=82)
                </span>
                <p className="text-2xl font-black text-white mt-1">
                  {telemetry?.savingsPercentage ?? 85.0}%
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatBytes(telemetry?.savedBytes ?? 0)} de espacio físico preservado
                </p>
              </div>

              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5">
                <span className="text-[11px] font-medium text-indigo-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Capacidad Proyectada
                </span>
                <p className="text-2xl font-black text-white mt-1">
                  ~{(telemetry?.projected4TBCapacityChapters ?? 220000).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Capítulos totales soportados en tu disco 4TB
                </p>
              </div>
            </div>

            {/* Hardware Profile & Adaptive Ingestion Status Banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Control Adaptativo de Ingesta (AIC)
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    adaptiveState === 'RUNNING'
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                      : adaptiveState === 'THROTTLED'
                      ? 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                      : 'bg-red-950/60 text-red-400 border-red-500/40'
                  }`}
                >
                  {adaptiveState === 'RUNNING' ? '● ESTADO: NORMAL (15ms sleep)' : adaptiveState === 'THROTTLED' ? '▲ ATENUADO (200ms sleep)' : '■ PAUSADO (Protegiendo lector)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                    <Activity className="w-3 h-3 text-cyan-400" /> Latencia API P95
                  </span>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {adaptive?.p95Ms ? `${Math.round(adaptive.p95Ms)} ms` : '< 20 ms'}
                    <span className="text-[10px] font-normal text-slate-500 ml-1.5">/ umbral 500ms</span>
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block">Memoria V8 RSS</span>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {adaptive?.rssMb ? `${adaptive.rssMb} MB` : '185 MB'}
                    <span className="text-[10px] font-normal text-slate-500 ml-1.5">/ límite 380MB</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleToggleAdaptiveState}
                  disabled={togglingIngestion}
                  className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {adaptiveState === 'PAUSED' ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5" /> Reanudar Ingesta Manualmente
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5" /> Pausar Ingesta para Máxima Velocidad
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Library Counts Overview */}
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 flex justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Series en Biblioteca</span>
                <span className="font-bold text-white text-sm">{telemetry?.totalSeries ?? 0}</span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-400 block text-[10px]">Capítulos Ingestados</span>
                <span className="font-bold text-white text-sm">{telemetry?.totalChapters ?? 0}</span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-400 block text-[10px]">Páginas WebP</span>
                <span className="font-bold text-cyan-400 text-sm">{telemetry?.totalPages ?? 0}</span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-400 block text-[10px]">Uso 4TB Actual</span>
                <span className="font-bold text-white text-sm">{telemetry?.hdd4TBUsedPercentage ?? 0}%</span>
              </div>
            </div>

            {/* In-Memory ByteLRU Cache Flush & Self-Healing Actions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Memoria RAM ByteLRU</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatBytes(telemetry?.memoryCache?.imagesUsedBytes ?? 0)} / 16 MB
                  </p>
                </div>

                <button
                  onClick={handleFlushCache}
                  disabled={flushing}
                  className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 hover:border-cyan-500/40 transition-colors"
                >
                  {flushSuccess ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>¡Liberada!</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Vaciar RAM</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Autocuración (4TB)</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Limpia temporales y reconcilia SQLite
                  </p>
                </div>

                <button
                  onClick={handleSelfHeal}
                  disabled={healing}
                  className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 text-xs font-medium border border-cyan-500/40 hover:border-cyan-400 transition-colors"
                >
                  {healing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>Sanando...</span>
                    </>
                  ) : healingSuccess ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>¡Sana y Lista!</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Autocuración</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
