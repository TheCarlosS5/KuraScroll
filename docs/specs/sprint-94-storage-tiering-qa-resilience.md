# Sprint 94 QA Resilience Matrix: Multi-Tier Intelligent Storage Vault Tiering & Auto-Tiered Platter Eviction Manager

## Executive Summary
Sprint 94 introduces the **Multi-Tier Intelligent Storage Vault Tiering & Auto-Tiered Platter Eviction Manager (SLA 58)**, responsible for managing local disk allocation across the 4TB mechanical SATA II HDD, prioritizing fast-access flash/memory tiers, enforcing strict LRU eviction policies, and protecting pinned or recently read chapters (`< 48h`).

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for pinned chapter protection, recent read protection (`< 48h`), near-full disk quota scenarios (`99%` utilization), non-blocking event loop background sweeps, SQLite CHECK constraints, and ETag 304 caching.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **TIER-01** | **Pinned Chapter Protection** | Storage vault running low on space with LRU eviction sweep triggered | Eviction manager strictly exempts all chapters marked with `is_pinned = true`, regardless of age or last access timestamp. | `tier-pinned.test.ts` |
| **TIER-02** | **Recent Read Protection (< 48h)** | Unpinned chapter accessed within the last 48 hours | Eviction manager protects recent chapters from being evicted, preserving continuity for active readers. | `tier-recent.test.ts` |
| **TIER-03** | **Near-Full Disk Quota (99% of 4TB)** | Local disk utilization reaches 99.8% capacity (`available space < 500MB`) | Eviction manager triggers emergency batch purge of cold assets asynchronously via micro-task yielding, preventing event loop starvation. | `tier-quota.test.ts` |
| **TIER-04** | **SQLite CHECK Constraint Validation** | Malformed database write attempts to insert out-of-range tier levels or negative file sizes | SQLite `CHECK (tier_level >= 0 AND tier_level <= 3)` constraint rejects invalid writes, preserving database integrity. | `tier-sqlite.test.ts` |
| **TIER-05** | **ETag HTTP 304 Verification** | Client requests storage tier status profile with matching `If-None-Match` ETag header | Fastify server responds with HTTP 304 Not Modified, bypassing redundant disk scan operations. | `tier-etag.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Storage Tiering Service & Eviction Unit Tests (`tests/unit/backend/services/storage-tiering-service.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { evaluateEvictionEligibility, sanitizeTierLevel, checkEmergencyDiskPressure, computeTierEtag } from '../../../../src/backend/services/storage-tiering-service';

describe('Storage Tiering & Eviction Manager Resilience', () => {
  it('protects pinned chapters and chapters read within 48 hours from eviction', () => {
    const now = Date.now();
    const pinnedChapter = { id: 'c-1', is_pinned: true, lastAccessed: now - 10000000 };
    const recentChapter = { id: 'c-2', is_pinned: false, lastAccessed: now - 3600000 }; // 1 hour ago
    const oldChapter = { id: 'c-3', is_pinned: false, lastAccessed: now - 604800000 }; // 7 days ago

    expect(evaluateEvictionEligibility(pinnedChapter, now)).toBe(false);
    expect(evaluateEvictionEligibility(recentChapter, now)).toBe(false);
    expect(evaluateEvictionEligibility(oldChapter, now)).toBe(true);
  });

  it('triggers emergency eviction mode when disk quota reaches 99%', () => {
    const diskStats = { totalBytes: 4000000000000, usedBytes: 3980000000000, freeBytes: 20000000 }; // 99.5% full
    const isEmergency = checkEmergencyDiskPressure(diskStats);

    expect(isEmergency).toBe(true);
  });

  it('sanitizes tier level enums strictly to [0, 3]', () => {
    expect(sanitizeTierLevel(-1)).toBe(0);
    expect(sanitizeTierLevel(5)).toBe(3);
    expect(sanitizeTierLevel(2)).toBe(2);
  });

  it('generates deterministic ETags for cached storage tier status profiles', () => {
    const etag1 = computeTierEtag('vault-main', 0.995);
    const etag2 = computeTierEtag('vault-main', 0.995);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Frontend Storage Tier Hook Tests (`frontend/src/tests/useStorageTiering.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStorageTiering } from '../hooks/useStorageTiering';

describe('useStorageTiering Event Loop Yielding & Quota Warnings', () => {
  it('exposes warning banner state when disk utilization exceeds 95%', () => {
    const { result } = renderHook(() => useStorageTiering({ usedPercentage: 0.97 }));
    expect(result.current.isDiskWarningActive).toBe(true);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Non-Blocking Sweep:** Background disk sweeps yield control back to the Fastify event loop every 50ms using `setImmediate` or `setTimeout(..., 0)` to ensure reading UI responsiveness remains at 60 FPS even during heavy file deletion passes.
2. **SQLite Integrity Protection:** Database tables enforce strict `CHECK` constraints on tier levels and file byte metrics to prevent corrupt metadata states on the 4TB HDD.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 94.*
