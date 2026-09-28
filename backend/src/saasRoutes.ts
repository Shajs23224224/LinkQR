import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuthUser } from "./auth.js";
import type { AuthRepository, SaaSRepository } from "./repositoryPorts.js";
import {
  SaaSConfig,
  WorkspaceCreateSchema,
  WorkspaceQrRecordSchema,
  Workspace,
  WorkspaceQrRecord,
  SyncApplyResult,
  SaaSSyncPage,
  compareSyncRecords
} from "./saas.js";

export type SaaSStoreLike = SaaSRepository;

type Principal =
  | { kind: "api-key"; user: null }
  | { kind: "user"; user: AuthUser };

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    error: "UNAUTHORIZED"
  });
}

function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

function resolvePrincipal(
  request: FastifyRequest,
  config: SaaSConfig,
  authStore?: AuthRepository
): Principal | null {
  const providedKey = request.headers["x-linkqr-api-key"];
  const apiKey = Array.isArray(providedKey)
    ? providedKey[0]
    : providedKey;

  if (apiKey === config.apiKey) {
    return { kind: "api-key", user: null };
  }

  const token = getBearerToken(request);
  if (token && authStore) {
    const user = authStore.getUserBySessionToken(token);
    if (user) return { kind: "user", user };
  }

  return null;
}

function workspaceForPrincipal(
  store: SaaSRepository,
  workspaceId: string,
  principal: Principal
): Workspace | null {
  return principal.kind === "user"
    ? store.getWorkspaceForUser(workspaceId, principal.user.id)
    : store.getWorkspace(workspaceId);
}

export function registerSaaSRoutes(
  app: FastifyInstance,
  store: SaaSRepository,
  config: SaaSConfig,
  authStore?: AuthRepository
): void {
  if (!config.enabled) return;

  const authorize = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    if (!resolvePrincipal(request, config, authStore)) {
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

  app.get(
    "/v1/saas/workspaces",
    { preHandler: authorize },
    async (request, reply) => {
      const principal = resolvePrincipal(request, config, authStore);
      if (!principal) return unauthorized(reply);

      if (principal.kind === "user") {
        return {
          workspaces: store.listWorkspacesForUser(principal.user.id)
        };
      }

      return {
        workspaces: []
      };
    }
  );

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

      const principal = resolvePrincipal(request, config, authStore);
      if (!principal) return unauthorized(reply);

      const workspace = workspaceForPrincipal(store, workspaceId, principal);

      if (!workspace) {
        return reply.code(404).send({
          error: "WORKSPACE_NOT_FOUND"
        });
      }

      return { workspace };
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

      const principal = resolvePrincipal(request, config, authStore);
      if (!principal) return unauthorized(reply);

      const workspace = workspaceForPrincipal(store, workspaceId, principal);

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
      const existing = exists
        ? store.getQrRecord(workspaceId, parsed.data.recordId)
        : null;
      const activeBefore = existing ? !existing.deleted : false;
      const limit =
        workspace.plan === "PRO"
          ? config.proQrLimit
          : config.freeQrLimit;
      const staleOrDuplicate =
        existing !== null &&
        compareSyncRecords(parsed.data, existing) <= 0;

      // Resolve stale/duplicate revisions before quota checks. A stale client
      // must receive SYNC_CONFLICT rather than being blocked by the active
      // record quota, especially when the current winner is a tombstone.
      if (
        !staleOrDuplicate &&
        !parsed.data.deleted &&
        !activeBefore &&
        store.countQrRecords(workspaceId) >= limit
      ) {
        return reply.code(409).send({
          synced: false,
          error: "WORKSPACE_QUOTA_EXCEEDED",
          limit
        });
      }

      const result = store.upsertQrRecord({
        workspaceId,
        ...parsed.data
      });

      if (!result.accepted) {
        return reply.code(409).send({
          synced: false,
          error: "SYNC_CONFLICT",
          winner: result.record
        });
      }

      return {
        synced: true,
        workspaceId,
        recordId: parsed.data.recordId,
        created: result.created,
        updated: result.updated,
        record: result.record
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

      const principal = resolvePrincipal(request, config, authStore);
      if (!principal) return unauthorized(reply);

      if (!workspaceForPrincipal(store, workspaceId, principal)) {
        return reply.code(404).send({
          error: "WORKSPACE_NOT_FOUND"
        });
      }

      const query = request.query as {
        includeDeleted?: string;
        cursor?: string;
        limit?: string;
      };

      if (query.cursor !== undefined) {
        const cursor = Number(query.cursor);
        const limit = Number(query.limit ?? "50");

        if (
          !Number.isSafeInteger(cursor) ||
          cursor < 0 ||
          !Number.isSafeInteger(limit) ||
          limit < 1 ||
          limit > 100
        ) {
          return reply.code(400).send({
            error: "INVALID_SYNC_CURSOR"
          });
        }

        const page = store.listQrDelta(workspaceId, cursor, limit);

        return {
          workspaceId,
          cursor: page.cursor,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          records: page.records
        };
      }

      const includeDeleted = query.includeDeleted === "true";

      return {
        workspaceId,
        records: store.listQrRecords(workspaceId, includeDeleted)
      };
    }
  );
}

