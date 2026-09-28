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
- Performance-focused unit coverage for the QR bitmap renderer.
- Core QR generation remains synchronous from the UI's current architecture; no network dependency was introduced into generation.
