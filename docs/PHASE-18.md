# LinkQR — Phase 18: Production hardening and Release Candidate

## Objective

Turn the current LinkQR 1.0 implementation into a verifiable release candidate without adding new product functionality.

## Implemented

### Android release hardening
- Release builds enable R8/minification.
- Release resource shrinking is enabled.
- A dedicated `app/proguard-rules.pro` file is present for future project-specific keep rules.
- Debug and release SaaS endpoints remain separated.
- Release cleartext traffic remains disabled.
- No signing keys or production secrets are stored in the repository.

### Backend HTTP hardening
- Fastify request body limit is 64 KiB.
- API responses send `Cache-Control: no-store`.
- API responses send `X-Content-Type-Options: nosniff`.
- Added `GET /ready` for container/readiness checks.
- Existing `GET /health` remains available.

### Backend configuration hardening
- SaaS administrative API keys must contain at least 32 characters.
- The API key remains server-side only.
- SaaS remains disabled by default in the example configuration.

### Container hardening
- Multi-stage Docker build.
- Runtime image excludes development dependencies.
- Container runs as the non-root `node` user.
- SQLite data is stored under `/data`.
- Docker volume is declared for persistence.
- Docker healthcheck uses `/ready`.

### CI
Android CI now verifies:
- JVM unit tests.
- Debug APK.
- Release APK.
- Release AAB.

Release artifacts are uploaded for inspection. The artifacts are unsigned by design.

## Verification

Additional tests cover:
- readiness endpoint;
- response security headers;
- oversized request rejection;
- weak SaaS API key rejection;
- minimum 32-character SaaS key acceptance.

## Production configuration boundary

The repository deliberately does not contain:
- Google service account credentials;
- Play Console signing keys;
- production AdMob secrets/configuration;
- SaaS administrative keys.

Those values must be injected by the deployment environment or secure build system.

## Release candidate gate

Phase 18 is complete only when all of the following are true:

1. Backend tests pass.
2. Backend TypeScript build passes.
3. Android unit tests pass.
4. Debug APK builds.
5. Release APK builds with R8/resource shrinking.
6. Release AAB builds.
7. No production credentials are committed.
8. Release cleartext traffic remains disabled.
9. Backend container starts as a non-root user and reports readiness.
10. Publication checklist is updated.

## Explicitly deferred

Phase 18 does not yet implement:
- email verification;
- password reset;
- MFA;
- distributed rate limiting;
- background sync;
- PostgreSQL;
- server-side PRO entitlement redesign;
- Dynamic QR;
- admin panel;
- high availability.

Those belong to later phases in `docs/ROADMAP-18-ONWARD.md`.
