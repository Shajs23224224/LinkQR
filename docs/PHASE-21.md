# LinkQR — Phase 21: Observability and operation

## Objective

Make the backend diagnosable in production without exposing credentials, session tokens, QR payloads or other sensitive data.

## Implemented

### Backend logging

- Fastify/Pino JSON logging remains enabled.
- Every HTTP request receives a correlation/request ID.
- `X-Request-ID` is returned on responses.
- Slow requests are logged with route, status and duration.
- Logs use only route metadata and low-cardinality diagnostic fields; request/response bodies are not logged.

### Metrics

The backend exposes Prometheus-compatible metrics through `GET /metrics`.

The endpoint is disabled unless `LINKQR_OBSERVABILITY_TOKEN` is configured and requires that bearer token.

Metrics include:

- HTTP request count by method/route/status.
- HTTP request latency histogram.
- HTTP error count.
- Authentication request/error counters.
- Sync push/delta request counters.
- Sync conflict and quota rejection counters.
- Billing verification/error counters.
- Readiness and database health gauges.
- Process uptime.

Metrics are held in memory and reset when the process restarts. An external Prometheus/OTel collector can scrape the endpoint without requiring a new application dependency.

### Health and readiness

- `GET /health` is a liveness endpoint.
- `GET /ready` performs the configured database health check.
- Readiness returns HTTP 503 when the database is unavailable.
- Readiness and database health are reflected in metrics.

### Database diagnostics

All backend stores expose a lightweight `SELECT 1` health check so production readiness can validate the actual SQLite connection.

### Android sync diagnostics

- The sync worker records a bounded local diagnostic history.
- Entries contain timestamp, sync state, attempt count, counts for pushed/pulled/conflicts, cursor and a low-cardinality error code.
- The history never stores authentication tokens, passwords, QR payloads or network request bodies.
- Entries are capped to the most recent 20 events.

## Configuration

```env
LINKQR_OBSERVABILITY_TOKEN=<32+ character secret>
```

Leave empty to disable the `/metrics` endpoint.

## Validation

Phase 21 is complete when:

1. Backend tests pass.
2. Backend TypeScript build passes.
3. Android unit tests pass.
4. `/ready` fails closed when the configured database health check fails.
5. `/metrics` requires the configured observability token.
6. Request IDs are present on responses.
7. Metrics include HTTP latency/errors and auth/sync/billing domain counters.
8. Android sync diagnostics contain no secret or QR payload fields.
9. GitHub Actions is green on the final commit.

## Deferred

- External alerting provider integration.
- Long-term metrics storage.
- Distributed tracing backend.
- Full OpenTelemetry exporter.
- Centralized remote collection of Android diagnostic history.
