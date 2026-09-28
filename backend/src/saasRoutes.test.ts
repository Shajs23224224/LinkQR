import { describe, expect, it, vi } from "vitest";
import { buildServer } from "./server.js";
import type { GooglePlayVerifier } from "./googlePlay.js";
import type { PurchaseStore } from "./store.js";
import type { SaaSStoreLike } from "./saasRoutes.js";
import type { SaaSPlan, Workspace, WorkspaceQrRecord } from "./saas.js";
import { compareSyncRecords } from "./saas.js";
import type { AuthStoreLike } from "./authRoutes.js";

const baseOptions = {
  packageName: "com.linkqr",
  proProductId: "linkqr_pro"
};

const authEmailSender = {
  send: vi.fn().mockResolvedValue(undefined)
};

function createFakeSaaSStore(): SaaSStoreLike {
  const workspaces = new Map<string, Workspace>();
  const records = new Map<string, WorkspaceQrRecord>();

  return {
    createWorkspace(workspace) {
      workspaces.set(workspace.id, workspace);
    },
    getWorkspace(workspaceId) {
      return workspaces.get(workspaceId) ?? null;
    },
    getWorkspaceForUser(workspaceId, userId) {
      const workspace = workspaces.get(workspaceId);
      return workspace?.ownerUserId === userId ? workspace : null;
    },
    listWorkspacesForUser(userId) {
      return [...workspaces.values()].filter(
        (workspace) => workspace.ownerUserId === userId
      );
    },
    countQrRecords(workspaceId) {
      return [...records.values()].filter(
        (record) => record.workspaceId === workspaceId && !record.deleted
      ).length;
    },
    hasQrRecord(workspaceId, recordId) {
      return records.has(workspaceId + ":" + recordId);
    },
    getQrRecord(workspaceId, recordId) {
      return records.get(workspaceId + ":" + recordId) ?? null;
    },
    upsertQrRecord(record) {
      const key = record.workspaceId + ":" + record.recordId;
      const existing = records.get(key);
      if (existing && compareSyncRecords(record, existing) < 0) {
        return {
          accepted: false,
          created: false,
          updated: false,
          record: existing
        };
      }
      records.set(key, record);
      return {
        accepted: true,
        created: !existing,
        updated: Boolean(existing),
        record
      };
    },
    listQrRecords(workspaceId, includeDeleted = false) {
      return [...records.values()]
        .filter((record) =>
          record.workspaceId === workspaceId &&
          (includeDeleted || !record.deleted)
        )
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  };
}

function createApp(
  saasStore: SaaSStoreLike = createFakeSaaSStore(),
  authStore?: AuthStoreLike
) {
  return buildServer(
    {} as GooglePlayVerifier,
    {} as PurchaseStore,
    {
      ...baseOptions,
      auth: authStore
        ? {
            enabled: true,
            sessionDays: 30
          }
        : undefined,
      authStore,
      authEmailSender: authStore ? authEmailSender : undefined,
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
    expect(response.json()).toEqual({
      error: "UNAUTHORIZED"
    });

    await app.close();
  });

  it("creates a workspace and syncs a QR record through the API key", async () => {
    const app = createApp();

    const headers = {
      "x-linkqr-api-key": "test-key"
    };

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers,
      payload: {
        name: "Demo workspace",
        plan: "FREE"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const workspace = createResponse.json().workspace as Workspace;

    const syncResponse = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: {
        recordId: "qr-1",
        type: "URL",
        payload: "https://example.com",
        createdAt: 100,
        updatedAt: 100,
        isFavorite: false,
        foregroundColor: "#000000",
        backgroundColor: "#FFFFFF",
        marginModules: 4,
        version: 1,
        deviceId: "device-a",
        deleted: false,
        deletedAt: null
      }
    });

    expect(syncResponse.statusCode).toBe(200);
    expect(syncResponse.json()).toMatchObject({
      synced: true,
      workspaceId: workspace.id,
      recordId: "qr-1",
      created: true,
      updated: false,
      record: {
        recordId: "qr-1",
        version: 1,
        deviceId: "device-a",
        deleted: false
      }
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().records).toHaveLength(1);

    await app.close();
  });

  it("binds user workspaces to the authenticated account and rejects cross-user access", async () => {
    const saasStore = createFakeSaaSStore();
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
      headers: {
        authorization: "Bearer session-1"
      },
      payload: {
        name: "Private workspace",
        plan: "PRO"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const workspace = createResponse.json().workspace as Workspace;
    expect(workspace.plan).toBe("FREE");
    expect(workspace.ownerUserId).toBe("user-1");

    const ownList = await app.inject({
      method: "GET",
      url: "/v1/saas/workspaces",
      headers: {
        authorization: "Bearer session-1"
      }
    });

    expect(ownList.statusCode).toBe(200);
    expect(ownList.json().workspaces).toHaveLength(1);

    const crossUser = await app.inject({
      method: "GET",
      url: "/v1/saas/workspaces/" + workspace.id,
      headers: {
        authorization: "Bearer session-2"
      }
    });

    expect(crossUser.statusCode).toBe(404);

    const ownQr = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers: {
        authorization: "Bearer session-1"
      },
      payload: {
        recordId: "qr-1",
        type: "TEXT",
        payload: "private",
        createdAt: 100,
        updatedAt: 100,
        isFavorite: false,
        foregroundColor: "#000000",
        backgroundColor: "#FFFFFF",
        marginModules: 4,
        version: 1,
        deviceId: "device-a",
        deleted: false,
        deletedAt: null
      }
    });

    expect(ownQr.statusCode).toBe(200);

    const otherQr = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers: {
        authorization: "Bearer session-2"
      },
      payload: {
        recordId: "qr-2",
        type: "TEXT",
        payload: "forbidden",
        createdAt: 200,
        updatedAt: 200,
        isFavorite: false,
        foregroundColor: "#000000",
        backgroundColor: "#FFFFFF",
        marginModules: 4,
        version: 1,
        deviceId: "device-a",
        deleted: false,
        deletedAt: null
      }
    });

    expect(otherQr.statusCode).toBe(404);

    await app.close();
  });

  it("enforces the workspace QR quota", async () => {
    const app = createApp();

    const headers = {
      "x-linkqr-api-key": "test-key"
    };

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers,
      payload: {
        name: "Quota workspace",
        plan: "FREE"
      }
    });

    const workspace = createResponse.json().workspace as Workspace;
    const buildPayload = (recordId: string) => ({
      recordId,
      type: "TEXT",
      payload: recordId,
      createdAt: 100,
      updatedAt: 100,
      isFavorite: false,
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
      marginModules: 4,
      version: 1,
      deviceId: "device-a",
      deleted: false,
      deletedAt: null
    });

    const first = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: buildPayload("qr-1")
    });

    const second = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: buildPayload("qr-2")
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


