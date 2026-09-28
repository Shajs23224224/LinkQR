import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
  type AuthUser
} from "./auth.js";

type UserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  created_at: number;
};

export class AuthStore {
  private readonly db: Database.Database;

  constructor(
    path: string,
    private readonly sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
  ) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
        ON auth_sessions(user_id);

      CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
        ON auth_sessions(expires_at);
    `);
  }

  createUser(email: string, password: string, name: string | null): AuthUser {
    const normalizedEmail = normalizeEmail(email);
    const id = randomUUID();
    const createdAt = Date.now();

    this.db
      .prepare(`
        INSERT INTO users
          (user_id, email, display_name, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        id,
        normalizedEmail,
        name?.trim() || null,
        hashPassword(password),
        createdAt
      );

    return { id, email: normalizedEmail, name: name?.trim() || null, createdAt };
  }

  findUserByEmail(email: string): AuthUser | null {
    const row = this.db
      .prepare(`
        SELECT user_id, email, display_name, password_hash, created_at
        FROM users
        WHERE email = ?
      `)
      .get(normalizeEmail(email)) as UserRow | undefined;

    return row ? this.toUser(row) : null;
  }

  verifyCredentials(email: string, password: string): AuthUser | null {
    const row = this.db
      .prepare(`
        SELECT user_id, email, display_name, password_hash, created_at
        FROM users
        WHERE email = ?
      `)
      .get(normalizeEmail(email)) as UserRow | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) return null;
    return this.toUser(row);
  }

  createSession(userId: string, now = Date.now()): {
    token: string;
    expiresAt: number;
  } {
    const token = randomUUID() + "." + randomUUID();
    const expiresAt = now + this.sessionLifetimeMs;

    this.db
      .prepare(`
        INSERT INTO auth_sessions
          (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(hashSessionToken(token), userId, now, expiresAt);

    return { token, expiresAt };
  }

  getUserBySessionToken(token: string, now = Date.now()): AuthUser | null {
    const row = this.db
      .prepare(`
        SELECT u.user_id, u.email, u.display_name, u.password_hash, u.created_at
        FROM auth_sessions s
        INNER JOIN users u ON u.user_id = s.user_id
        WHERE s.token_hash = ?
          AND s.revoked_at IS NULL
          AND s.expires_at > ?
      `)
      .get(hashSessionToken(token), now) as UserRow | undefined;

    return row ? this.toUser(row) : null;
  }

  revokeSession(token: string, now = Date.now()): void {
    this.db
      .prepare(`
        UPDATE auth_sessions
        SET revoked_at = ?
        WHERE token_hash = ? AND revoked_at IS NULL
      `)
      .run(now, hashSessionToken(token));
  }

  revokeAllSessionsForUser(userId: string, now = Date.now()): void {
    this.db
      .prepare(`
        UPDATE auth_sessions
        SET revoked_at = ?
        WHERE user_id = ? AND revoked_at IS NULL
      `)
      .run(now, userId);
  }

  purgeExpiredSessions(now = Date.now()): void {
    this.db
      .prepare("DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL")
      .run(now);
  }

  close(): void {
    this.db.close();
  }

  private toUser(row: UserRow): AuthUser {
    return {
      id: row.user_id,
      email: row.email,
      name: row.display_name,
      createdAt: row.created_at
    };
  }
}
