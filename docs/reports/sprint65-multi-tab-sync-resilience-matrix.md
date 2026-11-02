# Sprint 65: QA Resilience Test Plan & Multi-Tab Sync Matrix
**Feature:** Motor de Sincronización Multi-Pestaña y Elección de Líder Efímero (Cross-Tab BroadcastChannel & Shared Tab Leader Election)  
**Target Host Platform:** Browser BroadcastChannel API / Web Workers & Local Storage Coordination

---

## 1. Executive Summary & Objective

In **Sprint 65**, KuraScroll introduces **Cross-Tab BroadcastChannel & Shared Tab Leader Election**, allowing multiple browser tabs to coordinate background sync, websocket connections, and reader heartbeat tasks without redundant resource usage.

Operating across multiple browser tabs requires extreme resilience against sudden tab crashes, suspended/discarded tab wake-ups, message echo loops, and malformed payload broadcasts.

Our QA resilience test suite rigorously verifies:
1. Abrupt leader tab closure (unclean exit without `beforeunload`) $\rightarrow$ rapid re-election of a new leader in $< 500\text{ ms}$.
2. Tab wake-up from suspension (Chrome tab discard/sleep) $\rightarrow$ safe re-adoptions without double-leader conflicts.
3. Circular message echoing prevention via deduplication by `tabId` and `messageId`.
4. Malformed or corrupted payloads received over the `BroadcastChannel`.

---

## 2. Adversarial Test Case Matrix

### Case 1: Abrupt Leader Tab Closure (Unclean Exit)
- **Scenario:** The browser tab acting as the current leader crashes or is force-closed without executing cleanup handlers or `beforeunload`.
- **Behavioral Expectation:**
  - Heartbeat / lease timeout (e.g. 300ms) expires on surviving follower tabs.
  - A new leader is elected deterministically within **$< 500\text{ ms}$** via distributed lease renewal.
- **Test Implementation Outline (`frontend/tests/useCrossTabSync.test.ts`):**
  ```typescript
  it('elects a new leader within 500ms when the current leader tab closes abruptly', async () => {
    const tab1 = renderHook(() => useCrossTabSync({ tabId: 'tab-1' }));
    const tab2 = renderHook(() => useCrossTabSync({ tabId: 'tab-2' }));

    // tab-1 is elected leader
    await establishLeader(tab1);
    expect(tab1.result.current.isLeader).toBe(true);

    // Abruptly kill tab-1 without unmount cleanup
    tab1.unmountWithoutCleanup();

    await vi.advanceTimersByTimeAsync(450);
    expect(tab2.result.current.isLeader).toBe(true);
  });
  ```

---

### Case 2: Tab Wake-Up from Suspension (Tab Discard / Sleep)
- **Scenario:** A browser tab is discarded or put to sleep by Chrome due to memory constraints, then restored/awakened by the user.
- **Behavioral Expectation:**
  - Upon waking up, the tab verifies active lease validity before attempting to seize leadership, preventing "double leader" split-brain states.
- **Test Implementation Outline (`frontend/tests/useCrossTabSync.test.ts`):**
  ```typescript
  it('prevents double-leader split-brain when a suspended tab awakens', async () => {
    const tab1 = renderHook(() => useCrossTabSync({ tabId: 'tab-1' }));
    const tab2 = renderHook(() => useCrossTabSync({ tabId: 'tab-2' }));

    await establishLeader(tab1);

    // Simulate tab-2 waking from sleep state
    tab2.simulateWakeUp();

    await vi.advanceTimersByTimeAsync(100);
    expect(tab1.result.current.isLeader).toBe(true);
    expect(tab2.result.current.isLeader).toBe(false);
  });
  ```

---

### Case 3: Circular Message Echo Prevention (`tabId` & `messageId`)
- **Scenario:** A broadcast message sent by `tab-1` is echoed back across the `BroadcastChannel` to `tab-1`.
- **Behavioral Expectation:**
  - The message receiver must discard any broadcast originating from the sender's own `tabId` or already processed `messageId`, preventing infinite loops.
- **Test Implementation Outline (`frontend/tests/useCrossTabSync.test.ts`):**
  ```typescript
  it('deduplicates self-echoed messages via tabId and messageId checks', () => {
    const sync = new CrossTabSyncManager({ tabId: 'tab-1' });
    const listenerSpy = vi.fn();
    sync.onMessage(listenerSpy);

    sync.broadcast({ type: 'SYNC_PROGRESS', messageId: 'msg-123' });
    // Simulate channel echo back to sender
    sync.simulateIncomingBroadcast({ tabId: 'tab-1', messageId: 'msg-123', type: 'SYNC_PROGRESS' });

    expect(listenerSpy).not.toHaveBeenCalled();
  });
  ```

---

### Case 4: Malformed or Corrupt Broadcast Payloads
- **Scenario:** Receiving invalid JSON, non-object structures, or missing required fields (`type`, `tabId`) over the `BroadcastChannel`.
- **Behavioral Expectation:**
  - The message parser must wrap parsing and validation in `try...catch`, dropping malformed payloads silently without throwing runtime exceptions.
- **Test Implementation Outline (`tests/unit/backend/services/tab-session-service.test.ts`):**
  ```typescript
  it('silently drops malformed or corrupted broadcast payloads without crashing', () => {
    const sync = new CrossTabSyncManager({ tabId: 'tab-1' });

    expect(() => {
      sync.simulateIncomingRawMessage('invalid-json-string{{{');
      sync.simulateIncomingRawMessage(null);
      sync.simulateIncomingRawMessage({ randomField: true });
    }).not.toThrow();
  });
  ```

---

## 3. Deliverables & Artifact Summary
- This resilience test plan document (`docs/reports/sprint65-multi-tab-sync-resilience-matrix.md`).
- Automated test suites:
  - `tests/unit/backend/services/tab-session-service.test.ts`
  - `frontend/tests/useCrossTabSync.test.ts`
