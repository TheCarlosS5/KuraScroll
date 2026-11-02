# Sprint 72 QA Resilience Matrix: Offline Storage Vault & Quota Arbiter Engine

## Executive Summary
Sprint 72 implements the **Offline Storage Vault & Quota Arbiter Engine**, responsible for managing offline chapter downloads in IndexedDB and CacheStorage, enforcing strict quota boundaries, protecting active and pinned reading assets, and performing atomic reconciliation of incomplete downloads.

This document outlines the exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for quota pre-allocation (`QuotaExceededError` prevention), pinned chapter immutability, orphaned asset cleanup, and volatile `navigator.storage.estimate()` telemetry.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **VAULT-01** | **Quota Exceeded Prevention** | Requesting download of a 400MB chapter when remaining disk quota is only 150MB | Arbiter checks `navigator.storage.estimate()`, detects insufficient space *before* writing, and triggers intelligent LRU eviction or returns a descriptive `QUOTA_INSUFFICIENT` error. | `storage-vault-service.test.ts` |
| **VAULT-02** | **Active & Pinned Chapter Protection** | Storage vault running low on space with active LRU purge triggered | Arbiter strictly refuses to evict the chapter currently open in the reader or any user-pinned chapters, regardless of last-access timestamp. | `storage-vault-service.test.ts` |
| **VAULT-03** | **Orphaned Asset Reconciliation** | Chapter download interrupted abruptly (network drop / browser crash mid-stream) | Startup background job scans vault, identifies partial temp files without corresponding metadata references, and safely purges them to reclaim space. | `storage-vault-service.test.ts` |
| **VAULT-04** | **Volatile Storage Estimation** | `navigator.storage.estimate()` returns fluctuating or zero quota values | Arbiter falls back to conservative heuristic estimates (assuming minimum 500MB free space) and safely catches `QuotaExceededError` on write. | `useStorageVault.test.ts` |
| **VAULT-05** | **Atomic IndexedDB Transactions** | Concurrent write operations of multi-page chapter blobs | IndexedDB write transactions execute atomically; a failure on page $N$ rolls back pages $1 \dots N-1$, preventing partial corrupt states. | `StorageVaultHUD.test.tsx` |

---

## 2. Conclusion
The resilience matrix establishes rigorous guarantees for all edge cases across quota reservation, eviction protection, and orphaned asset cleanup.
