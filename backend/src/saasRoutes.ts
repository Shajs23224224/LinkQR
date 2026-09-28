import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createSessionToken, hashPassword, verifyPassword } from "./auth.js";
import {
  SaaSConfig,
  UserLoginSchema,
  UserRegisterSchema,
  WorkspaceCreateSchema,
  WorkspaceQrRecordSchema,
  Workspace
} from "./saas.js";
import type { User } from "./saas.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SaaSStoreLike = {
  createUser(user: User): void;
  getUserByEmail(email: string): User | null;
  getUser(userId: string): User | null;
  createSession(token: string, userId: string, expiresAt: number): void;
  getSessionUser(token: string): User | null;
  deleteSession(token: string): void;
  createWorkspace(workspace: Workspace): void;
  getWorkspace(workspaceId: string): Workspace | null;
  countQrRecords(workspaceId: string): number;
  hasQrRecord(workspaceId: string, recordId: string): boolean;
  upsertQrRecord(record: {
    workspaceId: string; recordId: string; type: string; payload: string; createdAt: number;
    isFavorite: boolean; foregroundColor: string; backgroundColor: string; marginModules: number;
  }): void;
  listQrRecords(workspaceId: string): Array<{
    workspaceId: string; recordId: string; type: string; payload: string; createdAt: number;
    isFavorite: boolean; foregroundColor: string; backgroundColor: string; marginModules: number;
  }>;
};

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({ error: "UNAUTHORIZED" });
}

