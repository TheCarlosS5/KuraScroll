/**
 * Sprint 65 - Client-Side Multi-Tab BroadcastChannel & Shared Tab Leader Election Hook
 *
 * Elects a single Tab Leader to coordinate background writes and Fastify synchronization,
 * eliminating duplicate polling and SQLite database locking on 4TB Mechanical SATA II HDD.
 * Zero CSS blur, zero backdrop-filter, CLS = 0.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type TabMessageType =
  | 'LEADER_HEARTBEAT'
  | 'LEADER_CLAIM'
  | 'LEADER_RESIGN'
  | 'TAB_PING'
  | 'TAB_PONG'
  | 'SYNC_READING_PROGRESS'
  | 'SYNC_PAPER_TONE'
  | 'SYNC_BOOKMARK';

export interface TabBusMessage<T = any> {
  id: string;
  type: TabMessageType;
  senderTabId: string;
  senderEpoch: number;
  timestamp: number;
  payload?: T;
}

export interface UseCrossTabSyncOptions {
  userId?: string;
  seriesId?: string;
  chapterId?: string;
  apiBaseUrl?: string;
  heartbeatIntervalMs?: number;
  leaseTimeoutMs?: number;
  onSyncEvent?: (event: { type: TabMessageType; payload: any }) => void;
}

export interface UseCrossTabSyncReturn {
  isLeader: boolean;
  tabId: string;
  leaderEpoch: number;
  activePeerCount: number;
  lastSyncEvent: { type: TabMessageType; payload: any; timestamp: number } | null;
  claimLeadership: () => void;
  broadcastEvent: (type: TabMessageType, payload?: any) => void;
}

export function useCrossTabSync(options: UseCrossTabSyncOptions = {}): UseCrossTabSyncReturn {
  const {
    userId = 'default_user',
    seriesId,
    chapterId,
    apiBaseUrl = '',
    heartbeatIntervalMs = 1500,
    leaseTimeoutMs = 4000,
    onSyncEvent,
  } = options;

  // Stable random Tab ID
  const tabIdRef = useRef<string>(
    `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`
  );
  const tabId = tabIdRef.current;

  const [isLeader, setIsLeader] = useState<boolean>(false);
  const [leaderEpoch, setLeaderEpoch] = useState<number>(0);
  const [activePeerCount, setActivePeerCount] = useState<number>(1);
  const [lastSyncEvent, setLastSyncEvent] = useState<{
    type: TabMessageType;
    payload: any;
    timestamp: number;
  } | null>(null);

  const lastLeaderHeartbeatRef = useRef<number>(Date.now());
  const peerTabsRef = useRef<Map<string, number>>(new Map());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const epochRef = useRef<number>(0);
  const isLeaderRef = useRef<boolean>(false);

  // Keep refs in sync with state
  useEffect(() => {
    isLeaderRef.current = isLeader;
  }, [isLeader]);

  useEffect(() => {
    epochRef.current = leaderEpoch;
  }, [leaderEpoch]);

  // Broadcast message helper
  const broadcastEvent = useCallback(
    (type: TabMessageType, payload?: any) => {
      const channel = channelRef.current;
      if (!channel) return;

      const msg: TabBusMessage = {
        id: `msg_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
        type,
        senderTabId: tabId,
        senderEpoch: epochRef.current,
        timestamp: Date.now(),
        payload,
      };

      try {
        channel.postMessage(msg);
      } catch {}
    },
    [tabId]
  );

  // Manually or preemptively claim leadership
  const claimLeadership = useCallback(() => {
    const nextEpoch = epochRef.current + 1;
    setLeaderEpoch(nextEpoch);
    setIsLeader(true);
    isLeaderRef.current = true;
    lastLeaderHeartbeatRef.current = Date.now();

    broadcastEvent('LEADER_CLAIM', { epoch: nextEpoch });

    // Inform backend of heartbeat as leader
    try {
      fetch(`${apiBaseUrl}/api/v1/sync/tabs/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabId,
          userId,
          isLeader: true,
          leaderEpoch: nextEpoch,
          activeSeriesId: seriesId || null,
          activeChapterId: chapterId || null,
        }),
      }).catch(() => {});
    } catch {}
  }, [tabId, userId, seriesId, chapterId, apiBaseUrl, broadcastEvent]);

  // Main BroadcastChannel Setup and Message Dispatcher
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('kura_tab_bus');
      channelRef.current = channel;
    } catch {
      // In SSR or environments without BroadcastChannel
      return;
    }

    const handleMessage = (event: MessageEvent<TabBusMessage>) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.senderTabId === tabId) return; // Prevent self-echo

      // Track active peer
      peerTabsRef.current.set(msg.senderTabId, Date.now());
      setActivePeerCount(peerTabsRef.current.size + 1);

      switch (msg.type) {
        case 'LEADER_HEARTBEAT': {
          lastLeaderHeartbeatRef.current = Date.now();
          if (isLeaderRef.current) {
            // Conflict resolution: compare epochs or fallback to tabId
            if (
              msg.senderEpoch > epochRef.current ||
              (msg.senderEpoch === epochRef.current && msg.senderTabId < tabId)
            ) {
              setIsLeader(false);
              isLeaderRef.current = false;
            }
          }
          break;
        }

        case 'LEADER_CLAIM': {
          lastLeaderHeartbeatRef.current = Date.now();
          const claimedEpoch = msg.payload?.epoch ?? msg.senderEpoch;
          if (claimedEpoch > epochRef.current) {
            setLeaderEpoch(claimedEpoch);
            setIsLeader(false);
            isLeaderRef.current = false;
          }
          break;
        }

        case 'LEADER_RESIGN': {
          // Current leader is resigning. Instantly claim leadership if eligible
          lastLeaderHeartbeatRef.current = 0;
          claimLeadership();
          break;
        }

        case 'TAB_PING': {
          broadcastEvent('TAB_PONG');
          break;
        }

        case 'TAB_PONG': {
          peerTabsRef.current.set(msg.senderTabId, Date.now());
          setActivePeerCount(peerTabsRef.current.size + 1);
          break;
        }

        case 'SYNC_READING_PROGRESS':
        case 'SYNC_PAPER_TONE':
        case 'SYNC_BOOKMARK': {
          const syncData = { type: msg.type, payload: msg.payload, timestamp: msg.timestamp };
          setLastSyncEvent(syncData);
          if (onSyncEvent) {
            onSyncEvent(syncData);
          }
          break;
        }
      }
    };

    channel.addEventListener('message', handleMessage);

    // Initial ping to discover existing tabs
    broadcastEvent('TAB_PING');

    // Resign and cleanup on page close
    const handleUnload = () => {
      if (isLeaderRef.current) {
        broadcastEvent('LEADER_RESIGN');
        try {
          navigator.sendBeacon?.(
            `${apiBaseUrl}/api/v1/sync/tabs/resign`,
            JSON.stringify({ tabId })
          );
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      handleUnload();
      channel?.removeEventListener('message', handleMessage);
      channel?.close();
      channelRef.current = null;
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [tabId, claimLeadership, broadcastEvent, apiBaseUrl, onSyncEvent]);

  // Periodic Heartbeat & Leader Lease Watchdog
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // Prune inactive peers (no message for > 8000ms)
      for (const [peerId, lastSeen] of peerTabsRef.current.entries()) {
        if (now - lastSeen > 8000) {
          peerTabsRef.current.delete(peerId);
        }
      }
      setActivePeerCount(peerTabsRef.current.size + 1);

      if (isLeaderRef.current) {
        // Broadcast heartbeat to workers
        broadcastEvent('LEADER_HEARTBEAT');
        lastLeaderHeartbeatRef.current = now;

        // Periodic backend heartbeat (every 6 seconds)
        if (now % (heartbeatIntervalMs * 4) < heartbeatIntervalMs) {
          fetch(`${apiBaseUrl}/api/v1/sync/tabs/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tabId,
              userId,
              isLeader: true,
              leaderEpoch: epochRef.current,
              activeSeriesId: seriesId || null,
              activeChapterId: chapterId || null,
            }),
          }).catch(() => {});
        }
      } else {
        // Worker: verify if leader lease has expired
        if (now - lastLeaderHeartbeatRef.current > leaseTimeoutMs) {
          // Leader dead or timed out -> claim leadership
          claimLeadership();
        }
      }
    }, heartbeatIntervalMs);

    return () => clearInterval(interval);
  }, [
    tabId,
    userId,
    seriesId,
    chapterId,
    apiBaseUrl,
    heartbeatIntervalMs,
    leaseTimeoutMs,
    broadcastEvent,
    claimLeadership,
  ]);

  return {
    isLeader,
    tabId,
    leaderEpoch,
    activePeerCount,
    lastSyncEvent,
    claimLeadership,
    broadcastEvent,
  };
}
