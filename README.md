# LinkQR

Offline-first Android QR generator, scanner and manager.

## Phase 0 — Foundations

LinkQR starts as a lightweight Android application with clear separation between UI, domain logic and infrastructure.

### Stack

- Kotlin
- Jetpack Compose + Material 3
- Navigation Compose
- minSdk 24
- compileSdk / targetSdk 37
- Single app module
- Manual dependency injection direction
- Lightweight Clean Architecture + MVVM direction

### Current milestone

Phase 0 establishes the Gradle project, Android application module, Compose runtime, Material 3, Navigation Compose, base MainActivity and the initial QR domain model.

### Planned package structure

com.linkqr/
- core/
- data/
- domain/
- qr/
- scanner/
- storage/
- monetization/
- features/

The domain layer must remain independent from Compose, Room, CameraX, ZXing, MediaStore, AdMob and Play Billing.

### Development rule

Implement → compile → test → fix → freeze → next phase.

### Roadmap

1. MVP URL QR
2. Save + share
3. All QR types
4. History + favorites
5. Scanner
6. Customization
7. Security + quality
8. FREE monetization
9. PRO billing
10. Optimization
11. Testing
12. Publication
13. SaaS preparation
14. Functional user authentication


## Phase 8 — FREE monetization

Phase 8 adds a non-blocking FREE monetization layer without coupling ads to QR generation, storage or domain logic.

### Included

- Google Mobile Ads SDK 25.5.0.
- Google UMP SDK 4.0.0 for consent/privacy flows.
- Adaptive banner ads on the Home screen for FREE users.
- FREE/PRO entitlement abstraction ready for Phase 9 billing.
- Privacy options entry point when UMP requires one.
- Ads never become a prerequisite for QR generation, scanning, history or favorites.
- Offline behavior remains functional; without an available consent/ad request, the banner is simply not shown.
- Debug builds use Google's official test banner ID.

### Production AdMob configuration

The repository intentionally uses Google's sample AdMob app ID and banner ad unit while developing.

For a production release, provide your own IDs through Gradle properties:

```bash
./gradlew assembleRelease \
  -PLINKQR_ADMOB_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY \
  -PLINKQR_ADMOB_BANNER_AD_UNIT_ID=ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ
```

Never click your own production ads during testing. Replace the sample IDs only when the AdMob app and ad unit are configured for release.


## Phase 9 — PRO Billing

Phase 9 integrates Google Play Billing for a non-consumable LinkQR PRO product.

### Included

- Google Play Billing Library 9.1.0.
- Product ID: `linkqr_pro`.
- One-time PRO purchase flow using `ProductDetails`.
- Purchase restoration through `queryPurchasesAsync`.
- Pending purchase handling; PRO is not granted until Google Play reports the purchase as `PURCHASED`.
- Purchase acknowledgement for non-consumable PRO purchases.
- Cached local PRO entitlement for continuity while temporarily offline.
- Online Google Play purchase state remains authoritative and can revoke the cached entitlement when a successful purchase query no longer reports PRO.
- PRO automatically suppresses FREE banner ads.
- Dedicated LinkQR PRO screen with localized Play price and restore action.

### Google Play Console setup

Before a real purchase can be made, create a **one-time product** in the LinkQR app in Play Console with this exact product ID:

```text
linkqr_pro
```

Configure it as a non-consumable purchase that grants the permanent PRO benefit.

The application currently does not contain a hard-coded price. The price shown to the user comes from Google Play through `ProductDetails`, so currency and localized formatting remain Play-managed.

### Testing

Use a Play Console testing track and licensed tester account to exercise the complete purchase lifecycle. Do not replace the product ID with a local placeholder: the app intentionally requires the real Play Console product ID `linkqr_pro`.

The local entitlement cache is a convenience for temporary offline continuity; it is not a substitute for server-side purchase verification for a security-sensitive production service.


## Phase 10 — Optimization

Phase 10 keeps LinkQR lightweight for low-end Android devices and reduces avoidable allocation/recomposition work.

### Included

- Centralized QR bitmap sizing policy with a 768 px default.
- Batched QR bitmap rendering through `Bitmap.setPixels` instead of calling `Bitmap.setPixel` for every pixel.
- History flows use `distinctUntilChanged()` after domain mapping to avoid redundant UI emissions.
- Pure JVM unit coverage for QR bitmap pixel conversion without requiring the Android runtime.
- Core QR generation remains synchronous from the UI's current architecture; no network dependency was introduced into generation.


## Phase 11 — Testing

Phase 11 expands automated regression coverage around the app's highest-risk logic and preserves test evidence in CI.

### Included

- Boundary coverage for QR bitmap sizes from 128 px to 1536 px.
- Pure JVM coverage for QR pixel conversion without requiring the Android runtime.
- Coverage for all seven QR content classifications.
- Security regression tests for QR open policies and WhatsApp host spoofing.
- UTF-8 byte-limit tests at and beyond the 2048-byte payload boundary.
- Expanded persistence tests for custom QR design data, deletion and legacy/unknown types.
- Expanded validation tests for colors, margins, phone, email and location inputs.
- Android CI now publishes JUnit test results and HTML test reports as workflow artifacts, including failed runs when available.


## Phase 12 — Publication

LinkQR is prepared for the publication workflow with version **1.0.0**, a launcher logo, a release APK CI build, and an explicit Play Console deployment checklist.

### Included

