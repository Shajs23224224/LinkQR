import test from "node:test";
import assert from "node:assert/strict";
import { queryHistoryRecords } from "../src/features/history/history-query.js";

const records = [
  { id: "older-url", content: "https://example.com/z", source: "generated", kind: "url", createdAt: "2026-01-01T12:00:00.000Z", favorite: false, tags: ["trabajo"] },
  { id: "newer-text", content: "Apuntes de clase", source: "scanned", kind: "text", createdAt: "2026-01-03T12:00:00.000Z", favorite: true, tags: ["estudio", "importante"] },
  { id: "middle-url", content: "https://example.com/a", source: "generated", kind: "url", createdAt: "2026-01-02T12:00:00.000Z", favorite: false, tags: [] },
  { id: "untagged-legacy", content: "Texto legado", source: "scanned", kind: "text", createdAt: "2026-01-02T10:00:00.000Z", favorite: false },
];

test("filters simultaneously by search, origin, kind and tag", () => {
  const result = queryHistoryRecords(records, { query: "example", source: "generated", kind: "url", tag: "trabajo" });
  assert.equal(result.invalidDateRange, false);
  assert.deepEqual(result.items.map((item) => item.id), ["older-url"]);
});

test("date range includes both local calendar endpoints", () => {
  const result = queryHistoryRecords(records, { dateFrom: "2026-01-02", dateTo: "2026-01-02", sort: "oldest" });
  assert.equal(result.invalidDateRange, false);
  assert.deepEqual(result.items.map((item) => item.id), ["untagged-legacy", "middle-url"]);
});

test("rejects malformed and reversed date ranges explicitly", () => {
  assert.equal(queryHistoryRecords(records, { dateFrom: "2026-02-30" }).invalidDateRange, true);
  const reversed = queryHistoryRecords(records, { dateFrom: "2026-01-04", dateTo: "2026-01-01" });
  assert.equal(reversed.invalidDateRange, true);
  assert.deepEqual(reversed.items, []);
});

test("supports chronological, alphabetical, favorite-first and tagged-first sorting", () => {
  assert.deepEqual(queryHistoryRecords(records, { sort: "newest" }).items.map((item) => item.id), ["newer-text", "middle-url", "untagged-legacy", "older-url"]);
  assert.deepEqual(queryHistoryRecords(records, { sort: "oldest" }).items.map((item) => item.id), ["older-url", "untagged-legacy", "middle-url", "newer-text"]);
  assert.deepEqual(queryHistoryRecords(records, { sort: "content-asc" }).items.map((item) => item.id), ["newer-text", "middle-url", "older-url", "untagged-legacy"]);
  assert.equal(queryHistoryRecords(records, { sort: "favorites-first" }).items[0].id, "newer-text");
  assert.equal(queryHistoryRecords(records, { sort: "tagged-first" }).items[0].id, "newer-text");
});

test("treats a legacy record without tags as untagged and defaults unknown sort values safely", () => {
  const legacy = queryHistoryRecords(records, { tag: "all", sort: "not-supported" });
  assert.equal(legacy.invalidDateRange, false);
  assert.ok(legacy.items.some((item) => item.id === "untagged-legacy"));
  assert.deepEqual(queryHistoryRecords(records, { tag: "missing-tag" }).items, []);
});
