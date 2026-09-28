import { describe, expect, it, vi } from "vitest";
import { buildServer } from "./server.js";
import type { GooglePlayVerifier } from "./googlePlay.js";
import type { PurchaseStore } from "./store.js";
import type { AuthStoreLike } from "./authRoutes.js";

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
