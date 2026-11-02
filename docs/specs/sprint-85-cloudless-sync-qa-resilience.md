# Sprint 85 QA Resilience Matrix: CloudlessSync Local-First P2P Milestone & Reading Progress Synchronization Engine

## Executive Summary
Sprint 85 introduces the **CloudlessSync Local-First P2P Milestone & Reading Progress Synchronization Engine**, allowing readers to sync reading progress and milestones seamlessly across local network peers and offline devices without relying on central cloud servers.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for CloudlessSync Fastify endpoints, split-brain divergence resolution, backward time skew / client clock drift handling, concurrency/idempotency, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **SYNC-01** | **Split-Brain Divergence** | Two peer nodes update progress simultaneously during offline split-brain (`Node A: Ch 5, Page 12` vs `Node B: Ch 6, Page 2`) with identical vector timestamps | CRDT merge resolver applies deterministic tie-breaking (e.g. highest chapter/page priority or peer UUID lexicographical sort) to converge state without data loss. | `cloudless-split-brain.test.ts` |
| **SYNC-02** | **Backward Time Skew / Clock Drift** | Peer node reports milestone timestamp in the past (`timestamp = Date.now() - 86400000`) or drifted future clock | Engine normalizes telemetry using logical vector clocks and monotonic sequence counters rather than wall-clock time alone. | `cloudless-clock-drift.test.ts` |
| **SYNC-03** | **CRDT Peer Reconciliation** | `POST /reconcile-peer` receives conflicting state updates from multiple LAN companions | Conflict-free Replicated Data Type (LWW-Element-Set / PN-Counter) merges states atomically across nodes. | `cloudless-crdt.test.ts` |
| **SYNC-04** | **Concurrency & Idempotency** | Simultaneous duplicate `POST /milestone` submissions from unstable local Wi-Fi reconnects | Fastify idempotency middleware and database transactions guarantee idempotent persistence without duplicate milestone entries. | `cloudless-concurrency.test.ts` |
| **SYNC-05** | **ETag 304 Caching (`GET /milestone/:seriesId`)** | Client requests milestone profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant database queries. | `cloudless-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify CloudlessSync Service & CRDT Unit Tests (`tests/unit/backend/services/cloudless-sync-service.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { reconcileCrdtPeers, handleClockDrift, validateMilestonePayload, computeMilestoneEtag } from '../../../../src/backend/services/cloudless-sync-service';

describe('CloudlessSync P2P Engine Resilience & CRDT Reconciliation', () => {
  it('resolves split-brain divergence deterministically using sequence priorities', () => {
    const peerA = { seriesId: 's-1', chapterId: 'ch-5', page: 12, vector: 10, peerId: 'peer-alpha' };
    const peerB = { seriesId: 's-1', chapterId: 'ch-6', page: 2, vector: 10, peerId: 'peer-beta' };

    const merged = reconcileCrdtPeers(peerA, peerB);
    // Higher chapter ID / vector convergence wins
    expect(merged.chapterId).toBe('ch-6');
    expect(merged.page).toBe(2);
  });

  it('mitigates backward time skew and clock drift using logical vectors', () => {
    const normalState = { timestamp: 1000, vector: 5 };
    const skewedState = { timestamp: 500, vector: 6 }; // Timestamp is in the past, but vector is higher

    const resolved = handleClockDrift(normalState, skewedState);
    expect(resolved.vector).toBe(6); // Prefers higher logical vector over wall clock
  });

  it('validates milestone payload fields and rejects malformed requests', () => {
    const invalid = { seriesId: '', page: -5, chapterId: null };
    const validation = validateMilestonePayload(invalid);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toHaveProperty('page');
  });

  it('generates deterministic ETags for cached milestone profiles', () => {
    const etag1 = computeMilestoneEtag('series-456', 15);
    const etag2 = computeMilestoneEtag('series-456', 15);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Sync Hook Tests (`frontend/src/tests/useCloudlessSync.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloudlessSync } from '../hooks/useCloudlessSync';

describe('useCloudlessSync P2P Broadcast & Retry Resilience', () => {
  it('queues offline milestone changes and syncs upon peer reconnection', async () => {
    const syncSpy = vi.fn().mockResolvedValue({ success: true });
    const { result } = renderHook(() => useCloudlessSync({ onSync: syncSpy }));

    act(() => {
      result.current.recordOfflineMilestone({ chapterId: 'ch-2', page: 5 });
    });

    expect(result.current.pendingQueueLength).toBe(1);

    await act(async () => {
      await result.current.triggerPeerSync();
    });

    expect(syncSpy).toHaveBeenCalled();
    expect(result.current.pendingQueueLength).toBe(0);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Split-Brain Convergence:** When two offline nodes reconnect on the LAN, state conflicts are resolved via Conflict-free Replicated Data Type (CRDT) merge rules, ensuring zero data loss and eventual consistency.
2. **Clock Drift Safeguard:** Wall-clock timestamps are accompanied by monotonic logical counters; if a peer node's clock is skewed into the past or future, logical counters take precedence.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 85.*
