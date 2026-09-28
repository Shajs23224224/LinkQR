import { timingSafeEqual } from "node:crypto";

export type MetricLabels = Record<string, string | number | boolean>;

type MetricEntry = {
  name: string;
  labels: Record<string, string>;
  value: number;
};

type HistogramEntry = {
  name: string;
  labels: Record<string, string>;
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
};

const DEFAULT_LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function normalizeLabels(labels: MetricLabels): Record<string, string> {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)])
  );
}

function metricKey(name: string, labels: Record<string, string>): string {
  return name + JSON.stringify(labels);
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";
  return "{" + entries.map(([key, value]) => key + '="' + escapeLabelValue(value) + '"').join(",") + "}";
}

export class ObservabilityMetrics {
  readonly startedAt = Date.now();
  private readonly counters = new Map<string, MetricEntry>();
  private readonly gauges = new Map<string, MetricEntry>();
  private readonly histograms = new Map<string, HistogramEntry>();

  incCounter(name: string, labels: MetricLabels = {}, value = 1): void {
    const normalized = normalizeLabels(labels);
    const key = metricKey(name, normalized);
    const current = this.counters.get(key);

    if (current) {
      current.value += value;
      return;
    }

    this.counters.set(key, { name, labels: normalized, value });
  }

  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const normalized = normalizeLabels(labels);
    this.gauges.set(metricKey(name, normalized), { name, labels: normalized, value });
  }

  observeHistogram(
    name: string,
    valueSeconds: number,
    labels: MetricLabels = {},
    buckets = DEFAULT_LATENCY_BUCKETS
  ): void {
    const normalized = normalizeLabels(labels);
    const key = metricKey(name, normalized);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        name,
        labels: normalized,
        buckets: [...buckets],
        counts: buckets.map(() => 0),
        sum: 0,
        count: 0
      };
      this.histograms.set(key, histogram);
    }

    histogram.count += 1;
    histogram.sum += valueSeconds;

    histogram.buckets.forEach((bucket, index) => {
      if (valueSeconds <= bucket) histogram.counts[index] += 1;
    });
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    const types = new Set<string>();

    const addType = (name: string, type: string) => {
      if (types.has(name)) return;
      lines.push("# TYPE " + name + " " + type);
      types.add(name);
    };

    addType("linkqr_process_uptime_seconds", "gauge");
    lines.push("linkqr_process_uptime_seconds " + String((Date.now() - this.startedAt) / 1000));

    for (const metric of this.counters.values()) {
      addType(metric.name, "counter");
      lines.push(metric.name + formatLabels(metric.labels) + " " + String(metric.value));
    }

    for (const metric of this.gauges.values()) {
      addType(metric.name, "gauge");
      lines.push(metric.name + formatLabels(metric.labels) + " " + String(metric.value));
    }

    for (const histogram of this.histograms.values()) {
      addType(histogram.name, "histogram");
      histogram.buckets.forEach((bucket, index) => {
        lines.push(
          histogram.name +
            "_bucket" +
            formatLabels({ ...histogram.labels, le: String(bucket) }) +
            " " +
            String(histogram.counts[index])
        );
      });
      lines.push(
        histogram.name +
          "_bucket" +
          formatLabels({ ...histogram.labels, le: "+Inf" }) +
          " " +
          String(histogram.count)
      );
      lines.push(histogram.name + "_sum" + formatLabels(histogram.labels) + " " + String(histogram.sum));
      lines.push(histogram.name + "_count" + formatLabels(histogram.labels) + " " + String(histogram.count));
    }

    return lines.join("\n") + "\n";
  }
}

export function isBearerTokenAuthorized(
  providedToken: string | null,
  expectedToken: string | undefined
): boolean {
  if (!providedToken || !expectedToken) return false;

  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
