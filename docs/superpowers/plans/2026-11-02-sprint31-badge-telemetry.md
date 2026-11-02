# Sprint 31: Badge Telemetry & Performance Monitoring Specification

This document specifies the telemetry metrics and diagnostic endpoint (`GET /api/v1/telemetry/badges`) for the Badge Engine in KuraScroll, along with verification tests for performance monitoring (P95 evaluation latency) and badge progress telemetry.

---

## 1. Metrics Exposed (`GET /api/v1/telemetry/badges`)

The badge telemetry endpoint exposes real-time operational and performance statistics regarding user achievements and badge engine evaluation latency:

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| `total_unlocked_badges` | `number` | Cumulative count of total badge unlocks across all users in the system. |
| `completion_percentage_overall` | `number` | Average completion percentage of badges unlocked relative to total available badges (`(unlocked / total_possible) * 100`). |
| `most_recent_unlock_timestamp` | `string \| null` | ISO-8601 timestamp of the most recent badge unlock event across the platform. |
| `evaluation_latency_p95_ms` | `number` | 95th percentile evaluation duration in milliseconds for badge check invocations, ensuring compliance with Pentium T4500 performance budgets (<15ms). |

### JSON Response Schema
```json
{
  "success": true,
  "badgeTelemetry": {
    "total_unlocked_badges": 342,
    "completion_percentage_overall": 42.75,
    "most_recent_unlock_timestamp": "2026-11-02T00:33:00.123Z",
    "evaluation_latency_p95_ms": 6.84
  }
}
```

---

## 2. Verification Test Case (Vitest)

Below is the test suite verifying badge telemetry calculations and P95 latency tracking:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

class BadgeTelemetryService {
  private unlockTimestamps: string[] = [];
  private totalUnlocked = 0;
  private totalPossibleBadges = 100;
  private evaluationLatenciesMs: number[] = [];

  public recordUnlock(timestamp: string) {
    this.unlockTimestamps.push(timestamp);
    this.totalUnlocked++;
  }

  public recordEvaluationLatency(latencyMs: number) {
    this.evaluationLatenciesMs.push(latencyMs);
  }

  public getMetrics() {
    const sorted = [...this.evaluationLatenciesMs].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted.length > 0 ? sorted[p95Index] || sorted[sorted.length - 1] : 0;

    const completion = (this.totalUnlocked / (this.totalPossibleBadges * 10)) * 100;
    const mostRecent = this.unlockTimestamps.length > 0 
      ? this.unlockTimestamps[this.unlockTimestamps.length - 1] 
      : null;

    return {
      total_unlocked_badges: this.totalUnlocked,
      completion_percentage_overall: Math.round(completion * 100) / 100,
      most_recent_unlock_timestamp: mostRecent,
      evaluation_latency_p95_ms: Math.round(p95 * 100) / 100,
    };
  }
}

describe('Sprint 31: Badge Telemetry & P95 Performance Monitoring', () => {
  let telemetryService: BadgeTelemetryService;

  beforeEach(() => {
    telemetryService = new BadgeTelemetryService();
  });

  it('calculates correct telemetry metrics and p95 evaluation latency', () => {
    telemetryService.recordUnlock('2026-11-02T00:10:00.000Z');
    telemetryService.recordUnlock('2026-11-02T00:30:00.000Z');

    // Record latencies
    telemetryService.recordEvaluationLatency(2.1);
    telemetryService.recordEvaluationLatency(4.5);
    telemetryService.recordEvaluationLatency(12.3); // p95 candidate
    telemetryService.recordEvaluationLatency(3.8);

    const metrics = telemetryService.getMetrics();
    expect(metrics.total_unlocked_badges).toBe(2);
    expect(metrics.most_recent_unlock_timestamp).toBe('2026-11-02T00:30:00.000Z');
    expect(metrics.evaluation_latency_p95_ms).toBeLessThanOrEqual(15); // Pentium T4500 budget check
  });
});
```
