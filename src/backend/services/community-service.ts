import crypto from 'node:crypto';
import { DatabaseInstance, Statement } from '../db/database.js';

export type TargetType = 'comment' | 'chapter' | 'series';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';
export type ContentStatus = 'published' | 'hidden' | 'removed';

export interface PublicProfile {
  handle: string;
  displayName: string | null;
  bio: string | null;
  createdAt: string;
}

export interface UpdateProfileInput {
  displayName?: string | null;
  bio?: string | null;
}

export interface CommentRecord {
  id: string;
  seriesSlug: string;
  authorHandle: string;
  authorDisplayName: string | null;
  body: string;
  hasSpoiler: boolean;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reporterHandle: string;
  targetType: TargetType;
  targetId: string;
  targetSnippet?: string | null;
  reason: string;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedByHandle: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class CommunityService {
  private statements = new Map<string, Statement>();
  private rateLimits = new Map<string, RateLimitEntry>();

  constructor(private db: DatabaseInstance) {
    this.ensureVisibilityColumns();
  }

  private getStatement(sql: string): Statement {
    let stmt = this.statements.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.statements.set(sql, stmt);
    }
    return stmt;
  }

  private ensureVisibilityColumns(): void {
    try {
      const chapterCols = this.db.prepare("PRAGMA table_info(chapters)").all() as Array<{ name: string }>;
      if (!chapterCols.some(c => c.name === 'visibility_status')) {
        this.db.exec("ALTER TABLE chapters ADD COLUMN visibility_status TEXT NOT NULL DEFAULT 'published' CHECK(visibility_status IN ('published', 'hidden', 'removed'));");
      }
    } catch {
      // Ignore if table doesn't exist yet or already added
    }

    try {
      const seriesCols = this.db.prepare("PRAGMA table_info(series)").all() as Array<{ name: string }>;
      if (!seriesCols.some(c => c.name === 'visibility_status')) {
        this.db.exec("ALTER TABLE series ADD COLUMN visibility_status TEXT NOT NULL DEFAULT 'published' CHECK(visibility_status IN ('published', 'hidden', 'removed'));");
      }
    } catch {
      // Ignore if table doesn't exist yet or already added
    }
  }

