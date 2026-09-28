import Database from "better-sqlite3";
import { createHash } from "node:crypto";

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export type IdempotencyRecord = {
  key: string;
  scope: string;
  requestHash: string;
  statusCode: number;
  responseBody: string;
  contentType: string | null;
  createdAt: number;
  expiresAt: number;
};

export type IdempotencyClaim =
  | { kind: "new" }
  | { kind: "replay"; record: IdempotencyRecord }
  | { kind: "conflict" }
  | { kind: "in_progress" };

export class SqliteApiProtectionStore {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
        bucket_key TEXT PRIMARY KEY,
        window_started_at INTEGER NOT NULL,
        count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_api_rate_limit_expiry
        ON api_rate_limit_buckets(expires_at);

      CREATE TABLE IF NOT EXISTS api_idempotency_keys (
        idempotency_key TEXT NOT NULL,
        scope TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_body TEXT NOT NULL,
        content_type TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (idempotency_key, scope)
      );

      CREATE INDEX IF NOT EXISTS idx_api_idempotency_expiry
        ON api_idempotency_keys(expires_at);
    `);
  }

  consumeRateLimit(
    bucketKey: string,
    limit: number,
    windowMs: number,
    now = Date.now()
  ): RateLimitDecision {
    const transaction = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM api_rate_limit_buckets WHERE expires_at <= ?")
        .run(now);

      const existing = this.db
        .prepare("SELECT window_started_at, count FROM api_rate_limit_buckets WHERE bucket_key = ?")
        .get(bucketKey) as
        | { window_started_at: number; count: number }
        | undefined;

      if (!existing || now >= existing.window_started_at + windowMs) {
        this.db
          .prepare(`
            INSERT INTO api_rate_limit_buckets
              (bucket_key, window_started_at, count, expires_at)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(bucket_key) DO UPDATE SET
              window_started_at = excluded.window_started_at,
              count = excluded.count,
              expires_at = excluded.expires_at
          `)
          .run(bucketKey, now, now + windowMs);

        return {
          allowed: true,
          limit,
          remaining: Math.max(0, limit - 1),
          retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000))
        };
      }

      if (existing.count >= limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((existing.window_started_at + windowMs - now) / 1000)
          )
        };
      }

      const nextCount = existing.count + 1;
      this.db
        .prepare("UPDATE api_rate_limit_buckets SET count = ? WHERE bucket_key = ?")
        .run(nextCount, bucketKey);

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - nextCount),
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((existing.window_started_at + windowMs - now) / 1000)
        )
      };
    });

    return transaction();
  }

  claimIdempotency(
    key: string,
    scope: string,
    requestHash: string,
    ttlMs: number,
    now = Date.now()
  ): IdempotencyClaim {
    const transaction = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM api_idempotency_keys WHERE expires_at <= ?")
        .run(now);

      const existing = this.db
        .prepare(`
          SELECT
            idempotency_key,
            scope,
            request_hash,
            status_code,
            response_body,
            content_type,
            created_at,
            expires_at
          FROM api_idempotency_keys
          WHERE idempotency_key = ? AND scope = ?
        `)
        .get(key, scope) as IdempotencyRecord | undefined;

      if (existing) {
        if (existing.requestHash !== requestHash) {
          return { kind: "conflict" } as const;
        }

        if (existing.statusCode === 0) {
          return { kind: "in_progress" } as const;
        }

        return { kind: "replay", record: existing } as const;
      }

      this.db
        .prepare(`
          INSERT INTO api_idempotency_keys
            (
              idempotency_key,
              scope,
              request_hash,
              status_code,
              response_body,
              content_type,
              created_at,
              expires_at
            )
          VALUES (?, ?, ?, 0, '', NULL, ?, ?)
        `)
        .run(key, scope, requestHash, now, now + ttlMs);

      return { kind: "new" } as const;
    });

    return transaction();
  }

  finalizeIdempotency(
    key: string,
    scope: string,
    requestHash: string,
    statusCode: number,
    responseBody: string,
    contentType: string | null,
    now = Date.now()
  ): void {
    this.db
      .prepare(`
        UPDATE api_idempotency_keys
        SET
          status_code = ?,
          response_body = ?,
          content_type = ?,
          created_at = ?
        WHERE
          idempotency_key = ?
          AND scope = ?
          AND request_hash = ?
          AND status_code = 0
      `)
      .run(
        statusCode,
        responseBody,
        contentType,
        now,
        key,
        scope,
        requestHash
      );
  }

  purgeExpired(now = Date.now()): void {
    this.db
      .prepare("DELETE FROM api_idempotency_keys WHERE expires_at <= ?")
      .run(now);
    this.db
      .prepare("DELETE FROM api_rate_limit_buckets WHERE expires_at <= ?")
      .run(now);
  }

  close(): void {
    this.db.close();
  }
}

export function hashRequestBody(body: unknown): string {
  const serialized = JSON.stringify(body ?? null);
  return createHash("sha256").update(serialized).digest("hex");
}

export function hashPrincipal(
  authorizationHeader: string | undefined,
  apiKey: string | undefined,
  ip: string
): string {
  return createHash("sha256")
    .update(authorizationHeader ?? apiKey ?? ip)
    .digest("hex");
}
