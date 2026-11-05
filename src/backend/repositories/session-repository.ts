import { DatabaseInstance } from '../db/database.js';
import { SafeUser, UserRepository } from './user-repository.js';

export interface SessionRecord {
  id: string;
  token_hash: string;
  user_id: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export class SessionRepository {
  private userRepo: UserRepository;

  constructor(private db: DatabaseInstance) {
    this.userRepo = new UserRepository(db);
  }

  createSession(data: {
    id: string;
    tokenHash: string;
    userId: string;
    expiresAt: string;
    ipAddress?: string;
    userAgent?: string;
  }): SessionRecord {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, token_hash, user_id, expires_at, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.tokenHash,
      data.userId,
      data.expiresAt,
      data.ipAddress ?? null,
      data.userAgent ?? null
    );

    const created = this.findByTokenHash(data.tokenHash);
    if (!created) {
      throw new Error('Failed to create session');
    }
    return created;
  }

  findByTokenHash(tokenHash: string): SessionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE token_hash = ?');
    const row = stmt.get(tokenHash) as any;
    return row ? (row as SessionRecord) : null;
  }

  findValidSessionWithUser(tokenHash: string): { session: SessionRecord; user: SafeUser } | null {
    const stmt = this.db.prepare(`
      SELECT s.*, u.id as u_id, u.handle, u.email, u.display_name, u.role, u.email_verified, u.avatar_url, u.bio, u.created_at as u_created_at, u.updated_at as u_updated_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND julianday(s.expires_at) > julianday('now')
    `);

    const row = stmt.get(tokenHash) as any;
    if (!row) return null;

    const session: SessionRecord = {
      id: row.id,
      token_hash: row.token_hash,
      user_id: row.user_id,
      expires_at: row.expires_at,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
    };

    const user: SafeUser = {
      id: row.u_id,
      handle: row.handle,
      displayName: row.display_name,
      role: row.role,
      emailVerified: Boolean(row.email_verified),
      avatarUrl: row.avatar_url,
      bio: row.bio,
      createdAt: row.u_created_at,
    };

    return { session, user };
  }

  revokeSession(tokenHash: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token_hash = ?');
    stmt.run(tokenHash);
  }

  revokeAllUserSessions(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE user_id = ?');
    stmt.run(userId);
  }

  cleanExpiredSessions(): number {
    const stmt = this.db.prepare("DELETE FROM sessions WHERE julianday(expires_at) <= julianday('now')");
    const result = stmt.run();
    return Number(result.changes || 0);
  }
}
