import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser } from "./auth.js";
import type { AuthStoreLike } from "./authRoutes.js";
import {
  SaaSConfig,
  SaaSSyncMutationResult,
  WorkspaceCreateSchema,
  WorkspaceQrDeleteSchema,
  WorkspaceQrUpsertSchema,
  Workspace,
  WorkspaceQrSyncRecord
} from "./saas.js";

export type SaaSStoreLike = {
  createWorkspace(workspace: Workspace): void;
  getWorkspace(workspaceId: string): Workspace | null;
  getWorkspaceForUser(workspaceId: string, userId: string): Workspace | null;
  listWorkspacesForUser(userId: string): Workspace[];
  countQrRecords(workspaceId: string): number;
  hasQrRecord(workspaceId: string, recordId: string): boolean;
  getQrSyncRecord(workspaceId: string, recordId: string): WorkspaceQrSyncRecord | null;
  upsertQrRecord(
    record: WorkspaceQrSyncRecord extends never ? never : {
      workspaceId: string;
      recordId: string;
      type: string;
      payload: string;
      createdAt: number;
      isFavorite: boolean;
      foregroundColor: string;
      backgroundColor: string;
      marginModules: number;
    },
    baseVersion: number,
    updatedAt: number,
    quotaLimit: number
  ): SaaSSyncMutationResult;
  deleteQrRecord(
    workspaceId: string,
    recordId: string,
    baseVersion: number,
    updatedAt: number
  ): SaaSSyncMutationResult;
  listQrRecords(workspaceId: string): Array<{
    workspaceId: string;
    recordId: string;
    type: string;
    payload: string;
    createdAt: number;
    isFavorite: boolean;
    foregroundColor: string;
    backgroundColor: string;
    marginModules: number;
    version: number;
    updatedAt: number;
  }>;
  listQrSyncRecords(workspaceId: string): WorkspaceQrSyncRecord[];
};

type Principal =
  | { kind: "api-key"; user: null }
  | { kind: "user"; user: AuthUser };

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({ error: "UNAUTHORIZED" });
}

function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

function resolvePrincipal(request: FastifyRequest, config: SaaSConfig, authStore?: AuthStoreLike): Principal | null {
  const providedKey = request.headers["x-linkqr-api-key"];
  const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;
  if (apiKey === config.apiKey) return { kind: "api-key", user: null };
  const token = getBearerToken(request);
  if (token && authStore) {
    const user = authStore.getUserBySessionToken(token);
    if (user) return { kind: "user", user };
  }
  return null;
}

function workspaceForPrincipal(store: SaaSStoreLike, workspaceId: string, principal: Principal): Workspace | null {
  return principal.kind === "user"
    ? store.getWorkspaceForUser(workspaceId, principal.user.id)
    : store.getWorkspace(workspaceId);
}

function mutationResponse(reply: FastifyReply, workspaceId: string, result: SaaSSyncMutationResult) {
  if (result.status === "quota") {
    return reply.code(409).send({ synced: false, error: "WORKSPACE_QUOTA_EXCEEDED", limit: result.limit });
  }
  if (result.status === "conflict") {
    return reply.code(409).send({ synced: false, error: "SYNC_CONFLICT", record: result.record });
  }
  return { synced: true, workspaceId, record: result.record };
}

