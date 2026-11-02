/**
 * Sprint 65 - Multi-Tab BroadcastChannel Synchronization & Leader Status HUD
 *
 * Visualizes current tab leadership role (Leader vs Synced Worker),
 * active peer count, and provides non-intrusive micro-pulse updates on cross-tab sync.
 * Optimized for Intel GMA 4500MHD: 0 CSS blur, 0 backdrop-filter, contain: layout paint (CLS = 0).
 */

import React, { useState, useEffect } from 'react';
import type { TabMessageType } from '../../reader/useCrossTabSync';

export interface MultiTabSyncHUDProps {
  isLeader: boolean;
  activePeerCount: number;
  lastSyncEvent?: {
    type: TabMessageType;
    payload?: any;
    timestamp: number;
  } | null;
  onClaimLeadership?: () => void;
}

export const MultiTabSyncHUD: React.FC<MultiTabSyncHUDProps> = ({
  isLeader,
  activePeerCount,
  lastSyncEvent,
  onClaimLeadership,
}) => {
  const [pulseActive, setPulseActive] = useState(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // Trigger non-intrusive pulse when a sync event arrives from another tab
  useEffect(() => {
    if (!lastSyncEvent) return;

    let text = 'Estado sincronizado';
    switch (lastSyncEvent.type) {
      case 'SYNC_READING_PROGRESS':
        text = 'Progreso de lectura actualizado';
        break;
      case 'SYNC_PAPER_TONE':
        text = 'Tinte de papel sincronizado';
        break;
      case 'SYNC_BOOKMARK':
        text = 'Marcador actualizado';
        break;
    }

    setLastNotification(text);
    setPulseActive(true);

    const timer = setTimeout(() => {
      setPulseActive(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [lastSyncEvent]);

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors"
      style={{
        backgroundColor: '#18181b', // Pure solid background (0 blur for Intel GMA 4500MHD)
        borderColor: pulseActive ? '#f59e0b' : '#27272a',
        contain: 'layout paint',
        transform: 'translateZ(0)',
      }}
      role="status"
      aria-live="polite"
    >
      {/* Role Indicator Dot */}
      <span
        className={`w-2 h-2 rounded-full ${
          isLeader ? 'bg-emerald-400' : 'bg-cyan-400'
        } ${pulseActive ? 'animate-ping' : ''}`}
        aria-hidden="true"
      />

      {/* Role Label */}
      <span className={isLeader ? 'text-emerald-300 font-semibold' : 'text-zinc-300'}>
        {isLeader ? 'Pestaña Líder' : 'Pestaña Sincronizada'}
      </span>

      {/* Separator */}
      <span className="text-zinc-600">|</span>

      {/* Connected Tabs Count */}
      <span className="text-zinc-400 text-[11px]">
        {activePeerCount} {activePeerCount === 1 ? 'pestaña' : 'pestañas'}
      </span>

      {/* Micro-Notification Toast */}
      {pulseActive && lastNotification && (
        <span className="ml-1 text-amber-300 font-medium text-[11px] animate-fade-in">
          • {lastNotification}
        </span>
      )}

      {/* Force Leader Button (Worker Only) */}
      {!isLeader && onClaimLeadership && (
        <button
          onClick={onClaimLeadership}
          className="ml-2 px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-medium transition-colors"
          title="Asumir coordinación manual de disco en esta pestaña"
        >
          Asumir Líder
        </button>
      )}
    </div>
  );
};