describe("SaaS sync conflicts and tombstones", () => {
  it("rejects an older device version and returns the winner", async () => {
    const saasStore = createFakeSaaSStore();
    const app = createApp(saasStore);
    const headers = { "x-linkqr-api-key": "test-key" };

    const workspace = (await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers,
      payload: { name: "Conflict workspace", plan: "FREE" }
    })).json().workspace as Workspace;

    const base = {
      type: "TEXT",
      payload: "winner",
      createdAt: 100,
      updatedAt: 300,
      isFavorite: false,
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
      marginModules: 4,
      version: 2,
      deviceId: "device-z",
      deleted: false,
      deletedAt: null
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: { recordId: "qr-conflict", ...base }
    });

    const stale = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload: {
        recordId: "qr-conflict",
        ...base,
        payload: "loser",
        updatedAt: 200,
        deviceId: "device-a"
      }
    });

    expect(first.statusCode).toBe(200);
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      synced: false,
      error: "SYNC_CONFLICT",
      winner: {
        recordId: "qr-conflict",
        payload: "winner",
        deviceId: "device-z",
        version: 2
      }
    });

    await app.close();
  });

  it("keeps tombstones in sync but excludes them from active quota/listing", async () => {
    const saasStore = createFakeSaaSStore();
    const app = createApp(saasStore);
    const headers = { "x-linkqr-api-key": "test-key" };

    const workspace = (await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces",
      headers,
      payload: { name: "Delete workspace", plan: "FREE" }
    })).json().workspace as Workspace;

    const payload = {
      recordId: "qr-delete",
      type: "TEXT",
      payload: "to-delete",
      createdAt: 100,
      updatedAt: 100,
      isFavorite: false,
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
      marginModules: 4,
      version: 1,
      deviceId: "device-a",
      deleted: true,
      deletedAt: 200
    };

    const deleted = await app.inject({
      method: "POST",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers,
      payload
    });

    const activeList = await app.inject({
      method: "GET",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr",
      headers
    });

    const syncList = await app.inject({
      method: "GET",
      url: "/v1/saas/workspaces/" + workspace.id + "/qr?includeDeleted=true",
      headers
    });

    expect(deleted.statusCode).toBe(200);
    expect(activeList.json().records).toHaveLength(0);
    expect(syncList.json().records).toHaveLength(1);
    expect(syncList.json().records[0]).toMatchObject({
      recordId: "qr-delete",
      deleted: true,
      deletedAt: 200
    });

    await app.close();
  });
});
