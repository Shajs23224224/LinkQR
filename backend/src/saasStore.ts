import Database from "better-sqlite3";
import type { SaaSPlan, Workspace, WorkspaceQrRecord } from "./saas.js";

export class SaaSStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        workspace_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plan TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        owner_user_id TEXT
      );

      CREATE TABLE IF NOT EXISTS workspace_qr_records (
        workspace_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT 0,
        is_favorite INTEGER NOT NULL,
        foreground_color TEXT NOT NULL,
        background_color TEXT NOT NULL,
        margin_modules INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, record_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
      );

      CREATE INDEX IF NOT EXISTS idx_workspace_qr_created_at
        ON workspace_qr_records(workspace_id, created_at DESC);
    `);

    const columns = this.db
      .prepare("PRAGMA table_info(workspaces)")
      .all() as Array<{ name: string }>;

    if (!columns.some((column) => column.name === "owner_user_id")) {
      this.db.exec("ALTER TABLE workspaces ADD COLUMN owner_user_id TEXT");
    }

    const qrColumns = this.db
      .prepare("PRAGMA table_info(workspace_qr_records)")
      .all() as Array<{ name: string }>;

    if (!qrColumns.some((column) => column.name === "updated_at")) {
      this.db.exec("ALTER TABLE workspace_qr_records ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0");
      this.db.exec("UPDATE workspace_qr_records SET updated_at = created_at WHERE updated_at = 0");
    }

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workspace_owner
        ON workspaces(owner_user_id);
    `);
  }

  createWorkspace(workspace: Workspace): void {
    this.db
      .prepare(`
        INSERT INTO workspaces
          (workspace_id, name, plan, created_at, owner_user_id)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        workspace.id,
        workspace.name,
        workspace.plan,
        workspace.createdAt,
        workspace.ownerUserId ?? null
      );
  }

  getWorkspace(workspaceId: string): Workspace | null {
    const row = this.db
      .prepare(`
        SELECT workspace_id, name, plan, created_at, owner_user_id
        FROM workspaces
        WHERE workspace_id = ?
      `)
      .get(workspaceId) as
      | {
          workspace_id: string;
          name: string;
          plan: SaaSPlan;
          created_at: number;
          owner_user_id: string | null;
        }
      | undefined;

    return row ? this.toWorkspace(row) : null;
  }

  getWorkspaceForUser(workspaceId: string, userId: string): Workspace | null {
    const row = this.db
      .prepare(`
        SELECT workspace_id, name, plan, created_at, owner_user_id
        FROM workspaces
        WHERE workspace_id = ? AND owner_user_id = ?
      `)
      .get(workspaceId, userId) as
      | {
          workspace_id: string;
          name: string;
          plan: SaaSPlan;
          created_at: number;
          owner_user_id: string | null;
        }
      | undefined;

    return row ? this.toWorkspace(row) : null;
  }

  listWorkspacesForUser(userId: string): Workspace[] {
    const rows = this.db
      .prepare(`
        SELECT workspace_id, name, plan, created_at, owner_user_id
        FROM workspaces
        WHERE owner_user_id = ?
        ORDER BY created_at DESC
      `)
      .all(userId) as Array<{
        workspace_id: string;
        name: string;
        plan: SaaSPlan;
        created_at: number;
        owner_user_id: string | null;
      }>;

    return rows.map((row) => this.toWorkspace(row));
  }

  countQrRecords(workspaceId: string): number {
    const row = this.db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM workspace_qr_records
        WHERE workspace_id = ?
      `)
      .get(workspaceId) as { count: number };

    return row.count;
  }

  hasQrRecord(workspaceId: string, recordId: string): boolean {
    const row = this.db
      .prepare(`
        SELECT 1 AS present
        FROM workspace_qr_records
        WHERE workspace_id = ? AND record_id = ?
      `)
      .get(workspaceId, recordId) as { present?: number } | undefined;

    return row?.present === 1;
  }

  upsertQrRecord(record: WorkspaceQrRecord): void {
    this.db
      .prepare(`
        INSERT INTO workspace_qr_records
          (
            workspace_id,
            record_id,
            type,
            payload,
            created_at,
            updated_at,
            is_favorite,
            foreground_color,
            background_color,
            margin_modules
          )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id, record_id) DO UPDATE SET
          type = excluded.type,
          payload = excluded.payload,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          is_favorite = excluded.is_favorite,
          foreground_color = excluded.foreground_color,
          background_color = excluded.background_color,
          margin_modules = excluded.margin_modules
      `)
      .run(
        record.workspaceId,
        record.recordId,
        record.type,
        record.payload,
        record.createdAt,
        record.updatedAt,
        record.isFavorite ? 1 : 0,
        record.foregroundColor,
        record.backgroundColor,
        record.marginModules
      );
  }

  listQrRecords(workspaceId: string): WorkspaceQrRecord[] {
    const rows = this.db
      .prepare(`
        SELECT
          workspace_id,
          record_id,
          type,
          payload,
          created_at,
          updated_at,
          is_favorite,
          foreground_color,
          background_color,
          margin_modules
        FROM workspace_qr_records
        WHERE workspace_id = ?
        ORDER BY created_at DESC
      `)
      .all(workspaceId) as Array<{
        workspace_id: string;
        record_id: string;
        type: string;
        payload: string;
        created_at: number;
        updated_at: number;
        is_favorite: number;
        foreground_color: string;
        background_color: string;
        margin_modules: number;
      }>;

    return rows.map((row) => ({
      workspaceId: row.workspace_id,
      recordId: row.record_id,
      type: row.type,
      payload: row.payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isFavorite: row.is_favorite === 1,
      foregroundColor: row.foreground_color,
      backgroundColor: row.background_color,
      marginModules: row.margin_modules
    }));
  }

  close(): void {
    this.db.close();
  }

  private toWorkspace(row: {
    workspace_id: string;
    name: string;
    plan: SaaSPlan;
    created_at: number;
    owner_user_id: string | null;
  }): Workspace {
    return {
      id: row.workspace_id,
      name: row.name,
      plan: row.plan,
      createdAt: row.created_at,
      ownerUserId: row.owner_user_id
    };
  }
}
