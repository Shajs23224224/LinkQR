import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  SaaSConfig,
  WorkspaceCreateSchema,
  WorkspaceQrRecordSchema,
  Workspace
} from "./saas.js";

export type SaaSStoreLike = {
  createWorkspace(workspace: Workspace): void;
  getWorkspace(workspaceId: string): Workspace | null;
  countQrRecords(workspaceId: string): number;
  hasQrRecord(workspaceId: string, recordId: string): boolean;
  upsertQrRecord(record: {
    workspaceId: string;
    recordId: string;
    type: string;
    payload: string;
    createdAt: number;
    isFavorite: boolean;
    foregroundColor: string;
    backgroundColor: string;
    marginModules: number;
  }): void;
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
  }>;
};

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    error: "UNAUTHORIZED"
  });
}

export function registerSaaSRoutes(
  app: FastifyInstance,
  store: SaaSStoreLike,
  config: SaaSConfig
): void {
  if (!config.enabled) return;

  const authorize = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const providedKey = request.headers["x-linkqr-api-key"];
    const apiKey = Array.isArray(providedKey)
      ? providedKey[0]
      : providedKey;

    if (apiKey !== config.apiKey) {
      return unauthorized(reply);
    }
  };

  app.get("/v1/saas/config", { preHandler: authorize }, async () => ({
    enabled: true,
    plans: {
      FREE: {
        qrRecordLimit: config.freeQrLimit
      },
      PRO: {
        qrRecordLimit: config.proQrLimit
      }
    }
  }));

  app.post(
    "/v1/saas/workspaces",
    { preHandler: authorize },
    async (request, reply) => {
      const parsed = WorkspaceCreateSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          created: false,
          error: "INVALID_REQUEST"
        });
      }

      const workspace: Workspace = {
        id: randomUUID(),
        name: parsed.data.name,
        plan: parsed.data.plan,
        createdAt: Date.now()
      };

      store.createWorkspace(workspace);

      return reply.code(201).send({
        created: true,
        workspace
      });
    }
  );

  app.get(
    "/v1/saas/workspaces/:workspaceId",
    { preHandler: authorize },
    async (request, reply) => {
      const workspaceId = (request.params as { workspaceId?: string }).workspaceId;

      if (!workspaceId) {
        return reply.code(400).send({
          error: "INVALID_WORKSPACE"
        });
      }

      const workspace = store.getWorkspace(workspaceId);

      if (!workspace) {
        return reply.code(404).send({
          error: "WORKSPACE_NOT_FOUND"
        });
      }

      return {
        workspace
      };
    }
  );

  app.post(
    "/v1/saas/workspaces/:workspaceId/qr",
    { preHandler: authorize },
    async (request, reply) => {
      const workspaceId = (request.params as { workspaceId?: string }).workspaceId;

      if (!workspaceId) {
        return reply.code(400).send({
          synced: false,
          error: "INVALID_WORKSPACE"
        });
      }

      const workspace = store.getWorkspace(workspaceId);

      if (!workspace) {
        return reply.code(404).send({
          synced: false,
          error: "WORKSPACE_NOT_FOUND"
        });
      }

      const parsed = WorkspaceQrRecordSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          synced: false,
          error: "INVALID_REQUEST"
        });
      }

      const exists = store.hasQrRecord(workspaceId, parsed.data.recordId);
      const limit =
        workspace.plan === "PRO"
          ? config.proQrLimit
          : config.freeQrLimit;

      if (!exists && store.countQrRecords(workspaceId) >= limit) {
        return reply.code(409).send({
          synced: false,
          error: "WORKSPACE_QUOTA_EXCEEDED",
          limit
        });
      }

      store.upsertQrRecord({
        workspaceId,
        ...parsed.data
      });

      return {
        synced: true,
        workspaceId,
        recordId: parsed.data.recordId,
        created: !exists,
        updated: exists
      };
    }
  );

  app.get(
    "/v1/saas/workspaces/:workspaceId/qr",
    { preHandler: authorize },
    async (request, reply) => {
      const workspaceId = (request.params as { workspaceId?: string }).workspaceId;

      if (!workspaceId) {
        return reply.code(400).send({
          error: "INVALID_WORKSPACE"
        });
      }

      if (!store.getWorkspace(workspaceId)) {
        return reply.code(404).send({
          error: "WORKSPACE_NOT_FOUND"
        });
      }

      return {
        workspaceId,
        records: store.listQrRecords(workspaceId)
      };
    }
  );
}
