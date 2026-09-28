import { describe, expect, it, vi } from "vitest";
import { buildServer } from "./server.js";
import type { GooglePlayVerifier } from "./googlePlay.js";
import type { PurchaseStore } from "./store.js";
import type { AuthStoreLike } from "./authRoutes.js";
import type {
  SaaSPlan,
  SaaSSyncMutationResult,
  Workspace,
  WorkspaceQrRecord,
  WorkspaceQrSyncRecord
} from "./saas.js";
import type { SaaSStoreLike } from "./saasRoutes.js";

const baseOptions = {
  packageName: "com.linkqr",
  proProductId: "linkqr_pro"
};

class FakeSaaSStore implements SaaSStoreLike {
  private readonly workspaces = new Map<string, Workspace>();
  private readonly records = new Map<string, WorkspaceQrSyncRecord>();

  createWorkspace(workspace: Workspace) {
    this.workspaces.set(workspace.id, workspace);
  }

  getWorkspace(workspaceId: string) {
    return this.workspaces.get(workspaceId) ?? null;
  }

  getWorkspaceForUser(workspaceId: string, userId: string) {
    const workspace = this.workspaces.get(workspaceId);
    return workspace?.ownerUserId === userId ? workspace : null;
  }

  listWorkspacesForUser(userId: string) {
    return [...this.workspaces.values()].filter(
      (workspace) => workspace.ownerUserId === userId
    );
  }

  countQrRecords(workspaceId: string) {
    return [...this.records.values()].filter(
      (record) => record.workspaceId === workspaceId && !record.deleted
    ).length;
  }

  hasQrRecord(workspaceId: string, recordId: string) {
    return this.getQrSyncRecord(workspaceId, recordId)?.deleted === false;
  }

  getQrSyncRecord(workspaceId: string, recordId: string) {
    return this.records.get(workspaceId + ":" + recordId) ?? null;
  }

  upsertQrRecord(
    record: WorkspaceQrRecord,
    baseVersion: number,
    updatedAt: number,
    quotaLimit: number
  ): SaaSSyncMutationResult {
    const key = record.workspaceId + ":" + record.recordId;
    const current = this.records.get(key) ?? null;

    if (
      current &&
      baseVersion !== current.version &&
      updatedAt <= current.updatedAt
    ) {
      return { status: "conflict", record: current };
    }

    if (
      (!current || current.deleted) &&
      this.countQrRecords(record.workspaceId) >= quotaLimit
    ) {
      return { status: "quota", limit: quotaLimit };
    }

    if (
      current &&
      !current.deleted &&
      current.updatedAt === updatedAt &&
      current.type === record.type &&
      current.payload === record.payload &&
      current.isFavorite === record.isFavorite &&
      current.foregroundColor === record.foregroundColor &&
      current.backgroundColor === record.backgroundColor &&
      current.marginModules === record.marginModules
    ) {
      return { status: "accepted", record: current };
    }

    const next: WorkspaceQrSyncRecord = {
      ...record,
      version: current ? current.version + 1 : 1,
      updatedAt,
      deleted: false
    };
    this.records.set(key, next);
    return { status: "accepted", record: next };
  }

  deleteQrRecord(
    workspaceId: string,
    recordId: string,
    baseVersion: number,
    updatedAt: number
  ): SaaSSyncMutationResult {
    const key = workspaceId + ":" + recordId;
    const current = this.records.get(key) ?? null;

    if (
      current &&
      baseVersion !== current.version &&
      updatedAt <= current.updatedAt
    ) {
      return { status: "conflict", record: current };
    }

    if (current?.deleted && current.updatedAt === updatedAt) {
      return { status: "accepted", record: current };
    }

    const next: WorkspaceQrSyncRecord = {
      ...(current ?? {
        workspaceId,
        recordId,
        type: "TEXT",
        payload: "",
        createdAt: 0,
        isFavorite: false,
        foregroundColor: "#000000",
        backgroundColor: "#FFFFFF",
        marginModules: 4
      }),
      version: current ? current.version + 1 : 1,
      updatedAt,
      deleted: true
    };
    this.records.set(key, next);
    return { status: "accepted", record: next };
  }

