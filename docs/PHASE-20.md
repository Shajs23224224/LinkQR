# LinkQR — Phase 20: Resilient background synchronization

## Objective

Move synchronization outside the authenticated screen lifecycle and make it resilient to network interruptions, process restarts and incremental cloud changes.

## Implemented

### Android background execution

- WorkManager schedules synchronization with `NetworkType.CONNECTED`.
- A periodic sync runs every hour.
- Authenticated UI events enqueue a unique immediate sync without performing network I/O on the main thread.
- Immediate work uses exponential backoff starting at 30 seconds.
- Periodic work and immediate work are guarded by an in-process mutex so they do not execute the sync engine concurrently.
- A worker returns explicit execution states:
  - `IDLE`
  - `SUCCESS`
  - `FAILED`
  - `AUTH_REQUIRED`

### Retry and failure policy

- Network I/O failures retry automatically.
- HTTP 408, 429 and 5xx responses retry with WorkManager backoff.
- HTTP 401 clears the local session token and finishes with `AUTH_REQUIRED` instead of looping.
- Other non-success HTTP responses fail without infinite retry.
- Retry attempts are bounded for one-time work.

### Incremental synchronization

- Room now persists one sync cursor per workspace.
- Cloud sync uses a monotonic server-side change sequence.
- The backend stores a change log for accepted QR revisions.
- Existing QR records are backfilled into the change log during store initialization so new clients can bootstrap from cursor `0`.
- The delta endpoint returns:
  - current cursor;
  - next cursor;
  - `hasMore`;
  - current record states, including tombstones.
- Android advances the cursor only after applying the returned batch.
- A crash after applying a batch but before cursor persistence is safe because replaying a delta is idempotent at the record-version layer.

### Tombstones and conflicts

- Phase 17 version/deviceId ordering remains authoritative.
- Deleted records continue to travel through the delta feed.
- A stale client cannot resurrect a tombstoned record because the same deterministic conflict comparison is used.
- Exact duplicate mutations no longer create additional cloud change-log entries.

### Batching

- Local pending mutations are pushed in batches of 50 records.
- Delta pulls are limited to 50 records per page.
- The backend caps requested delta page size at 100.

## API

Existing full listing remains available for compatibility:

- `GET /v1/saas/workspaces/:workspaceId/qr`

New incremental form:

- `GET /v1/saas/workspaces/:workspaceId/qr?cursor=<n>&limit=<1..100>`

Response contains:

```json
{
  "workspaceId": "...",
  "cursor": 0,
  "nextCursor": 50,
  "hasMore": true,
  "records": []
}
```

The cursor feed always carries tombstones so deletions cannot be skipped by a client.

## Room migration

Database version 4 → 5 adds:

- `sync_state(workspaceId, cursor)`

The migration is explicit and preserves all existing QR data.

## Validation

Phase 20 adds coverage for:

- cursor persistence after a remote batch;
- incremental cloud pagination;
- monotonic cursor advancement;
- existing tombstone/conflict behavior.

The authoritative build gate remains GitHub Actions:

- Android unit tests;
- Android debug build;
- Android release build;
- backend Vitest suite;
- backend TypeScript build.

## Deferred

Still deferred by design:

- multi-device acknowledgement based tombstone garbage collection;
- vector clocks/full causal history;
- distributed locks across multiple backend instances;
- distributed rate limiting and full API idempotency keys from Phase 23;
- server-side PRO entitlement redesign;
- observability from Phase 21.
