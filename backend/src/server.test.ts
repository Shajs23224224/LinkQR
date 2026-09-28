import { describe, expect, it, vi } from "vitest";
import { buildServer } from "./server.js";
import type { GooglePlayVerifier } from "./googlePlay.js";
import type { PurchaseStore } from "./store.js";
import type { AuthStoreLike } from "./authRoutes.js";
import { SqliteApiProtectionStore } from "./apiProtection.js";

const emailSender = {
  send: vi.fn().mockResolvedValue(undefined)
};

const options = {
  packageName: "com.linkqr",
  proProductId: "linkqr_pro"
};

describe("Production hardening", () => {
  it("exposes readiness and security headers", async () => {
    const verifier = {} as GooglePlayVerifier;
    const store = {} as PurchaseStore;
    const app = buildServer(verifier, store, options);

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ready: true,
      service: "linkqr-billing-backend"
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-request-id"]).toMatch(/^req-/);

    await app.close();
  });


  it("returns 503 when the readiness dependency check fails", async () => {
    const verifier = {} as GooglePlayVerifier;
    const store = {} as PurchaseStore;
    const app = buildServer(verifier, store, {
      ...options,
      readinessCheck: () => false
    });

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      ready: false,
      service: "linkqr-billing-backend"
    });

    await app.close();
  });

  it("protects metrics with the observability token", async () => {
    const verifier = {} as GooglePlayVerifier;
    const store = {} as PurchaseStore;
    const token = "observability-secret-".padEnd(32, "x");
    const app = buildServer(verifier, store, {
      ...options,
      observabilityToken: token
    });

    const unauthorized = await app.inject({
      method: "GET",
      url: "/metrics"
    });
    expect(unauthorized.statusCode).toBe(401);

    const metrics = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: {
        authorization: "Bearer " + token
      }
    });

    expect(metrics.statusCode).toBe(200);
    expect(metrics.headers["content-type"]).toContain("text/plain");
    expect(metrics.body).toContain("linkqr_process_uptime_seconds");

    await app.close();
  });

  it("rejects oversized request bodies", async () => {
    const verifier = {} as GooglePlayVerifier;
    const store = {} as PurchaseStore;
    const app = buildServer(verifier, store, options);

    const response = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      payload: {
        purchaseToken: "x".repeat(70_000),
        productId: "linkqr_pro"
      }
    });

    expect(response.statusCode).toBe(413);

    await app.close();
  });
});

describe("Google Play verification API", () => {
  it("rejects an unknown product", async () => {
    const verifier = {} as GooglePlayVerifier;
    const store = {} as PurchaseStore;
    const app = buildServer(verifier, store, options);

    const response = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      payload: {
        purchaseToken: "token",
        productId: "not-linkqr-pro"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      verified: false,
      error: "UNKNOWN_PRODUCT"
    });

    await app.close();
  });

  it("verifies and acknowledges a purchased PRO token", async () => {
    const verifier = {
      verifyOneTimeProduct: vi.fn().mockResolvedValue({
        purchaseToken: "token-123",
        productId: "linkqr_pro",
        purchaseState: 0,
        acknowledgementState: 0
      }),
      acknowledgeOneTimeProduct: vi.fn().mockResolvedValue(undefined)
    } as unknown as GooglePlayVerifier;

    const store = {
      hasPurchaseToken: vi.fn().mockReturnValue(false),
      save: vi.fn()
    } as unknown as PurchaseStore;

    const app = buildServer(verifier, store, options);

    const response = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      payload: {
        purchaseToken: "token-123",
        productId: "linkqr_pro",
        userId: "opaque-user-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      verified: true,
      pro: true,
      alreadyKnown: false
    });
    expect(verifier.acknowledgeOneTimeProduct).toHaveBeenCalledOnce();
    expect(store.save).toHaveBeenCalledOnce();

    await app.close();
  });

  it("requires an authenticated user for purchase attribution when auth is enabled", async () => {
    const verifier = {
      verifyOneTimeProduct: vi.fn().mockResolvedValue({
        purchaseToken: "token-123",
        productId: "linkqr_pro",
        purchaseState: 0,
        acknowledgementState: 0
      }),
      acknowledgeOneTimeProduct: vi.fn().mockResolvedValue(undefined)
    } as unknown as GooglePlayVerifier;

    const store = {
      hasPurchaseToken: vi.fn().mockReturnValue(false),
      save: vi.fn()
    } as unknown as PurchaseStore;

    const authStore: AuthStoreLike = {
      createUser: vi.fn(),
      findUserByEmail: vi.fn(),
      verifyCredentials: vi.fn(),
      createSession: vi.fn(),
      getUserBySessionToken: vi.fn((token: string) =>
        token === "session-1"
          ? {
              id: "user-1",
              email: "user@example.com",
              name: "User",
              createdAt: 1,
              emailVerified: true
            }
          : null
      ),
      getSessionByToken: vi.fn((token: string) =>
        token === "session-1"
          ? {
              sessionId: "session-1",
              user: {
                id: "user-1",
                email: "user@example.com",
                name: "User",
                createdAt: 1,
                emailVerified: true
              },
              createdAt: 1,
              expiresAt: 9999999999999
            }
          : null
      ),
      listSessions: vi.fn().mockReturnValue([]),
      revokeSession: vi.fn(),
      revokeSessionById: vi.fn(),
      revokeOtherSessions: vi.fn(),
      createEmailVerificationToken: vi.fn(),
      consumeEmailVerificationToken: vi.fn(),
      createPasswordResetToken: vi.fn(),
      resetPassword: vi.fn(),
      changePassword: vi.fn()
    };

    const app = buildServer(verifier, store, {
      ...options,
      auth: {
        enabled: true,
        sessionDays: 30
      },
      authStore,
      authEmailSender: emailSender
    });

    const unauthorized = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      payload: {
        purchaseToken: "token-123",
        productId: "linkqr_pro"
      }
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(store.save).not.toHaveBeenCalled();

    const authorized = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      headers: {
        authorization: "Bearer session-1"
      },
      payload: {
        purchaseToken: "token-123",
        productId: "linkqr_pro"
      }
    });

    expect(authorized.statusCode).toBe(200);
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1"
      })
    );

    await app.close();
  });

  it("does not grant PRO for pending purchases", async () => {
    const verifier = {
      verifyOneTimeProduct: vi.fn().mockResolvedValue({
        purchaseToken: "pending",
        productId: "linkqr_pro",
        purchaseState: 2,
        acknowledgementState: 0
      }),
      acknowledgeOneTimeProduct: vi.fn()
    } as unknown as GooglePlayVerifier;

    const store = {
      hasPurchaseToken: vi.fn(),
      save: vi.fn()
    } as unknown as PurchaseStore;

    const app = buildServer(verifier, store, options);

    const response = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      payload: {
        purchaseToken: "pending",
        productId: "linkqr_pro"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      verified: false,
      pro: false,
      pending: true,
      error: "PURCHASE_NOT_COMPLETED"
    });
    expect(store.save).not.toHaveBeenCalled();

    await app.close();
  });
});


