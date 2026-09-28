# LinkQR — SaaS foundation

## Phase 13
Phase 13 prepares LinkQR for a future cloud/SaaS model without making the Android app dependent on a network connection.

## Current architecture
- Local Room storage remains the source for the offline application.
- SaaS persistence is isolated in the backend.
- Workspaces are multi-tenant containers with their own QR records.
- Every QR record is scoped by workspaceId.
- Plans are represented as FREE and PRO.
- QR quotas are configurable per plan.
- SaaS routes are versioned under /v1/saas.
- SaaS routes are disabled by default.
- Enabled SaaS routes require the backend-only x-linkqr-api-key.

## API foundation
Available when SaaS is enabled:
- GET /v1/saas/config
- POST /v1/saas/workspaces
- GET /v1/saas/workspaces/:workspaceId
- POST /v1/saas/workspaces/:workspaceId/qr
- GET /v1/saas/workspaces/:workspaceId/qr

The QR sync contract preserves the existing LinkQR data required for rendering and favorites:
- record ID
- QR type
- payload
- creation time
- favorite state
- foreground color
- background color
- margin

## Security boundary
The SaaS API uses an environment-provided API key as an initial server-side protection layer. The Android client does not receive this key and the feature is disabled by default.

This is a preparation layer, not a finished end-user authentication system. A production SaaS deployment should add user authentication, workspace membership, role-based authorization, rate limiting, audit logging and per-user subscription enforcement before exposing the API publicly.

## Configuration
Enable only on a controlled backend environment:

LINKQR_SAAS_ENABLED=true
LINKQR_SAAS_API_KEY=replace-with-server-secret
LINKQR_SAAS_FREE_QR_LIMIT=100
LINKQR_SAAS_PRO_QR_LIMIT=10000

The API key must never be committed to the repository or embedded in the Android application.

## Roadmap after Phase 13
1. User authentication and sessions.
2. Workspace membership and roles.
3. Cloud sync conflict resolution.
4. Server-side subscription state.
5. Rate limiting and abuse protection.
6. Observability and audit logs.
7. Privacy/data retention controls.
8. Web dashboard and public API.