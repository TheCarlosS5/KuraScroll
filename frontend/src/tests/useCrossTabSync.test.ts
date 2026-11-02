import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrossTabSync, TabBusMessage } from '../reader/useCrossTabSync.js';

class MockBroadcastChannel {
  name: string;
  static channels: Map<string, Set<MockBroadcastChannel>> = new Map();
  listeners: Map<string, Function[]> = new Map();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(data: any) {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== this) {
        const event = { data } as MessageEvent;
        const list = peer.listeners.get('message') || [];
        for (const fn of list) fn(event);
      }
    }
  }

  addEventListener(type: string, fn: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(fn);
  }

  removeEventListener(type: string, fn: Function) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((l) => l !== fn));
  }

  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

describe('Sprint 65 - useCrossTabSync Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    MockBroadcastChannel.channels.clear();
    (global as any).BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    MockBroadcastChannel.channels.clear();
  });

  it('initializes with worker state and unique tabId', () => {
    const { result } = renderHook(() => useCrossTabSync({ leaseTimeoutMs: 10000 }));

    expect(result.current.tabId).toBeDefined();
    expect(result.current.isLeader).toBe(false);
    expect(result.current.activePeerCount).toBe(1);
  });

  it('claims leadership manually and broadcasts LEADER_CLAIM', () => {
    const { result } = renderHook(() => useCrossTabSync({ leaseTimeoutMs: 10000 }));

    act(() => {
      result.current.claimLeadership();
    });

    expect(result.current.isLeader).toBe(true);
    expect(result.current.leaderEpoch).toBeGreaterThan(0);
  });

  it('receives cross-tab sync events and updates lastSyncEvent', () => {
    const onSyncEvent = vi.fn();
    const { result } = renderHook(() =>
      useCrossTabSync({ leaseTimeoutMs: 10000, onSyncEvent })
    );

    // Simulate incoming broadcast from another peer
    const externalPeer = new MockBroadcastChannel('kura_tab_bus');
    act(() => {
      externalPeer.postMessage({
        id: 'msg_ext_1',
        type: 'SYNC_READING_PROGRESS',
        senderTabId: 'other_tab_xyz',
        senderEpoch: 1,
        timestamp: Date.now(),
        payload: { chapterId: 'c10', pageNumber: 5 },
      } as TabBusMessage);
    });

    expect(result.current.lastSyncEvent).not.toBeNull();
    expect(result.current.lastSyncEvent?.type).toBe('SYNC_READING_PROGRESS');
    expect(result.current.lastSyncEvent?.payload).toEqual({
      chapterId: 'c10',
      pageNumber: 5,
    });
    expect(onSyncEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SYNC_READING_PROGRESS' })
    );

    externalPeer.close();
  });

  it('automatically claims leadership upon receiving LEADER_RESIGN', () => {
    const { result } = renderHook(() => useCrossTabSync({ leaseTimeoutMs: 10000 }));

    expect(result.current.isLeader).toBe(false);

    const externalLeader = new MockBroadcastChannel('kura_tab_bus');
    act(() => {
      externalLeader.postMessage({
        id: 'msg_resign',
        type: 'LEADER_RESIGN',
        senderTabId: 'former_leader',
        senderEpoch: 1,
        timestamp: Date.now(),
      } as TabBusMessage);
    });

    expect(result.current.isLeader).toBe(true);
    externalLeader.close();
  });
});
