# LinkQR — Phase 22: Storage scalability

## Objective

Prepare persistence for growth without coupling the application and domain logic to SQLite.

## Implemented

### Repository ports

- Added explicit persistence contracts in `backend/src/repositoryPorts.ts`.
- Authentication, SaaS synchronization and purchases now depend on repository contracts at the HTTP/application boundary.
- Existing SQLite stores remain adapters for the current persistence engine.
- Replacing SQLite with PostgreSQL later can be implemented behind the same ports.

### SQLite baseline

- Centralized SQLite connection configuration.
- WAL mode remains enabled for file databases.
- Foreign-key enforcement is enabled.
- Busy timeout is configured to tolerate short write contention.
- `synchronous=NORMAL` and in-memory temp storage are used for the current server workload.
- SQLite optimization is requested after schema/index initialization.

### Indexing

Added workload-oriented indexes for:

- Active/expiring authentication sessions.
- Email verification and password reset token lookup.
- Purchase lookup by user and verification time.
- Workspace QR active-record listing.
- Incremental sync change-log lookup by workspace/record/sequence.

Existing primary keys and sync indexes remain intact.

### Online backups

- Added a SQLite online backup manager using the database backup API.
- Backups are written to a configurable directory.
- The server performs one startup backup and then repeats at the configured interval.
- Backup failures are logged as low-cardinality operational events and do not mutate request behavior.
- In-memory databases are explicitly rejected by the backup manager.

## Configuration

Optional environment variables:

```env
DATABASE_BACKUP_DIR=
DATABASE_BACKUP_INTERVAL_HOURS=24
```

Backups are enabled only when both a destination directory is configured and the interval is greater than zero.

## Validation

Phase 22 is complete when:

1. Application routes compile against persistence contracts rather than concrete SQLite store types.
2. SQLite configuration is centralized.
3. Workload-specific indexes are created idempotently.
4. An online backup can be created and reopened successfully.
5. Backup scheduling is configurable and disabled by default when no destination is supplied.
6. Existing authentication, billing and sync tests remain green.
7. GitHub Actions is green on the final commit.

## Deferred

- PostgreSQL implementation.
- Database connection pooling for PostgreSQL.
- Automated backup retention and deletion policy.
- Point-in-time recovery.
- Dual-read or dual-write migration.
- Load-test-driven engine migration criteria.
