import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { MaintenanceDaemon } from '../../../src/backend/daemon/maintenance-daemon.js';
import { EventBus } from '../../../src/backend/events/event-bus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MaintenanceDaemon (Background WAL Checkpoint & Temporary Pruning)', () => {
  const sandbox = path.resolve(__dirname, `../../../tmp/maintenance-daemon-test-${Date.now()}`);
  const storageRoot = path.join(sandbox, 'storage');
  const tmpIncoming = path.join(storageRoot, 'incoming', '.tmp');
  let db: DatabaseInstance;
  let eventBus: EventBus;
  let daemon: MaintenanceDaemon;

  beforeEach(async () => {
    await fs.promises.mkdir(tmpIncoming, { recursive: true });
    db = createDatabase(':memory:');
    runMigrations(db);
    eventBus = new EventBus();

    daemon = new MaintenanceDaemon({
      db,
      storageRoot,
      intervalMs: 100, // Short interval for testing
      eventBus,
    });
  });

  afterEach(async () => {
    daemon.stop();
    try {
      db.close();
    } catch {}
    try {
      await fs.promises.rm(sandbox, { recursive: true, force: true });
    } catch {}
  });

  it('1. executes maintenance cycle and optimizes SQLite database', async () => {
    const result = await daemon.runMaintenanceCycle();
    expect(result.maintenance.integrity).toBe('ok');
    expect(result.maintenance.checkpointResult).toBeDefined();
    expect(result.maintenance.walTruncated).toBe(true);
    expect(result.timestamp).toBeDefined();

    const status = daemon.getStatus();
    expect(status.lastReport?.integrity).toBe('ok');
    expect(status.lastRunAt).toBe(result.timestamp);
  });

  it('2. broadcasts system:maintenance event over EventBus', async () => {
    const events: any[] = [];
    eventBus.subscribe((evt) => {
      events.push(evt);
    }, 'system:maintenance');

    await daemon.runMaintenanceCycle();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('system:maintenance');
    expect(events[0].data.report.integrity).toBe('ok');
  });

  it('3. prunes old orphaned files from incoming/.tmp directory', async () => {
    const oldFile = path.join(tmpIncoming, 'old-orphan.tmp');
    const recentFile = path.join(tmpIncoming, 'recent.tmp');

    await fs.promises.writeFile(oldFile, 'old data');
    await fs.promises.writeFile(recentFile, 'recent data');

    // Artificially age the old file by 48 hours
    const oldTime = Date.now() - 48 * 60 * 60 * 1000;
    await fs.promises.utimes(oldFile, new Date(oldTime), new Date(oldTime));

    const result = await daemon.runMaintenanceCycle();
    expect(result.cleanedFilesCount).toBe(1);

    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(recentFile)).toBe(true);
  });

  it('4. starts and stops background timer cleanly', () => {
    daemon.start();
    expect(daemon.getStatus().active).toBe(true);

    daemon.stop();
    expect(daemon.getStatus().active).toBe(false);
  });
});
