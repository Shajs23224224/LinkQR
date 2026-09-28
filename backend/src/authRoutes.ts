import { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  LoginSchema,
  RegisterSchema,
  type AuthConfig
} from "./auth.js";
import type { AuthUser } from "./auth.js";
import type { AuthRepository } from "./repositoryPorts.js";
import type { AuthEmailSender } from "./authEmail.js";
import { AuthRateLimiter } from "./authRateLimiter.js";

const TokenSchema = z.string().trim().min(16).max(512);

const VerifyEmailSchema = z.object({
  token: TokenSchema
});

const PasswordResetRequestSchema = z.object({
  email: z.string().trim().email().max(254)
});

const PasswordResetConfirmSchema = z.object({
  token: TokenSchema,
  password: z.string().min(8).max(128)
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
});

export type AuthStoreLike = AuthRepository;

export type AuthPrincipal = {
  user: AuthUser;
  sessionId: string;
};

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

function rateLimited(reply: FastifyReply, retryAfterSeconds: number) {
  reply.header("Retry-After", String(retryAfterSeconds));
  return reply.code(429).send({
    error: "RATE_LIMITED",
    retryAfterSeconds
  });
}

export function getBearerToken(request: FastifyRequest): string | null {
  return bearerToken(request);
}

export function getAuthenticatedUser(
  request: FastifyRequest,
  authStore: AuthRepository
) {
  const token = bearerToken(request);
  return token ? authStore.getUserBySessionToken(token) : null;
}

