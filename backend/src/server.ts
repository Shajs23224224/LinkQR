import Fastify from "fastify";
import { z } from "zod";
import {
  SqliteApiProtectionStore,
  hashPrincipal,
  hashRequestBody
} from "./apiProtection.js";
import { loadConfig } from "./config.js";
import { GooglePlayVerifier } from "./googlePlay.js";
import { PurchaseStore } from "./store.js";
import { SaaSStore } from "./saasStore.js";
import type { AuthRepository, PurchaseRepository, SaaSRepository } from "./repositoryPorts.js";
import { SqliteBackupManager } from "./sqliteBackup.js";
import { registerSaaSRoutes } from "./saasRoutes.js";
import type { SaaSConfig } from "./saas.js";
import { AuthStore } from "./authStore.js";
import { registerAuthRoutes } from "./authRoutes.js";
import type { AuthConfig } from "./auth.js";
import { getAuthenticatedUser } from "./authRoutes.js";
import type { AuthEmailSender } from "./authEmail.js";
import { WebhookAuthEmailSender } from "./authEmail.js";
import {
  isBearerTokenAuthorized,
  ObservabilityMetrics
} from "./observability.js";

const requestSchema = z.object({
  purchaseToken: z.string().min(1).max(4096),
  productId: z.string().min(1)
});

export type BillingServerOptions = {
  packageName: string;
  proProductId: string;
  auth?: AuthConfig & {
    verificationLifetimeMs?: number;
    passwordResetLifetimeMs?: number;
  };
  authStore?: AuthRepository;
  authEmailSender?: AuthEmailSender;
  saas?: SaaSConfig;
  saasStore?: SaaSRepository;
  observabilityToken?: string;
  apiProtectionStore?: SqliteApiProtectionStore;
  apiRateLimitPerMinute?: number;
  apiWriteRateLimitPerMinute?: number;
  apiIdempotencyTtlMs?: number;
  readinessCheck?: () => boolean | Promise<boolean>;
};

