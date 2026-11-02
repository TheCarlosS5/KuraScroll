# Sprint 30: Habit Buffer Metrics & Diagnostic Endpoints Specification

This document specifies the metrics, schema, diagnostic endpoints, and alert thresholds for the **Habit Buffer & Reading Streaks Write-Behind Service** in KuraScroll, optimized for resource-constrained environments (Intel Pentium T4500 / 3-4GB RAM).

---

## 1. Metrics Exposed (`GET /api/v1/telemetry/buffer`)

The telemetry buffer endpoint exposes real-time operational statistics of the write-behind caching layer:

| Metric Name | Type | Description |
| :--- | :--- | :--- |
| `dirty_entries_count` | `number` | Number of unwritten reading activity items currently sitting in the in-memory write-behind buffer. |
| `last_flush_timestamp` | `string \| null` | ISO-8601 timestamp of the last successful SQLite buffer flush operation. |
| `total_flushes` | `number` | Cumulative count of buffer flush operations performed since server startup. |
| `total_buffered_writes` | `number` | Cumulative count of individual reading activity events added to the buffer. |
| `average_flush_duration_ms` | `number` | Exponential moving average (or arithmetic mean) duration in milliseconds for buffer flush operations. |

### JSON Response Schema
```json
{
  "success": true,
  "bufferTelemetry": {
    "dirty_entries_count": 12,
    "last_flush_timestamp": "2026-11-02T00:16:16.123Z",
    "total_flushes": 142,
    "total_buffered_writes": 1850,
    "average_flush_duration_ms": 4.82
  }
}
```

---

## 2. Pentium T4500 Alert Thresholds & Health Check Integration

To protect legacy hardware (such as Intel Pentium T4500 with limited I/O throughput and CPU concurrency) from write stalls or memory bloat, the `/api/health` endpoint evaluates the following alert thresholds:

- **Dirty Entries Alert**: If `dirty_entries_count > 50`
- **Flush Latency Alert**: If `average_flush_duration_ms > 20ms`

When either threshold is breached, the health check emits a warning status (`status: "degraded"` or warning object) in the health diagnostic payload:

```json
{
  "status": "degraded",
  "warnings": [
    "[Pentium T4500 Hardware Warning] Habit buffer dirty entries count (55) exceeds threshold (50). Consider increasing flush frequency.",
    "[Pentium T4500 Hardware Warning] Average buffer flush duration (22.4ms) exceeds latency threshold (20ms). I/O saturation detected."
  ]
}
```

---

## 3. Verification Test Case (Vitest)

Below is the test suite verifying the habit buffer metrics reporting and health check warning emission under load:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

class HabitBufferTelemetryService {
  private dirtyCount = 0;
  private lastFlushTimestamp: string | null = null;
  private totalFlushes = 0;
  private totalBufferedWrites = 0;
  private totalFlushDurationMs = 0;

  public recordWrite(count = 1) {
    this.totalBufferedWrites += count;
    this.dirtyCount += count;
  }

  public flush(durationMs: number) {
    const start = Date.now();
    // Simulate flush
    this.dirtyCount = 0;
    this.lastFlushTimestamp = new Date().toISOString();
    this.totalFlushes++;
    this.totalFlushDurationMs += durationMs;
  }

  public getMetrics() {
    const avgDuration = this.totalFlushes > 0 ? this.totalFlushDurationMs / this.totalFlushes : 0;
    return {
      dirty_entries_count: this.dirtyCount,
      last_flush_timestamp: this.lastFlushTimestamp,
      total_flushes: this.totalFlushes,
      total_buffered_writes: this.totalBufferedWrites,
      average_flush_duration_ms: Math.round(avgDuration * 100) / 100,
    };
  }

  public checkHealthWarnings() {
    const metrics = this.getMetrics();
    const warnings: string[] = [];

    if (metrics.dirty_entries_count > 50) {
      warnings.push(`[Pentium T4500 Hardware Warning] Habit buffer dirty entries count (${metrics.dirty_entries_count}) exceeds threshold (50).`);
    }
    if (metrics.average_flush_duration_ms > 20) {
      warnings.push(`[Pentium T4500 Hardware Warning] Average buffer flush duration (${metrics.average_flush_duration_ms}ms) exceeds threshold (20ms).`);
    }

    return {
      status: warnings.length > 0 ? 'degraded' : 'healthy',
      warnings,
    };
  }
}

describe('Sprint 30: Habit Buffer Telemetry & Pentium T4500 Health Warnings', () => {
  let bufferService: HabitBufferTelemetryService;

  beforeEach(() => {
    bufferService = new HabitBufferTelemetryService();
  });

  it('reports correct metrics and triggers warnings when thresholds are breached', () => {
    bufferService.recordWrite(55);
    bufferService.flush(25); // 25ms > 20ms threshold

    const metrics = bufferService.getMetrics();
    expect(metrics.total_buffered_writes).toBe(55);
    expect(metrics.total_flushes).toBe(1);
    expect(metrics.average_flush_duration_ms).toBe(25);

    // Add more writes to make dirty > 50
    bufferService.recordWrite(52);

    const health = bufferService.checkHealthWarnings();
    expect(health.status).toBe('degraded');
    expect(health.warnings.length).toBe(2);
    expect(health.warnings[0]).toContain('dirty entries count (52)');
    expect(health.warnings[1]).toContain('flush duration (25ms)');
  });
});
```
