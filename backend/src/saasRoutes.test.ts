import { describe, expect, it } from "vitest";
import { hashPassword } from "./auth.js";
import { buildServer } from "./server.js";
import type { GooglePlayVerifier } from "./googlePlay.js";
import type { PurchaseStore } from "./store.js";
import type { SaaSStoreLike } from "./saasRoutes.js";
import type { SaaSPlan, Workspace, WorkspaceQrRecord } from "./saas.js";

const baseOptions = {
  packageName: "com.linkqr",
  proProductId: "linkqr_pro"
};

function createFakeSaaSStore(): SaaSStoreLike {
  const workspaces = new Map<string, Workspace>();
  const records = new Map<string, WorkspaceQrRecord>();
  const users = new Map<string, import("./saas.js").User>();
  const sessions = new Map<string, { userId: string; expiresAt: number }>();

  return {
    createUser(user) {
      if ([...users.values()].some((candidate) => candidate.email === user.email)) {
        throw new Error("duplicate");
      }
      users.set(user.id, user);
    },
    getUserByEmail(email) {
      return [...users.values()].find((user) => user.email === email) ?? null;
    },
    getUser(userId) {
      return users.get(userId) ?? null;
    },
    createSession(token, userId, expiresAt) {
      sessions.set(token, { userId, expiresAt });
    },
    getSessionUser(token) {
      const session = sessions.get(token);
      if (!session || session.expiresAt <= Date.now()) return null;
      return users.get(session.userId) ?? null;
    },
    deleteSession(token) {
      sessions.delete(token);
    },
    createWorkspace(workspace) {
      workspaces.set(workspace.id, workspace);
    },
    getWorkspace(workspaceId) {
      return workspaces.get(workspaceId) ?? null;
    },
    countQrRecords(workspaceId) {
      return [...records.values()].filter(
        (record) => record.workspaceId === workspaceId
      ).length;
    },
    hasQrRecord(workspaceId, recordId) {
      return records.has(workspaceId + ":" + recordId);
    },
    upsertQrRecord(record) {
      records.set(record.workspaceId + ":" + record.recordId, record);
    },
    listQrRecords(workspaceId) {
      return [...records.values()]
        .filter((record) => record.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt - a.createdAt);
    }
  };
}

function createApp(saasStore: SaaSStoreLike = createFakeSaaSStore()) {
  return buildServer(
    {} as GooglePlayVerifier,
    {} as PurchaseStore,
    {
      ...baseOptions,
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

  it("requires the SaaS API key", async () => {
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

  it("creates a workspace and syncs a QR record", async () => {
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
        isFavorite: false,
        foregroundColor: "#000000",
        backgroundColor: "#FFFFFF",
        marginModules: 4
      }
    });

    expect(syncResponse.statusCode).toBe(200);
    expect(syncResponse.json()).toEqual({
      synced: true,
      workspaceId: workspace.id,
      recordId: "qr-1",
      created: true,
      updated: false
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
      isFavorite: false,
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
      marginModules: 4
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
