# LinkQR — Phase 17: Tombstones and deterministic multi-device conflict resolution

Phase 17 turns the Phase 16 sync metadata into an actual synchronization protocol.

## Included

### Local Android state
- Deletions are logical tombstones (deletedAt) instead of hard local deletes.
- Tombstones stay in Room so they can be uploaded and propagated to other devices.
- Normal history/favorites queries hide tombstoned records.
- Each record has a monotonic version and stable deviceId.
- Favorite changes and deletions increment the record version.
- Legacy records receive a sync identity and device identity before upload.
- Room migration 3 → 4 adds version, deviceId, deletedAt and a unique syncId index.

### Cloud state
- SaaS QR records persist version, deviceId, deleted and deletedAt.
- Existing SQLite databases are migrated in place.
- Tombstoned rows do not consume the active workspace QR quota.
- Normal listing hides tombstones.
- Sync pulls can request includeDeleted=true to receive tombstones.

### Conflict resolution
The same deterministic ordering is used by Android and the backend:

1. Higher version wins.
2. For equal versions from different devices, lexicographically higher deviceId wins.
3. If the device identity is also equal, higher updatedAt wins.

This avoids relying on wall-clock time to decide between concurrent edits on different devices.

When the cloud rejects a stale mutation, the API returns 409 SYNC_CONFLICT plus the winning record. The Android sync engine applies that winner locally.

### Android cloud sync
- Added an authenticated SaaSSyncClient using the user's Bearer session.
- Added a QrSyncEngine that:
  - uploads pending local records;
  - applies conflict winners;
  - pulls cloud records including tombstones;
  - converges local state to the deterministic winner.
- Network I/O is executed on Dispatchers.IO.
- Android requests require the INTERNET permission.
- The authenticated account flow finds the user's first workspace or creates a FREE LinkQR workspace, then runs sync when the session becomes active.

## Conflict semantics

This phase uses deterministic per-record revision ordering rather than vector clocks.

That means concurrent edits with the same logical revision converge to one winner, while every accepted winner becomes the base for the next local revision.

Tombstones participate in the same conflict ordering as live records, so a stale edit cannot resurrect a deleted QR record.

## Validation

CI is defined in .github/workflows/linkqr-validation.yml.

Required checks:

- Android unit tests.
- Android debug build.
- Backend Vitest suite.
- Backend TypeScript build.

The CI workflow is authoritative for build validation in environments with network access.

## Deferred work

Still intentionally deferred:
- vector clocks / full causal history;
- tombstone garbage collection after all devices acknowledge deletion;
- delta sync cursors/change feed for very large workspaces;
- periodic/background sync scheduling independent of the authentication lifecycle/UI (current implementation syncs when an authenticated session becomes active).

These are separate scaling/operational concerns and should not be implemented by deleting tombstones prematurely.