export function buildServer(
  verifier: Pick<
    GooglePlayVerifier,
    "verifyOneTimeProduct" | "acknowledgeOneTimeProduct"
  >,
  store: PurchaseRepository,
  options: BillingServerOptions
) {
  const metrics = new ObservabilityMetrics();
  const requestStartedAt = new WeakMap<object, bigint>();
  const idempotencyState = new WeakMap<object, { key: string; scope: string; requestHash: string }>();

  const app = Fastify({
    logger: true,
    bodyLimit: 64 * 1024,
    requestIdHeader: "x-request-id"
  });

  app.addHook("onRequest", async (request, reply) => {
    requestStartedAt.set(request, process.hrtime.bigint());

    if (request.url.startsWith("/v1/")) {
      reply.header("X-LinkQR-API-Version", "1");

      if (options.apiProtectionStore) {
        const path = request.url.split("?")[0];
        const principal = hashPrincipal(
          request.headers.authorization,
          Array.isArray(request.headers["x-linkqr-api-key"])
            ? request.headers["x-linkqr-api-key"][0]
            : request.headers["x-linkqr-api-key"],
          request.ip
        );
        const write = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
        const limit = write
          ? options.apiWriteRateLimitPerMinute ?? 120
          : options.apiRateLimitPerMinute ?? 300;
        const decision = options.apiProtectionStore.consumeRateLimit(
          "api:" + request.method + ":" + path + ":" + principal,
          limit,
          60_000
        );

        reply.header("RateLimit-Limit", String(decision.limit));
        reply.header("RateLimit-Remaining", String(decision.remaining));
        reply.header("RateLimit-Reset", String(decision.retryAfterSeconds));

        if (!decision.allowed) {
          reply.header("Retry-After", String(decision.retryAfterSeconds));
          metrics.incCounter("linkqr_api_rate_limit_rejections_total", {
            method: request.method,
            route: path
          });
          return reply.code(429).send({
            error: "RATE_LIMITED",
            retryAfterSeconds: decision.retryAfterSeconds
          });
        }

        const critical =
          request.method === "POST" &&
          (path === "/v1/saas/workspaces" ||
            path === "/v1/google-play/verify");
        const idempotencyKey = request.headers["idempotency-key"];

        if (critical && idempotencyKey) {
          const key = Array.isArray(idempotencyKey)
            ? idempotencyKey[0]
            : idempotencyKey;

          if (!/^[A-Za-z0-9._~-]{8,128}$/.test(key)) {
            return reply.code(400).send({
              error: "INVALID_IDEMPOTENCY_KEY"
            });
          }

          const scope = request.method + ":" + path + ":" + principal;
          const requestHash = hashRequestBody(request.body);
          const claim = options.apiProtectionStore.claimIdempotency(
            key,
            scope,
            requestHash,
            options.apiIdempotencyTtlMs ?? 24 * 60 * 60 * 1000
          );

          if (claim.kind === "conflict") {
            return reply.code(409).send({
              error: "IDEMPOTENCY_KEY_REUSED"
            });
          }

          if (claim.kind === "in_progress") {
            return reply.code(409).send({
              error: "IDEMPOTENCY_IN_PROGRESS"
            });
          }

          if (claim.kind === "replay") {
            if (claim.record.contentType) {
              reply.header("Content-Type", claim.record.contentType);
            }
            reply.header("Idempotent-Replayed", "true");
            return reply.code(claim.record.statusCode).send(claim.record.responseBody);
          }

          idempotencyState.set(request, { key, scope, requestHash });
        }
      }
    }

    reply.header("X-Request-ID", request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
        ? error.statusCode
        : 500;

    request.log.error({
      event: "unhandled_api_error",
      requestId: request.id,
      error: error instanceof Error ? error.name : "UNKNOWN_ERROR",
      statusCode
    });

    return reply.code(statusCode).send({
      error:
        statusCode === 413
          ? "PAYLOAD_TOO_LARGE"
          : statusCode === 404
            ? "NOT_FOUND"
            : statusCode === 400
              ? "INVALID_REQUEST"
              : "INTERNAL_SERVER_ERROR"
    });
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    const idempotency = idempotencyState.get(request);

    const route = request.routeOptions?.url ?? "__unmatched__";

    if (idempotency && typeof payload === "string" && reply.statusCode < 500 && options.apiProtectionStore) {
      options.apiProtectionStore.finalizeIdempotency(
        idempotency.key,
        idempotency.scope,
        idempotency.requestHash,
        reply.statusCode,
        payload,
        String(reply.getHeader("content-type") ?? "application/json")
      );
    }

    if (route.startsWith("/v1/auth/")) {
      metrics.incCounter("linkqr_auth_requests_total", {
        operation: route.replace("/v1/auth/", "") || "unknown"
      });
    }

    if (route.startsWith("/v1/saas/workspaces/") && route.endsWith("/qr")) {
      metrics.incCounter("linkqr_sync_requests_total", {
        operation:
          request.method === "POST"
            ? "push"
            : request.url.includes("cursor=")
              ? "delta"
              : "list"
      });
    }

    if (route === "/v1/google-play/verify") {
      metrics.incCounter("linkqr_billing_requests_total", {
        operation: "verify"
      });
    }

    if (
      typeof payload === "string" &&
      payload.length <= 128 * 1024 &&
      String(reply.getHeader("content-type") ?? "").includes("application/json")
    ) {
      try {
        const body = JSON.parse(payload) as { error?: unknown };
        if (body.error === "SYNC_CONFLICT") {
          metrics.incCounter("linkqr_sync_conflicts_total");
        }
        if (body.error === "WORKSPACE_QUOTA_EXCEEDED") {
          metrics.incCounter("linkqr_sync_quota_rejections_total");
        }
      } catch {
        // Metrics instrumentation must never change the response path.
      }
    }

    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    const startedAt = requestStartedAt.get(request);
    if (!startedAt) return;

    const durationSeconds =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const route = request.routeOptions?.url ?? "__unmatched__";

    metrics.incCounter("linkqr_http_requests_total", {
      method: request.method,
      route,
      status: reply.statusCode
    });
    metrics.observeHistogram(
      "linkqr_http_request_duration_seconds",
      durationSeconds,
      { method: request.method, route }
    );

    if (reply.statusCode >= 400) {
      metrics.incCounter("linkqr_http_errors_total", {
        route,
        status: reply.statusCode
      });

      if (route.startsWith("/v1/auth/")) {
        metrics.incCounter("linkqr_auth_errors_total", {
          operation: route.replace("/v1/auth/", "") || "unknown",
          status: reply.statusCode
        });
      }

      if (route === "/v1/google-play/verify") {
        metrics.incCounter("linkqr_billing_errors_total", {
          status: reply.statusCode
        });
      }
    }

    if (durationSeconds >= 1) {
      request.log.warn({
        event: "slow_request",
        requestId: request.id,
        method: request.method,
        route,
        status: reply.statusCode,
        durationMs: Math.round(durationSeconds * 1000)
      });
    }
  });

  if (options.auth?.enabled && options.authStore) {
    if (!options.authEmailSender) {
      throw new Error("Auth email sender is required when authentication is enabled.");
    }
    registerAuthRoutes(
      app,
      options.authStore,
      options.auth,
      options.authEmailSender
    );
  }

  if (options.saas?.enabled && options.saasStore) {
    registerSaaSRoutes(
      app,
      options.saasStore,
      options.saas,
      options.auth?.enabled ? options.authStore : undefined
    );
  }

  app.get("/health", async () => {
    metrics.setGauge("linkqr_liveness", 1);
    return {
      ok: true,
      service: "linkqr-billing-backend"
    };
  });

  app.get("/ready", async (request, reply) => {
    try {
      const ready = options.readinessCheck
        ? await options.readinessCheck()
        : true;

      metrics.setGauge("linkqr_readiness", ready ? 1 : 0);
      metrics.setGauge("linkqr_database_health", ready ? 1 : 0);

      if (!ready) {
        return reply.code(503).send({
          ready: false,
          service: "linkqr-billing-backend"
        });
      }

      return {
        ready: true,
        service: "linkqr-billing-backend"
      };
    } catch (error) {
      metrics.setGauge("linkqr_readiness", 0);
      metrics.setGauge("linkqr_database_health", 0);
      request.log.error({
        event: "readiness_check_failed",
        requestId: request.id,
        error: error instanceof Error ? error.name : "UNKNOWN_ERROR"
      });

      return reply.code(503).send({
        ready: false,
        service: "linkqr-billing-backend"
      });
    }
  });

  app.get("/metrics", async (request, reply) => {
    if (!options.observabilityToken) {
      return reply.code(404).send({
        error: "NOT_FOUND"
      });
    }

    const authorization = request.headers.authorization ?? "";
    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!isBearerTokenAuthorized(match?.[1] ?? null, options.observabilityToken)) {
      return reply.code(401).send({
        error: "UNAUTHORIZED"
      });
    }

    reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return metrics.renderPrometheus();
  });

  app.post("/v1/google-play/verify", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        verified: false,
        error: "INVALID_REQUEST"
      });
    }

    const { purchaseToken, productId } = parsed.data;

    if (productId !== options.proProductId) {
      return reply.code(400).send({
        verified: false,
        error: "UNKNOWN_PRODUCT"
      });
    }

    let authenticatedUserId: string | null = null;
    if (options.auth?.enabled && options.authStore) {
      const user = getAuthenticatedUser(request, options.authStore);
      if (!user) {
        return reply.code(401).send({
          verified: false,
          error: "UNAUTHORIZED"
        });
      }
      authenticatedUserId = user.id;
    }

    try {
      const alreadyKnown = store.hasPurchaseToken(purchaseToken);

      const purchase = await verifier.verifyOneTimeProduct(
        options.packageName,
        productId,
        purchaseToken
      );

      if (purchase.purchaseState !== 0) {
        return reply.code(409).send({
          verified: false,
          pro: false,
          pending: purchase.purchaseState === 2,
          error: "PURCHASE_NOT_COMPLETED"
        });
      }

      if (purchase.acknowledgementState !== 1) {
        await verifier.acknowledgeOneTimeProduct(
          options.packageName,
          productId,
          purchaseToken
        );
      }

      store.save({
        purchaseToken,
        productId,
        userId: authenticatedUserId,
        verifiedAt: Date.now()
      });

      return {
        verified: true,
        pro: true,
        alreadyKnown
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(502).send({
        verified: false,
        error: "GOOGLE_PLAY_VERIFICATION_FAILED"
      });
    }
  });

  return app;
}

