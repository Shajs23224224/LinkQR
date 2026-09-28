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
