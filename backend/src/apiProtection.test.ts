import { describe, expect, it } from "vitest";
import { SqliteApiProtectionStore } from "./apiProtection.js";

describe("API protection store", () => {
  it("enforces a fixed-window rate limit and resets after expiry", () => {
    const store = new SqliteApiProtectionStore(":memory:");
    try {
      expect(store.consumeRateLimit("bucket", 2, 1000, 0).allowed).toBe(true);
      expect(store.consumeRateLimit("bucket", 2, 1000, 10).remaining).toBe(0);
      expect(store.consumeRateLimit("bucket", 2, 1000, 20)).toMatchObject({
        allowed: false,
        remaining: 0
      });
      expect(store.consumeRateLimit("bucket", 2, 1000, 1000)).toMatchObject({
        allowed: true,
        remaining: 1
      });
    } finally {
      store.close();
    }
  });

  it("claims, replays and rejects conflicting idempotency keys", () => {
    const store = new SqliteApiProtectionStore(":memory:");
    try {
      expect(store.claimIdempotency("key-1234", "POST:/v1/test:user", "hash-a", 60_000, 0)).toEqual({
        kind: "new"
      });

      expect(
        store.claimIdempotency("key-1234", "POST:/v1/test:user", "hash-a", 60_000, 1)
      ).toEqual({
        kind: "in_progress"
      });

      store.finalizeIdempotency(
        "key-1234",
        "POST:/v1/test:user",
        "hash-a",
        201,
        '{"created":true}',
        "application/json",
        2
      );

      expect(
        store.claimIdempotency("key-1234", "POST:/v1/test:user", "hash-a", 60_000, 3)
      ).toMatchObject({
        kind: "replay",
        record: {
          statusCode: 201,
          responseBody: '{"created":true}'
        }
      });

      expect(
        store.claimIdempotency("key-1234", "POST:/v1/test:user", "hash-b", 60_000, 4)
      ).toEqual({
        kind: "conflict"
      });
    } finally {
      store.close();
    }
  });
});