async function main() {
  const config = loadConfig();

  const verifier = new GooglePlayVerifier(
    config.GOOGLE_SERVICE_ACCOUNT_JSON_B64
  );
  const store = new PurchaseStore(config.DATABASE_PATH);
  const saasStore = new SaaSStore(config.DATABASE_PATH);
  const backupManager = config.DATABASE_BACKUP.enabled && config.DATABASE_BACKUP.directory
    ? new SqliteBackupManager({
        sourcePath: config.DATABASE_PATH,
        backupDirectory: config.DATABASE_BACKUP.directory
      })
    : null;
  const authStore = new AuthStore(
    config.DATABASE_PATH,
    config.AUTH.sessionDays * 24 * 60 * 60 * 1000,
    config.AUTH.verificationLifetimeMs,
    config.AUTH.passwordResetLifetimeMs
  );

  const apiProtectionStore = new SqliteApiProtectionStore(config.DATABASE_PATH);

  const authEmailSender = config.AUTH.enabled
    ? new WebhookAuthEmailSender(
        config.LINKQR_AUTH_EMAIL_WEBHOOK_URL!,
        config.LINKQR_AUTH_EMAIL_WEBHOOK_TOKEN!
      )
    : undefined;

  const app = buildServer(verifier, store, {
    packageName: config.GOOGLE_PLAY_PACKAGE_NAME,
    proProductId: config.GOOGLE_PLAY_PRO_PRODUCT_ID,
    auth: config.AUTH,
    authStore,
    authEmailSender,
    saas: config.SAAS,
    saasStore,
    observabilityToken: config.OBSERVABILITY_TOKEN,
    apiProtectionStore,
    apiRateLimitPerMinute: config.API_PROTECTION.rateLimitPerMinute,
    apiWriteRateLimitPerMinute: config.API_PROTECTION.writeRateLimitPerMinute,
    apiIdempotencyTtlMs: config.API_PROTECTION.idempotencyTtlMs,
    readinessCheck: () => {
      store.healthCheck();
      saasStore.healthCheck();
      authStore.healthCheck();
      return true;
    }
  });

  const close = async () => {
    backupManager?.stop();
    await app.close();
    store.close();
    saasStore.close();
    authStore.close();
    apiProtectionStore.close();
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({
    host: "0.0.0.0",
    port: config.PORT
  });

  if (backupManager) {
    try {
      await backupManager.backupNow();
    } catch (error) {
      app.log.error({
        event: "database_backup_failed",
        error: error instanceof Error ? error.name : "UNKNOWN_ERROR"
      });
    }

    backupManager.start(config.DATABASE_BACKUP.intervalMs, (error) => {
      app.log.error({
        event: "database_backup_failed",
        error: error instanceof Error ? error.name : "UNKNOWN_ERROR"
      });
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