- LinkQR launcher logo registered in the Android manifest.
- QR customization with RGB sliders for foreground and background colors.
- Live HEX representation of the selected RGB color.
- Default QR: black `#000000` on white `#FFFFFF`.
- Existing contrast and margin validation preserved.
- CI builds both debug and release APKs.
- Publication documentation in `docs/PUBLICATION.md`.

The CI release artifact is unsigned by design. Production signing credentials must remain outside the repository.


## Phase 13 — Preparación SaaS

Phase 13 adds a backend foundation for a future cloud version of LinkQR without making the Android app dependent on the Internet.

### Included

- Multi-tenant workspaces.
- QR records scoped by workspace.
- FREE/PRO plan model and configurable record quotas.
- Versioned SaaS API under /v1/saas.
- Server-side API-key protection.
- SaaS feature flag disabled by default.
- Dedicated SQLite persistence for workspace and synced QR data.
- Automated tests for authentication, workspace creation, QR synchronization and quota enforcement.
- Architecture and security notes in docs/SAAS.md.

The Android application remains offline-first. The SaaS API is preparation for a future authenticated cloud product and is not yet exposed as an end-user account system.


## Phase 14 — Autenticación de usuarios funcional

Phase 14 adds the backend identity layer required for the SaaS product.

### Included

- User registration with normalized email.
- Secure password hashing with Node.js scrypt and per-password salt.
- Login with server-side opaque sessions.
- 30-day configurable session lifetime.
- Current-user endpoint and logout/revocation.
- SQLite persistence for users and sessions.
- Workspace ownership tied to the authenticated user.
- Cross-user workspace isolation.
- Authenticated Google Play purchase attribution.
- Client users cannot self-assign the PRO plan.
- Legacy server-to-server API-key access remains available for controlled administration.

### Authentication endpoints

When LINKQR_AUTH_ENABLED=true:

- POST /v1/auth/register
- POST /v1/auth/login
- GET /v1/auth/me
- POST /v1/auth/logout

Android now includes a functional account screen with registration, login, session restoration and logout. Authentication remains optional: QR generation, history, favorites and scanning continue to work offline without an account.


See `docs/AUTH.md` for the authentication flow and deployment configuration.


## Phase 16 — Preparación de sincronización offline-first

Phase 16 prepares local QR records and the SaaS contract for future cloud synchronization.

### Included

- Stable client-generated sync IDs.
- Local `updatedAt` and `syncStatus` metadata.
- Room 2→3 migration with legacy-record compatibility.
- Pending-sync DAO support.
- SaaS persistence of `updatedAt` with backward-compatible backend migration.
- Deletion propagation and multi-device conflict resolution intentionally deferred to a later tombstone/versioning phase.

See `docs/PHASE-16.md` for the exact scope.

## Phase 17 — Tombstones y resolución de conflictos

Phase 17 convierte la preparación de Fase 16 en un protocolo de sincronización multi-dispositivo.

### Incluido

- Tombstones locales para que las eliminaciones puedan propagarse a la nube.
- version y deviceId por registro.
- Resolución determinista compartida entre Android y backend.
- API SaaS que rechaza versiones obsoletas y devuelve el registro ganador.
- Tombstones conservados en SQLite, pero excluidos de historial y cuota activa.
- Cliente Android autenticado para push/pull.
- Motor de sincronización que aplica ganadores y sincroniza tombstones.
- Migración Room 3→4 y migración SQLite del backend.
- CI separado para pruebas/backend build y Android unit tests/debug build.

See docs/PHASE-17.md for the exact protocol and deferred scaling work.



## Arquitectura futura — Fases 18–30

La Fase 17 cierra el núcleo de sincronización multi-dispositivo. A partir de aquí, el desarrollo se divide en cuatro bloques: endurecimiento de producción, seguridad/operación SaaS, escalabilidad y evolución del producto.

- **Fase 18:** hardening y Release Candidate 1.0.
- **Fase 19:** seguridad avanzada de identidad: verificación de correo, recuperación de contraseña, sesiones, rate limiting y MFA.
- **Fase 20:** sincronización resiliente con WorkManager, reintentos, cursors y background sync.
- **Fase 21:** observabilidad, métricas, logging estructurado, health/readiness y alertas.
- **Fase 22:** arquitectura de persistencia escalable y preparación para PostgreSQL cuando los datos lo justifiquen.
- **Fase 23:** API idempotente, rate limiting distribuido, versionado, paginación y contratos robustos.
- **Fase 24:** billing y entitlements PRO verificados por servidor.
- **Fase 25:** privacidad, retención, exportación y eliminación de datos.
- **Fase 26:** pruebas de carga, estrés, soak y medición de capacidad.
- **Fase 27:** calidad Android de producción, accesibilidad y matriz de dispositivos.
- **Fase 28:** Dynamic QR y analítica.
- **Fase 29:** panel administrativo, RBAC y soporte operativo.
- **Fase 30:** alta disponibilidad, backups, recuperación y continuidad.

La arquitectura detallada, dependencias y gates de salida están en [docs/ROADMAP-18-ONWARD.md](docs/ROADMAP-18-ONWARD.md).

La regla del proyecto permanece: **implementar → compilar → probar → revisar → corregir → congelar → siguiente fase**.

## Phase 18 — Hardening de producción y Release Candidate

La Fase 18 convierte el estado actual en una candidate de producción verificable: R8/resource shrinking en release, límites y headers HTTP, readiness del backend, contenedor no-root, claves SaaS con mínimo de 32 caracteres y CI de APK/AAB de release.

See `docs/PHASE-18.md` for the exact scope and exit gate.
