/**
 * KuraScroll Offline Storage Vault & Quota Arbiter Service
 * Sprint 72 - Offline Chapter Management, Weighted LRU Eviction & Quota Guard
 *
 * Hardware-tuned for Intel Pentium T4500 (2C/2T 2.3GHz) & 4TB Mechanical SATA II HDD.
 * Features zero layout thrashing, zero unnecessary disk I/O on page reads,
 * and sub-50µs weighted eviction candidate sorting math (SLA 36).
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export interface VaultChapterRecord {
  id?: string;
  userId: string;
  seriesId: string;
  chapterId: string;
  chapterNumber: number;
  seriesTitle: string;
  totalBytes: number;
  totalPages: number;
  isPinned: boolean;
  isUnread: boolean;
  isFavorite: boolean;
  lastAccessedAt: number;
  downloadedAt: number;
}

export interface QuotaPolicyRecord {
  userId: string;
  maxQuotaBytes: number;
  highWatermarkPct: number;
  lowWatermarkPct: number;
  autoEvictEnabled: boolean;
  updatedAt?: number;
}

export interface EvictionCandidate {
  chapterId: string;
  seriesTitle: string;
  chapterNumber: number;
  totalBytes: number;
  evictionScore: number;
  isPinned: boolean;
  isUnread: boolean;
  isFavorite: boolean;
  lastAccessedAt: number;
}

export interface VaultStatusSummary {
  totalChapters: number;
  totalBytesUsed: number;
  pinnedChapters: number;
  pinnedBytes: number;
  maxQuotaBytes: number;
  highWatermarkBytes: number;
  lowWatermarkBytes: number;
  usagePercentage: number;
  isOverThreshold: boolean;
}

export const DEFAULT_QUOTA_POLICY: Omit<QuotaPolicyRecord, 'userId'> = {
  maxQuotaBytes: 1073741824, // 1 GB default
  highWatermarkPct: 0.75, // 75%
  lowWatermarkPct: 0.65, // 65%
  autoEvictEnabled: true,
};

export class StorageVaultService {
  private db: DatabaseInstance;
  private stmtCache = new Map<string, Statement>();

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initStatements();
  }

  private initStatements(): void {
    const upsertChapterSql = `
      INSERT INTO offline_storage_vault (
        id, user_id, series_id, chapter_id, chapter_number, series_title,
        total_bytes, total_pages, is_pinned, is_unread, is_favorite,
        last_accessed_at, downloaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, chapter_id) DO UPDATE SET
        total_bytes = excluded.total_bytes,
        total_pages = excluded.total_pages,
        is_pinned = excluded.is_pinned,
        is_unread = excluded.is_unread,
        is_favorite = excluded.is_favorite,
        last_accessed_at = excluded.last_accessed_at
    `;
    this.stmtCache.set('upsertChapter', this.db.prepare(upsertChapterSql));

    const selectInventorySql = `
      SELECT id, user_id, series_id, chapter_id, chapter_number, series_title,
             total_bytes, total_pages, is_pinned, is_unread, is_favorite,
             last_accessed_at, downloaded_at
      FROM offline_storage_vault
      WHERE user_id = ?
      ORDER BY last_accessed_at DESC
    `;
    this.stmtCache.set('selectInventory', this.db.prepare(selectInventorySql));

    const togglePinSql = `
      UPDATE offline_storage_vault
      SET is_pinned = ?
      WHERE user_id = ? AND chapter_id = ?
    `;
    this.stmtCache.set('togglePin', this.db.prepare(togglePinSql));

    const updateAccessSql = `
      UPDATE offline_storage_vault
      SET last_accessed_at = ?, is_unread = 0
      WHERE user_id = ? AND chapter_id = ?
    `;
    this.stmtCache.set('updateAccess', this.db.prepare(updateAccessSql));

    const deleteChapterSql = `
      DELETE FROM offline_storage_vault
      WHERE user_id = ? AND chapter_id = ?
    `;
    this.stmtCache.set('deleteChapter', this.db.prepare(deleteChapterSql));

    const selectPolicySql = `
      SELECT user_id, max_quota_bytes, high_watermark_pct, low_watermark_pct,
             auto_evict_enabled, updated_at
      FROM storage_quota_policies
      WHERE user_id = ?
    `;
    this.stmtCache.set('selectPolicy', this.db.prepare(selectPolicySql));

    const upsertPolicySql = `
      INSERT INTO storage_quota_policies (
        user_id, max_quota_bytes, high_watermark_pct, low_watermark_pct,
        auto_evict_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        max_quota_bytes = excluded.max_quota_bytes,
        high_watermark_pct = excluded.high_watermark_pct,
        low_watermark_pct = excluded.low_watermark_pct,
        auto_evict_enabled = excluded.auto_evict_enabled,
        updated_at = excluded.updated_at
    `;
    this.stmtCache.set('upsertPolicy', this.db.prepare(upsertPolicySql));
  }

  /**
   * Calculates zero-allocation weighted eviction priority score for a chapter.
   * Higher score => higher priority for eviction.
   * Target SLA 36: < 0.05 ms (< 50 µs) for 100 items.
   */
  public static calculateEvictionScore(
    chapter: VaultChapterRecord,
    nowMs: number,
    activeChapterId?: string
  ): number {
    if (chapter.isPinned || (activeChapterId && chapter.chapterId === activeChapterId)) {
      return -Infinity; // Immune to eviction
    }

    const elapsedHours = Math.max(0.01, (nowMs - chapter.lastAccessedAt) / 3600000);
    const sizeMb = Math.max(0.1, chapter.totalBytes / (1024 * 1024));
    const sizeFactor = Math.sqrt(sizeMb);

    let divisor = 1.0;
    if (chapter.isFavorite) divisor += 1000.0;
    if (chapter.isUnread) divisor += 50.0;

    return (elapsedHours * sizeFactor) / divisor;
  }

  /**
   * Sorts eviction candidates using weighted formula.
   * Target SLA 36: < 0.05 ms (< 50 µs) per 100 items.
   */
  public static sortCandidates(
    chapters: VaultChapterRecord[],
    nowMs: number,
    activeChapterId?: string
  ): EvictionCandidate[] {
    const len = chapters.length;
    const candidates: EvictionCandidate[] = new Array(len);

    for (let i = 0; i < len; i++) {
      const ch = chapters[i];
      const score = StorageVaultService.calculateEvictionScore(ch, nowMs, activeChapterId);
      candidates[i] = {
        chapterId: ch.chapterId,
        seriesTitle: ch.seriesTitle,
        chapterNumber: ch.chapterNumber,
        totalBytes: ch.totalBytes,
        evictionScore: score,
        isPinned: ch.isPinned,
        isUnread: ch.isUnread,
        isFavorite: ch.isFavorite,
        lastAccessedAt: ch.lastAccessedAt,
      };
    }

    // Sort descending by evictionScore: highest score evicted first
    candidates.sort((a, b) => b.evictionScore - a.evictionScore);
    return candidates;
  }

  /**
   * Registers a newly downloaded chapter in the vault inventory.
   */
  public registerDownloadedChapter(record: Omit<VaultChapterRecord, 'id'>): VaultChapterRecord {
    const id = `${record.userId}:${record.chapterId}`;
    const upsertStmt = this.stmtCache.get('upsertChapter')!;

    upsertStmt.run(
      id,
      record.userId,
      record.seriesId,
      record.chapterId,
      record.chapterNumber,
      record.seriesTitle,
      record.totalBytes,
      record.totalPages,
      record.isPinned ? 1 : 0,
      record.isUnread ? 1 : 0,
      record.isFavorite ? 1 : 0,
      record.lastAccessedAt,
      record.downloadedAt
    );

    return { id, ...record };
  }

  /**
   * Toggles pinned protection status for an offline chapter.
   */
  public togglePin(userId: string, chapterId: string, isPinned?: boolean): boolean {
    const inventory = this.getVaultInventory(userId);
    const target = inventory.find((c) => c.chapterId === chapterId);
    if (!target) return false;

    const nextState = isPinned !== undefined ? isPinned : !target.isPinned;
    const stmt = this.stmtCache.get('togglePin')!;
    stmt.run(nextState ? 1 : 0, userId, chapterId);
    return nextState;
  }

  /**
   * Updates last_accessed_at timestamp during genuine user reading.
   */
  public markChapterRead(userId: string, chapterId: string): void {
    const stmt = this.stmtCache.get('updateAccess')!;
    stmt.run(Date.now(), userId, chapterId);
  }

  /**
   * Retrieves all downloaded offline chapters for a user.
   */
  public getVaultInventory(userId: string): VaultChapterRecord[] {
    const stmt = this.stmtCache.get('selectInventory')!;
    const rows = stmt.all(userId) as any[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      seriesId: r.series_id,
      chapterId: r.chapter_id,
      chapterNumber: r.chapter_number,
      seriesTitle: r.series_title,
      totalBytes: r.total_bytes,
      totalPages: r.total_pages,
      isPinned: r.is_pinned === 1,
      isUnread: r.is_unread === 1,
      isFavorite: r.is_favorite === 1,
      lastAccessedAt: r.last_accessed_at,
      downloadedAt: r.downloaded_at,
    }));
  }

  /**
   * Evaluates storage pressure and evicts weighted candidates until target space is cleared.
   */
  public evaluateAndEvict(
    userId: string,
    requiredBytes: number,
    activeChapterId?: string
  ): { evictedChapters: string[]; bytesFreed: number; newTotalBytes: number } {
    const inventory = this.getVaultInventory(userId);
    const policy = this.getQuotaPolicy(userId);
    const now = Date.now();

    let totalBytesUsed = inventory.reduce((sum, ch) => sum + ch.totalBytes, 0);
    const highLimit = policy.maxQuotaBytes * policy.highWatermarkPct;
    const lowLimit = policy.maxQuotaBytes * policy.lowWatermarkPct;

    // Check if eviction is necessary: if total + required exceeds highLimit
    if (totalBytesUsed + requiredBytes <= highLimit) {
      return { evictedChapters: [], bytesFreed: 0, newTotalBytes: totalBytesUsed };
    }

    const candidates = StorageVaultService.sortCandidates(inventory, now, activeChapterId);
    const evictedChapters: string[] = [];
    let bytesFreed = 0;

    const deleteStmt = this.stmtCache.get('deleteChapter')!;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      // Skip immune candidates (pinned or currently active)
      if (candidate.evictionScore === -Infinity) continue;

      deleteStmt.run(userId, candidate.chapterId);
      evictedChapters.push(candidate.chapterId);
      bytesFreed += candidate.totalBytes;
      totalBytesUsed -= candidate.totalBytes;

      // Stop once usage + required drops to low watermark
      if (totalBytesUsed + requiredBytes <= lowLimit) {
        break;
      }
    }

    return { evictedChapters, bytesFreed, newTotalBytes: totalBytesUsed };
  }

  /**
   * Deletes a chapter manually from the vault.
   */
  public deleteChapter(userId: string, chapterId: string): boolean {
    const stmt = this.stmtCache.get('deleteChapter')!;
    const info = stmt.run(userId, chapterId);
    return info.changes > 0;
  }

  /**
   * Gets quota policy for a user.
   */
  public getQuotaPolicy(userId: string): QuotaPolicyRecord {
    const stmt = this.stmtCache.get('selectPolicy')!;
    const row = stmt.get(userId) as any;

    if (!row) {
      return {
        userId,
        ...DEFAULT_QUOTA_POLICY,
        updatedAt: Date.now(),
      };
    }

    return {
      userId: row.user_id,
      maxQuotaBytes: row.max_quota_bytes,
      highWatermarkPct: row.high_watermark_pct,
      lowWatermarkPct: row.low_watermark_pct,
      autoEvictEnabled: row.auto_evict_enabled === 1,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Updates user quota policy.
   */
  public updateQuotaPolicy(policy: QuotaPolicyRecord): QuotaPolicyRecord {
    const stmt = this.stmtCache.get('upsertPolicy')!;
    const now = Date.now();
    stmt.run(
      policy.userId,
      policy.maxQuotaBytes,
      policy.highWatermarkPct,
      policy.lowWatermarkPct,
      policy.autoEvictEnabled ? 1 : 0,
      now
    );

    return { ...policy, updatedAt: now };
  }

  /**
   * Computes vault summary status.
   */
  public getVaultStatus(userId: string): VaultStatusSummary {
    const inventory = this.getVaultInventory(userId);
    const policy = this.getQuotaPolicy(userId);

    const totalChapters = inventory.length;
    let totalBytesUsed = 0;
    let pinnedChapters = 0;
    let pinnedBytes = 0;

    for (let i = 0; i < inventory.length; i++) {
      const ch = inventory[i];
      totalBytesUsed += ch.totalBytes;
      if (ch.isPinned) {
        pinnedChapters++;
        pinnedBytes += ch.totalBytes;
      }
    }

    const highWatermarkBytes = Math.round(policy.maxQuotaBytes * policy.highWatermarkPct);
    const lowWatermarkBytes = Math.round(policy.maxQuotaBytes * policy.lowWatermarkPct);
    const usagePercentage = policy.maxQuotaBytes > 0
      ? Math.round((totalBytesUsed / policy.maxQuotaBytes) * 1000) / 10
      : 0;
    const isOverThreshold = totalBytesUsed >= highWatermarkBytes;

    return {
      totalChapters,
      totalBytesUsed,
      pinnedChapters,
      pinnedBytes,
      maxQuotaBytes: policy.maxQuotaBytes,
      highWatermarkBytes,
      lowWatermarkBytes,
      usagePercentage,
      isOverThreshold,
    };
  }
}
