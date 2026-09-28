import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  createOpaqueToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
  hashSessionToken as hashOpaqueToken,
  type AuthUser
} from "./auth.js";

type UserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  created_at: number;
  email_verified_at: number | null;
};

export type AuthSessionInfo = {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  current: boolean;
};

export type AuthTokenRequest = {
  userId: string;
  email: string;
  name: string | null;
  token: string;
  expiresAt: number;
};

export class AuthStore {
  private readonly db: Database.Database;

  constructor(
    path: string,
    private readonly sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000,
    private readonly verificationLifetimeMs = 24 * 60 * 60 * 1000,
    private readonly passwordResetLifetimeMs = 30 * 60 * 1000
  ) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        email_verified_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );

      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
        ON auth_sessions(user_id);

      CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
        ON auth_sessions(expires_at);

      CREATE INDEX IF NOT EXISTS idx_email_verification_user
        ON email_verification_tokens(user_id);

      CREATE INDEX IF NOT EXISTS idx_password_reset_user
        ON password_reset_tokens(user_id);
    `);

    const userColumns = this.db
      .prepare("PRAGMA table_info(users)")
      .all() as Array<{ name: string }>;

    if (!userColumns.some((column) => column.name === "email_verified_at")) {
      this.db.exec("ALTER TABLE users ADD COLUMN email_verified_at INTEGER");
      this.db.exec(
        "UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL"
      );
    }

    const sessionColumns = this.db
      .prepare("PRAGMA table_info(auth_sessions)")
      .all() as Array<{ name: string }>;

    if (!sessionColumns.some((column) => column.name === "session_id")) {
      this.db.exec("ALTER TABLE auth_sessions ADD COLUMN session_id TEXT");
    }

    const sessionsMissingIds = this.db
      .prepare("SELECT token_hash FROM auth_sessions WHERE session_id IS NULL")
      .all() as Array<{ token_hash: string }>;

    const assignSessionId = this.db.prepare(
      "UPDATE auth_sessions SET session_id = ? WHERE token_hash = ?"
    );

    const assignMissingSessionIds = this.db.transaction(() => {
      for (const row of sessionsMissingIds) {
        assignSessionId.run(randomUUID(), row.token_hash);
      }
    });
    assignMissingSessionIds();

    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_session_id
        ON auth_sessions(session_id);
    `);

    this.db
      .prepare("DELETE FROM email_verification_tokens WHERE expires_at <= ? OR used_at IS NOT NULL")
      .run(Date.now());

    this.db
      .prepare("DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL")
      .run(Date.now());
  }

  createUser(email: string, password: string, name: string | null): AuthUser {
    const normalizedEmail = normalizeEmail(email);
    const id = randomUUID();
    const createdAt = Date.now();

    this.db
      .prepare(`
        INSERT INTO users
          (user_id, email, display_name, password_hash, created_at, email_verified_at)
        VALUES (?, ?, ?, ?, ?, NULL)
      `)
      .run(
        id,
        normalizedEmail,
        name?.trim() || null,
        hashPassword(password),
        createdAt
      );

    return {
      id,
      email: normalizedEmail,
      name: name?.trim() || null,
      createdAt,
      emailVerified: false
    };
  }

  findUserByEmail(email: string): AuthUser | null {
    const row = this.getUserRowByEmail(email);
    return row ? this.toUser(row) : null;
  }

  verifyCredentials(email: string, password: string): AuthUser | null {
    const row = this.getUserRowByEmail(email);

    if (!row || !verifyPassword(password, row.password_hash)) {
      return null;
    }

    return this.toUser(row);
  }

  createSession(userId: string, now = Date.now()): {
    sessionId: string;
    token: string;
    expiresAt: number;
  } {
    const token = createOpaqueToken();
    const sessionId = randomUUID();
    const expiresAt = now + this.sessionLifetimeMs;

    this.db
      .prepare(`
        INSERT INTO auth_sessions
          (token_hash, session_id, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(hashSessionToken(token), sessionId, userId, now, expiresAt);

    return { sessionId, token, expiresAt };
  }

  getSessionByToken(token: string, now = Date.now()): {
    sessionId: string;
    user: AuthUser;
    createdAt: number;
    expiresAt: number;
  } | null {
    const row = this.db
      .prepare(`
        SELECT
          s.session_id,
          s.created_at AS session_created_at,
          s.expires_at,
          u.user_id,
          u.email,
          u.display_name,
          u.password_hash,
          u.created_at,
          u.email_verified_at
        FROM auth_sessions s
        INNER JOIN users u ON u.user_id = s.user_id
        WHERE s.token_hash = ?
          AND s.revoked_at IS NULL
          AND s.expires_at > ?
      `)
      .get(hashSessionToken(token), now) as
      | {
          session_id: string;
          session_created_at: number;
          expires_at: number;
          user_id: string;
          email: string;
          display_name: string | null;
          password_hash: string;
          created_at: number;
          email_verified_at: number | null;
        }
      | undefined;

    if (!row) return null;

    return {
      sessionId: row.session_id,
      user: this.toUser(row),
      createdAt: row.session_created_at,
      expiresAt: row.expires_at
    };
  }

  getUserBySessionToken(token: string, now = Date.now()): AuthUser | null {
    return this.getSessionByToken(token, now)?.user ?? null;
  }

  listSessions(
    userId: string,
    currentSessionId: string | null,
    now = Date.now()
  ): AuthSessionInfo[] {
    const rows = this.db
      .prepare(`
        SELECT session_id, created_at, expires_at
        FROM auth_sessions
        WHERE user_id = ?
          AND revoked_at IS NULL
          AND expires_at > ?
        ORDER BY created_at DESC
      `)
      .all(userId, now) as Array<{
        session_id: string;
        created_at: number;
        expires_at: number;
      }>;

    return rows.map((row) => ({
      sessionId: row.session_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      current: row.session_id === currentSessionId
    }));
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

  revokeSessionById(userId: string, sessionId: string, now = Date.now()): void {
    this.db
      .prepare(`
        UPDATE auth_sessions
        SET revoked_at = ?
        WHERE user_id = ? AND session_id = ? AND revoked_at IS NULL
      `)
      .run(now, userId, sessionId);
  }

  revokeOtherSessions(userId: string, currentSessionId: string, now = Date.now()): void {
    this.db
      .prepare(`
        UPDATE auth_sessions
        SET revoked_at = ?
        WHERE user_id = ?
          AND session_id <> ?
          AND revoked_at IS NULL
      `)
      .run(now, userId, currentSessionId);
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

  createEmailVerificationToken(
    userId: string,
    now = Date.now()
  ): AuthTokenRequest {
    const row = this.getUserRowById(userId);
    if (!row) throw new Error("USER_NOT_FOUND");

    this.db
      .prepare("DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL")
      .run(userId);

    const token = createOpaqueToken();
    const expiresAt = now + this.verificationLifetimeMs;

    this.db
      .prepare(`
        INSERT INTO email_verification_tokens
          (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(hashOpaqueToken(token), userId, now, expiresAt);

    return {
      userId,
      email: row.email,
      name: row.display_name,
      token,
      expiresAt
    };
  }

  consumeEmailVerificationToken(token: string, now = Date.now()): AuthUser | null {
    const row = this.db
      .prepare(`
        SELECT u.user_id, u.email, u.display_name, u.password_hash, u.created_at, u.email_verified_at
        FROM email_verification_tokens t
        INNER JOIN users u ON u.user_id = t.user_id
        WHERE t.token_hash = ?
          AND t.used_at IS NULL
          AND t.expires_at > ?
      `)
      .get(hashOpaqueToken(token), now) as UserRow | undefined;

    if (!row) return null;

    this.db
      .prepare("UPDATE email_verification_tokens SET used_at = ? WHERE token_hash = ?")
      .run(now, hashOpaqueToken(token));

    this.db
      .prepare("UPDATE users SET email_verified_at = ? WHERE user_id = ?")
      .run(now, row.user_id);

    return this.toUser({
      ...row,
      email_verified_at: now
    });
  }

  createPasswordResetToken(
    email: string,
    now = Date.now()
  ): AuthTokenRequest | null {
    const row = this.getUserRowByEmail(email);
    if (!row) return null;

    this.db
      .prepare("DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL")
      .run(row.user_id);

    const token = createOpaqueToken();
    const expiresAt = now + this.passwordResetLifetimeMs;

    this.db
      .prepare(`
        INSERT INTO password_reset_tokens
          (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(hashOpaqueToken(token), row.user_id, now, expiresAt);

    return {
      userId: row.user_id,
      email: row.email,
      name: row.display_name,
      token,
      expiresAt
    };
  }

  resetPassword(
    token: string,
    newPassword: string,
    now = Date.now()
  ): AuthUser | null {
    const row = this.db
      .prepare(`
        SELECT u.user_id, u.email, u.display_name, u.password_hash, u.created_at, u.email_verified_at
        FROM password_reset_tokens t
        INNER JOIN users u ON u.user_id = t.user_id
        WHERE t.token_hash = ?
          AND t.used_at IS NULL
          AND t.expires_at > ?
      `)
      .get(hashOpaqueToken(token), now) as UserRow | undefined;

    if (!row) return null;

    this.db
      .prepare("UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?")
      .run(now, hashOpaqueToken(token));

    this.db
      .prepare("UPDATE users SET password_hash = ? WHERE user_id = ?")
      .run(hashPassword(newPassword), row.user_id);

    this.revokeAllSessionsForUser(row.user_id, now);

    return this.toUser(row);
  }

  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    now = Date.now()
  ): boolean {
    const row = this.getUserRowById(userId);
    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      return false;
    }

    this.db
      .prepare("UPDATE users SET password_hash = ? WHERE user_id = ?")
      .run(hashPassword(newPassword), userId);

    this.revokeAllSessionsForUser(userId, now);
    return true;
  }

  purgeExpiredSessions(now = Date.now()): void {
    this.db
      .prepare("DELETE FROM auth_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL")
      .run(now);
  }

  close(): void {
    this.db.close();
  }

  private getUserRowByEmail(email: string): UserRow | undefined {
    return this.db
      .prepare(`
        SELECT user_id, email, display_name, password_hash, created_at, email_verified_at
        FROM users
        WHERE email = ?
      `)
      .get(normalizeEmail(email)) as UserRow | undefined;
  }

  private getUserRowById(userId: string): UserRow | undefined {
    return this.db
      .prepare(`
        SELECT user_id, email, display_name, password_hash, created_at, email_verified_at
        FROM users
        WHERE user_id = ?
      `)
      .get(userId) as UserRow | undefined;
  }

  private toUser(row: UserRow | {
    user_id: string;
    email: string;
    display_name: string | null;
    created_at: number;
    email_verified_at: number | null;
  }): AuthUser {
    return {
      id: row.user_id,
      email: row.email,
      name: row.display_name,
      createdAt: row.created_at,
      emailVerified: row.email_verified_at != null
    };
  }
}
