import { DatabaseInstance } from '../db/database.js';

export interface VerificationCodeRecord {
  id: number;
  user_id: string;
  code_hash: string;
  expires_at: string;
  used: number;
  attempts: number;
  created_at: string;
}

export class VerificationCodeRepository {
  constructor(private db: DatabaseInstance) {}

  createCode(userId: string, codeHash: string, expiresAt: string): void {
    // Invalidate existing unused codes for this user
    this.db.prepare(`
      UPDATE email_verification_codes
      SET used = 1
      WHERE user_id = ? AND used = 0
    `).run(userId);

    const stmt = this.db.prepare(`
      INSERT INTO email_verification_codes (
        user_id, code_hash, expires_at
      ) VALUES (?, ?, ?)
    `);
    stmt.run(userId, codeHash, expiresAt);
  }

  findActiveCode(userId: string): VerificationCodeRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM email_verification_codes
      WHERE user_id = ? AND used = 0 AND julianday(expires_at) > julianday('now')
      ORDER BY id DESC
      LIMIT 1
    `);
    const row = stmt.get(userId) as any;
    return row ? (row as VerificationCodeRecord) : null;
  }

  incrementAttempts(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE email_verification_codes
      SET attempts = attempts + 1
      WHERE id = ?
    `);
    stmt.run(id);
  }

  markUsed(id: number): void {
    const stmt = this.db.prepare(`
      UPDATE email_verification_codes
      SET used = 1
      WHERE id = ?
    `);
    stmt.run(id);
  }

  cleanExpired(): number {
    const stmt = this.db.prepare("DELETE FROM email_verification_codes WHERE julianday(expires_at) <= julianday('now') OR used = 1");
    const result = stmt.run();
    return Number(result.changes || 0);
  }
}
