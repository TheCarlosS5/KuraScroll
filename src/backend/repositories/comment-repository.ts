import { DatabaseInstance } from '../db/database.js';

export interface CommentRecord {
  id: string;
  user_id: string;
  target_type: 'series' | 'chapter';
  target_id: string;
  parent_id: string | null;
  body: string;
  is_edited: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface CommentWithAuthor {
  id: string;
  targetType: 'series' | 'chapter';
  targetId: string;
  parentId: string | null;
  body: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    role: string;
  } | null;
}

export class CommentRepository {
  constructor(private db: DatabaseInstance) {}

  createComment(data: {
    id: string;
    userId: string;
    targetType: 'series' | 'chapter';
    targetId: string;
    parentId?: string | null;
    body: string;
  }): CommentWithAuthor {
    const stmt = this.db.prepare(`
      INSERT INTO comments (
        id, user_id, target_type, target_id, parent_id, body
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.userId,
      data.targetType,
      data.targetId,
      data.parentId ?? null,
      data.body
    );

    const created = this.findByIdWithAuthor(data.id);
    if (!created) {
      throw new Error('No se pudo guardar el comentario.');
    }
    return created;
  }

  findById(id: string): CommentRecord | null {
    const stmt = this.db.prepare('SELECT * FROM comments WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? (row as CommentRecord) : null;
  }

  findByIdWithAuthor(id: string): CommentWithAuthor | null {
    const stmt = this.db.prepare(`
      SELECT c.*, u.id as u_id, u.handle, u.display_name, u.avatar_url, u.role
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.id = ?
    `);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapCommentRow(row);
  }

  findComments(
    targetType: 'series' | 'chapter',
    targetId: string,
    page = 1,
    limit = 50
  ): { items: CommentWithAuthor[]; total: number } {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM comments
      WHERE target_type = ? AND target_id = ?
    `);
    const countRow = countStmt.get(targetType, targetId) as any;
    const total = countRow?.count || 0;

    const queryStmt = this.db.prepare(`
      SELECT c.*, u.id as u_id, u.handle, u.display_name, u.avatar_url, u.role
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.target_type = ? AND c.target_id = ?
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `);
    const rows = queryStmt.all(targetType, targetId, safeLimit, offset) as any[];

    return {
      items: rows.map((r) => this.mapCommentRow(r)),
      total,
    };
  }

  updateComment(id: string, userId: string, newBody: string): CommentWithAuthor | null {
    const existing = this.findById(id);
    if (!existing || existing.user_id !== userId || existing.is_deleted) {
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE comments
      SET body = ?, is_edited = 1, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `);
    stmt.run(newBody, id, userId);

    return this.findByIdWithAuthor(id);
  }

  softDeleteComment(id: string, userId: string, isPrivileged: boolean): boolean {
    const existing = this.findById(id);
    if (!existing) return false;

    if (!isPrivileged && existing.user_id !== userId) {
      return false;
    }

    const stmt = this.db.prepare(`
      UPDATE comments
      SET is_deleted = 1, body = '[Comentario eliminado]', updated_at = datetime('now')
      WHERE id = ?
    `);
    const res = stmt.run(id);
    return Number(res.changes || 0) > 0;
  }

  private mapCommentRow(row: any): CommentWithAuthor {
    const isDeleted = Boolean(row.is_deleted);
    return {
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      parentId: row.parent_id,
      body: isDeleted ? '[Comentario eliminado]' : row.body,
      isEdited: Boolean(row.is_edited),
      isDeleted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      author: row.u_id
        ? {
            id: row.u_id,
            handle: row.handle,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            role: row.role,
          }
        : null,
    };
  }
}
