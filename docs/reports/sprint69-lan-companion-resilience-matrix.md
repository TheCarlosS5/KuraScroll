# Sprint 69 QA Resilience Matrix: LAN Companion Sync & Zero-Config Mobile Reader Bridge

## Executive Summary
Sprint 69 introduces the **LAN Companion Sync & Zero-Config Mobile Reader Bridge**, enabling seamless QR-code pairing between a desktop KuraScroll host and mobile companion devices over local Wi-Fi without cloud dependencies or manual IP configuration.

This report establishes the exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for abrupt Wi-Fi drops, short-lived token expiration (90s TTL), local brute-force mitigation, concurrent reading race conditions (vector clocks / monotonic sequence numbers), and host DHCP interface rotation.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **LAN-01** | **Abrupt Wi-Fi Drop & Reconnect** | Mobile client loses connection mid-chapter (`navigator.onLine = false` or TCP RST) | Automatic reconnection loop with exponential backoff (1s, 2s, 4s, 8s) + delta snapshot sync upon re-establishing WebSocket session. | `lan-reconnect.test.ts` |
| **LAN-02** | **Expired & Tampered Pairing Tokens** | Pairing QR token exceeds 90s TTL or HMAC signature is altered | Host rejects pairing request with HTTP 401 Unauthorized / 410 Gone and automatically generates a fresh dynamic QR code. | `lan-auth.test.ts` |
| **LAN-03** | **Local Brute-Force Rate Limiting** | 6+ consecutive failed PIN/token attempts from a single local IP within 60s | IP address is temporarily quarantined (HTTP 429 Too Many Requests) for 300 seconds to prevent malicious discovery scans. | `lan-ratelimit.test.ts` |
| **LAN-04** | **Concurrent Reading Race Conditions** | Host desktop advances to page 5 while mobile companion requests page 6 | State synchronization resolves using monotonic sequence numbers (`vector_clock > client_clock`), taking the highest logical timestamp without stutter. | `lan-sync-race.test.ts` |
| **LAN-05** | **Host DHCP / Interface IP Rotation** | Desktop host changes local IP address (e.g., `192.168.1.50` $\rightarrow$ `10.0.0.15`) | mDNS / UDP broadcast beacon broadcasts new IP endpoint; connected companions seamlessly reconnect via fallback discovery ping. | `lan-dhcp.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / WebSocket & Auth Resilience Unit Tests (`tests/unit/backend/services/lan-companion.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { validatePairingToken, checkBruteForceLimit, resolveReadingRace } from '../../../../src/backend/services/lan-companion';

describe('LAN Companion Sync Resilience & Security', () => {
  it('rejects expired pairing tokens (>90s TTL) with 410 Gone', () => {
    const expiredTokenPayload = { createdAt: Date.now() - 95000, hmac: 'valid_sig' };
    const result = validatePairingToken(expiredTokenPayload);
    expect(result.status).toBe(410);
    expect(result.error).toMatch(/token expired/i);
  });

  it('triggers rate-limiting after 5 failed authentication attempts from same IP', () => {
    const clientIp = '192.168.1.105';
    for (let i = 0; i < 5; i++) {
      checkBruteForceLimit(clientIp, false);
    }
    const sixthAttempt = checkBruteForceLimit(clientIp, false);
    expect(sixthAttempt.allowed).toBe(false);
    expect(sixthAttempt.statusCode).toBe(429);
  });

  it('resolves concurrent reading race conditions using monotonic sequence counters', () => {
    const hostState = { chapterId: 'ch-5', page: 5, seq: 12 };
    const mobileState = { chapterId: 'ch-5', page: 6, seq: 11 };
    
    const resolved = resolveReadingRace(hostState, mobileState);
    // Host has higher sequence counter (12 > 11), wins state authoritatively
    expect(resolved.page).toBe(5);
    expect(resolved.seq).toBe(12);
  });
});
```

### 2.2 Frontend WebSocket Reconnection & Snapshot Hooks (`frontend/src/tests/useLanSync.test.ts`)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLanSync } from '../hooks/useLanSync';

describe('useLanSync Exponential Backoff & Reconnection', () => {
  it('attempts reconnection with exponential backoff on WebSocket close', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLanSync({ hostUrl: 'ws://192.168.1.50:4820' }));

    act(() => {
      // Simulate sudden drop
      result.current.simulateDisconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.reconnectAttempts).toBe(1);

    // Fast-forward backoff timer (1s)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.reconnectAttempts).toBe(2);

    vi.useRealTimers();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **DHCP Interface Switch:** When network adapters change IPs, the host broadcast daemon triggers a UDP multicast announcement across `239.255.255.250:4820` so active mobile companion clients auto-update their target endpoint without user intervention.
2. **Snapshot Delta Hydration:** Upon successful reconnection after a Wi-Fi drop, the client sends its last known `vector_clock` and immediately receives a compressed JSON delta rather than reloading the entire chapter asset tree.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 69.*
