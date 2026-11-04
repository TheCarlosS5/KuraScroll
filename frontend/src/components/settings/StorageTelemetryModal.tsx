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
  const [compacting, setCompacting] = useState(false);
  const [compactSuccess, setCompactSuccess] = useState(false);
  const [compactMsg, setCompactMsg] = useState<string | null>(null);
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

  const handleCompactStorage = async () => {
    setCompacting(true);
    setCompactMsg(null);
    try {
      const res = await fetch('/api/v1/admin/maintenance/compact', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCompactSuccess(true);
        if (data.report) {
          const freedKb = Math.round((data.report.orphanBytesReclaimed || 0) / 1024);
          setCompactMsg(`${data.report.orphanFilesDeleted} huérfanos (${freedKb} KB)`);
        }
        await fetchTelemetry();
        setTimeout(() => {
          setCompactSuccess(false);
          setCompactMsg(null);
        }, 4000);
      }
    } catch {
      // Offline fallback
    } finally {
      setCompacting(false);
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
        className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-[#090d16] p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-indigo-400">
              <HardDrive className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="storage-modal-title" className="text-lg font-bold tracking-tight text-zinc-100">
                  Telemetría 4TB & Perfil T4500
                </h2>
                <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                  Pentium T4500 Host
                </span>
              </div>
              <p className="text-xs text-zinc-400">Eficiencia WebP & control de I/O en disco local</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar telemetría"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && !telemetry ? (
          <div className="py-12 flex flex-col items-center justify-center text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
            <p className="text-xs">Consultando estadísticas físicas del repositorio...</p>
          </div>
        ) : (
          <div className="my-5 space-y-4">
            {/* Storage Capacity & Savings Hero */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" /> Ahorro por WebP (q=82)
                </span>
                <p className="text-2xl font-black text-zinc-100 mt-1">
                  {telemetry?.savingsPercentage ?? 85.0}%
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {formatBytes(telemetry?.savedBytes ?? 0)} de espacio físico preservado
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
                <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-400" /> Capacidad Proyectada
                </span>
                <p className="text-2xl font-black text-zinc-100 mt-1">
                  ~{(telemetry?.projected4TBCapacityChapters ?? 220000).toLocaleString()}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Capítulos totales soportados en disco
                </p>
              </div>
            </div>

            {/* Hardware Profile & Adaptive Ingestion Status Banner */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  Control Adaptativo de Ingesta (AIC)
                </span>

                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                    adaptiveState === 'RUNNING'
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                      : adaptiveState === 'THROTTLED'
                      ? 'bg-amber-950/40 text-amber-300 border-amber-800/50'
                      : 'bg-rose-950/40 text-rose-300 border-rose-800/50'
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

            {/* In-Memory ByteLRU Cache Flush, Self-Healing, and Compaction Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Compactar & WAL</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {compactMsg || 'Purga huérfanos y checkpoint WAL'}
                  </p>
                </div>

                <button
                  data-testid="compact-storage-btn"
                  onClick={handleCompactStorage}
                  disabled={compacting}
                  className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-medium border border-emerald-500/40 hover:border-emerald-400 transition-colors"
                >
                  {compacting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Compactando...</span>
                    </>
                  ) : compactSuccess ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>¡Compactado!</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Compactar</span>
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
