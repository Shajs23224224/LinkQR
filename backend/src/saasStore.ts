import Database from "better-sqlite3";
import type { SaaSPlan, SaaSSyncMutationResult, Workspace, WorkspaceQrRecord, WorkspaceQrSyncRecord } from "./saas.js";

type StoredRow = {
  workspace_id: string;
  record_id: string;
  type: string;
  payload: string;
  created_at: number;
  is_favorite: number;
  foreground_color: string;
  background_color: string;
  margin_modules: number;
  version: number;
  updated_at: number;
  deleted_at: number | null;
};

export class SaaSStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS workspaces (" +
      "workspace_id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL, " +
      "created_at INTEGER NOT NULL, owner_user_id TEXT" +
      ");"
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS workspace_qr_records (" +
      "workspace_id TEXT NOT NULL, record_id TEXT NOT NULL, type TEXT NOT NULL, " +
      "payload TEXT NOT NULL, created_at INTEGER NOT NULL, is_favorite INTEGER NOT NULL, " +
      "foreground_color TEXT NOT NULL, background_color TEXT NOT NULL, margin_modules INTEGER NOT NULL, " +
      "version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL DEFAULT 0, deleted_at INTEGER, " +
      "PRIMARY KEY (workspace_id, record_id), FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)" +
      ");"
    );

    const columns = this.db.prepare("PRAGMA table_info(workspaces)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "owner_user_id")) {
      this.db.exec("ALTER TABLE workspaces ADD COLUMN owner_user_id TEXT");
    }

    const qrColumns = this.db.prepare("PRAGMA table_info(workspace_qr_records)").all() as Array<{ name: string }>;
    if (!qrColumns.some((column) => column.name === "version")) {
      this.db.exec("ALTER TABLE workspace_qr_records ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
    }
    if (!qrColumns.some((column) => column.name === "updated_at")) {
      this.db.exec("ALTER TABLE workspace_qr_records ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0");
    }
    if (!qrColumns.some((column) => column.name === "deleted_at")) {
      this.db.exec("ALTER TABLE workspace_qr_records ADD COLUMN deleted_at INTEGER");
    }

    this.db.exec("UPDATE workspace_qr_records SET updated_at = created_at WHERE updated_at = 0");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_workspace_owner ON workspaces(owner_user_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_workspace_qr_version ON workspace_qr_records(workspace_id, version)");
  }

  createWorkspace(workspace: Workspace): void {
    this.db.prepare(
      "INSERT INTO workspaces (workspace_id, name, plan, created_at, owner_user_id) VALUES (?, ?, ?, ?, ?)"
    ).run(workspace.id, workspace.name, workspace.plan, workspace.createdAt, workspace.ownerUserId ?? null);
  }

  getWorkspace(workspaceId: string): Workspace | null {
    const row = this.db.prepare(
      "SELECT workspace_id, name, plan, created_at, owner_user_id FROM workspaces WHERE workspace_id = ?"
    ).get(workspaceId) as { workspace_id: string; name: string; plan: SaaSPlan; created_at: number; owner_user_id: string | null } | undefined;
    return row ? this.toWorkspace(row) : null;
  }

  getWorkspaceForUser(workspaceId: string, userId: string): Workspace | null {
    const row = this.db.prepare(
      "SELECT workspace_id, name, plan, created_at, owner_user_id FROM workspaces WHERE workspace_id = ? AND owner_user_id = ?"
    ).get(workspaceId, userId) as { workspace_id: string; name: string; plan: SaaSPlan; created_at: number; owner_user_id: string | null } | undefined;
    return row ? this.toWorkspace(row) : null;
  }

  listWorkspacesForUser(userId: string): Workspace[] {
    const rows = this.db.prepare(
      "SELECT workspace_id, name, plan, created_at, owner_user_id FROM workspaces WHERE owner_user_id = ? ORDER BY created_at DESC"
    ).all(userId) as Array<{ workspace_id: string; name: string; plan: SaaSPlan; created_at: number; owner_user_id: string | null }>;
    return rows.map((row) => this.toWorkspace(row));
  }

  countQrRecords(workspaceId: string): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) AS count FROM workspace_qr_records WHERE workspace_id = ? AND deleted_at IS NULL"
    ).get(workspaceId) as { count: number };
    return row.count;
  }

  hasQrRecord(workspaceId: string, recordId: string): boolean {
    return this.getQrSyncRecord(workspaceId, recordId)?.deleted === false;
  }

  getQrSyncRecord(workspaceId: string, recordId: string): WorkspaceQrSyncRecord | null {
    const row = this.getRow(workspaceId, recordId);
    return row ? this.toSyncRecord(row) : null;
  }

  upsertQrRecord(record: WorkspaceQrRecord, baseVersion: number, updatedAt: number, quotaLimit: number): SaaSSyncMutationResult {
    const transaction = this.db.transaction(() => {
      const current = this.getRow(record.workspaceId, record.recordId);
      if (!this.acceptsMutation(current, baseVersion, updatedAt)) {
        return { status: "conflict" as const, record: this.toSyncRecord(current!) };
      }

      if ((!current || current.deleted_at !== null) && this.countQrRecords(record.workspaceId) >= quotaLimit) {
        return { status: "quota" as const, limit: quotaLimit };
      }

      const nextVersion = current ? current.version + 1 : 1;
      const next: StoredRow = {
        workspace_id: record.workspaceId,
        record_id: record.recordId,
        type: record.type,
        payload: record.payload,
        created_at: current?.created_at ?? record.createdAt,
        is_favorite: record.isFavorite ? 1 : 0,
        foreground_color: record.foregroundColor,
        background_color: record.backgroundColor,
        margin_modules: record.marginModules,
        version: nextVersion,
        updated_at: updatedAt,
        deleted_at: null
      };

      if (current && current.deleted_at === null && current.updated_at === updatedAt &&
          current.type === next.type && current.payload === next.payload &&
          current.is_favorite === next.is_favorite && current.foreground_color === next.foreground_color &&
          current.background_color === next.background_color && current.margin_modules === next.margin_modules) {
        return { status: "accepted" as const, record: this.toSyncRecord(current) };
      }

      this.db.prepare(
        "INSERT INTO workspace_qr_records (" +
        "workspace_id, record_id, type, payload, created_at, is_favorite, foreground_color, background_color, " +
        "margin_modules, version, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) " +
        "ON CONFLICT(workspace_id, record_id) DO UPDATE SET type = excluded.type, payload = excluded.payload, " +
        "is_favorite = excluded.is_favorite, foreground_color = excluded.foreground_color, " +
        "background_color = excluded.background_color, margin_modules = excluded.margin_modules, " +
        "version = excluded.version, updated_at = excluded.updated_at, deleted_at = NULL"
      ).run(next.workspace_id, next.record_id, next.type, next.payload, next.created_at, next.is_favorite,
        next.foreground_color, next.background_color, next.margin_modules, next.version, next.updated_at);

      return { status: "accepted" as const, record: this.toSyncRecord(next) };
    });
    return transaction();
  }

  deleteQrRecord(workspaceId: string, recordId: string, baseVersion: number, updatedAt: number): SaaSSyncMutationResult {
    const transaction = this.db.transaction(() => {
      const current = this.getRow(workspaceId, recordId);
      if (current && !this.acceptsMutation(current, baseVersion, updatedAt)) {
        return { status: "conflict" as const, record: this.toSyncRecord(current) };
      }

      if (current && current.deleted_at !== null && current.updated_at === updatedAt) {
        return { status: "accepted" as const, record: this.toSyncRecord(current) };
      }

      const nextVersion = current ? current.version + 1 : 1;
      const next: StoredRow = current ?? {
        workspace_id: workspaceId, record_id: recordId, type: "TEXT", payload: "", created_at: 0,
        is_favorite: 0, foreground_color: "#000000", background_color: "#FFFFFF", margin_modules: 4,
        version: nextVersion, updated_at: updatedAt, deleted_at: updatedAt
      };
      next.version = nextVersion;
      next.updated_at = updatedAt;
      next.deleted_at = updatedAt;

      this.db.prepare(
        "INSERT INTO workspace_qr_records (" +
        "workspace_id, record_id, type, payload, created_at, is_favorite, foreground_color, background_color, " +
        "margin_modules, version, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(workspace_id, record_id) DO UPDATE SET version = excluded.version, " +
        "updated_at = excluded.updated_at, deleted_at = excluded.deleted_at"
      ).run(next.workspace_id, next.record_id, next.type, next.payload, next.created_at, next.is_favorite,
        next.foreground_color, next.background_color, next.margin_modules, next.version, next.updated_at, next.deleted_at);

      return { status: "accepted" as const, record: this.toSyncRecord(next) };
    });
    return transaction();
  }

  listQrRecords(workspaceId: string): Array<WorkspaceQrRecord & { version: number; updatedAt: number }> {
    const rows = this.db.prepare(
      "SELECT workspace_id, record_id, type, payload, created_at, is_favorite, foreground_color, background_color, margin_modules, version, updated_at, deleted_at " +
      "FROM workspace_qr_records WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
    ).all(workspaceId) as StoredRow[];
    return rows.map((row) => ({ ...this.toActiveRecord(row), version: row.version, updatedAt: row.updated_at }));
  }

  listQrSyncRecords(workspaceId: string): WorkspaceQrSyncRecord[] {
    const rows = this.db.prepare(
      "SELECT workspace_id, record_id, type, payload, created_at, is_favorite, foreground_color, background_color, margin_modules, version, updated_at, deleted_at " +
      "FROM workspace_qr_records WHERE workspace_id = ? ORDER BY updated_at DESC"
    ).all(workspaceId) as StoredRow[];
    return rows.map((row) => this.toSyncRecord(row));
  }

  close(): void {
    this.db.close();
  }

  private getRow(workspaceId: string, recordId: string): StoredRow | null {
    const row = this.db.prepare(
      "SELECT workspace_id, record_id, type, payload, created_at, is_favorite, foreground_color, background_color, margin_modules, version, updated_at, deleted_at " +
      "FROM workspace_qr_records WHERE workspace_id = ? AND record_id = ?"
    ).get(workspaceId, recordId) as StoredRow | undefined;
    return row ?? null;
  }

  private acceptsMutation(current: StoredRow | null, baseVersion: number, updatedAt: number): boolean {
    if (!current) return baseVersion === 0;
    if (baseVersion === current.version) return true;
    return updatedAt > current.updated_at;
  }

  private toActiveRecord(row: StoredRow): WorkspaceQrRecord {
    return {
      workspaceId: row.workspace_id, recordId: row.record_id, type: row.type, payload: row.payload,
      createdAt: row.created_at, isFavorite: row.is_favorite === 1, foregroundColor: row.foreground_color,
      backgroundColor: row.background_color, marginModules: row.margin_modules
    };
  }

  private toSyncRecord(row: StoredRow): WorkspaceQrSyncRecord {
    return { ...this.toActiveRecord(row), version: row.version, updatedAt: row.updated_at, deleted: row.deleted_at !== null };
  }

  private toWorkspace(row: { workspace_id: string; name: string; plan: SaaSPlan; created_at: number; owner_user_id: string | null }): Workspace {
    return { id: row.workspace_id, name: row.name, plan: row.plan, createdAt: row.created_at, ownerUserId: row.owner_user_id };
  }
}