export function registerSaaSRoutes(app: FastifyInstance, store: SaaSStoreLike, config: SaaSConfig, authStore?: AuthStoreLike): void {
  if (!config.enabled) return;

  const authorize = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!resolvePrincipal(request, config, authStore)) return unauthorized(reply);
  };

  app.get("/v1/saas/config", { preHandler: authorize }, async () => ({
    enabled: true,
    plans: {
      FREE: { qrRecordLimit: config.freeQrLimit },
      PRO: { qrRecordLimit: config.proQrLimit }
    }
  }));

  app.get("/v1/saas/workspaces", { preHandler: authorize }, async (request, reply) => {
    const principal = resolvePrincipal(request, config, authStore);
    if (!principal) return unauthorized(reply);
    return principal.kind === "user"
      ? { workspaces: store.listWorkspacesForUser(principal.user.id) }
      : { workspaces: [] };
  });

  app.post("/v1/saas/workspaces", { preHandler: authorize }, async (request, reply) => {
    const parsed = WorkspaceCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ created: false, error: "INVALID_REQUEST" });
    const principal = resolvePrincipal(request, config, authStore);
    if (!principal) return unauthorized(reply);
    const workspace: Workspace = {
      id: randomUUID(),
      name: parsed.data.name,
      plan: principal.kind === "user" ? "FREE" : parsed.data.plan,
      createdAt: Date.now(),
      ownerUserId: principal.kind === "user" ? principal.user.id : null
    };
    store.createWorkspace(workspace);
    return reply.code(201).send({ created: true, workspace });
  });

  app.get("/v1/saas/workspaces/:workspaceId", { preHandler: authorize }, async (request, reply) => {
    const workspaceId = (request.params as { workspaceId?: string }).workspaceId;
    if (!workspaceId) return reply.code(400).send({ error: "INVALID_WORKSPACE" });
    const principal = resolvePrincipal(request, config, authStore);
    if (!principal) return unauthorized(reply);
    const workspace = workspaceForPrincipal(store, workspaceId, principal);
    if (!workspace) return reply.code(404).send({ error: "WORKSPACE_NOT_FOUND" });
    return { workspace };
  });

  app.post("/v1/saas/workspaces/:workspaceId/qr", { preHandler: authorize }, async (request, reply) => {
    const workspaceId = (request.params as { workspaceId?: string }).workspaceId;
    if (!workspaceId) return reply.code(400).send({ synced: false, error: "INVALID_WORKSPACE" });
    const principal = resolvePrincipal(request, config, authStore);
    if (!principal) return unauthorized(reply);
    const workspace = workspaceForPrincipal(store, workspaceId, principal);
    if (!workspace) return reply.code(404).send({ synced: false, error: "WORKSPACE_NOT_FOUND" });
    const parsed = WorkspaceQrUpsertSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ synced: false, error: "INVALID_REQUEST" });
    const updatedAt = parsed.data.updatedAt ?? parsed.data.createdAt;
    const result = store.upsertQrRecord(
      {
        workspaceId,
        recordId: parsed.data.recordId,
        type: parsed.data.type,
        payload: parsed.data.payload,
        createdAt: parsed.data.createdAt,
        isFavorite: parsed.data.isFavorite,
        foregroundColor: parsed.data.foregroundColor,
        backgroundColor: parsed.data.backgroundColor,
        marginModules: parsed.data.marginModules
      },
      parsed.data.baseVersion,
      updatedAt,
      workspace.plan === "PRO" ? config.proQrLimit : config.freeQrLimit
    );
    return mutationResponse(reply, workspaceId, result);
  });

  app.delete("/v1/saas/workspaces/:workspaceId/qr/:recordId", { preHandler: authorize }, async (request, reply) => {
    const params = request.params as { workspaceId?: string; recordId?: string };
    if (!params.workspaceId || !params.recordId) return reply.code(400).send({ synced: false, error: "INVALID_REQUEST" });
    const principal = resolvePrincipal(request, config, authStore);
    if (!principal) return unauthorized(reply);
    if (!workspaceForPrincipal(store, params.workspaceId, principal)) return reply.code(404).send({ synced: false, error: "WORKSPACE_NOT_FOUND" });
    const parsed = WorkspaceQrDeleteSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ synced: false, error: "INVALID_REQUEST" });
    const result = store.deleteQrRecord(params.workspaceId, params.recordId, parsed.data.baseVersion, parsed.data.updatedAt ?? Date.now());
    return mutationResponse(reply, params.workspaceId, result);
  });

  app.get("/v1/saas/workspaces/:workspaceId/qr/sync", { preHandler: authorize }, async (request, reply) => {
    const workspaceId = (request.params as { workspaceId?: string }).workspaceId;
    if (!workspaceId) return reply.code(400).send({ error: "INVALID_WORKSPACE" });
    const principal = resolvePrincipal(request, config, authStore);
    if (!principal) return unauthorized(reply);
    if (!workspaceForPrincipal(store, workspaceId, principal)) return reply.code(404).send({ error: "WORKSPACE_NOT_FOUND" });
    return { workspaceId, records: store.listQrSyncRecords(workspaceId) };
  });

  app.get("/v1/saas/workspaces/:workspaceId/qr", { preHandler: authorize }, async (request, reply) => {
    const workspaceId = (request.params as { workspaceId?: string }).workspaceId;
    if (!workspaceId) return reply.code(400).send({ error: "INVALID_WORKSPACE" });
    const principal = resolvePrincipal(request, config, authStore);
    if (!principal) return unauthorized(reply);
    if (!workspaceForPrincipal(store, workspaceId, principal)) return reply.code(404).send({ error: "WORKSPACE_NOT_FOUND" });
    return { workspaceId, records: store.listQrRecords(workspaceId) };
  });
}