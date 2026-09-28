import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  LoginSchema,
  RegisterSchema,
  type AuthConfig
} from "./auth.js";
import type { AuthStore } from "./authStore.js";

export type AuthStoreLike = Pick<
  AuthStore,
  | "createUser"
  | "findUserByEmail"
  | "verifyCredentials"
  | "createSession"
  | "getUserBySessionToken"
  | "revokeSession"
>;

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;

  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    error: "UNAUTHORIZED"
  });
}

export function getBearerToken(request: FastifyRequest): string | null {
  return bearerToken(request);
}

export function getAuthenticatedUser(
  request: FastifyRequest,
  authStore: AuthStoreLike
) {
  const token = bearerToken(request);
  return token ? authStore.getUserBySessionToken(token) : null;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  authStore: AuthStoreLike,
  config: AuthConfig
): void {
  if (!config.enabled) return;

  app.post("/v1/auth/register", async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        created: false,
        error: "INVALID_REQUEST"
      });
    }

    const email = parsed.data.email.trim().toLowerCase();

    if (authStore.findUserByEmail(email)) {
      return reply.code(409).send({
        created: false,
        error: "EMAIL_ALREADY_REGISTERED"
      });
    }

    try {
      const user = authStore.createUser(
        email,
        parsed.data.password,
        parsed.data.name ?? null
      );
      const session = authStore.createSession(user.id);

      return reply.code(201).send({
        created: true,
        user,
        session
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(409).send({
        created: false,
        error: "EMAIL_ALREADY_REGISTERED"
      });
    }
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        authenticated: false,
        error: "INVALID_REQUEST"
      });
    }

    const user = authStore.verifyCredentials(
      parsed.data.email,
      parsed.data.password
    );

    if (!user) {
      return reply.code(401).send({
        authenticated: false,
        error: "INVALID_CREDENTIALS"
      });
    }

    const session = authStore.createSession(user.id);

    return {
      authenticated: true,
      user,
      session
    };
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const user = getAuthenticatedUser(request, authStore);
    if (!user) return unauthorized(reply);

    return { authenticated: true, user };
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const token = getBearerToken(request);
    if (!token) return unauthorized(reply);

    authStore.revokeSession(token);

    return {
      loggedOut: true
    };
  });
}
