import { describe, expect, it } from "vitest";
import { SaaSStore } from "./saasStore.js";

function workspace() {
  return {
    id: "workspace-1",
    name: "Test",
    plan: "FREE" as const,
    createdAt: 1,
    ownerUserId: "user-1"
  };
}

function record(payload: string, updatedAt: number) {
  return {
    workspaceId: "workspace-1",
    recordId: "qr-1",
    type: "TEXT",
    payload,
    createdAt: 1,
    isFavorite: false,
    foregroundColor: "#000000",
    backgroundColor: "#FFFFFF",
    marginModules: 4
  };
}

describe("SaaSStore synchronization state", () => {
  it("persists versions and tombstones", () => {
    const store = new SaaSStore(":memory:");
    store.createWorkspace(workspace());

    const first = store.upsertQrRecord(
      record("first", 100),
      0,
      100,
      1
    );

    expect(first.status).toBe("accepted");
    if (first.status !== "accepted") throw new Error("expected accepted");
    expect(first.record.version).toBe(1);
    expect(first.record.deleted).toBe(false);

    const removed = store.deleteQrRecord(
      "workspace-1",
      "qr-1",
      1,
      200
    );

    expect(removed.status).toBe("accepted");
    if (removed.status !== "accepted") throw new Error("expected accepted");
    expect(removed.record.version).toBe(2);
    expect(removed.record.deleted).toBe(true);
    expect(store.countQrRecords("workspace-1")).toBe(0);
    expect(store.listQrSyncRecords("workspace-1")).toHaveLength(1);

    store.close();
  });

  it("rejects an older concurrent mutation and accepts a newer one", () => {
    const store = new SaaSStore(":memory:");
    store.createWorkspace(workspace());

    const first = store.upsertQrRecord(
      record("first", 100),
      0,
      100,
      1
    );
    expect(first.status).toBe("accepted");

    const current = store.upsertQrRecord(
      record("device-a", 200),
      1,
      200,
      1
    );
    expect(current.status).toBe("accepted");

    const stale = store.upsertQrRecord(
      record("device-b-old", 150),
      1,
      150,
      1
    );
    expect(stale.status).toBe("conflict");
    if (stale.status !== "conflict") throw new Error("expected conflict");
    expect(stale.record.payload).toBe("device-a");

    const newer = store.upsertQrRecord(
      record("device-b-new", 300),
      1,
      300,
      1
    );
    expect(newer.status).toBe("accepted");
    if (newer.status !== "accepted") throw new Error("expected accepted");
    expect(newer.record.version).toBe(3);
    expect(newer.record.payload).toBe("device-b-new");

    store.close();
  });
});
