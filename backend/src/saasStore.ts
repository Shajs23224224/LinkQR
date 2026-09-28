import Database from "better-sqlite3";
import { hashSessionToken } from "./auth.js";
import type { SaaSPlan, User, Workspace, WorkspaceQrRecord } from "./saas.js";

export class SaaSStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        workspace_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plan TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        owner_user_id TEXT REFERENCES users(user_id)
      );

      CREATE TABLE IF NOT EXISTS workspace_qr_records (
        workspace_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        is_favorite INTEGER NOT NULL,
        foreground_color TEXT NOT NULL,
        background_color TEXT NOT NULL,
        margin_modules INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, record_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
      );

      CREATE INDEX IF NOT EXISTS idx_workspace_qr_created_at
        ON workspace_qr_records(workspace_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id
        ON sessions(user_id);
    `);

    const columns = this.db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "owner_user_id")) {
      this.db.exec("ALTER TABLE workspaces ADD COLUMN owner_user_id TEXT REFERENCES users(user_id)");
    }
  }

  createUser(user: User): void {
    this.db.prepare(`
      INSERT INTO users (user_id, email, name, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.email, user.name, user.passwordHash, user.createdAt);
  }

  getUserByEmail(email: string): User | null {
    const row = this.db.prepare(`
      SELECT user_id, email, name, password_hash, created_at
      FROM users WHERE email = ?
    `).get(email) as { user_id: string; email: string; name: string; password_hash: string; created_at: number } | undefined;
    return row ? this.toUser(row) : null;
  }

  getUser(userId: string): User | null {
    const row = this.db.prepare(`
      SELECT user_id, email, name, password_hash, created_at
      FROM users WHERE user_id = ?
    `).get(userId) as { user_id: string; email: string; name: string; password_hash: string; created_at: number } | undefined;
    return row ? this.toUser(row) : null;
  }

  createSession(token: string, userId: string, expiresAt: number): void {
    this.db.prepare(`
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(hashSessionToken(token), userId, expiresAt, Date.now());
  }

  getSessionUser(token: string): User | null {
    const row = this.db.prepare(`
      SELECT u.user_id, u.email, u.name, u.password_hash, u.created_at
      FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?
    `).get(hashSessionToken(token), Date.now()) as { user_id: string; email: string; name: string; password_hash: string; created_at: number } | undefined;
    return row ? this.toUser(row) : null;
  }

  deleteSession(token: string): void {
    this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
  }

  createWorkspace(workspace: Workspace): void {
    this.db.prepare(`
      INSERT INTO workspaces (workspace_id, name, plan, created_at, owner_user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(workspace.id, workspace.name, workspace.plan, workspace.createdAt, workspace.ownerUserId);
  }

  getWorkspace(workspaceId: string): Workspace | null {
    const row = this.db.prepare(`
      SELECT workspace_id, name, plan, created_at, owner_user_id
      FROM workspaces WHERE workspace_id = ?
    `).get(workspaceId) as { workspace_id: string; name: string; plan: SaaSPlan; created_at: number; owner_user_id: string | null } | undefined;
    return row ? {
      id: row.workspace_id, name: row.name, plan: row.plan,
      createdAt: row.created_at, ownerUserId: row.owner_user_id
    } : null;
  }

  countQrRecords(workspaceId: string): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM workspace_qr_records WHERE workspace_id = ?").get(workspaceId) as { count: number };
    return row.count;
  }

  hasQrRecord(workspaceId: string, recordId: string): boolean {
    const row = this.db.prepare("SELECT 1 AS present FROM workspace_qr_records WHERE workspace_id = ? AND record_id = ?").get(workspaceId, recordId) as { present?: number } | undefined;
    return row?.present === 1;
  }

  upsertQrRecord(record: WorkspaceQrRecord): void {
    this.db.prepare(`
      INSERT INTO workspace_qr_records
        (workspace_id, record_id, type, payload, created_at, is_favorite, foreground_color, background_color, margin_modules)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, record_id) DO UPDATE SET
        type = excluded.type, payload = excluded.payload, created_at = excluded.created_at,
        is_favorite = excluded.is_favorite, foreground_color = excluded.foreground_color,
        background_color = excluded.background_color, margin_modules = excluded.margin_modules
    `).run(
      record.workspaceId, record.recordId, record.type, record.payload, record.createdAt,
      record.isFavorite ? 1 : 0, record.foregroundColor, record.backgroundColor, record.marginModules
    );
  }

  listQrRecords(workspaceId: string): WorkspaceQrRecord[] {
    const rows = this.db.prepare(`
      SELECT workspace_id, record_id, type, payload, created_at, is_favorite,
             foreground_color, background_color, margin_modules
      FROM workspace_qr_records WHERE workspace_id = ? ORDER BY created_at DESC
    `).all(workspaceId) as Array<{
      workspace_id: string; record_id: string; type: string; payload: string; created_at: number;
      is_favorite: number; foreground_color: string; background_color: string; margin_modules: number;
    }>;
    return rows.map((row) => ({
      workspaceId: row.workspace_id, recordId: row.record_id, type: row.type, payload: row.payload,
      createdAt: row.created_at, isFavorite: row.is_favorite === 1,
      foregroundColor: row.foreground_color, backgroundColor: row.background_color,
      marginModules: row.margin_modules
    }));
  }

  close(): void {
    this.db.close();
  }

  private toUser(row: { user_id: string; email: string; name: string; password_hash: string; created_at: number }): User {
    return { id: row.user_id, email: row.email, name: row.name, passwordHash: row.password_hash, createdAt: row.created_at };
  }
}
