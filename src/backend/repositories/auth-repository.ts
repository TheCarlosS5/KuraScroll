import { DatabaseInstance, Statement } from '../db/database.js';

export interface UserRecord {
  id: string;
  emailNormalized: string;
  handle: string;
  passwordHash: string;
  role: 'user' | 'admin';
  emailVerifiedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface EmailActionTokenRecord {
  tokenHash: string;
  userId: string;
  actionType: 'verify_email' | 'reset_password';
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

export interface CreateUserInput {
  id: string;
  emailNormalized: string;
  handle: string;
  passwordHash: string;
  role?: 'user' | 'admin';
  emailVerifiedAt?: string | null;
}

export interface CreateSessionInput {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

export interface CreateActionTokenInput {
  tokenHash: string;
  userId: string;
  actionType: 'verify_email' | 'reset_password';
  expiresAt: string;
}

export interface ClaimLegacyDataResult {
  claimedTables: Record<string, number>;
  totalRowsUpdated: number;
}

export class AuthRepository {
  private statements = new Map<string, Statement>();

  constructor(private db: DatabaseInstance) {}

  private getStatement(sql: string): Statement {
    let stmt = this.statements.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.statements.set(sql, stmt);
    }
    return stmt;
  }

  private mapUserRow(row: any): UserRecord {
    return {
      id: String(row.id),
      emailNormalized: String(row.email_normalized),
      handle: String(row.handle),
      passwordHash: String(row.password_hash),
      role: row.role as 'user' | 'admin',
      emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
      disabledAt: row.disabled_at ? String(row.disabled_at) : null,
      createdAt: String(row.created_at),
    };
  }

  private mapSessionRow(row: any): SessionRecord {
    return {
      tokenHash: String(row.token_hash),
      userId: String(row.user_id),
      expiresAt: String(row.expires_at),
      revokedAt: row.revoked_at ? String(row.revoked_at) : null,
      createdAt: String(row.created_at),
    };
  }

  private mapActionTokenRow(row: any): EmailActionTokenRecord {
    return {
      tokenHash: String(row.token_hash),
      userId: String(row.user_id),
      actionType: row.action_type as 'verify_email' | 'reset_password',
      expiresAt: String(row.expires_at),
      consumedAt: row.consumed_at ? String(row.consumed_at) : null,
      createdAt: String(row.created_at),
    };
  }

  public createUser(input: CreateUserInput): UserRecord {
    const role = input.role ?? 'user';
    const emailVerifiedAt = input.emailVerifiedAt ?? null;
    const stmt = this.getStatement(`
      INSERT INTO users (id, email_normalized, handle, password_hash, role, email_verified_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      input.id,
      input.emailNormalized,
      input.handle,
      input.passwordHash,
      role,
      emailVerifiedAt
    );

    const created = this.findUserById(input.id);
    if (!created) {
      throw new Error(`Failed to retrieve newly created user: ${input.id}`);
    }
    return created;
  }

  public findUserByEmail(emailNormalized: string): UserRecord | null {
    const stmt = this.getStatement(`
      SELECT id, email_normalized, handle, password_hash, role, email_verified_at, disabled_at, created_at
      FROM users
      WHERE email_normalized = ?
    `);
    const row = stmt.get(emailNormalized);
    return row ? this.mapUserRow(row) : null;
  }

  public findUserByHandle(handle: string): UserRecord | null {
    const stmt = this.getStatement(`
      SELECT id, email_normalized, handle, password_hash, role, email_verified_at, disabled_at, created_at
      FROM users
      WHERE handle = ?
    `);
    const row = stmt.get(handle);
    return row ? this.mapUserRow(row) : null;
  }

  public findUserById(id: string): UserRecord | null {
    const stmt = this.getStatement(`
      SELECT id, email_normalized, handle, password_hash, role, email_verified_at, disabled_at, created_at
      FROM users
      WHERE id = ?
    `);
    const row = stmt.get(id);
    return row ? this.mapUserRow(row) : null;
  }

  public createSession(input: CreateSessionInput): SessionRecord {
    const stmt = this.getStatement(`
      INSERT INTO auth_sessions (token_hash, user_id, expires_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(input.tokenHash, input.userId, input.expiresAt);

    const session = this.findSessionByTokenHash(input.tokenHash);
    if (!session) {
      throw new Error(`Failed to retrieve newly created session`);
    }
    return session;
  }

  public findSessionByTokenHash(tokenHash: string): SessionRecord | null {
    const stmt = this.getStatement(`
      SELECT token_hash, user_id, expires_at, revoked_at, created_at
      FROM auth_sessions
      WHERE token_hash = ?
    `);
    const row = stmt.get(tokenHash);
    return row ? this.mapSessionRow(row) : null;
  }

  public revokeSession(tokenHash: string): boolean {
    const stmt = this.getStatement(`
      UPDATE auth_sessions
      SET revoked_at = datetime('now')
      WHERE token_hash = ? AND revoked_at IS NULL
    `);
    const result = stmt.run(tokenHash) as { changes: number };
    return result.changes > 0;
  }

  public revokeAllUserSessions(userId: string): number {
    const stmt = this.getStatement(`
      UPDATE auth_sessions
      SET revoked_at = datetime('now')
      WHERE user_id = ? AND revoked_at IS NULL
    `);
    const result = stmt.run(userId) as { changes: number };
    return result.changes;
  }

  public createActionToken(input: CreateActionTokenInput): EmailActionTokenRecord {
    const stmt = this.getStatement(`
      INSERT INTO email_action_tokens (token_hash, user_id, action_type, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(input.tokenHash, input.userId, input.actionType, input.expiresAt);

    const token = this.findActionTokenByHash(input.tokenHash);
    if (!token) {
      throw new Error(`Failed to retrieve newly created email action token`);
    }
    return token;
  }

  public findActionTokenByHash(tokenHash: string): EmailActionTokenRecord | null {
    const stmt = this.getStatement(`
      SELECT token_hash, user_id, action_type, expires_at, consumed_at, created_at
      FROM email_action_tokens
      WHERE token_hash = ?
    `);
    const row = stmt.get(tokenHash);
    return row ? this.mapActionTokenRow(row) : null;
  }

  public consumeActionToken(tokenHash: string): boolean {
    const stmt = this.getStatement(`
      UPDATE email_action_tokens
      SET consumed_at = datetime('now')
      WHERE token_hash = ? AND consumed_at IS NULL
    `);
    const result = stmt.run(tokenHash) as { changes: number };
    return result.changes > 0;
  }

  public updatePassword(userId: string, passwordHash: string): boolean {
    const stmt = this.getStatement(`
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `);
    const result = stmt.run(passwordHash, userId) as { changes: number };
    return result.changes > 0;
  }

  public verifyUserEmail(userId: string): boolean {
    const stmt = this.getStatement(`
      UPDATE users
      SET email_verified_at = datetime('now')
      WHERE id = ? AND email_verified_at IS NULL
    `);
    const result = stmt.run(userId) as { changes: number };
    return result.changes > 0;
  }

  /**
   * Explicitly claim legacy 'local_user' progress, reading habit, and preference records
   * for an administrator user. Does not run automatically.
   */
  public claimLegacyDataForAdmin(adminUserId: string): ClaimLegacyDataResult {
    const admin = this.findUserById(adminUserId);
    if (!admin) {
      throw new Error(`Admin user ${adminUserId} not found`);
    }

    const candidateTables = [
      'user_progress',
      'user_reading_streaks',
      'user_reading_goals',
      'user_daily_activity',
      'user_badges',
      'user_bookmarks',
      'user_preferences',
      'user_genre_read_stats',
      'applied_mutations',
      'offline_storage_vault',
      'reading_ruler_preferences',
      'user_soundscape_preferences',
    ];

    const claimedTables: Record<string, number> = {};
    let totalRowsUpdated = 0;

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of candidateTables) {
        // Verify table exists in SQLite catalog
        const checkTableStmt = this.getStatement(`
          SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
        `);
        const tableExists = checkTableStmt.get(table);
        if (!tableExists) {
          continue;
        }

        // UPDATE OR IGNORE handles conflicts with existing rows for adminUserId
        const updateStmt = this.getStatement(`
          UPDATE OR IGNORE ${table}
          SET user_id = ?
          WHERE user_id = 'local_user'
        `);
        const result = updateStmt.run(adminUserId) as { changes: number };
        claimedTables[table] = result.changes;
        totalRowsUpdated += result.changes;
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return {
      claimedTables,
      totalRowsUpdated,
    };
  }
}