  listQrRecords(workspaceId: string) {
    return [...this.records.values()]
      .filter(
        (record) => record.workspaceId === workspaceId && !record.deleted
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  listQrSyncRecords(workspaceId: string) {
    return [...this.records.values()]
      .filter((record) => record.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

function createApp(
  saasStore: SaaSStoreLike = new FakeSaaSStore(),
  authStore?: AuthStoreLike
) {
  return buildServer(
    {} as GooglePlayVerifier,
    {} as PurchaseStore,
    {
      ...baseOptions,
      auth: authStore
        ? { enabled: true, sessionDays: 30 }
        : undefined,
      authStore,
      saas: {
        enabled: true,
        apiKey: "test-key",
        freeQrLimit: 1,
        proQrLimit: 2
      },
      saasStore
    }
  );
}

function qrPayload(recordId: string, updatedAt = 100, baseVersion = 0) {
  return {
    recordId,
    type: "TEXT",
    payload: recordId,
    createdAt: 100,
    isFavorite: false,
    foregroundColor: "#000000",
    backgroundColor: "#FFFFFF",
    marginModules: 4,
    updatedAt,
    baseVersion
  };
}

describe("SaaS workspace API", () => {
  it("keeps SaaS routes disabled by default", async () => {
    const app = buildServer(
      {} as GooglePlayVerifier,
      {} as PurchaseStore,
      baseOptions
    );

    const response = await app.inject({
      method: "GET",
      url: "/v1/saas/config"
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("requires the SaaS API key or a valid user session", async () => {
    const app = createApp();

    const response = await app.inject({
      method: "GET",
      url: "/v1/saas/config"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "UNAUTHORIZED" });

    await app.close();
  });

  it("creates, updates and lists a versioned QR record", async () => {
    const app = createApp();
    const headers = { "x-linkqr-api-key": "test-key" };

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers,
      payload: { name: "Demo workspace", plan: "FREE" }
    });

    const workspace = createResponse.json().workspace as Workspace;

    const first = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: qrPayload("qr-1")
    });

    expect(first.statusCode).toBe(200);
    expect(first.json().record.version).toBe(1);

    const second = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: {
        ...qrPayload("qr-1", 200, 1),
        payload: "updated"
      }
    });

    expect(second.statusCode).toBe(200);
    expect(second.json().record.version).toBe(2);
    expect(second.json().record.payload).toBe("updated");

    await app.close();
  });

  it("propagates deletions through a tombstone without counting them against quota", async () => {
    const app = createApp();
    const headers = { "x-linkqr-api-key": "test-key" };

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers,
      payload: { name: "Delete workspace", plan: "FREE" }
    });
    const workspace = createResponse.json().workspace as Workspace;

    const first = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: qrPayload("qr-1")
    });
    expect(first.statusCode).toBe(200);

    const remove = await app.inject({
      method: "DELETE",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr/qr-1",
      headers,
      payload: { baseVersion: 1, updatedAt: 200 }
    });

    expect(remove.statusCode).toBe(200);
    expect(remove.json().record.deleted).toBe(true);
    expect(remove.json().record.version).toBe(2);

    const active = await app.inject({
      method: "GET",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers
    });
    expect(active.json().records).toHaveLength(0);

    const sync = await app.inject({
      method: "GET",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr/sync",
      headers
    });
    expect(sync.json().records).toHaveLength(1);
    expect(sync.json().records[0].deleted).toBe(true);

    const replacement = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: qrPayload("qr-2", 300, 0)
    });
    expect(replacement.statusCode).toBe(200);

    await app.close();
  });

  it("resolves concurrent changes with deterministic last-write-wins", async () => {
    const app = createApp();
    const headers = { "x-linkqr-api-key": "test-key" };

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers,
      payload: { name: "Conflict workspace", plan: "FREE" }
    });
    const workspace = workspaceResponse.json().workspace as Workspace;

    const initial = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: qrPayload("qr-1", 100, 0)
    });
    expect(initial.statusCode).toBe(200);

    const current = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: { ...qrPayload("qr-1", 200, 1), payload: "device-A" }
    });
    expect(current.statusCode).toBe(200);

    const stale = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: { ...qrPayload("qr-1", 150, 1), payload: "device-B-old" }
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error).toBe("SYNC_CONFLICT");
    expect(stale.json().record.payload).toBe("device-A");

    const newer = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: { ...qrPayload("qr-1", 300, 1), payload: "device-B-new" }
    });
    expect(newer.statusCode).toBe(200);
    expect(newer.json().record.version).toBe(3);
    expect(newer.json().record.payload).toBe("device-B-new");

    await app.close();
  });

  it("binds workspaces to authenticated users and rejects cross-user access", async () => {
    const saasStore = new FakeSaaSStore();
    const user = {
      id: "user-1",
      email: "user@example.com",
      name: "User",
      createdAt: 1
    };
    const otherUser = {
      id: "user-2",
      email: "other@example.com",
      name: "Other",
      createdAt: 2
    };
    const authStore: AuthStoreLike = {
      createUser: vi.fn(),
      findUserByEmail: vi.fn(),
      verifyCredentials: vi.fn(),
      createSession: vi.fn(),
      getUserBySessionToken: vi.fn((token: string) =>
        token === "session-1" ? user : token === "session-2" ? otherUser : null
      ),
      revokeSession: vi.fn()
    };

    const app = createApp(saasStore, authStore);

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers: { authorization: "Bearer session-1" },
      payload: { name: "Private workspace", plan: "PRO" }
    });

    expect(createResponse.statusCode).toBe(201);
    const workspace = createResponse.json().workspace as Workspace;
    expect(workspace.plan).toBe("FREE");
    expect(workspace.ownerUserId).toBe("user-1");

    const crossUser = await app.inject({
      method: "GET",
      url: "/v1/saas/workspaces/" + workspace.id,
      headers: { authorization: "Bearer session-2" }
    });

    expect(crossUser.statusCode).toBe(404);

    const ownQr = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers: { authorization: "Bearer session-1" },
      payload: qrPayload("qr-1")
    });

    expect(ownQr.statusCode).toBe(200);

    const otherQr = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers: { authorization: "Bearer session-2" },
      payload: qrPayload("qr-2", 200)
    });

    expect(otherQr.statusCode).toBe(404);

    await app.close();
  });

  it("enforces the workspace QR quota", async () => {
    const app = createApp();
    const headers = { "x-linkqr-api-key": "test-key" };

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers,
      payload: { name: "Quota workspace", plan: "FREE" }
    });

    const workspace = createResponse.json().workspace as Workspace;

    const first = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: qrPayload("qr-1")
    });

    const second = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: qrPayload("qr-2", 200)
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({
      synced: false,
      error: "WORKSPACE_QUOTA_EXCEEDED",
      limit: 1
    });

    await app.close();
  });
});
