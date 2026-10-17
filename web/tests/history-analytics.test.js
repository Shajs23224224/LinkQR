import test from "node:test";
import assert from "node:assert/strict";
import { summarizeHistory } from "../src/features/history/history-analytics.js";

const today = new Date(2026, 0, 7, 12);
const atDay = (day, hour = 12) => new Date(2026, 0, day, hour).toISOString();
const sample = [
  { id: "a", source: "generated", kind: "url", content: "https://example.com", createdAt: atDay(7, 9), favorite: true, tags: ["trabajo", "personal"] },
  { id: "b", source: "scanned", kind: "text", content: "Apuntes", createdAt: atDay(6, 16), favorite: false, tags: ["estudio", "personal"] },
  { id: "c", source: "generated", kind: "text", content: "Compartir", createdAt: atDay(1, 8), favorite: true, tags: ["trabajo"] },
  { id: "d", source: "scanned", kind: "url", content: "https://example.org", createdAt: atDay(20), favorite: false },
];

test("counts records by source, content type, favorites and tag coverage", () => {
  const stats = summarizeHistory(sample, { now: today });
  assert.equal(stats.total, 4);
  assert.equal(stats.generated, 2);
  assert.equal(stats.scanned, 2);
  assert.equal(stats.urls, 2);
  assert.equal(stats.texts, 2);
  assert.equal(stats.favorites, 2);
  assert.equal(stats.favoriteRate, 50);
  assert.equal(stats.tagged, 3);
  assert.equal(stats.untagged, 1);
  assert.equal(stats.distinctTagCount, 3);
});

test("returns the last seven local calendar days including today", () => {
  const stats = summarizeHistory(sample, { now: today });
  assert.equal(stats.activity.length, 7);
  assert.equal(stats.activity[0].date, "2026-01-01");
  assert.equal(stats.activity[6].date, "2026-01-07");
  assert.equal(stats.activity[6].count, 1);
  assert.equal(stats.activity[5].count, 1);
  assert.equal(stats.activity.reduce((sum, day) => sum + day.count, 0), 3);
  assert.equal(stats.maxDailyActivity, 1);
});

test("ranks tags by records containing them and breaks ties alphabetically", () => {
  const stats = summarizeHistory(sample, { now: today });
  assert.deepEqual(stats.topTags, [
    { tag: "personal", count: 2 },
    { tag: "trabajo", count: 2 },
    { tag: "estudio", count: 1 },
  ]);
});

test("handles empty history and non-array inputs without division errors", () => {
  const stats = summarizeHistory([], { now: today });
  assert.equal(stats.total, 0);
  assert.equal(stats.favoriteRate, 0);
  assert.equal(stats.topTags.length, 0);
  assert.equal(stats.activity.length, 7);
  assert.equal(stats.maxDailyActivity, 0);
  assert.equal(summarizeHistory(null, { now: today }).total, 0);
});

test("ignores repeated tags within a record and records with invalid timestamps for activity", () => {
  const stats = summarizeHistory([
    { id: "a", source: "generated", kind: "text", favorite: false, tags: ["demo", "demo"], createdAt: "invalid" },
  ], { now: today });
  assert.equal(stats.distinctTagCount, 1);
  assert.deepEqual(stats.topTags, [{ tag: "demo", count: 1 }]);
  assert.equal(stats.activity.reduce((sum, day) => sum + day.count, 0), 0);
});