describe("API platform robustness", () => {
  it("adds API version headers and enforces configurable rate limits", async () => {
    const verifier = {} as GooglePlayVerifier;
    const store = {} as PurchaseStore;
    const protection = new SqliteApiProtectionStore(":memory:");
    const app = buildServer(verifier, store, {
      ...options,
      apiProtectionStore: protection,
      apiRateLimitPerMinute: 1,
      apiWriteRateLimitPerMinute: 1
    });

    const first = await app.inject({
      method: "GET",
      url: "/v1/unknown"
    });
    expect(first.statusCode).toBe(404);
    expect(first.headers["x-linkqr-api-version"]).toBe("1");
    expect(first.headers["ratelimit-limit"]).toBe("1");

    const second = await app.inject({
      method: "GET",
      url: "/v1/unknown"
    });
    expect(second.statusCode).toBe(429);
    expect(second.json()).toMatchObject({
      error: "RATE_LIMITED"
    });

    await app.close();
    protection.close();
  });

  it("replays successful idempotent billing verification without repeating the provider call", async () => {
    const verifier = {
      verifyOneTimeProduct: vi.fn().mockResolvedValue({
        purchaseToken: "idempotent-token",
        productId: "linkqr_pro",
        purchaseState: 0,
        acknowledgementState: 1
      }),
      acknowledgeOneTimeProduct: vi.fn()
    } as unknown as GooglePlayVerifier;

    const store = {
      hasPurchaseToken: vi.fn().mockReturnValue(false),
      save: vi.fn()
    } as unknown as PurchaseStore;

    const protection = new SqliteApiProtectionStore(":memory:");
    const app = buildServer(verifier, store, {
      ...options,
      apiProtectionStore: protection
    });

    const headers = {
      "idempotency-key": "billing-key-1234"
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      headers,
      payload: {
        purchaseToken: "idempotent-token",
        productId: "linkqr_pro"
      }
    });

    const second = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      headers,
      payload: {
        purchaseToken: "idempotent-token",
        productId: "linkqr_pro"
      }
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(verifier.verifyOneTimeProduct).toHaveBeenCalledOnce();
    expect(store.save).toHaveBeenCalledOnce();

    await app.close();
    protection.close();
  });

  it("rejects reusing an idempotency key for a different request", async () => {
    const verifier = {
      verifyOneTimeProduct: vi.fn().mockResolvedValue({
        purchaseToken: "first",
        productId: "linkqr_pro",
        purchaseState: 2,
        acknowledgementState: 0
      }),
      acknowledgeOneTimeProduct: vi.fn()
    } as unknown as GooglePlayVerifier;

    const store = {
      hasPurchaseToken: vi.fn(),
      save: vi.fn()
    } as unknown as PurchaseStore;

    const protection = new SqliteApiProtectionStore(":memory:");
    const app = buildServer(verifier, store, {
      ...options,
      apiProtectionStore: protection
    });

    const first = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      headers: { "idempotency-key": "billing-key-5678" },
      payload: {
        purchaseToken: "first",
        productId: "linkqr_pro"
      }
    });

    const conflict = await app.inject({
      method: "POST",
      url: "/v1/google-play/verify",
      headers: { "idempotency-key": "billing-key-5678" },
      payload: {
        purchaseToken: "second",
        productId: "linkqr_pro"
      }
    });

    expect(first.statusCode).toBe(409);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      error: "IDEMPOTENCY_KEY_REUSED"
    });

    await app.close();
    protection.close();
  });
});
