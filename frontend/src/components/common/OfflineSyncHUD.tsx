import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, Database, X, AlertCircle } from 'lucide-react';
import { localClientStorage, SyncQueueItem } from '../../services/local-storage-service.js';
import { OfflineSyncManager } from '../../services/offline-sync-manager.js';

export interface OfflineSyncHUDProps {
  userId?: string;
  onSyncComplete?: (syncedCount: number) => void;
}

export const OfflineSyncHUD: React.FC<OfflineSyncHUDProps> = ({
  userId = 'local_user',
  onSyncComplete,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingItems, setPendingItems] = useState<SyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Nunca');
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const syncManager = React.useMemo(() => new OfflineSyncManager(localClientStorage), []);

  const refreshPendingQueue = useCallback(async () => {
    try {
      const items = await localClientStorage.getPendingSync();
      setPendingItems(items);
    } catch {
      // IndexedDB fallback
    }
  }, []);

  const handleSyncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg(null);

    try {
      const stats = await syncManager.syncAllPending({ userId });
      await refreshPendingQueue();
      setLastSyncTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSyncStatusMsg(`Sincronizados ${stats.synced} registros con éxito.`);
      onSyncComplete?.(stats.synced);
    } catch (err: any) {
      setSyncStatusMsg(`Error de sincronización: ${err?.message || 'Servidor no disponible'}`);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, syncManager, userId, refreshPendingQueue, onSyncComplete]);

  useEffect(() => {
    refreshPendingQueue();

    const handleOnline = () => {
      setIsOnline(true);
      // Opportunistic auto-sync on reconnect
      handleSyncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check of IndexedDB queue every 15 seconds
    const interval = setInterval(refreshPendingQueue, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingQueue, handleSyncNow]);

  const hasPending = pendingItems.length > 0;

  return (
    <>
      {/* Status Pill Button */}
      <button
        type="button"
        data-testid="offline-sync-hud-btn"
        onClick={() => setIsModalOpen(true)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all shadow-sm focus:outline-none focus:ring-1 cursor-pointer ${
          isSyncing
            ? 'bg-blue-950/70 border-blue-700/60 text-blue-300'
            : !isOnline
            ? 'bg-amber-950/80 border-amber-600/70 text-amber-300 hover:bg-amber-900/60'
            : hasPending
            ? 'bg-yellow-950/70 border-yellow-700/60 text-yellow-300 hover:bg-yellow-900/60'
            : 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/50'
        }`}
        style={{ contain: 'layout paint' }}
        title="Estado de sincronización y outbox local"
        aria-label="Estado de sincronización offline"
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span className="hidden sm:inline">Sincronizando...</span>
          </>
        ) : !isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            <span>Sin conexión {hasPending && `(${pendingItems.length})`}</span>
          </>
        ) : hasPending ? (
          <>
            <Database className="w-3.5 h-3.5 text-yellow-400" />
            <span>{pendingItems.length} pendientes</span>
          </>
        ) : (
          <>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Sincronizado</span>
          </>
        )}
      </button>

      {/* Diagnostics Modal */}
      {isModalOpen && (
        <div
          data-testid="offline-sync-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sync-hud-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-gray-800 p-6 shadow-2xl flex flex-col gap-4 text-white"
            style={{ contain: 'layout paint' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-red-500" />
                <h3 id="sync-hud-title" className="text-base font-bold text-gray-100">
                  Diagnóstico de Sincronización
                </h3>
              </div>
              <button
                type="button"
                data-testid="close-sync-modal-btn"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Network & Queue Health Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-gray-400">
                  Estado de Red
                </span>
                <div className="flex items-center gap-1.5">
                  {isOnline ? (
                    <>
                      <Wifi className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-300">En Línea</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-300">Desconectado</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-gray-400">
                  Cola Outbox
                </span>
                <span className="text-xs font-semibold text-white">
                  {pendingItems.length} registros locales
                </span>
              </div>
            </div>

            {/* Status Feedback Message */}
            {syncStatusMsg && (
              <div className="px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/60 text-xs text-gray-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{syncStatusMsg}</span>
              </div>
            )}

            {/* Pending Items List */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-400">
                Mutaciones Pendientes en IndexedDB:
              </span>
              <div
                data-testid="pending-items-list"
                className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-800"
              >
                {pendingItems.length === 0 ? (
                  <div className="p-4 text-center rounded-lg bg-gray-950/60 border border-gray-800/60 text-xs text-gray-500">
                    No hay cambios pendientes. Todo el progreso está sincronizado con SQLite.
                  </div>
                ) : (
                  pendingItems.map((item, idx) => (
                    <div
                      key={item.seriesId + idx}
                      className="p-2 rounded-lg bg-gray-950/70 border border-gray-800/70 text-xs flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold text-gray-200">{item.seriesId}</span>
                        <span className="text-gray-400 text-[11px] block truncate">
                          Cap. {item.chapterId} • Pág. {item.pageNumber}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 shrink-0 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer with Sync Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 mt-1">
              <span className="text-[11px] text-gray-500">Última sync: {lastSyncTime}</span>
              <button
                type="button"
                data-testid="trigger-manual-sync-btn"
                disabled={isSyncing || pendingItems.length === 0}
                onClick={handleSyncNow}
                className="px-4 py-2 rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium flex items-center gap-2 shadow-lg shadow-[#dc2626]/20 transition-all active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
