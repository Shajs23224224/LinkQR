# LinkQR — Phase 23: API and platform robustness

## Objective

Harden the HTTP platform against duplicate requests, abusive request volume and contract drift while preserving the existing `/v1` sync/authentication APIs.

## Implemented

### API versioning
- Existing public API remains explicitly versioned under `/v1`.
- Responses from `/v1/*` include `X-LinkQR-API-Version: 1`.
- Versioning remains path-based so future `/v2` contracts can evolve without silently changing `/v1`.

### Rate limiting
- Added a persistent SQLite-backed API protection store.
- Fixed-window limits are tracked per method, route and principal fingerprint.
- Separate limits exist for reads and writes.
- Rate-limit responses expose `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` on 429.
- Rate-limit state is shared through the configured persistence database and is therefore restart-safe.

Default configuration:
```env
LINKQR_API_RATE_LIMIT_PER_MINUTE=300
LINKQR_API_WRITE_RATE_LIMIT_PER_MINUTE=120
```

The persistence adapter is isolated so PostgreSQL/Redis can replace it when multi-host distributed infrastructure is introduced.

### Idempotency
- Added `Idempotency-Key` support for critical POST operations:
  - Google Play purchase verification.
  - SaaS workspace creation.
- Keys are scoped to route and principal fingerprint.
- Reusing a key with the same request replays the original response.
- Reusing a key with a different request returns `IDEMPOTENCY_KEY_REUSED`.
- Concurrent reuse while the first request is active returns `IDEMPOTENCY_IN_PROGRESS`.
- Keys are retained for a configurable TTL.

Configuration:
```env
LINKQR_API_IDEMPOTENCY_TTL_HOURS=24
```

### Error contract
- Added a Fastify global error handler for uncaught HTTP failures.
- Internal errors do not leak stack traces or implementation details.
- Body-too-large, malformed request and not-found errors map to stable error codes.

### Sync safety
- Existing sync push semantics remain idempotent through version/deviceId conflict handling.
- QR payload responses are not persisted in the HTTP idempotency cache for sync pushes.

## Validation

Phase 23 is complete when:
1. `/v1` responses expose explicit API version metadata.
2. Global read/write rate limits are enforced and configurable.
3. Critical operations replay safely with idempotency keys.
4. Reusing an idempotency key with a different request is rejected.
5. Unhandled API errors use a stable, non-sensitive error contract.
6. Existing auth, billing, sync and Android tests remain green.
7. GitHub Actions is green on the final commit.

## Deferred
- Native PostgreSQL/Redis distributed rate limiting for multi-host deployments.
- Full OpenAPI generation and client SDK generation.
- ETag/If-None-Match optimization where response volatility makes it worthwhile.
- Formal deprecation headers and `/v2` rollout policy.
- Replay protection mechanisms tied to signed client requests.