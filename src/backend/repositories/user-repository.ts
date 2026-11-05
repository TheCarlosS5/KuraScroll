import { DatabaseInstance } from '../db/database.js';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface UserRecord {
  id: string;
  handle: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  email_verified: number;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafeUser {
  id: string;
  handle: string;
  displayName: string;
  role: UserRole;
  emailVerified: boolean;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  seriesCount: number;
}

export class UserRepository {
  constructor(private db: DatabaseInstance) {}

  createUser(user: {
    id: string;
    handle: string;
    email: string;
    displayName: string;
    passwordHash: string;
    role?: UserRole;
    emailVerified?: boolean;
  }): SafeUser {
    const role: UserRole = user.role || 'user';
    const emailVerified = user.emailVerified ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO users (
        id, handle, email, display_name, password_hash, role, email_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      user.id,
      user.handle.toLowerCase().trim(),
      user.email.toLowerCase().trim(),
      user.displayName.trim(),
      user.passwordHash,
      role,
      emailVerified
    );

    const created = this.findById(user.id);
    if (!created) {
      throw new Error('Failed to retrieve newly created user');
    }
    return this.toSafeUser(created);
  }

  findById(id: string): UserRecord | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? (row as UserRecord) : null;
  }

  findByHandle(handle: string): UserRecord | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE handle = ?');
    const row = stmt.get(handle.toLowerCase().trim()) as any;
    return row ? (row as UserRecord) : null;
  }

  findByEmail(email: string): UserRecord | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email.toLowerCase().trim()) as any;
    return row ? (row as UserRecord) : null;
  }

  findByLogin(login: string): UserRecord | null {
    const normalized = login.toLowerCase().trim();
    const stmt = this.db.prepare('SELECT * FROM users WHERE handle = ? OR email = ?');
    const row = stmt.get(normalized, normalized) as any;
    return row ? (row as UserRecord) : null;
  }

  updateProfile(userId: string, data: { displayName?: string; bio?: string; avatarUrl?: string }): SafeUser | null {
    const existing = this.findById(userId);
    if (!existing) return null;

    const newDisplayName = data.displayName !== undefined ? data.displayName.trim() : existing.display_name;
    const newBio = data.bio !== undefined ? (data.bio ? data.bio.trim() : null) : existing.bio;
    const newAvatar = data.avatarUrl !== undefined ? data.avatarUrl : existing.avatar_url;

    const stmt = this.db.prepare(`
      UPDATE users
      SET display_name = ?, bio = ?, avatar_url = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(newDisplayName, newBio, newAvatar, userId);

    const updated = this.findById(userId);
    return updated ? this.toSafeUser(updated) : null;
  }

  setEmailVerified(userId: string, verified: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE users
      SET email_verified = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(verified ? 1 : 0, userId);
  }

  updateRole(userId: string, role: UserRole): void {
    const stmt = this.db.prepare(`
      UPDATE users
      SET role = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(role, userId);
  }

  getPublicProfile(handle: string): PublicProfile | null {
    const user = this.findByHandle(handle);
    if (!user) return null;

    let seriesCount = 0;
    try {
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM series
        WHERE uploader_user_id = ? AND visibility = 'published'
      `);
      const res = countStmt.get(user.id) as any;
      seriesCount = res?.count || 0;
    } catch {
      // Table may not have uploader_user_id yet
      seriesCount = 0;
    }

    return {
      id: user.id,
      handle: user.handle,
      displayName: user.display_name,
      role: user.role,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      createdAt: user.created_at,
      seriesCount,
    };
  }

  toSafeUser(user: UserRecord): SafeUser {
    return {
      id: user.id,
      handle: user.handle,
      displayName: user.display_name,
      role: user.role,
      emailVerified: Boolean(user.email_verified),
      avatarUrl: user.avatar_url,
      bio: user.bio,
      createdAt: user.created_at,
    };
  }
}
