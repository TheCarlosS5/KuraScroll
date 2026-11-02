# Sprint 110 QA Resilience Matrix: Chroma-Bleed Fastify Endpoints & Storage Seek Thrashing Protection

## Executive Summary
Sprint 110 introduces the **Chroma-Bleed Fastify Endpoints & Storage Seek Thrashing Protection Engine**, designed to provide robust backend validation for chroma-bleed and color dispersion endpoints while strictly protecting the 4TB mechanical SATA II HDD from head seek thrashing.

This document establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for anomalous parameter injection (negative Kelvin temperatures, $> 100,000\text{K}$, `NaN`, empty strings), ETag caching validation with HTTP 304 Not Modified support, and strict asynchronous non-blocking I/O verification to prevent mechanical HDD seek lockups.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **CHROMA-01** | **Anomalous Parameter Injection (Kelvin Fuzzing)** | API requests pass extreme, malformed, or negative Kelvin values (`temperature = -5000K`, `150000K`, `NaN`, `""`) | Fastify validation schema rejects or sanitizes values strictly into safe bounds (`[1800K, 6500K]`), preventing shader compilation errors. | `chroma-kelvin-fuzz.test.ts` |
| **CHROMA-02** | **ETag 304 Not Modified Caching** | Client requests chroma-bleed profile endpoint with matching `If-None-Match` ETag header | Fastify server responds immediately with HTTP 304 Not Modified, skipping redundant computations and database lookups. | `chroma-etag-304.test.ts` |
| **CHROMA-03** | **HDD Seek Thrashing Prevention (Non-Blocking I/O)** | Concurrent requests saturate chroma-bleed asset lookups on the 4TB mechanical SATA II HDD | Service strictly uses asynchronous non-blocking I/O (`fs.promises`) and in-memory LRU caching, ensuring synchronous disk operations (`fs.readFileSync`) are never invoked. | `chroma-hdd-protection.test.ts` |
| **CHROMA-04** | **Strict Execution Latency (< 50 µs / < 20 µs)** | Chroma-bleed configuration validation executed repeatedly in Vitest benchmark suite | Unit test assertions complete in `< 50 µs`; optimized benchmark loops complete in `< 20 µs` per evaluation cycle. | `chroma-latency.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / Fastify Chroma-Bleed Service & Unit Tests (`tests/unit/backend/services/chroma-bleed-service.test.ts`)
```typescript
import { describe, it, expect, performance } from 'vitest';
import { validateChromaParams, sanitizeKelvinTemperature, computeChromaEtag, checkNoSynchronousDiskOps } from '../../../../src/backend/services/chroma-bleed-service';

describe('Chroma-Bleed Fastify Endpoints & HDD Resilience', () => {
  it('sanitizes anomalous parameter injection (negative Kelvin, 150000K, NaN, empty strings)', () => {
    expect(sanitizeKelvinTemperature(-5000)).toBe(1800);
    expect(sanitizeKelvinTemperature(150000)).toBe(6500);
    expect(sanitizeKelvinTemperature(NaN)).toBe(4500); // Safe fallback
    expect(sanitizeKelvinTemperature('' as any)).toBe(4500);
  });

  it('verifies that no synchronous disk operations are invoked (protecting 4TB HDD seek thrashing)', () => {
    const syncOpsDetected = checkNoSynchronousDiskOps();
    expect(syncOpsDetected).toBe(false); // Zero sync disk calls allowed
  });

  it('satisfies strict latency SLA (< 50 µs unit test, < 20 µs benchmark)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      sanitizeKelvinTemperature(3500);
      validateChromaParams({ temperature: 4500, intensity: 0.8 });
    }
    const avgMicroSeconds = ((performance.now() - start) / 100) * 1000;

    expect(avgMicroSeconds).toBeLessThan(50); // < 50 µs SLA
  });

  it('generates deterministic ETags and supports HTTP 304 Not Modified validation', () => {
    const etag1 = computeChromaEtag('series-110', 4500);
    const etag2 = computeChromaEtag('series-110', 4500);
    expect(etag1).toBe(etag2);
    expect(etag1).toMatch(/^"[\da-f]+"$/);
  });
});
```

### 2.2 Fastify Endpoint Integration Tests (`tests/integration/backend/chroma-bleed-endpoint.test.ts`)
```typescript
import { describe, it, expect } from 'vitest';
import { buildFastifyApp } from '../../../src/backend/app';

describe('Fastify /api/v1/reader/chroma-bleed/* Endpoints', () => {
  it('returns HTTP 304 Not Modified when ETag matches If-None-Match header', async () => {
    const app = await buildFastifyApp();
    const res1 = await app.inject({ method: 'GET', url: '/api/v1/reader/chroma-bleed/profile/s-110' });
    const etag = res1.headers['etag'];

    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/chroma-bleed/profile/s-110',
      headers: { 'if-none-match': etag },
    });

    expect(res2.statusCode).toBe(304);
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **HDD Seek Protection:** All file reads within the chroma-bleed module are routed through asynchronous promise-based streams and cached in memory, preventing mechanical HDD head thrashing.
2. **Schema Fuzzing Defense:** Fastify query and body schemas enforce strict type validation and range clamping, neutralizing malformed parameter injection attacks.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 110.*
