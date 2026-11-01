import { describe, it, expect } from 'vitest';
import { runHostSlaBenchmark } from '../../../scripts/benchmark-sla.js';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Host SLA Benchmark Suite (Pentium T4500 & SATA II Profile)', () => {
  it('executes full SLA benchmark and confirms all targets pass', async () => {
    const report = await runHostSlaBenchmark();

    expect(report).toBeDefined();
    expect(report.host.cpus).toBeGreaterThan(0);
    expect(report.host.totalMemMB).toBeGreaterThan(0);
    expect(report.results.length).toBeGreaterThanOrEqual(10);
    expect(report.allPassed).toBe(true);
    expect(report.summary.failed).toBe(0);

    // Verify written JSON report
    const reportFilePath = path.resolve(process.cwd(), 'data/reports/host-sla-report.json');
    const content = await fs.readFile(reportFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.allPassed).toBe(true);
  });
});