  /**
   * Simple sliding rate limiter per action + key (e.g. `comment:${userId}`).
   */
  public checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || entry.resetAt <= now) {
      this.rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= maxRequests) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  // =========================================================================
  // Public Profiles
  // =========================================================================

  /**
   * Fetches public profile by handle.
   * STRICT SECURITY: Never leaks email, passwords, streaks, habits, or private reading data.
   */
  public getPublicProfile(handle: string): PublicProfile | null {
    if (!handle || typeof handle !== 'string') return null;

    const stmt = this.getStatement(`
      SELECT handle, display_name, bio, created_at, disabled_at
      FROM users
      WHERE handle = ? COLLATE NOCASE
      LIMIT 1
    `);
    const row = stmt.get(handle.trim()) as any;

    if (!row || row.disabled_at) {
      return null;
    }

    return {
      handle: String(row.handle),
      displayName: row.display_name ? String(row.display_name) : null,
      bio: row.bio ? String(row.bio) : null,
      createdAt: String(row.created_at),
    };
  }

  /**
   * Updates display_name and bio for the currently authenticated user.
   */
  public updateMyProfile(userId: string, input: UpdateProfileInput): PublicProfile {
    const userStmt = this.getStatement(`
      SELECT id, handle, display_name, bio, created_at, disabled_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `);
    const user = userStmt.get(userId) as any;
    if (!user || user.disabled_at) {
      throw new Error('Usuario no encontrado o deshabilitado.');
    }

    // Rate limit: 15 profile edits per 10 minutes
    if (!this.checkRateLimit(`profile_edit:${userId}`, 15, 10 * 60 * 1000)) {
      throw new Error('Demasiadas actualizaciones de perfil. Por favor espera unos minutos.');
    }

    let finalDisplayName = user.display_name;
    if (input.displayName !== undefined) {
      if (input.displayName === null || input.displayName.trim() === '') {
        finalDisplayName = null;
      } else {
        const trimmed = input.displayName.trim();
        if (trimmed.length < 2 || trimmed.length > 40) {
          throw new Error('El nombre visible debe tener entre 2 y 40 caracteres.');
        }
        finalDisplayName = trimmed;
      }
    }

    let finalBio = user.bio;
    if (input.bio !== undefined) {
      if (input.bio === null || input.bio.trim() === '') {
        finalBio = null;
      } else {
        const trimmedBio = input.bio.trim();
        if (trimmedBio.length > 280) {
          throw new Error('La biografía no puede exceder 280 caracteres.');
        }
        finalBio = trimmedBio;
      }
    }

    const updateStmt = this.getStatement(`
      UPDATE users
      SET display_name = ?, bio = ?
      WHERE id = ?
    `);
    updateStmt.run(finalDisplayName, finalBio, userId);

    return {
      handle: String(user.handle),
      displayName: finalDisplayName,
      bio: finalBio,
      createdAt: String(user.created_at),
    };
  }

  // =========================================================================
  // Series Comments
  // =========================================================================

  /**
   * Lists published comments for a series, ordered newest first with cursor pagination.
   */
  public listComments(
    seriesSlug: string,
    cursor?: string,
    limit: number = 20
  ): { comments: CommentRecord[]; nextCursor: string | null } {
    const seriesStmt = this.getStatement(`
      SELECT id, slug FROM series WHERE slug = ? LIMIT 1
    `);
    const series = seriesStmt.get(seriesSlug) as any;
    if (!series) {
      return { comments: [], nextCursor: null };
    }

    const safeLimit = Math.min(Math.max(1, limit || 20), 50);

    let rows: any[] = [];
    if (cursor) {
      const stmt = this.getStatement(`
        SELECT c.id, c.body, c.has_spoiler, c.status, c.created_at, c.updated_at,
               u.handle AS author_handle, u.display_name AS author_display_name
        FROM series_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.series_id = ?
          AND c.status = 'published'
          AND c.created_at < ?
        ORDER BY c.created_at DESC
        LIMIT ?
      `);
      rows = stmt.all(series.id, cursor, safeLimit) as any[];
    } else {
      const stmt = this.getStatement(`
        SELECT c.id, c.body, c.has_spoiler, c.status, c.created_at, c.updated_at,
               u.handle AS author_handle, u.display_name AS author_display_name
        FROM series_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.series_id = ?
          AND c.status = 'published'
        ORDER BY c.created_at DESC
        LIMIT ?
      `);
      rows = stmt.all(series.id, safeLimit) as any[];
    }

    const comments: CommentRecord[] = rows.map((r) => ({
      id: String(r.id),
      seriesSlug,
      authorHandle: String(r.author_handle),
      authorDisplayName: r.author_display_name ? String(r.author_display_name) : null,
      body: String(r.body),
      hasSpoiler: Boolean(r.has_spoiler),
      status: r.status as ContentStatus,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));

    const nextCursor = comments.length === safeLimit ? comments[comments.length - 1].createdAt : null;

    return { comments, nextCursor };
  }

  /**
   * Posts a new comment for a series.
   * Requires verified session; validates 1-2000 chars and enforces rate limit.
   */
  public createComment(
    userId: string,
    seriesSlug: string,
    body: string,
    hasSpoiler?: boolean
  ): CommentRecord {
    // Rate limit: 10 comments per minute per user
    if (!this.checkRateLimit(`comment:${userId}`, 10, 60 * 1000)) {
      throw new Error('Estás comentando demasiado rápido. Por favor espera un momento.');
    }

    const cleanBody = (body || '').trim();
    if (!cleanBody || cleanBody.length < 1 || cleanBody.length > 2000) {
      throw new Error('El comentario debe tener entre 1 y 2000 caracteres.');
    }

    const seriesStmt = this.getStatement(`
      SELECT id, slug FROM series WHERE slug = ? LIMIT 1
    `);
    const series = seriesStmt.get(seriesSlug) as any;
    if (!series) {
      throw new Error('Serie no encontrada.');
    }

    const userStmt = this.getStatement(`
      SELECT id, handle, display_name, email_verified_at, disabled_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `);
    const user = userStmt.get(userId) as any;
    if (!user || user.disabled_at) {
      throw new Error('Usuario inválido o deshabilitado.');
    }

    if (!user.email_verified_at) {
      throw new Error('Debes verificar tu correo electrónico para poder comentar.');
    }

    const commentId = crypto.randomUUID();
    const spoilerInt = hasSpoiler ? 1 : 0;

    const insertStmt = this.getStatement(`
      INSERT INTO series_comments (id, series_id, user_id, body, has_spoiler, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'))
    `);
    insertStmt.run(commentId, series.id, userId, cleanBody, spoilerInt);

    const createdRow = this.getStatement(`
      SELECT created_at, updated_at FROM series_comments WHERE id = ?
    `).get(commentId) as any;

    return {
      id: commentId,
      seriesSlug,
      authorHandle: String(user.handle),
      authorDisplayName: user.display_name ? String(user.display_name) : null,
      body: cleanBody,
      hasSpoiler: Boolean(hasSpoiler),
      status: 'published',
      createdAt: createdRow?.created_at || new Date().toISOString(),
      updatedAt: createdRow?.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Deletes a comment.
   * Only the author or an admin can delete it.
   */
  public deleteComment(commentId: string, userId: string, role: string): { success: boolean; commentId: string } {
    const stmt = this.getStatement(`
      SELECT id, user_id, status FROM series_comments WHERE id = ? LIMIT 1
    `);
    const comment = stmt.get(commentId) as any;
    if (!comment) {
      throw new Error('Comentario no encontrado.');
    }

    if (comment.user_id !== userId && role !== 'admin') {
      throw new Error('No tienes permiso para eliminar este comentario.');
    }

    const delStmt = this.getStatement(`
      DELETE FROM series_comments WHERE id = ?
    `);
    delStmt.run(commentId);

    return { success: true, commentId };
  }

  // =========================================================================
  // Reports & Admin Moderation
  // =========================================================================

  /**
   * Submits a report for a comment, chapter, or series.
   * Deduplicated: UNIQUE(reporter_id, target_type, target_id).
   */
  public createReport(
    reporterId: string,
    targetType: TargetType,
    targetId: string,
    reason: string
  ): { id: string; status: ReportStatus; alreadyReported: boolean } {
    if (!['comment', 'chapter', 'series'].includes(targetType)) {
      throw new Error('Tipo de objetivo de reporte inválido.');
    }

    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3 || cleanReason.length > 500) {
      throw new Error('El motivo del reporte debe tener entre 3 y 500 caracteres.');
    }

    // Rate limit: 5 reports per minute per user
    if (!this.checkRateLimit(`report:${reporterId}`, 5, 60 * 1000)) {
      throw new Error('Has enviado demasiados reportes recientemente. Por favor espera un momento.');
    }

    const userStmt = this.getStatement(`
      SELECT id, email_verified_at, disabled_at FROM users WHERE id = ? LIMIT 1
    `);
    const user = userStmt.get(reporterId) as any;
    if (!user || user.disabled_at) {
      throw new Error('Usuario inválido o deshabilitado.');
    }

    if (!user.email_verified_at) {
      throw new Error('Debes verificar tu correo para poder enviar reportes.');
    }

    // Check duplicate
    const checkStmt = this.getStatement(`
      SELECT id, status FROM content_reports
      WHERE reporter_id = ? AND target_type = ? AND target_id = ?
      LIMIT 1
    `);
    const existing = checkStmt.get(reporterId, targetType, targetId) as any;
    if (existing) {
      return {
        id: String(existing.id),
        status: existing.status as ReportStatus,
        alreadyReported: true,
      };
    }

    const reportId = crypto.randomUUID();
    const insertStmt = this.getStatement(`
      INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
    `);

    try {
      insertStmt.run(reportId, reporterId, targetType, targetId, cleanReason);
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        const dup = checkStmt.get(reporterId, targetType, targetId) as any;
        return {
          id: String(dup?.id || reportId),
          status: (dup?.status || 'pending') as ReportStatus,
          alreadyReported: true,
        };
      }
      throw err;
    }

    return {
      id: reportId,
      status: 'pending',
      alreadyReported: false,
    };
  }

  /**
   * Lists reports for admin moderation queue.
   */
  public listReports(
    status?: ReportStatus,
    cursor?: string,
    limit: number = 20
  ): { reports: ReportRecord[]; nextCursor: string | null } {
    const safeLimit = Math.min(Math.max(1, limit || 20), 50);

    let rows: any[] = [];
    if (status && cursor) {
      const stmt = this.getStatement(`
        SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.status,
               r.reviewed_by, r.reviewed_at, r.created_at,
               u.handle AS reporter_handle,
               rev.handle AS reviewer_handle
        FROM content_reports r
        JOIN users u ON u.id = r.reporter_id
        LEFT JOIN users rev ON rev.id = r.reviewed_by
        WHERE r.status = ?
          AND r.created_at < ?
        ORDER BY r.created_at DESC
        LIMIT ?
      `);
      rows = stmt.all(status, cursor, safeLimit) as any[];
    } else if (status) {
      const stmt = this.getStatement(`
        SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.status,
               r.reviewed_by, r.reviewed_at, r.created_at,
               u.handle AS reporter_handle,
               rev.handle AS reviewer_handle
        FROM content_reports r
        JOIN users u ON u.id = r.reporter_id
        LEFT JOIN users rev ON rev.id = r.reviewed_by
        WHERE r.status = ?
        ORDER BY r.created_at DESC
        LIMIT ?
      `);
      rows = stmt.all(status, safeLimit) as any[];
    } else if (cursor) {
      const stmt = this.getStatement(`
        SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.status,
               r.reviewed_by, r.reviewed_at, r.created_at,
               u.handle AS reporter_handle,
               rev.handle AS reviewer_handle
        FROM content_reports r
        JOIN users u ON u.id = r.reporter_id
        LEFT JOIN users rev ON rev.id = r.reviewed_by
        WHERE r.created_at < ?
        ORDER BY r.created_at DESC
        LIMIT ?
      `);
      rows = stmt.all(cursor, safeLimit) as any[];
    } else {
      const stmt = this.getStatement(`
        SELECT r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.status,
               r.reviewed_by, r.reviewed_at, r.created_at,
               u.handle AS reporter_handle,
               rev.handle AS reviewer_handle
        FROM content_reports r
        JOIN users u ON u.id = r.reporter_id
        LEFT JOIN users rev ON rev.id = r.reviewed_by
        ORDER BY r.created_at DESC
        LIMIT ?
      `);
      rows = stmt.all(safeLimit) as any[];
    }

    const reports: ReportRecord[] = rows.map((r) => {
      let snippet: string | null = null;
      try {
        if (r.target_type === 'comment') {
          const c = this.getStatement('SELECT body FROM series_comments WHERE id = ?').get(r.target_id) as any;
          snippet = c ? (c.body.length > 80 ? c.body.substring(0, 80) + '...' : c.body) : '[Comentario no disponible]';
        } else if (r.target_type === 'series') {
          const s = this.getStatement('SELECT title_primary FROM series WHERE id = ? OR slug = ?').get(r.target_id, r.target_id) as any;
          snippet = s ? s.title_primary : '[Serie no disponible]';
        } else if (r.target_type === 'chapter') {
          const ch = this.getStatement('SELECT chapter_number, title FROM chapters WHERE id = ?').get(r.target_id) as any;
          snippet = ch ? `Capítulo ${ch.chapter_number}${ch.title ? ': ' + ch.title : ''}` : '[Capítulo no disponible]';
        }
      } catch {
        snippet = null;
      }

      return {
        id: String(r.id),
        reporterId: String(r.reporter_id),
        reporterHandle: String(r.reporter_handle),
        targetType: r.target_type as TargetType,
        targetId: String(r.target_id),
        targetSnippet: snippet,
        reason: String(r.reason),
        status: r.status as ReportStatus,
        reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
        reviewedByHandle: r.reviewer_handle ? String(r.reviewer_handle) : null,
        reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
        createdAt: String(r.created_at),
      };
    });

    const nextCursor = reports.length === safeLimit ? reports[reports.length - 1].createdAt : null;

    return { reports, nextCursor };
  }

  /**
   * Resolves or dismisses a report and optionally executes a moderation action.
   */
  public resolveReport(
    reportId: string,
    adminUserId: string,
    resolution: ReportStatus,
    action?: 'none' | 'hide' | 'restore' | 'remove'
  ): { id: string; status: ReportStatus; reviewedBy: string } {
    const reportStmt = this.getStatement(`
      SELECT id, target_type, target_id, status FROM content_reports WHERE id = ? LIMIT 1
    `);
    const report = reportStmt.get(reportId) as any;
    if (!report) {
      throw new Error('Reporte no encontrado.');
    }

    if (action && action !== 'none') {
      const visibilityStatus: ContentStatus =
        action === 'hide' ? 'hidden' : action === 'restore' ? 'published' : 'removed';
      this.updateVisibility(report.target_type, report.target_id, adminUserId, visibilityStatus);
    }

    const updateStmt = this.getStatement(`
      UPDATE content_reports
      SET status = ?, reviewed_by = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `);
    updateStmt.run(resolution, adminUserId, reportId);

    return {
      id: reportId,
      status: resolution,
      reviewedBy: adminUserId,
    };
  }

  /**
   * Updates visibility of a target item (comment, chapter, or series).
   */
  public updateVisibility(
    targetType: TargetType,
    targetId: string,
    adminUserId: string,
    status: ContentStatus
  ): { success: boolean; targetType: TargetType; targetId: string; status: ContentStatus } {
    this.ensureVisibilityColumns();

    if (targetType === 'comment') {
      const stmt = this.getStatement(`
        UPDATE series_comments
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(status, targetId);
    } else if (targetType === 'chapter') {
      const stmt = this.getStatement(`
        UPDATE chapters
        SET visibility_status = ?
        WHERE id = ?
      `);
      stmt.run(status, targetId);
    } else if (targetType === 'series') {
      const stmt = this.getStatement(`
        UPDATE series
        SET visibility_status = ?
        WHERE slug = ? OR id = ?
      `);
      stmt.run(status, targetId, targetId);
    } else {
      throw new Error('Tipo de contenido no compatible para cambio de visibilidad.');
    }

    return {
      success: true,
      targetType,
      targetId,
      status,
    };
  }
}
