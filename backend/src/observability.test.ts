import { describe, expect, it } from "vitest";
import {
  isBearerTokenAuthorized,
  ObservabilityMetrics
} from "./observability.js";

describe("Observability metrics", () => {
  it("renders counters, gauges and latency histograms", () => {
    const metrics = new ObservabilityMetrics();

    metrics.incCounter("linkqr_http_requests_total", {
      method: "GET",
      route: "/health",
      status: 200
    });
    metrics.setGauge("linkqr_readiness", 1);
    metrics.observeHistogram(
      "linkqr_http_request_duration_seconds",
      0.04,
      { method: "GET", route: "/health" }
    );

    const output = metrics.renderPrometheus();

    expect(output).toContain("# TYPE linkqr_http_requests_total counter");
    expect(output).toContain('linkqr_http_requests_total{method="GET",route="/health",status="200"} 1');
    expect(output).toContain("linkqr_readiness 1");
    expect(output).toContain('linkqr_http_request_duration_seconds_bucket{le="0.05",method="GET",route="/health"} 1');
    expect(output).toContain("linkqr_http_request_duration_seconds_count");
  });

  it("compares observability bearer tokens without accepting different lengths", () => {
    const token = "x".repeat(32);

    expect(isBearerTokenAuthorized(token, token)).toBe(true);
    expect(isBearerTokenAuthorized("y".repeat(31), token)).toBe(false);
    expect(isBearerTokenAuthorized(null, token)).toBe(false);
  });
});
