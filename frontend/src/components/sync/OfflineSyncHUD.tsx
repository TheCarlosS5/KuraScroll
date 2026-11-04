import React, { useEffect, useState } from 'react';
import './OfflineSyncHUD.css';
import { syncCoordinator, SyncState } from '../../services/sync-coordinator';

export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'pending';

export interface OfflineSyncHUDProps {
  status?: SyncStatus;
  pendingCount?: number;
  onTriggerSync?: () => void;
  isOnline?: boolean;
}

export const OfflineSyncHUD: React.FC<OfflineSyncHUDProps> = (props) => {
  const [internalState, setInternalState] = useState<SyncState>({
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced',
    pendingCount: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  });

  const [visible, setVisible] = useState(true);

  // Subscribe to singleton SyncCoordinator if props are not explicitly controlling state
  useEffect(() => {
    if (props.status === undefined) {
      const unsubscribe = syncCoordinator.subscribe((state) => {
        setInternalState(state);
      });
      return unsubscribe;
    }
  }, [props.status]);

  const status = props.status !== undefined ? props.status : internalState.status;
  const pendingCount = props.pendingCount !== undefined ? props.pendingCount : internalState.pendingCount;
  const isOnline = props.isOnline !== undefined ? props.isOnline : internalState.isOnline;
  const onTriggerSync = props.onTriggerSync || (() => syncCoordinator.triggerSync());

  // Auto-fade green synced status after 2.5s
  useEffect(() => {
    if (status === 'synced') {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [status]);

  if (!visible && status === 'synced') return null;

  return (
    <div
      className={`offline-sync-hud fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium shadow-lg transition-all duration-300 ${
        status === 'offline'
          ? 'bg-amber-950/90 border border-amber-700 text-amber-200'
          : status === 'syncing'
          ? 'bg-indigo-950/90 border border-indigo-700 text-indigo-200'
          : 'bg-emerald-950/90 border border-emerald-700 text-emerald-200'
      }`}
      style={{ contain: 'layout paint', transform: 'translateZ(0)' }}
      role="status"
      aria-live="polite"
    >
      {/* Icon / Indicator */}
      <div className="flex items-center gap-2">
        {status === 'syncing' ? (
          <span className="sync-spinner inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
        ) : status === 'offline' ? (
          <span className="text-amber-400 font-mono text-xs">SYNC</span>
        ) : (
          <span className="text-emerald-400 font-mono text-xs">OK</span>
        )}

        <span>
          {status === 'offline'
            ? `Sin conexión (${pendingCount} cambio${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''})`
            : status === 'syncing'
            ? 'Sincronizando cambios en segundo plano...'
            : 'Sincronizado'}
        </span>
      </div>

      {/* Manual Trigger Button */}
      {isOnline && pendingCount > 0 && status !== 'syncing' && (
        <button
          onClick={onTriggerSync}
          className="ml-2 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Sincronizar Ahora
        </button>
      )}
    </div>
  );
};
