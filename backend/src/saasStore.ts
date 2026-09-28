import Database from "better-sqlite3";
import type { SaaSPlan, SyncApplyResult, Workspace, WorkspaceQrRecord } from "./saas.js";
import { compareSyncRecords } from "./saas.js";

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
        version INTEGER NOT NULL DEFAULT 1,
        device_id TEXT NOT NULL DEFAULT 'legacy-server',
        deleted INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        PRIMARY KEY (workspace_id, record_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
      );

      CREATE INDEX IF NOT EXISTS idx_workspace_qr_created_at
        ON workspace_qr_records(workspace_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_workspace_qr_sync
        ON workspace_qr_records(workspace_id, version, updated_at);
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
    if (!qrColumns.some((column) => column.name === "version")) {
      this.db.exec("ALTER TABLE workspace_qr_records ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
    }
    if (!qrColumns.some((column) => column.name === "device_id")) {
      this.db.exec("ALTER TABLE workspace_qr_records ADD COLUMN device_id TEXT NOT NULL DEFAULT 'legacy-server'");
    }
    if (!qrColumns.some((column) => column.name === "deleted")) {
      this.db.exec("ALTER TABLE workspace_qr_records ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0");
    }
    if (!qrColumns.some((column) => column.name === "deleted_at")) {
      this.db.exec("ALTER TABLE workspace_qr_records ADD COLUMN deleted_at INTEGER");
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
        WHERE workspace_id = ? AND deleted = 0
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

  getQrRecord(workspaceId: string, recordId: string): WorkspaceQrRecord | null {
    const row = this.db
      .prepare(\`
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
          margin_modules,
          version,
          device_id,
          deleted,
          deleted_at
        FROM workspace_qr_records
        WHERE workspace_id = ? AND record_id = ?
      \`)
      .get(workspaceId, recordId) as QrRow | undefined;

    return row ? this.toQrRecord(row) : null;
  }

  upsertQrRecord(record: WorkspaceQrRecord): SyncApplyResult {
    const existing = this.getQrRecord(record.workspaceId, record.recordId);

    if (existing && compareSyncRecords(record, existing) < 0) {
      return {
        accepted: false,
        created: false,
        updated: false,
        record: existing
      };
    }

    this.db.prepare(\`
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
          margin_modules,
          version,
          device_id,
          deleted,
          deleted_at
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, record_id) DO UPDATE SET
        type = excluded.type,
        payload = excluded.payload,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        is_favorite = excluded.is_favorite,
        foreground_color = excluded.foreground_color,
        background_color = excluded.background_color,
        margin_modules = excluded.margin_modules,
        version = excluded.version,
        device_id = excluded.device_id,
        deleted = excluded.deleted,
        deleted_at = excluded.deleted_at
    \`).run(
      record.workspaceId,
      record.recordId,
      record.type,
      record.payload,
      record.createdAt,
      record.updatedAt,
      record.isFavorite ? 1 : 0,
      record.foregroundColor,
      record.backgroundColor,
      record.marginModules,
      record.version,
      record.deviceId,
      record.deleted ? 1 : 0,
      record.deletedAt ?? null
    );

    return {
      accepted: true,
      created: !existing,
      updated: Boolean(existing),
      record
    };
  }

  listQrRecords(workspaceId: string, includeDeleted = false): WorkspaceQrRecord[] {
    const rows = this.db.prepare(\`
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
        margin_modules,
        version,
        device_id,
        deleted,
        deleted_at
      FROM workspace_qr_records
      WHERE workspace_id = ? AND (? = 1 OR deleted = 0)
      ORDER BY created_at DESC
    \`).all(workspaceId, includeDeleted ? 1 : 0) as QrRow[];

    return rows.map((row) => this.toQrRecord(row));
  }


  private toQrRecord(row: QrRow): WorkspaceQrRecord {
    return {
      workspaceId: row.workspace_id,
      recordId: row.record_id,
      type: row.type,
      payload: row.payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isFavorite: row.is_favorite === 1,
      foregroundColor: row.foreground_color,
      backgroundColor: row.background_color,
      marginModules: row.margin_modules,
      version: row.version,
      deviceId: row.device_id,
      deleted: row.deleted === 1,
      deletedAt: row.deleted_at
    };
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

type QrRow = {
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
  version: number;
  device_id: string;
  deleted: number;
  deleted_at: number | null;
};


}