function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export function registerSaaSRoutes(app: FastifyInstance, store: SaaSStoreLike, config: SaaSConfig): void {
  if (!config.enabled) return;

  const isLegacyApiKey = (request: FastifyRequest): boolean => {
    const providedKey = request.headers["x-linkqr-api-key"];
    const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;
    return apiKey === config.apiKey;
  };

  const requireUser = async (request: FastifyRequest, reply: FastifyReply): Promise<User | null> => {
    const token = bearerToken(request);
    if (!token) {
      unauthorized(reply);
      return null;
    }
    const user = store.getSessionUser(token);
    if (!user) {
      unauthorized(reply);
      return null;
    }
    return user;
  };

  const authorizeLegacyApiKey = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    const providedKey = request.headers["x-linkqr-api-key"];
    const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;
    if (apiKey !== config.apiKey) {
      unauthorized(reply);
      return false;
    }
    return true;
  };

  const getWorkspace = (request: FastifyRequest) =>
    (request.params as { workspaceId?: string }).workspaceId ?? null;

  const authenticateUserOrApiKey = async (request: FastifyRequest, reply: FastifyReply): Promise<User | null | "api-key"> => {
    if (isLegacyApiKey(request)) return "api-key";
    return requireUser(request, reply);
  };

  const canAccessWorkspace = (
    workspaceId: string,
    user: User | null,
    allowLegacyApiKey: boolean,
    request: FastifyRequest
  ): boolean => {
    if (allowLegacyApiKey) {
      const providedKey = request.headers["x-linkqr-api-key"];
      const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;
      if (apiKey === config.apiKey) return true;
    }
    const workspace = store.getWorkspace(workspaceId);
    return Boolean(user && workspace && workspace.ownerUserId === user.id);
  };

  app.post("/v1/saas/auth/register", async (request, reply) => {
    const parsed = UserRegisterSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ authenticated: false, error: "INVALID_REQUEST" });
    if (store.getUserByEmail(parsed.data.email)) {
      return reply.code(409).send({ authenticated: false, error: "EMAIL_ALREADY_REGISTERED" });
    }

    const user: User = {
      id: randomUUID(),
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: hashPassword(parsed.data.password),
      createdAt: Date.now()
    };
    try {
      store.createUser(user);
    } catch {
      return reply.code(409).send({ authenticated: false, error: "EMAIL_ALREADY_REGISTERED" });
    }

    const token = createSessionToken();
    store.createSession(token, user.id, Date.now() + SESSION_TTL_MS);
    return reply.code(201).send({ authenticated: true, token, expiresInSeconds: SESSION_TTL_MS / 1000, user: publicUser(user) });
  });

  app.post("/v1/saas/auth/login", async (request, reply) => {
    const parsed = UserLoginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ authenticated: false, error: "INVALID_REQUEST" });

    const user = store.getUserByEmail(parsed.data.email);
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ authenticated: false, error: "INVALID_CREDENTIALS" });
    }

    const token = createSessionToken();
    store.createSession(token, user.id, Date.now() + SESSION_TTL_MS);
    return { authenticated: true, token, expiresInSeconds: SESSION_TTL_MS / 1000, user: publicUser(user) };
  });

  app.get("/v1/saas/auth/me", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return { authenticated: true, user: publicUser(user) };
  });

  app.post("/v1/saas/auth/logout", async (request, reply) => {
    const token = bearerToken(request);
    if (!token || !store.getSessionUser(token)) return unauthorized(reply);
    store.deleteSession(token);
    return { authenticated: false, loggedOut: true };
  });

  app.get("/v1/saas/config", async (request, reply) => {
    if (!(await authorizeLegacyApiKey(request, reply))) return;
    return {
      enabled: true,
      plans: {
        FREE: { qrRecordLimit: config.freeQrLimit },
        PRO: { qrRecordLimit: config.proQrLimit }
      }
    };
  });

  app.post("/v1/saas/workspaces", async (request, reply) => {
    const legacy = isLegacyApiKey(request);
    const user = legacy ? null : await requireUser(request, reply);
    if (!legacy && !user) return;

    const parsed = WorkspaceCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ created: false, error: "INVALID_REQUEST" });

    const workspace: Workspace = {
      id: randomUUID(),
      name: parsed.data.name,
      plan: user ? "FREE" : parsed.data.plan,
      createdAt: Date.now(),
      ownerUserId: user?.id ?? null
    };
    store.createWorkspace(workspace);
    return reply.code(201).send({ created: true, workspace });
  });

  app.get("/v1/saas/workspaces/:workspaceId", async (request, reply) => {
    const workspaceId = getWorkspace(request);
    if (!workspaceId) return reply.code(400).send({ error: "INVALID_WORKSPACE" });
    const auth = await authenticateUserOrApiKey(request, reply);
    if (!auth) return;
    const user = auth === "api-key" ? null : auth;
    if (!canAccessWorkspace(workspaceId, user, true, request)) return unauthorized(reply);
    const workspace = store.getWorkspace(workspaceId);
    if (!workspace) return reply.code(404).send({ error: "WORKSPACE_NOT_FOUND" });
    return { workspace };
  });

  app.post("/v1/saas/workspaces/:workspaceId/qr", async (request, reply) => {
    const workspaceId = getWorkspace(request);
    if (!workspaceId) return reply.code(400).send({ synced: false, error: "INVALID_WORKSPACE" });
    const workspace = store.getWorkspace(workspaceId);
    if (!workspace) return reply.code(404).send({ synced: false, error: "WORKSPACE_NOT_FOUND" });

    const auth = await authenticateUserOrApiKey(request, reply);
    if (!auth) return;
    const user = auth === "api-key" ? null : auth;
    if (!canAccessWorkspace(workspaceId, user, true, request)) return unauthorized(reply);

    const parsed = WorkspaceQrRecordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ synced: false, error: "INVALID_REQUEST" });

    const exists = store.hasQrRecord(workspaceId, parsed.data.recordId);
    const limit = workspace.plan === "PRO" ? config.proQrLimit : config.freeQrLimit;
    if (!exists && store.countQrRecords(workspaceId) >= limit) {
      return reply.code(409).send({ synced: false, error: "WORKSPACE_QUOTA_EXCEEDED", limit });
    }

    store.upsertQrRecord({ workspaceId, ...parsed.data });
    return { synced: true, workspaceId, recordId: parsed.data.recordId, created: !exists, updated: exists };
  });

  app.get("/v1/saas/workspaces/:workspaceId/qr", async (request, reply) => {
    const workspaceId = getWorkspace(request);
    if (!workspaceId) return reply.code(400).send({ error: "INVALID_WORKSPACE" });
    const workspace = store.getWorkspace(workspaceId);
    if (!workspace) return reply.code(404).send({ error: "WORKSPACE_NOT_FOUND" });

    const auth = await authenticateUserOrApiKey(request, reply);
    if (!auth) return;
    const user = auth === "api-key" ? null : auth;
    if (!canAccessWorkspace(workspaceId, user, true, request)) return unauthorized(reply);

    return { workspaceId, records: store.listQrRecords(workspaceId) };
  });
}
