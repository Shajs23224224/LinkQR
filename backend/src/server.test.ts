import { describe, expect, it, vi } from "vitest";
import { buildServer } from "./server.js";
import type { GooglePlayVerifier } from "./googlePlay.js";
import type { PurchaseStore } from "./store.js";

const options = {
  packageName: "com.linkqr",
  proProductId: "linkqr_pro"
};

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
