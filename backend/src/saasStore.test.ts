import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SaaSStore } from "./saasStore.js";

function createRecord(
  workspaceId: string,
  recordId: string,
  version = 1
) {
  return {
    workspaceId,
    recordId,
    type: "TEXT",
    payload: recordId,
    createdAt: 100,
    updatedAt: 100 + version,
    isFavorite: false,
    foregroundColor: "#000000",
    backgroundColor: "#FFFFFF",
    marginModules: 4,
    version,
    deviceId: "device-a",
    deleted: false,
    deletedAt: null
  };
}

describe("SaaSStore delta sync", () => {
  it("persists a monotonic change log and returns only changed records", () => {
    const directory = mkdtempSync(join(tmpdir(), "linkqr-sync-"));
    const databasePath = join(directory, "linkqr.db");

    try {
      const store = new SaaSStore(databasePath);
      store.createWorkspace({
        id: "workspace-1",
        name: "Sync",
        plan: "PRO",
        createdAt: 1,
        ownerUserId: null
      });

      store.upsertQrRecord(createRecord("workspace-1", "qr-1"));
      store.upsertQrRecord(createRecord("workspace-1", "qr-2"));

      const firstPage = store.listQrDelta("workspace-1", 0, 1);

      expect(firstPage.cursor).toBe(0);
      expect(firstPage.nextCursor).toBe(1);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.records).toHaveLength(1);

      store.close();

      const reopened = new SaaSStore(databasePath);
      const secondPage = reopened.listQrDelta(
        "workspace-1",
        firstPage.nextCursor,
        10
      );

      expect(secondPage.nextCursor).toBe(2);
      expect(secondPage.hasMore).toBe(false);
      expect(secondPage.records.map((record) => record.recordId)).toEqual([
        "qr-2"
      ]);

      reopened.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not create a second change event for an identical retry", () => {
    const directory = mkdtempSync(join(tmpdir(), "linkqr-sync-idempotent-"));
    const databasePath = join(directory, "linkqr.db");

    try {
      const store = new SaaSStore(databasePath);
      store.createWorkspace({
        id: "workspace-1",
        name: "Sync",
        plan: "PRO",
        createdAt: 1,
        ownerUserId: null
      });

      const record = createRecord("workspace-1", "qr-1");
      expect(store.upsertQrRecord(record).created).toBe(true);
      expect(store.upsertQrRecord(record).updated).toBe(false);

      const page = store.listQrDelta("workspace-1", 0, 10);

      expect(page.records).toHaveLength(1);
      expect(page.nextCursor).toBe(1);
      expect(page.hasMore).toBe(false);

      store.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
