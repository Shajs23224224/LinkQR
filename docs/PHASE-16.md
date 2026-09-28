# LinkQR — Phase 16: Offline-first sync preparation

Phase 16 prepares the Android local model and SaaS API for cloud synchronization without introducing conflict resolution prematurely.

## Included

- Stable client-generated `syncId` for new QR records.
- `updatedAt` metadata on local QR records.
- `syncStatus` with `PENDING`/`SYNCED` states.
- Room migration 2 → 3 with backward-compatible defaults.
- Pending-sync DAO queries.
- Legacy records receive a `syncId` lazily before upload.
- Favorite changes update `updatedAt` and return to `PENDING`.
- SaaS QR records persist `updatedAt`.
- Existing SaaS databases migrate `updated_at` from `created_at`.
- Existing authentication, workspace isolation and quota behavior remain unchanged.

## Deliberately deferred

Phase 16 does **not** claim complete multi-device synchronization.

The following belong to the later conflict/deletion synchronization phase:

- tombstones for deletions;
- cloud deletion propagation;
- per-record version/revision or vector clocks;
- deterministic multi-device conflict resolution;
- full Android network sync worker/API client.

Until those mechanisms exist, local QR deletion remains local and cannot safely propagate to the cloud.

## Sync contract

Each local record now has:

- `syncId`: stable logical identity across devices/cloud;
- `updatedAt`: last local mutation timestamp;
- `syncStatus`: local upload state.

The backend accepts and stores `updatedAt`, but does not use it to silently resolve competing device versions.

## Validation

Required validation remains:

1. Android unit tests.
2. Android debug build.
3. Backend TypeScript build.
4. Backend Vitest suite.

A phase is considered complete only after those checks pass.
