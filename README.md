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

1. Foundations
2. MVP URL QR
3. Save + share
4. All QR types
5. History + favorites
6. Scanner
7. Customization
8. Security + quality
9. FREE monetization
10. PRO billing
11. Optimization
12. Testing
13. Publication
14. SaaS preparation


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
