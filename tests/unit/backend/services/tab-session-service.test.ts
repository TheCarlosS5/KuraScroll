import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { TabSessionService } from '../../../../src/backend/services/tab-session-service.js';

describe('TabSessionService (Sprint 65)', () => {
  let db: DatabaseInstance;
  let service: TabSessionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-sync-test', 'sync-test', 'Sync Test', 'manga', 'ongoing')
    `).run();

    service = new TabSessionService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('records heartbeat and persists ephemeral tab session', () => {
    const session = service.recordHeartbeat({
      tabId: 'tab_test_alpha',
      userId: 'user_1',
      isLeader: true,
      leaderEpoch: 1,
      activeSeriesId: 'ser-sync-test',
      activeChapterId: 'chap_1',
    });

    expect(session.tabId).toBe('tab_test_alpha');
    expect(session.isLeader).toBe(true);
    expect(session.leaderEpoch).toBe(1);
    expect(session.activeSeriesId).toBe('ser-sync-test');
    expect(session.lastHeartbeatMs).toBeGreaterThan(0);
  });

  it('updates existing tab session on subsequent heartbeat without UNIQUE constraint error', () => {
    service.recordHeartbeat({
      tabId: 'tab_test_beta',
      userId: 'user_1',
      isLeader: false,
      leaderEpoch: 0,
    });

    // Update to leader with epoch 1
    const updated = service.recordHeartbeat({
      tabId: 'tab_test_beta',
      userId: 'user_1',
      isLeader: true,
      leaderEpoch: 1,
    });

    expect(updated.isLeader).toBe(true);
    expect(updated.leaderEpoch).toBe(1);

    const active = service.getActiveSessions('user_1');
    expect(active.length).toBe(1);
    expect(active[0].tabId).toBe('tab_test_beta');
  });

  it('retrieves active sessions filtering out stale tabs and ordering leader first', () => {
    // Session 1: Leader
    service.recordHeartbeat({
      tabId: 'tab_leader',
      userId: 'user_active',
      isLeader: true,
      leaderEpoch: 2,
    });

    // Session 2: Worker
    service.recordHeartbeat({
      tabId: 'tab_worker',
      userId: 'user_active',
      isLeader: false,
      leaderEpoch: 0,
    });

    const sessions = service.getActiveSessions('user_active', 60000);
    expect(sessions.length).toBe(2);
    expect(sessions[0].tabId).toBe('tab_leader');
    expect(sessions[0].isLeader).toBe(true);
    expect(sessions[1].tabId).toBe('tab_worker');
    expect(sessions[1].isLeader).toBe(false);
  });

  it('resigns leadership for a specific tab', () => {
    service.recordHeartbeat({
      tabId: 'tab_resign',
      userId: 'user_resign',
      isLeader: true,
      leaderEpoch: 1,
    });

    const resigned = service.resignLeader('tab_resign');
    expect(resigned).toBe(true);

    const sessions = service.getActiveSessions('user_resign');
    expect(sessions.length).toBe(1);
    expect(sessions[0].isLeader).toBe(false);
  });

  it('removes session upon tab close', () => {
    service.recordHeartbeat({
      tabId: 'tab_close',
      userId: 'user_close',
      isLeader: false,
    });

    const removed = service.removeSession('tab_close');
    expect(removed).toBe(true);

    const sessions = service.getActiveSessions('user_close');
    expect(sessions.length).toBe(0);
  });

  it('cleans up stale tab sessions older than threshold', () => {
    // Insert directly with old timestamp
    db.prepare(`
      INSERT INTO ephemeral_tab_sessions (tab_id, user_id, is_leader, leader_epoch, last_heartbeat_ms)
      VALUES ('tab_old', 'user_clean', 0, 0, 1000)
    `).run();

    const cleaned = service.cleanupStale(5000);
    expect(cleaned).toBeGreaterThanOrEqual(1);

    const check = db.prepare('SELECT COUNT(*) as c FROM ephemeral_tab_sessions WHERE tab_id = ?').get('tab_old') as any;
    expect(check.c).toBe(0);
  });
});
