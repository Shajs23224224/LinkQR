import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqliteDatabase } from "./sqlite.js";
import { AuthStore } from "./authStore.js";
import { SaaSStore } from "./saasStore.js";
import { PurchaseStore } from "./store.js";

describe("storage infrastructure", () => {
  it("opens file databases with WAL and scalable SQLite defaults", () => {
    const directory = mkdtempSync(join(tmpdir(), "linkqr-storage-"));
    const path = join(directory, "linkqr.db");

    try {
      const db = openSqliteDatabase(path);
      expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(db.pragma("synchronous", { simple: true })).toBe(1);
      db.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("creates indexes for active auth sessions, sync changes and purchases", () => {
    const directory = mkdtempSync(join(tmpdir(), "linkqr-indexes-"));
    const path = join(directory, "linkqr.db");

    try {
      const auth = new AuthStore(path);
      const saas = new SaaSStore(path);
      const purchases = new PurchaseStore(path);

      const db = new Database(path, { readonly: true });
      const authIndexes = (db.prepare("PRAGMA index_list(auth_sessions)").all() as Array<{ name: string }>).map((row) => row.name);
      const changeIndexes = (db.prepare("PRAGMA index_list(workspace_qr_change_log)").all() as Array<{ name: string }>).map((row) => row.name);
      const purchaseIndexes = (db.prepare("PRAGMA index_list(purchases)").all() as Array<{ name: string }>).map((row) => row.name);

      expect(authIndexes).toContain("idx_auth_sessions_active_user_expiry");
      expect(changeIndexes).toContain("idx_workspace_qr_change_workspace_record_seq");
      expect(purchaseIndexes).toContain("idx_purchases_user_verified");

      db.close();
      auth.close();
      saas.close();
      purchases.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