export function getAuthenticatedSession(
  request: FastifyRequest,
  authStore: AuthRepository
) {
  const token = bearerToken(request);
  return token ? authStore.getSessionByToken(token) : null;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  authStore: AuthStoreLike,
  config: AuthConfig,
  emailSender: AuthEmailSender,
  rateLimiter = new AuthRateLimiter({
    register: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    login: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
    verifyEmail: { windowMs: 15 * 60 * 1000, maxRequests: 20 },
    resendVerification: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    resetRequest: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
    resetConfirm: { windowMs: 15 * 60 * 1000, maxRequests: 10 }
  })
): void {
  if (!config.enabled) return;

  const checkRate = (request: FastifyRequest, reply: FastifyReply, action: string) => {
    const result = rateLimiter.check(request.ip, action);
    if (!result.allowed) {
      return rateLimited(reply, result.retryAfterSeconds);
    }
    return null;
  };

  app.post("/v1/auth/register", async (request, reply) => {
    const limited = checkRate(request, reply, "register");
    if (limited) return limited;

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
      const verification = authStore.createEmailVerificationToken(user.id);

      await emailSender.send({
        type: "VERIFY_EMAIL",
        to: verification.email,
        name: verification.name,
        token: verification.token,
        expiresAt: verification.expiresAt
      });

      return reply.code(201).send({
        created: true,
        user,
        emailVerified: false,
        verificationRequired: true
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({
        created: false,
        error: "EMAIL_DELIVERY_FAILED"
      });
    }
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const limited = checkRate(request, reply, "login");
    if (limited) return limited;

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

    if (!user.emailVerified) {
      return reply.code(403).send({
        authenticated: false,
        error: "EMAIL_NOT_VERIFIED"
      });
    }

    const session = authStore.createSession(user.id);

    return {
      authenticated: true,
      user,
      session
    };
  });

  app.post("/v1/auth/verify-email", async (request, reply) => {
    const limited = checkRate(request, reply, "verifyEmail");
    if (limited) return limited;

    const parsed = VerifyEmailSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        verified: false,
        error: "INVALID_REQUEST"
      });
    }

    const user = authStore.consumeEmailVerificationToken(parsed.data.token);

    if (!user) {
      return reply.code(400).send({
        verified: false,
        error: "INVALID_OR_EXPIRED_TOKEN"
      });
    }

    return {
      verified: true,
      user
    };
  });

  app.post("/v1/auth/resend-verification", async (request, reply) => {
    const limited = checkRate(request, reply, "resendVerification");
    if (limited) return limited;

    const parsed = PasswordResetRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        sent: false,
        error: "INVALID_REQUEST"
      });
    }

    const user = authStore.findUserByEmail(parsed.data.email);

    if (user && !user.emailVerified) {
      try {
        const verification = authStore.createEmailVerificationToken(user.id);
        await emailSender.send({
          type: "VERIFY_EMAIL",
          to: verification.email,
          name: verification.name,
          token: verification.token,
          expiresAt: verification.expiresAt
        });
      } catch (error) {
        request.log.error(error);
      }
    }

    return reply.code(202).send({
      sent: true,
      message: "Si la cuenta requiere verificación, se enviará un correo."
    });
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const session = getAuthenticatedSession(request, authStore);
    if (!session) return unauthorized(reply);

    return {
      authenticated: true,
      user: session.user,
      session: {
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      }
    };
  });

  app.get("/v1/auth/sessions", async (request, reply) => {
    const session = getAuthenticatedSession(request, authStore);
    if (!session) return unauthorized(reply);

    return {
      sessions: authStore.listSessions(
        session.user.id,
        session.sessionId
      )
    };
  });

  app.delete("/v1/auth/sessions/:sessionId", async (request, reply) => {
    const session = getAuthenticatedSession(request, authStore);
    if (!session) return unauthorized(reply);

    const sessionId = (request.params as { sessionId?: string }).sessionId;
    if (!sessionId) {
      return reply.code(400).send({
        revoked: false,
        error: "INVALID_SESSION"
      });
    }

    authStore.revokeSessionById(session.user.id, sessionId);

    return { revoked: true };
  });

  app.post("/v1/auth/sessions/revoke-others", async (request, reply) => {
    const session = getAuthenticatedSession(request, authStore);
    if (!session) return unauthorized(reply);

    authStore.revokeOtherSessions(session.user.id, session.sessionId);

    return { revoked: true };
  });

  app.post("/v1/auth/password-reset/request", async (request, reply) => {
    const limited = checkRate(request, reply, "resetRequest");
    if (limited) return limited;

    const parsed = PasswordResetRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        sent: false,
        error: "INVALID_REQUEST"
      });
    }

    const reset = authStore.createPasswordResetToken(parsed.data.email);

    if (reset) {
      try {
        await emailSender.send({
          type: "PASSWORD_RESET",
          to: reset.email,
          name: reset.name,
          token: reset.token,
          expiresAt: reset.expiresAt
        });
      } catch (error) {
        request.log.error(error);
      }
    }

    return reply.code(202).send({
      sent: true,
      message: "Si existe una cuenta con ese correo, recibirás instrucciones."
    });
  });

  app.post("/v1/auth/password-reset/confirm", async (request, reply) => {
    const limited = checkRate(request, reply, "resetConfirm");
    if (limited) return limited;

    const parsed = PasswordResetConfirmSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        reset: false,
        error: "INVALID_REQUEST"
      });
    }

    const user = authStore.resetPassword(
      parsed.data.token,
      parsed.data.password
    );

    if (!user) {
      return reply.code(400).send({
        reset: false,
        error: "INVALID_OR_EXPIRED_TOKEN"
      });
    }

    return {
      reset: true
    };
  });

  app.post("/v1/auth/password/change", async (request, reply) => {
    const session = getAuthenticatedSession(request, authStore);
    if (!session) return unauthorized(reply);

    const parsed = ChangePasswordSchema.safeParse(request.body);

    if (!parsed.success || parsed.data.currentPassword === parsed.data.newPassword) {
      return reply.code(400).send({
        changed: false,
        error: "INVALID_REQUEST"
      });
    }

    const changed = authStore.changePassword(
      session.user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );

    if (!changed) {
      return reply.code(401).send({
        changed: false,
        error: "INVALID_CREDENTIALS"
      });
    }

    const newSession = authStore.createSession(session.user.id);

    return {
      changed: true,
      session: newSession
    };
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
