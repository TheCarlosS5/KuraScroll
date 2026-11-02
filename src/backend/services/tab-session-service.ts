/**
 * KuraScroll Multi-Tab BroadcastChannel & Ephemeral Tab Leader Session Service
 * Sprint 65 - Zero-Latency Cross-Tab Coordination & Disk I/O Minimizer
 *
 * Tracks active browser tabs, prevents duplicate polling, and monitors leader leases.
 * Designed for Intel Pentium T4500 and 4TB SATA II HDD.
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export interface TabSessionRecord {
  tabId: string;
  userId: string;
  isLeader: boolean;
  leaderEpoch: number;
  activeSeriesId: string | null;
  activeChapterId: string | null;
  lastHeartbeatMs: number;
  createdAt: string;
}

export interface TabHeartbeatInput {
  tabId: string;
  userId?: string;
  isLeader?: boolean;
  leaderEpoch?: number;
  activeSeriesId?: string | null;
  activeChapterId?: string | null;
}

export class TabSessionService {
  private db: DatabaseInstance;
  private stmtCache: Map<string, Statement> = new Map();

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initStatements();
  }

  private initStatements(): void {
    const upsertSql = `
      INSERT INTO ephemeral_tab_sessions (
        tab_id, user_id, is_leader, leader_epoch, active_series_id, active_chapter_id, last_heartbeat_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(tab_id) DO UPDATE SET
        is_leader = excluded.is_leader,
        leader_epoch = excluded.leader_epoch,
        active_series_id = excluded.active_series_id,
        active_chapter_id = excluded.active_chapter_id,
        last_heartbeat_ms = excluded.last_heartbeat_ms
    `;
    this.stmtCache.set('upsert', this.db.prepare(upsertSql));

    const selectActiveSql = `
      SELECT tab_id, user_id, is_leader, leader_epoch, active_series_id, active_chapter_id, last_heartbeat_ms, created_at
      FROM ephemeral_tab_sessions
      WHERE user_id = ? AND last_heartbeat_ms >= ?
      ORDER BY is_leader DESC, leader_epoch DESC, last_heartbeat_ms DESC
    `;
    this.stmtCache.set('selectActive', this.db.prepare(selectActiveSql));

    const resignSql = `
      UPDATE ephemeral_tab_sessions
      SET is_leader = 0
      WHERE tab_id = ?
    `;
    this.stmtCache.set('resign', this.db.prepare(resignSql));

    const deleteSql = `
      DELETE FROM ephemeral_tab_sessions
      WHERE tab_id = ?
    `;
    this.stmtCache.set('delete', this.db.prepare(deleteSql));

    const cleanupSql = `
      DELETE FROM ephemeral_tab_sessions
      WHERE last_heartbeat_ms < ?
    `;
    this.stmtCache.set('cleanup', this.db.prepare(cleanupSql));
  }

  /**
   * Records or updates a tab session heartbeat.
   */
  public recordHeartbeat(input: TabHeartbeatInput): TabSessionRecord {
    const tabId = input.tabId.trim();
    const userId = input.userId ?? 'default_user';
    const isLeader = input.isLeader ? 1 : 0;
    const leaderEpoch = input.leaderEpoch ?? 0;
    const activeSeriesId = input.activeSeriesId ?? null;
    const activeChapterId = input.activeChapterId ?? null;
    const nowMs = Date.now();

    const stmt = this.stmtCache.get('upsert');
    if (!stmt) {
      throw new Error('Prepared statement upsert not initialized');
    }

    stmt.run(
      tabId,
      userId,
      isLeader,
      leaderEpoch,
      activeSeriesId,
      activeChapterId,
      nowMs
    );

    return {
      tabId,
      userId,
      isLeader: isLeader === 1,
      leaderEpoch,
      activeSeriesId,
      activeChapterId,
      lastHeartbeatMs: nowMs,
      createdAt: new Date(nowMs).toISOString(),
    };
  }

  /**
   * Retrieves all currently active tabs for a user within maxAgeMs threshold.
   */
  public getActiveSessions(userId = 'default_user', maxAgeMs = 15000): TabSessionRecord[] {
    const stmt = this.stmtCache.get('selectActive');
    if (!stmt) return [];

    const thresholdMs = Date.now() - maxAgeMs;
    const rows = stmt.all(userId, thresholdMs) as any[];

    return rows.map((r) => ({
      tabId: r.tab_id,
      userId: r.user_id,
      isLeader: r.is_leader === 1,
      leaderEpoch: r.leader_epoch,
      activeSeriesId: r.active_series_id,
      activeChapterId: r.active_chapter_id,
      lastHeartbeatMs: r.last_heartbeat_ms,
      createdAt: r.created_at,
    }));
  }

  /**
   * Resigns leadership for a tab.
   */
  public resignLeader(tabId: string): boolean {
    const stmt = this.stmtCache.get('resign');
    if (!stmt) return false;
    const res = stmt.run(tabId);
    return res.changes > 0;
  }

  /**
   * Removes a tab session on window unload.
   */
  public removeSession(tabId: string): boolean {
    const stmt = this.stmtCache.get('delete');
    if (!stmt) return false;
    const res = stmt.run(tabId);
    return res.changes > 0;
  }

  /**
   * Cleans up dead sessions older than maxAgeMs.
   */
  public cleanupStale(maxAgeMs = 30000): number {
    const stmt = this.stmtCache.get('cleanup');
    if (!stmt) return 0;
    const thresholdMs = Date.now() - maxAgeMs;
    const res = stmt.run(thresholdMs);
    return res.changes;
  }
}
