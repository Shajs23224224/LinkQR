# LinkQR — Phase 19: Advanced identity security

## Objective

Harden the account layer for a public SaaS deployment while preserving LinkQR's offline-first behavior.

## Included

### Email verification
- New accounts start unverified.
- Login is blocked until the email is verified.
- Verification tokens are opaque, hashed at rest and single-use.
- Verification tokens expire after the configured lifetime.
- Resend endpoint uses a generic response that does not reveal whether an email exists.
- Existing pre-Phase-19 accounts are treated as verified during migration so the authentication upgrade does not lock out legacy users.

### Password recovery
- Password-reset requests always return a generic response.
- Reset tokens are opaque, hashed at rest, time-limited and single-use.
- Password reset revokes all existing sessions.
- Password changes revoke all existing sessions and return a fresh session to the current client.
- New passwords retain the existing scrypt password hashing policy.

### Session management
- Every session has a stable server-side session ID.
- Authenticated clients can list active sessions.
- Sessions can be revoked individually.
- All sessions except the current one can be revoked.
- Session tokens remain opaque and only SHA-256 hashes are stored.
- Session expiry and revocation remain enforced server-side.

### Abuse protection
- Authentication-sensitive routes have an in-memory per-IP rate limiter:
  - registration;
  - login;
  - email verification;
  - verification resend;
  - password-reset request;
  - password-reset confirmation.
- Rate-limited responses return HTTP 429 and Retry-After.
- Distributed rate limiting remains deferred to Phase 23.

### Email delivery boundary
- Added a generic `AuthEmailSender` abstraction.
- Production uses a configurable HTTPS webhook adapter.
- When authentication is enabled, the backend requires an email webhook URL and a server-only webhook bearer token.
- Raw verification/reset tokens are never persisted for later retrieval and are delivered only through the configured sender.
- The repository does not embed an email provider credential or SaaS webhook secret.

### Android
- Registration now waits for email verification instead of storing an unverified session.
- Account UI supports verification-resend.
- Login explains the unverified state.
- Password recovery can be requested from the login screen.
- Authenticated users can change their password.
- Password change rotates the session token.
- Offline QR generation, history, favorites and scanning remain available without authentication.

## Security properties

- Generic password-reset and resend responses reduce account-enumeration leakage.
- Verification/reset tokens are single-use under concurrent requests through atomic database updates.
- Password reset revokes all active sessions.
- Session revocation is server-side.
- Rate limits are intentionally local to one backend instance in this phase.

## Configuration

When `LINKQR_AUTH_ENABLED=true`, production must provide:

```env
LINKQR_AUTH_EMAIL_WEBHOOK_URL=https://...
LINKQR_AUTH_EMAIL_WEBHOOK_TOKEN=<32+ character secret>
LINKQR_AUTH_EMAIL_VERIFICATION_HOURS=24
LINKQR_AUTH_PASSWORD_RESET_MINUTES=30
```

The webhook contract receives a message with:
- `type`;
- `to`;
- `name`;
- `token`;
- `expiresAt`.

The email-delivery service is responsible for turning those values into a user-facing verification or password-reset link.

## API additions

- POST `/v1/auth/verify-email`
- POST `/v1/auth/resend-verification`
- POST `/v1/auth/password-reset/request`
- POST `/v1/auth/password-reset/confirm`
- POST `/v1/auth/password/change`
- GET `/v1/auth/sessions`
- DELETE `/v1/auth/sessions/:sessionId`
- POST `/v1/auth/sessions/revoke-others`

Existing:
- POST `/v1/auth/register`
- POST `/v1/auth/login`
- GET `/v1/auth/me`
- POST `/v1/auth/logout`

## Validation gate

Phase 19 is complete only when:
1. Backend tests pass.
2. Backend TypeScript build passes.
3. Android unit tests pass.
4. Debug APK builds.
5. Release APK/AAB build with Fase 18 hardening.
6. Verification, recovery, session lifecycle and rate-limit tests pass.
7. No authentication or email-delivery secret is committed.

## Deferred

- Distributed rate limiting.
- MFA.
- Full device/session metadata and trusted-device controls.
- External email-provider implementation beyond the webhook adapter.
- Background sync.
- Server-side PRO entitlement redesign.
