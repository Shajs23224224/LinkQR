# LinkQR — SaaS foundation

## Phase 13
Phase 13 prepares LinkQR for a future cloud/SaaS model without making the Android app dependent on a network connection.

## Phase 14 — User authentication
Phase 14 adds a functional account/session layer for the future cloud product.

### Authentication API
When `LINKQR_AUTH_ENABLED=true`:

- POST `/v1/auth/register`
- POST `/v1/auth/login`
- GET `/v1/auth/me`
- POST `/v1/auth/logout`

Registration and login return an opaque bearer session token. The token is sent as:

```
Authorization: Bearer <session-token>
```

Sessions are stored server-side as SHA-256 hashes, not as raw bearer tokens, and expire after the configured number of days. Logout revokes the current session.

Passwords are hashed with Node's built-in scrypt implementation and a per-password random salt. Plaintext passwords are never stored.

### Workspace authorization
User authentication is now connected to SaaS tenancy:

- A user-created workspace is owned by that authenticated user.
- User-created workspaces always start on FREE; the client cannot self-assign PRO.
- Users can list and access only their own workspaces.
- QR records are only readable/writable through a workspace the authenticated user owns.
- The legacy `x-linkqr-api-key` remains available for controlled server-side administration.

### Purchase attribution
When authentication is enabled, `/v1/google-play/verify` requires a valid bearer session and attributes the verified purchase to that authenticated user. The backend no longer trusts a client-supplied arbitrary `userId`.

### Configuration
```env
LINKQR_AUTH_ENABLED=true
LINKQR_AUTH_SESSION_DAYS=30
LINKQR_SAAS_ENABLED=true
LINKQR_SAAS_API_KEY=replace-with-server-secret
LINKQR_SAAS_FREE_QR_LIMIT=100
LINKQR_SAAS_PRO_QR_LIMIT=10000
```

The API key is an administrative/server credential and must never be embedded in the Android application.

### Security notes
Phase 14 intentionally does not implement email verification, password reset email delivery, MFA, social login or a distributed rate-limiter. Those require additional infrastructure. A production deployment should add those controls before treating this as a complete consumer identity platform.

## Current architecture

- Local Room storage remains the source for the offline Android application.
- SaaS persistence is isolated in the backend.
- Workspaces are multi-tenant containers with their own QR records.
- Every QR record is scoped by workspaceId.
- Plans are represented as FREE and PRO.
- QR quotas are configurable per plan.
- SaaS routes are versioned under /v1/saas.
- SaaS routes accept either the backend API key or a valid authenticated user session.
- Auth is disabled by default.

## Phase 14 test coverage

Automated backend tests cover:

- account registration
- email normalization
- duplicate registration rejection
- password verification
- invalid credentials
- session creation and lookup
- logout/revocation
- unauthenticated /v1/auth/me
- workspace ownership
- cross-user workspace isolation
- prevention of client-side PRO self-assignment
- authenticated Google Play purchase attribution
